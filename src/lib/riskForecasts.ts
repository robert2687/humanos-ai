import {
  AssessmentRecord,
  EventAnalysisRecord,
  PsychologicalIndexSuite,
  ReflectionSession,
  RelationshipAreaInsight,
  RelationshipNode,
  RiskForecastMetric,
  RiskForecastSuite,
  RiskTier,
  RiskTrend,
  WellbeingCheckIn,
} from '../types/humanos';

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function tierFor(probability: number): RiskTier {
  if (probability >= 65) return 'Elevated';
  if (probability >= 40) return 'Watchful';
  return 'Low';
}

function trendFromDelta(diff: number, hasSeries: boolean, invert = false): RiskTrend {
  if (!hasSeries) return 'Baseline';
  const effective = invert ? -diff : diff;
  if (effective >= 0.45) return 'Rising';
  if (effective <= -0.45) return 'Easing';
  return 'Steady';
}

export function computeRiskForecasts(input: {
  wellbeingCheckIns: WellbeingCheckIn[];
  assessments?: AssessmentRecord[];
  relationships?: RelationshipNode[];
  relationshipInsights?: RelationshipAreaInsight[];
  eventAnalyses?: EventAnalysisRecord[];
  sessions?: ReflectionSession[];
  indexSuite?: PsychologicalIndexSuite;
  retentionDays?: number;
}): RiskForecastSuite {
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
  const relationshipInsights = input.relationshipInsights ?? [];
  const activeEvents = [...(input.eventAnalyses ?? [])].filter((e) => {
    const ms = Date.parse(e.createdAt);
    return !Number.isFinite(ms) || ms >= cutoffMs;
  });
  const sessions = input.sessions ?? [];

  const hasCheckIns = activeCheckIns.length > 0;
  const hasMultiCheckIns = activeCheckIns.length >= 2;
  const splitIdx = Math.max(1, Math.floor(activeCheckIns.length / 2));
  const priorCheckIns = hasMultiCheckIns ? activeCheckIns.slice(0, splitIdx) : [];
  const recentCheckIns = hasMultiCheckIns ? activeCheckIns.slice(splitIdx) : activeCheckIns;

  const getIndexScore = (key: string, fallback: number) =>
    input.indexSuite?.indices.find((i) => i.key === key)?.score ?? fallback;

  const latestAssessment = (instrument: AssessmentRecord['instrument']) =>
    activeAssessments.find((a) => a.instrument === instrument)?.compositeScore ?? null;

  // 1. Burnout Risk
  const burnoutIdx = getIndexScore('burnout', 30);
  const burnoutAssess = latestAssessment('Burnout Screen');
  const avgSleepHours = hasCheckIns
    ? avg(activeCheckIns.map((w) => w.sleepHours ?? 7))
    : 7;
  const avgSleepQuality = hasCheckIns
    ? avg(activeCheckIns.map((w) => w.sleepQuality ?? 3))
    : 3;
  const sleepDeficitPenalty =
    avgSleepHours < 6.5 ? Math.min(18, Math.round((6.5 - avgSleepHours) * 10)) : 0;
  const poorSleepQualPenalty =
    avgSleepQuality < 3 ? Math.round((3 - avgSleepQuality) * 8) : 0;
  const burnoutHasData = hasCheckIns || burnoutAssess !== null;
  const burnoutRaw = burnoutHasData
    ? Math.round(
        clamp(
          burnoutIdx * 0.8 +
            sleepDeficitPenalty +
            poorSleepQualPenalty +
            (burnoutAssess !== null ? burnoutAssess * 0.2 : 0),
          0,
          100
        )
      )
    : 0;
  const recentBurnout5 = avg(
    recentCheckIns.map((w) => (w.stress + (6 - w.energy) + (6 - w.motivation)) / 3)
  );
  const priorBurnout5 = avg(
    priorCheckIns.map((w) => (w.stress + (6 - w.energy) + (6 - w.motivation)) / 3)
  );
  const burnoutDrivers: string[] = [];
  if (hasCheckIns) {
    burnoutDrivers.push(
      `Burnout Index ${burnoutIdx}/100 · Sleep avg ${avgSleepHours.toFixed(1)}h`
    );
  }
  if (burnoutAssess !== null) {
    burnoutDrivers.push(`Burnout Screen assessment scored ${burnoutAssess}/100`);
  }
  if (burnoutDrivers.length === 0) {
    burnoutDrivers.push('Awaiting wellbeing check-ins or Burnout Screen assessment');
  }

  // 2. Relationship Risk
  const relEvents = activeEvents.filter(
    (e) => e.contextCategory === 'Relationship' || e.contextCategory === 'Conflict & Anger'
  );
  const avgTension =
    relationships.length > 0 ? avg(relationships.map((r) => r.tension)) : 0;
  const avgCloseness =
    relationships.length > 0 ? avg(relationships.map((r) => r.closeness)) : 0;
  const avgConnCheck5 = hasCheckIns ? avg(activeCheckIns.map((w) => w.socialConnection)) : 3;
  const relHasData =
    relationships.length > 0 ||
    relEvents.length > 0 ||
    relationshipInsights.length > 0 ||
    hasCheckIns;

  let relRiskRaw = 0;
  if (relHasData) {
    const tensionScore =
      relationships.length > 0 ? ((avgTension - 1) / 4) * 65 : 22;
    const closenessGap =
      relationships.length > 0 && avgTension > avgCloseness
        ? (avgTension - avgCloseness) * 8
        : 0;
    const connectionDrag = hasCheckIns ? ((5 - avgConnCheck5) / 4) * 25 : 8;
    const eventLoad = Math.min(20, relEvents.length * 6 + relationshipInsights.length * 3);
    relRiskRaw = Math.round(clamp(tensionScore + closenessGap + connectionDrag + eventLoad, 0, 100));
  }
  const relDrivers: string[] = [];
  if (relationships.length > 0) {
    relDrivers.push(
      `${relationships.length} mapped dynamic(s): Tension ${avgTension.toFixed(1)}/5, Closeness ${avgCloseness.toFixed(1)}/5`
    );
  }
  if (relEvents.length > 0) {
    relDrivers.push(`${relEvents.length} recent Relationship/Conflict analysis record(s)`);
  }
  if (hasCheckIns && avgConnCheck5 <= 2.8) {
    relDrivers.push(`Social connection check-in avg ${avgConnCheck5.toFixed(1)}/5`);
  }
  if (relDrivers.length === 0) {
    relDrivers.push(
      relHasData
        ? `Social Connection avg ${avgConnCheck5.toFixed(1)}/5 with low relational friction`
        : 'Map dynamics in Relationship Graph or log check-ins to assess'
    );
  }

  // 3. Stress Escalation
  const anxAssess = latestAssessment('Anxiety Pattern');
  const recentStress5 = hasCheckIns ? avg(recentCheckIns.map((w) => w.stress)) : 0;
  const priorStress5 = hasMultiCheckIns ? avg(priorCheckIns.map((w) => w.stress)) : recentStress5;
  const stressVelocity = hasMultiCheckIns ? recentStress5 - priorStress5 : 0;
  const peakStress = hasCheckIns ? Math.max(...activeCheckIns.map((w) => w.stress)) : 0;
  const stressHasData = hasCheckIns || anxAssess !== null;
  let stressEscalationRaw = 0;
  if (stressHasData) {
    const baseStressPct = hasCheckIns ? ((recentStress5 - 1) / 4) * 60 : 25;
    const velocityPct = stressVelocity > 0 ? Math.min(25, stressVelocity * 18) : 0;
    const peakPct = peakStress >= 4 ? (peakStress - 3) * 8 : 0;
    const assessPct = anxAssess !== null ? anxAssess * 0.2 : 0;
    stressEscalationRaw = Math.round(
      clamp(baseStressPct + velocityPct + peakPct + assessPct, 0, 100)
    );
  }
  const stressDrivers: string[] = [];
  if (hasCheckIns) {
    stressDrivers.push(
      `Recent stress avg ${recentStress5.toFixed(1)}/5 (peak ${peakStress}/5)`
    );
    if (hasMultiCheckIns) {
      stressDrivers.push(
        stressVelocity >= 0.4
          ? `Climbing +${stressVelocity.toFixed(1)} vs earlier window`
          : stressVelocity <= -0.4
            ? `Easing ${stressVelocity.toFixed(1)} vs earlier window`
            : 'Slope stable across recent check-ins'
      );
    }
  }
  if (anxAssess !== null) {
    stressDrivers.push(`Anxiety Pattern assessment ${anxAssess}/100`);
  }
  if (stressDrivers.length === 0) {
    stressDrivers.push('Awaiting check-in stress trend data');
  }

  // 4. Isolation Risk
  const connIdx = getIndexScore('social-connection', 50);
  const moodIdx = getIndexScore('mood', 50);
  const recentConn5 = hasCheckIns ? avg(recentCheckIns.map((w) => w.socialConnection)) : 3;
  const priorConn5 = hasMultiCheckIns ? avg(priorCheckIns.map((w) => w.socialConnection)) : recentConn5;
  const connDrop = priorConn5 - recentConn5;
  const isolationHasData = hasCheckIns || relationships.length > 0;
  let isolationRaw = 0;
  if (isolationHasData) {
    const connInverted = 100 - connIdx;
    const networkPenalty =
      relationships.length === 0 ? 14 : avgCloseness < 3 ? 10 : 0;
    const moodPull = moodIdx < 45 ? 10 : 0;
    const dropBoost = connDrop > 0 ? Math.min(18, connDrop * 12) : 0;
    isolationRaw = Math.round(
      clamp(connInverted * 0.72 + networkPenalty + moodPull + dropBoost, 0, 100)
    );
  }
  const isolationDrivers: string[] = [];
  if (hasCheckIns) {
    isolationDrivers.push(`Social Connection Index ${connIdx}/100`);
  }
  isolationDrivers.push(
    relationships.length > 0
      ? `${relationships.length} support/relational connection(s) mapped`
      : 'No active relational anchors mapped in Relationship Graph yet'
  );

  // 5. Conflict Probability
  const stabilityIdx = getIndexScore('emotional-stability', 50);
  const conflictAndDigitalEvents = activeEvents.filter(
    (e) =>
      e.contextCategory === 'Conflict & Anger' ||
      e.contextCategory === 'Digital & Online' ||
      e.lens === 'conflict-emotion' ||
      e.lens === 'digital-check'
  );
  const conflictSessions = sessions.filter(
    (s) => s.mode === 'de-escalation' || s.mode === 'digital-pause'
  );
  const conflictHasData =
    hasCheckIns ||
    relationships.length > 0 ||
    conflictAndDigitalEvents.length > 0 ||
    conflictSessions.length > 0;
  let conflictRaw = 0;
  if (conflictHasData) {
    const reactivityComponent = hasCheckIns ? (100 - stabilityIdx) * 0.42 : 16;
    const tensionComponent =
      relationships.length > 0 ? ((avgTension - 1) / 4) * 32 : 10;
    const stressComponent = hasCheckIns ? ((recentStress5 - 1) / 4) * 20 : 6;
    const historyComponent = Math.min(
      24,
      conflictAndDigitalEvents.length * 6 + conflictSessions.length * 4
    );
    conflictRaw = Math.round(
      clamp(reactivityComponent + tensionComponent + stressComponent + historyComponent, 0, 100)
    );
  }
  const conflictDrivers: string[] = [];
  if (hasCheckIns) {
    conflictDrivers.push(`Emotional Stability ${stabilityIdx}/100 · Stress ${recentStress5.toFixed(1)}/5`);
  }
  if (conflictAndDigitalEvents.length > 0 || conflictSessions.length > 0) {
    conflictDrivers.push(
      `${conflictAndDigitalEvents.length} conflict/digital event(s), ${conflictSessions.length} pause thread(s)`
    );
  }
  if (relationships.length > 0 && avgTension >= 3) {
    conflictDrivers.push(`Elevated tension (${avgTension.toFixed(1)}/5) in Relationship Graph`);
  }
  if (conflictDrivers.length === 0) {
    conflictDrivers.push('Awaiting check-ins, Event Lab conflict logs, or relationship data');
  }

  // 6. Emotional Decline
  const moodAssessRaw = latestAssessment('Mood & Depression Strain');
  const resilienceIdx = getIndexScore('resilience', 50);
  const recentMood5 = hasCheckIns ? avg(recentCheckIns.map((w) => w.mood)) : 3;
  const priorMood5 = hasMultiCheckIns ? avg(priorCheckIns.map((w) => w.mood)) : recentMood5;
  const moodDrop = priorMood5 - recentMood5;
  const recentSat5 = hasCheckIns ? avg(recentCheckIns.map((w) => w.lifeSatisfaction)) : 3;
  const emotionalDeclineHasData = hasCheckIns || moodAssessRaw !== null;
  let emotionalDeclineRaw = 0;
  if (emotionalDeclineHasData) {
    const lowMoodPct = hasCheckIns ? ((5 - recentMood5) / 4) * 45 : 18;
    const lowSatPct = hasCheckIns ? ((5 - recentSat5) / 4) * 20 : 8;
    const declineSlopePct = moodDrop > 0 ? Math.min(22, moodDrop * 16) : 0;
    const lowResiliencePct = (100 - resilienceIdx) * 0.2;
    const assessPct = moodAssessRaw !== null ? moodAssessRaw * 0.22 : 0;
    emotionalDeclineRaw = Math.round(
      clamp(lowMoodPct + lowSatPct + declineSlopePct + lowResiliencePct + assessPct, 0, 100)
    );
  }
  const declineDrivers: string[] = [];
  if (hasCheckIns) {
    declineDrivers.push(
      `Mood Index ${moodIdx}/100 · Resilience ${resilienceIdx}/100`
    );
    if (hasMultiCheckIns) {
      declineDrivers.push(
        moodDrop >= 0.4
          ? `Mood dipped -${moodDrop.toFixed(1)}/5 vs earlier baseline`
          : moodDrop <= -0.4
            ? `Mood lifted +${Math.abs(moodDrop).toFixed(1)}/5 recently`
            : 'Mood trajectory steady over active window'
      );
    }
  }
  if (moodAssessRaw !== null) {
    declineDrivers.push(`Mood & Depression Strain assessment ${moodAssessRaw}/100`);
  }
  if (declineDrivers.length === 0) {
    declineDrivers.push('Awaiting check-in mood logs or Mood & Depression assessment');
  }

  const signals: RiskForecastMetric[] = [
    {
      key: 'burnout-risk',
      label: 'Burnout Risk',
      category: 'stress-burnout',
      probability: burnoutRaw,
      tier: tierFor(burnoutRaw),
      trend: trendFromDelta(recentBurnout5 - priorBurnout5, hasMultiCheckIns),
      drivers: burnoutDrivers,
      preventiveStep:
        burnoutRaw >= 65
          ? 'Trim optional commitments for 48–72 hours and protect an unhurried sleep recovery window.'
          : 'Guard regular energy pauses before stress compounds into chronic depletion.',
      hasData: burnoutHasData,
    },
    {
      key: 'relationship-risk',
      label: 'Relationship Risk',
      category: 'relational-conflict',
      probability: relRiskRaw,
      tier: tierFor(relRiskRaw),
      trend: trendFromDelta(priorConn5 - recentConn5, hasMultiCheckIns),
      drivers: relDrivers,
      preventiveStep:
        relRiskRaw >= 65
          ? 'Use Event Lab to separate observable facts from assumptions before a difficult conversation.'
          : 'Check in with one trusted person using a clear, non-blaming need statement.',
      hasData: relHasData,
    },
    {
      key: 'stress-escalation',
      label: 'Stress Escalation',
      category: 'stress-burnout',
      probability: stressEscalationRaw,
      tier: tierFor(stressEscalationRaw),
      trend: trendFromDelta(stressVelocity, hasMultiCheckIns),
      drivers: stressDrivers,
      preventiveStep:
        stressEscalationRaw >= 65
          ? 'Slow nervous-system pace today: 4-4-6 paced breathing and postponing non-urgent friction.'
          : 'Identify tomorrow’s earliest predictable stressor and set one realistic boundary around it.',
      hasData: stressHasData,
    },
    {
      key: 'isolation-risk',
      label: 'Isolation Risk',
      category: 'relational-conflict',
      probability: isolationRaw,
      tier: tierFor(isolationRaw),
      trend: trendFromDelta(connDrop, hasMultiCheckIns),
      drivers: isolationDrivers,
      preventiveStep:
        isolationRaw >= 65
          ? 'Send one low-pressure message to someone safe rather than waiting until energy feels complete.'
          : 'Keep one recurring relational touchpoint anchored on your weekly calendar.',
      hasData: isolationHasData,
    },
    {
      key: 'conflict-probability',
      label: 'Conflict Probability',
      category: 'relational-conflict',
      probability: conflictRaw,
      tier: tierFor(conflictRaw),
      trend: trendFromDelta(stressVelocity, hasMultiCheckIns),
      drivers: conflictDrivers,
      preventiveStep:
        conflictRaw >= 65
          ? 'Activate a 20-minute Digital Pause before replying to charged messages or high-tension threads.'
          : 'Notice boundary irritation early so requests stay constructive rather than reactive.',
      hasData: conflictHasData,
    },
    {
      key: 'emotional-decline',
      label: 'Emotional Decline',
      category: 'stress-burnout',
      probability: emotionalDeclineRaw,
      tier: tierFor(emotionalDeclineRaw),
      trend: trendFromDelta(moodDrop, hasMultiCheckIns),
      drivers: declineDrivers,
      preventiveStep:
        emotionalDeclineRaw >= 65
          ? 'Lean on trusted human support or 988 care resources if heaviness persists alongside basic rest.'
          : 'Track subtle dips gently and reconnect with one values-aligned restorative routine.',
      hasData: emotionalDeclineHasData,
    },
  ];

  const activeSignals = signals.filter((s) => s.hasData);
  const aggregateRisk =
    activeSignals.length > 0
      ? Math.round(avg(activeSignals.map((s) => s.probability)))
      : 0;

  return {
    signals,
    aggregateRisk,
    elevatedCount: activeSignals.filter((s) => s.tier === 'Elevated').length,
    watchfulCount: activeSignals.filter((s) => s.tier === 'Watchful').length,
    retentionDays,
  };
}

export function formatRiskForecastSummary(suite: RiskForecastSuite): string {
  const active = suite.signals.filter((s) => s.hasData);
  if (active.length === 0) return '';
  const lines = active.map(
    (s) =>
      `- ${s.label}: ${s.probability}% (${s.tier}, Trend: ${s.trend}) — ${s.drivers[0] || ''}`
  );
  return `Predictive Early-Warning Risk Signals (${suite.retentionDays}d window, Aggregate Risk ${suite.aggregateRisk}%):\n${lines.join('\n')}`;
}
