import {
  AssessmentInstrument,
  AssessmentRecord,
  PsychologicalIndexMetric,
  PsychologicalIndexPoint,
  PsychologicalIndexSuite,
  RelationshipNode,
  WellbeingCheckIn,
} from '../types/humanos';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toIndex100(score5: number): number {
  return Math.round(clamp(((score5 - 1) / 4) * 100, 0, 100));
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((acc, n) => acc + n, 0) / nums.length;
}

function stdDev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const mean = avg(nums);
  const variance = avg(nums.map((n) => (n - mean) ** 2));
  return Math.sqrt(variance);
}

function formatDateLabel(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return 'Entry';
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatDelta(series: PsychologicalIndexPoint[]): string {
  if (series.length < 2) return series.length === 1 ? 'Baseline reading' : 'Awaiting entries';
  const latest = series[series.length - 1].score;
  const priorAvg = avg(series.slice(0, -1).map((p) => p.score));
  const diff = Math.round(latest - priorAvg);
  if (Math.abs(diff) < 2) return 'Steady vs prior';
  return `${diff > 0 ? '+' : ''}${diff} pts vs prior`;
}

function latestAssessment5(
  assessments: AssessmentRecord[],
  instrument: AssessmentInstrument
): number | null {
  const matched = assessments.find((a) => a.instrument === instrument);
  if (!matched) return null;
  return clamp(1 + (matched.compositeScore / 100) * 4, 1, 5);
}

function blendScore5(checkIn5: number | null, assessment5: number | null): number {
  if (checkIn5 !== null && assessment5 !== null) {
    return checkIn5 * 0.78 + assessment5 * 0.22;
  }
  if (checkIn5 !== null) return checkIn5;
  if (assessment5 !== null) return assessment5;
  return 3;
}

function protectiveStatus(score: number, domainLabels?: [string, string, string]): string {
  const [high, mid, low] = domainLabels ?? ['Grounded', 'Moderate', 'Needs care'];
  if (score >= 68) return high;
  if (score >= 42) return mid;
  return low;
}

function strainStatus(score: number, calmLabel = 'Calm / Low'): string {
  if (score >= 65) return 'Elevated strain';
  if (score >= 40) return 'Watchful load';
  return calmLabel;
}

export function computePsychologicalIndices(input: {
  wellbeingCheckIns: WellbeingCheckIn[];
  assessments?: AssessmentRecord[];
  relationships?: RelationshipNode[];
  retentionDays?: number;
}): PsychologicalIndexSuite {
  const retentionDays = clamp(Math.round(input.retentionDays ?? 90), 30, 90);
  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  const activeCheckIns = [...input.wellbeingCheckIns]
    .filter((w) => {
      const ms = Date.parse(w.createdAt);
      return !Number.isFinite(ms) || ms >= cutoffMs;
    })
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .slice(-24);

  const activeAssessments = [...(input.assessments ?? [])]
    .filter((a) => {
      const ms = Date.parse(a.createdAt);
      return !Number.isFinite(ms) || ms >= cutoffMs;
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const relationships = input.relationships ?? [];

  const hasCheckIns = activeCheckIns.length > 0;

  // Assessment signals mapped cleanly onto 1.0–5.0 scale
  const moodAssessRaw = latestAssessment5(activeAssessments, 'Mood & Depression Strain');
  const moodAssess5 = moodAssessRaw !== null ? clamp(6 - moodAssessRaw, 1, 5) : null;
  const anxAssess5 = latestAssessment5(activeAssessments, 'Anxiety Pattern');
  const burnoutAssess5 = latestAssessment5(activeAssessments, 'Burnout Screen');
  const resilienceAssess5 = latestAssessment5(activeAssessments, 'Resilience Check');
  const esteemAssess5 = latestAssessment5(activeAssessments, 'Self-Esteem Reflection');
  const valuesAssess5 = latestAssessment5(activeAssessments, 'Values Alignment');

  const relCloseness5 =
    relationships.length > 0 ? avg(relationships.map((r) => r.closeness)) : null;

  // 1. Mood Index
  const moodCheck5 = hasCheckIns ? avg(activeCheckIns.map((w) => w.mood)) : null;
  const mood5 = blendScore5(moodCheck5, moodAssess5);
  const moodScore = toIndex100(mood5);
  const moodSeries: PsychologicalIndexPoint[] = activeCheckIns.map((w) => ({
    id: w.id,
    label: formatDateLabel(w.createdAt),
    score: toIndex100(w.mood),
  }));
  const moodHasData = moodCheck5 !== null || moodAssess5 !== null;

  // 2. Anxiety Index (strain load)
  const anxCheck5 = hasCheckIns ? avg(activeCheckIns.map((w) => w.anxiety)) : null;
  const anx5 = blendScore5(anxCheck5, anxAssess5);
  const anxScore = toIndex100(anx5);
  const anxSeries: PsychologicalIndexPoint[] = activeCheckIns.map((w) => ({
    id: w.id,
    label: formatDateLabel(w.createdAt),
    score: toIndex100(w.anxiety),
  }));
  const anxHasData = anxCheck5 !== null || anxAssess5 !== null;

  // 3. Burnout Index (strain load)
  const burnoutPoint5 = (w: WellbeingCheckIn) =>
    (w.stress + (6 - w.energy) + (6 - w.motivation)) / 3;
  const burnoutCheck5 = hasCheckIns ? avg(activeCheckIns.map(burnoutPoint5)) : null;
  const burnout5 = blendScore5(burnoutCheck5, burnoutAssess5);
  const burnoutScore = toIndex100(burnout5);
  const burnoutSeries: PsychologicalIndexPoint[] = activeCheckIns.map((w) => ({
    id: w.id,
    label: formatDateLabel(w.createdAt),
    score: toIndex100(burnoutPoint5(w)),
  }));
  const burnoutHasData = burnoutCheck5 !== null || burnoutAssess5 !== null;

  // 4. Resilience Index
  const resiliencePoint5 = (w: WellbeingCheckIn) =>
    (w.mood + w.selfEsteem + w.socialConnection + w.energy) / 4;
  const resilienceCheck5 = hasCheckIns ? avg(activeCheckIns.map(resiliencePoint5)) : null;
  const resilience5 = blendScore5(resilienceCheck5, resilienceAssess5);
  const resilienceScore = toIndex100(resilience5);
  const resilienceSeries: PsychologicalIndexPoint[] = activeCheckIns.map((w) => ({
    id: w.id,
    label: formatDateLabel(w.createdAt),
    score: toIndex100(resiliencePoint5(w)),
  }));
  const resilienceHasData = resilienceCheck5 !== null || resilienceAssess5 !== null;

  // 5. Social Connection Index
  const connCheck5 = hasCheckIns ? avg(activeCheckIns.map((w) => w.socialConnection)) : null;
  const conn5 =
    connCheck5 !== null && relCloseness5 !== null
      ? connCheck5 * 0.8 + relCloseness5 * 0.2
      : connCheck5 ?? relCloseness5 ?? 3;
  const connScore = toIndex100(conn5);
  const connSeries: PsychologicalIndexPoint[] = activeCheckIns.map((w) => ({
    id: w.id,
    label: formatDateLabel(w.createdAt),
    score: toIndex100(w.socialConnection),
  }));
  const connHasData = connCheck5 !== null || relCloseness5 !== null;

  // 6. Self-Esteem Index
  const esteemCheck5 = hasCheckIns ? avg(activeCheckIns.map((w) => w.selfEsteem)) : null;
  const esteem5 = blendScore5(esteemCheck5, esteemAssess5);
  const esteemScore = toIndex100(esteem5);
  const esteemSeries: PsychologicalIndexPoint[] = activeCheckIns.map((w) => ({
    id: w.id,
    label: formatDateLabel(w.createdAt),
    score: toIndex100(w.selfEsteem),
  }));
  const esteemHasData = esteemCheck5 !== null || esteemAssess5 !== null;

  // 7. Life Satisfaction Index
  const satCheck5 = hasCheckIns ? avg(activeCheckIns.map((w) => w.lifeSatisfaction)) : null;
  const sat5 = blendScore5(satCheck5, valuesAssess5);
  const satScore = toIndex100(sat5);
  const satSeries: PsychologicalIndexPoint[] = activeCheckIns.map((w) => ({
    id: w.id,
    label: formatDateLabel(w.createdAt),
    score: toIndex100(w.lifeSatisfaction),
  }));
  const satHasData = satCheck5 !== null || valuesAssess5 !== null;

  // 8. Emotional Stability Index
  // Combines affective composure ((6 - stress) + (6 - anxiety) + mood)/3 with volatility penalty from mood/stress spread.
  const composurePoint5 = (w: WellbeingCheckIn) =>
    ((6 - w.stress) + (6 - w.anxiety) + w.mood) / 3;
  let stabilityScore = 50;
  let stability5 = 3;
  let stabilitySeries: PsychologicalIndexPoint[] = [];
  let stabilityVolatility = 0;

  if (hasCheckIns) {
    const moodSpread = stdDev(activeCheckIns.map((w) => w.mood));
    const stressSpread = stdDev(activeCheckIns.map((w) => w.stress));
    const anxSpread = stdDev(activeCheckIns.map((w) => w.anxiety));
    stabilityVolatility = (moodSpread + stressSpread + anxSpread) / 3;
    const volatilityPenalty = Math.min(25, Math.round(stabilityVolatility * 15));
    const avgComposure5 = avg(activeCheckIns.map(composurePoint5));
    stabilityScore = clamp(toIndex100(avgComposure5) - volatilityPenalty, 0, 100);
    stability5 = Number(clamp(1 + (stabilityScore / 100) * 4, 1, 5).toFixed(2));

    stabilitySeries = activeCheckIns.map((w, idx) => {
      const windowSlice = activeCheckIns.slice(Math.max(0, idx - 3), idx + 1);
      const localVol =
        windowSlice.length >= 2
          ? (stdDev(windowSlice.map((p) => p.mood)) +
              stdDev(windowSlice.map((p) => p.stress))) /
            2
          : 0;
      const localPenalty = Math.min(25, Math.round(localVol * 15));
      return {
        id: w.id,
        label: formatDateLabel(w.createdAt),
        score: clamp(toIndex100(composurePoint5(w)) - localPenalty, 0, 100),
      };
    });
  } else if (anxAssess5 !== null || moodAssess5 !== null) {
    const fallback5 =
      anxAssess5 !== null && moodAssess5 !== null
        ? (moodAssess5 + (6 - anxAssess5)) / 2
        : moodAssess5 ?? clamp(6 - (anxAssess5 ?? 3), 1, 5);
    stability5 = fallback5;
    stabilityScore = toIndex100(fallback5);
  }
  const stabilityHasData = hasCheckIns || anxAssess5 !== null || moodAssess5 !== null;

  const indices: PsychologicalIndexMetric[] = [
    {
      key: 'mood',
      label: 'Mood Index',
      polarity: 'protective',
      score: moodScore,
      scale5: Number(mood5.toFixed(1)),
      status: moodHasData ? protectiveStatus(moodScore, ['Steady / Bright', 'Moderate', 'Low mood strain']) : 'No data',
      deltaText: formatDelta(moodSeries),
      formulaNote:
        moodAssess5 !== null
          ? 'Check-in Mood (78%) + inverted Mood & Depression Strain assessment (22%)'
          : 'Mean Mood ratings over active retention window',
      interpretation:
        moodScore >= 68
          ? 'Affective tone appears generally buoyant or steady across recent logs.'
          : moodScore >= 42
            ? 'Mood fluctuates around a moderate baseline; watch sleep and rest buffers.'
            : 'Mood appears weighed down recently—gentle support and pacing may help.',
      series: moodSeries,
      hasData: moodHasData,
    },
    {
      key: 'anxiety',
      label: 'Anxiety Index',
      polarity: 'strain',
      score: anxScore,
      scale5: Number(anx5.toFixed(1)),
      status: anxHasData ? strainStatus(anxScore, 'Calm / Settled') : 'No data',
      deltaText: formatDelta(anxSeries),
      formulaNote:
        anxAssess5 !== null
          ? 'Check-in Anxiety (78%) + Anxiety Pattern assessment (22%)'
          : 'Mean Anxiety ratings over active retention window',
      interpretation:
        anxScore >= 65
          ? 'Anticipatory tension or hyper-vigilance appears elevated; grounding before decisions may help.'
          : anxScore >= 40
            ? 'Moderate alertness or occasional worry loops present.'
            : 'Anxiety load appears low and settled across recent reflections.',
      series: anxSeries,
      hasData: anxHasData,
    },
    {
      key: 'burnout',
      label: 'Burnout Index',
      polarity: 'strain',
      score: burnoutScore,
      scale5: Number(burnout5.toFixed(1)),
      status: burnoutHasData ? strainStatus(burnoutScore, 'Sustainable') : 'No data',
      deltaText: formatDelta(burnoutSeries),
      formulaNote:
        burnoutAssess5 !== null
          ? '(Stress + inverted Energy + inverted Motivation)/3 blended with Burnout Screen'
          : 'Composite of Stress load, depleted Energy, and lowered Motivation',
      interpretation:
        burnoutScore >= 65
          ? 'Recovery bandwidth looks strained relative to demand; consider reducing non-essential load.'
          : burnoutScore >= 40
            ? 'Watchful fatigue signals appearing alongside ongoing responsibilities.'
            : 'Output and energy recovery appear reasonably balanced.',
      series: burnoutSeries,
      hasData: burnoutHasData,
    },
    {
      key: 'resilience',
      label: 'Resilience Index',
      polarity: 'protective',
      score: resilienceScore,
      scale5: Number(resilience5.toFixed(1)),
      status: resilienceHasData ? protectiveStatus(resilienceScore, ['Grounded', 'Moderate', 'Needs care']) : 'No data',
      deltaText: formatDelta(resilienceSeries),
      formulaNote:
        resilienceAssess5 !== null
          ? '(Mood + Self-Esteem + Connection + Energy)/4 blended with Resilience Check'
          : 'Composite of Mood, Self-Esteem, Social Connection, and Energy',
      interpretation:
        resilienceScore >= 68
          ? 'Protective buffers across esteem, energy, and connection appear sturdy.'
          : resilienceScore >= 42
            ? 'Moderate recovery capacity; lean on one steady daily anchor.'
            : 'Protective resources appear thin right now—prioritize basic restoration.',
      series: resilienceSeries,
      hasData: resilienceHasData,
    },
    {
      key: 'social-connection',
      label: 'Social Connection Index',
      polarity: 'protective',
      score: connScore,
      scale5: Number(conn5.toFixed(1)),
      status: connHasData ? protectiveStatus(connScore, ['Connected', 'Moderate', 'Isolated strain']) : 'No data',
      deltaText: formatDelta(connSeries),
      formulaNote:
        relCloseness5 !== null
          ? `Check-in Social Connection + ${relationships.length} mapped Relationship Graph closeness score(s)`
          : 'Mean Social Connection check-ins over active retention window',
      interpretation:
        connScore >= 68
          ? 'Sense of relational belonging and supportive contact appears strong.'
          : connScore >= 42
            ? 'Selective connection; meaningful outreach could replenish support.'
            : 'Interpersonal isolation may be adding weight—consider one low-pressure check-in.',
      series: connSeries,
      hasData: connHasData,
    },
    {
      key: 'self-esteem',
      label: 'Self-Esteem Index',
      polarity: 'protective',
      score: esteemScore,
      scale5: Number(esteem5.toFixed(1)),
      status: esteemHasData ? protectiveStatus(esteemScore, ['Grounded worth', 'Moderate', 'Self-critical load']) : 'No data',
      deltaText: formatDelta(esteemSeries),
      formulaNote:
        esteemAssess5 !== null
          ? 'Check-in Self-Esteem (78%) + Self-Esteem Reflection assessment (22%)'
          : 'Mean Self-Esteem check-ins over active retention window',
      interpretation:
        esteemScore >= 68
          ? 'Self-regard appears fair and resilient against isolated setbacks.'
          : esteemScore >= 42
            ? 'Self-worth varies somewhat with recent performance or feedback.'
            : 'Inner critic activity may feel loud right now; separate worth from single outcomes.',
      series: esteemSeries,
      hasData: esteemHasData,
    },
    {
      key: 'life-satisfaction',
      label: 'Life Satisfaction Index',
      polarity: 'protective',
      score: satScore,
      scale5: Number(sat5.toFixed(1)),
      status: satHasData ? protectiveStatus(satScore, ['Aligned', 'Moderate', 'Discontent load']) : 'No data',
      deltaText: formatDelta(satSeries),
      formulaNote:
        valuesAssess5 !== null
          ? 'Check-in Life Satisfaction (78%) + Values Alignment assessment (22%)'
          : 'Mean Life Satisfaction ratings over active retention window',
      interpretation:
        satScore >= 68
          ? 'Daily choices appear meaningfully aligned with personal values and direction.'
          : satScore >= 42
            ? 'Mixed alignment—some chapters feel meaningful while others feel frictional.'
            : 'Noticeable gap between current routine and what matters most to you.',
      series: satSeries,
      hasData: satHasData,
    },
    {
      key: 'emotional-stability',
      label: 'Emotional Stability Index',
      polarity: 'protective',
      score: stabilityScore,
      scale5: Number(stability5.toFixed(1)),
      status: stabilityHasData ? protectiveStatus(stabilityScore, ['Steady', 'Variable', 'Volatile load']) : 'No data',
      deltaText:
        activeCheckIns.length >= 2
          ? `Spread σ=${stabilityVolatility.toFixed(2)}`
          : formatDelta(stabilitySeries),
      formulaNote:
        activeCheckIns.length >= 2
          ? 'Affective composure (calm stress, low anxiety, mood) minus mood/stress volatility penalty'
          : 'Affective composure baseline across calm stress, anxiety, and mood',
      interpretation:
        stabilityScore >= 68
          ? 'Emotional shifts appear well-contained without sharp swing amplification.'
          : stabilityScore >= 42
            ? 'Some emotional oscillation visible; pause tools and sleep consistency help stabilize.'
            : 'Heightened emotional reactivity or swings observed across recent logs.',
      series: stabilitySeries,
      hasData: stabilityHasData,
    },
  ];

  const activeIndices = indices.filter((i) => i.hasData);
  const overallEquilibrium =
    activeIndices.length > 0
      ? Math.round(
          avg(
            activeIndices.map((idx) =>
              idx.polarity === 'strain' ? 100 - idx.score : idx.score
            )
          )
        )
      : 50;

  return {
    indices,
    sampleCount: activeCheckIns.length,
    assessmentCount: activeAssessments.length,
    relationshipCount: relationships.length,
    overallEquilibrium,
    retentionDays,
  };
}

export function formatPsychologicalIndicesSummary(suite: PsychologicalIndexSuite): string {
  const populated = suite.indices.filter((i) => i.hasData);
  if (populated.length === 0) return '';
  const lines = populated.map(
    (i) => `- ${i.label}: ${i.score}/100 (${i.scale5}/5 · ${i.status})`
  );
  return `Quantitative Psychological & Wellbeing Indices (${suite.retentionDays}d window, Equilibrium ${suite.overallEquilibrium}/100):\n${lines.join('\n')}`;
}
