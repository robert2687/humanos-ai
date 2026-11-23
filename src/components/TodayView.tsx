import { useMemo, useState } from 'react';
import { ArrowRight, Check, Loader2, Trash2 } from 'lucide-react';
import { gatewayFetch } from '../lib/gatewayClient';
import {
  computePsychologicalIndices,
  formatPsychologicalIndicesSummary,
} from '../lib/psychologicalIndices';
import {
  computeRiskForecasts,
  formatRiskForecastSummary,
} from '../lib/riskForecasts';
import { detectClientCrisisCategories } from '../hooks/useHumanosStore';
import { CrisisBanner } from './CrisisSupportView';
import {
  AssessmentRecord,
  CrisisRiskCategory,
  DynamicUserModel,
  EventAnalysisRecord,
  GrowthJournalEntry,
  PatternHypothesis,
  PersonalInsightBrief,
  ReflectionSession,
  RelationshipAreaInsight,
  RelationshipNode,
  UserProfile,
  WellbeingCheckIn,
} from '../types/humanos';

interface TodayViewProps {
  activeUser: UserProfile;
  dailyInsights: PersonalInsightBrief[];
  wellbeingCheckIns: WellbeingCheckIn[];
  assessments: AssessmentRecord[];
  relationships: RelationshipNode[];
  relationshipInsights: RelationshipAreaInsight[];
  eventAnalyses: EventAnalysisRecord[];
  sessions: ReflectionSession[];
  hypotheses: PatternHypothesis[];
  dynamicUserModel: DynamicUserModel;
  retentionDays: number;
  onAddWellbeingCheckIn: (input: Omit<WellbeingCheckIn, 'id' | 'createdAt'>) => void;
  onAddJournalEntry: (input: Omit<GrowthJournalEntry, 'id' | 'createdAt'>) => void;
  onAddDailyInsight: (
    insight: Omit<PersonalInsightBrief, 'id' | 'createdAt'>
  ) => PersonalInsightBrief;
  onDeleteDailyInsight: (id: string) => void;
  onReflectTodayInDialogue: (input: {
    todayMood: number;
    moodLabel: string;
    energyLevel: number;
    stressScore: number;
    todaysReflection: string;
    personalInsight?: string;
  }) => void;
  onOpenWellbeingAtlas: () => void;
  onOpenCrisisSupport: () => void;
}

const MOOD_LEVELS: { value: number; label: string; tone: string }[] = [
  { value: 1, label: 'Heavy', tone: 'Weighted down, tender, or drained' },
  { value: 2, label: 'Subdued', tone: 'Quiet fatigue or mild emotional friction' },
  { value: 3, label: 'Steady', tone: 'Balanced, functional, and grounded' },
  { value: 4, label: 'Warm', tone: 'Open, engaged, and receptive' },
  { value: 5, label: 'Clear', tone: 'Calm, energized, and aligned' },
];

const ENERGY_LEVELS: { value: number; label: string }[] = [
  { value: 1, label: 'Depleted' },
  { value: 2, label: 'Low' },
  { value: 3, label: 'Moderate' },
  { value: 4, label: 'Charged' },
  { value: 5, label: 'Restored' },
];

const STRESS_LEVELS: { value: number; label: string }[] = [
  { value: 1, label: 'Calm' },
  { value: 2, label: 'Mild' },
  { value: 3, label: 'Moderate' },
  { value: 4, label: 'High' },
  { value: 5, label: 'Overwhelmed' },
];

const REFLECTION_PROMPTS: string[] = [
  'What feels most alive, unsettled, or meaningful as today unfolds?',
  'Where did your energy expand or tighten today, and why?',
  'What boundary, conversation, or quiet recovery deserves care today?',
];

function getLocalDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toPct(val: number): number {
  return Math.round(((Math.min(5, Math.max(1, val)) - 1) / 4) * 100);
}

export function TodayView({
  activeUser,
  dailyInsights,
  wellbeingCheckIns,
  assessments,
  relationships,
  relationshipInsights,
  eventAnalyses,
  sessions,
  hypotheses,
  dynamicUserModel,
  retentionDays,
  onAddWellbeingCheckIn,
  onAddJournalEntry,
  onAddDailyInsight,
  onDeleteDailyInsight,
  onReflectTodayInDialogue,
  onOpenWellbeingAtlas,
  onOpenCrisisSupport,
}: TodayViewProps) {
  const latestCheckIn = wellbeingCheckIns[0];
  const todayKey = getLocalDateKey();
  const todayFormatted = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const [todayMood, setTodayMood] = useState<number>(latestCheckIn?.mood ?? 3);
  const [energyLevel, setEnergyLevel] = useState<number>(latestCheckIn?.energy ?? 3);
  const [stressScore, setStressScore] = useState<number>(latestCheckIn?.stress ?? 2);
  const [selectedPromptIdx, setSelectedPromptIdx] = useState<number>(0);
  const [todaysReflection, setTodaysReflection] = useState<string>('');
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(
    dailyInsights[0]?.id ?? null
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [savedPulseFlag, setSavedPulseFlag] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeMoodSpec =
    MOOD_LEVELS.find((m) => m.value === todayMood) || MOOD_LEVELS[2];
  const activeEnergySpec =
    ENERGY_LEVELS.find((e) => e.value === energyLevel) || ENERGY_LEVELS[2];
  const activeStressSpec =
    STRESS_LEVELS.find((s) => s.value === stressScore) || STRESS_LEVELS[1];

  const indexSuite = useMemo(
    () =>
      computePsychologicalIndices({
        wellbeingCheckIns,
        assessments,
        relationships,
        retentionDays,
      }),
    [wellbeingCheckIns, assessments, relationships, retentionDays]
  );

  const riskSuite = useMemo(
    () =>
      computeRiskForecasts({
        wellbeingCheckIns,
        assessments,
        relationships,
        relationshipInsights,
        eventAnalyses,
        sessions,
        indexSuite,
        retentionDays,
      }),
    [
      wellbeingCheckIns,
      assessments,
      relationships,
      relationshipInsights,
      eventAnalyses,
      sessions,
      indexSuite,
      retentionDays,
    ]
  );

  const activeInsight =
    dailyInsights.find((item) => item.id === selectedInsightId) ||
    dailyInsights[0] ||
    null;

  const liveCrisisCategories = useMemo(
    () =>
      Array.from(
        new Set<CrisisRiskCategory>([
          ...detectClientCrisisCategories(todaysReflection),
          ...(activeInsight?.safetyCategories ?? []),
        ])
      ),
    [todaysReflection, activeInsight]
  );

  const persistDailyPulse = () => {
    const base = wellbeingCheckIns[0];
    onAddWellbeingCheckIn({
      mood: todayMood,
      energy: energyLevel,
      stress: stressScore,
      anxiety: base?.anxiety ?? stressScore,
      socialConnection: base?.socialConnection ?? 3,
      selfEsteem: base?.selfEsteem ?? 3,
      motivation: base?.motivation ?? energyLevel,
      lifeSatisfaction: base?.lifeSatisfaction ?? todayMood,
      sleepHours: base?.sleepHours ?? 7,
      sleepQuality: base?.sleepQuality ?? 3,
      note: todaysReflection.trim(),
    });

    if (todaysReflection.trim().length > 0) {
      onAddJournalEntry({
        area: 'Resilience',
        prompt: REFLECTION_PROMPTS[selectedPromptIdx],
        entry: todaysReflection.trim(),
        valueActivated: `Mood ${activeMoodSpec.label} · Energy ${energyLevel}/5`,
      });
    }
  };

  const handleSaveMetricsOnly = () => {
    setErrorMsg(null);
    persistDailyPulse();
    setSavedPulseFlag(true);
    setTimeout(() => setSavedPulseFlag(false), 2000);
  };

  const handleGeneratePersonalInsight = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setErrorMsg(null);

    try {
      persistDailyPulse();

      const activeHypotheses = hypotheses
        .filter((h) => h.status !== 'dismissed')
        .slice(0, 6)
        .map((h) => `[Layer 2 · ${h.dimension}]: ${h.statement}`);
      const modelLines = dynamicUserModel.entries
        .slice(0, 6)
        .map((m) => `[User Model · ${m.domain}]: ${m.observation}`);
      const layer2Summary = [...activeHypotheses, ...modelLines].join('\n');

      const response = await gatewayFetch('/api/agents/personal-insight', {
        method: 'POST',
        body: JSON.stringify({
          todayMood,
          moodLabel: activeMoodSpec.label,
          energyLevel,
          stressScore,
          todaysReflection: todaysReflection.trim(),
          indicesSummary: formatPsychologicalIndicesSummary(indexSuite),
          riskSummary: formatRiskForecastSummary(riskSuite),
          layer2Summary,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not generate your Personal Insight.');
      }

      const saved = onAddDailyInsight({
        dateKey: todayKey,
        todayMood,
        moodLabel: activeMoodSpec.label,
        energyLevel,
        stressScore,
        todaysReflection: todaysReflection.trim(),
        headline: data.headline || 'Today’s Emotional & Energy Posture',
        personalInsight: data.personalInsight || '',
        energyStressNote: data.energyStressNote || '',
        patternConnection: data.patternConnection || '',
        reflectiveQuestion: data.reflectiveQuestion || '',
        gentleStep: data.gentleStep || '',
        crisisDetected: Boolean(data.crisisDetected),
        safetyCategories: Array.isArray(data.safetyCategories)
          ? data.safetyCategories
          : [],
      });

      setSelectedInsightId(saved.id);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Unable to synthesize Personal Insight right now.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-10 space-y-10">
      {/* Editorial Header */}
      <section className="flex flex-wrap items-end justify-between gap-6 border-b border-[#1C1917]/10 pb-7">
        <div className="space-y-2.5 max-w-2xl">
          <div className="text-xs font-medium text-[#1E3A5F]">
            Today · {todayFormatted} · {activeUser.displayName}
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-[#1C1917] [text-wrap:balance]">
            Daily mood, energy, stress, and personal insight
          </h1>
          <p className="text-sm sm:text-base text-[#57534E] leading-relaxed">
            Record how you are arriving today. Each check-in updates your time-series telemetry, 8 wellbeing indices, and Personal Insight brief.
          </p>
        </div>

        {/* Live At-a-Glance Summary Strip */}
        <div className="grid grid-cols-3 gap-6 border border-[#1C1917]/10 rounded-lg bg-[#F4F0E8]/60 px-5 py-3.5">
          <div>
            <div className="text-[11px] text-[#78716C]">Today Mood</div>
            <div className="font-mono text-lg font-medium text-[#1C1917] tabular-nums">
              {todayMood}/5 · {activeMoodSpec.label}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#78716C]">Energy Level</div>
            <div className="font-mono text-lg font-medium text-[#1E3A5F] tabular-nums">
              {energyLevel}/5 ({toPct(energyLevel)}%)
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#78716C]">Stress Score</div>
            <div
              className={`font-mono text-lg font-medium tabular-nums ${
                stressScore >= 4 ? 'text-[#9A3412]' : 'text-[#1C1917]'
              }`}
            >
              {stressScore}/5 ({toPct(stressScore)}%)
            </div>
          </div>
        </div>
      </section>

      {(liveCrisisCategories.length > 0 || activeInsight?.crisisDetected) && (
        <CrisisBanner
          detectedCategories={liveCrisisCategories}
          onOpenResources={onOpenCrisisSupport}
        />
      )}

      {errorMsg && (
        <div
          role="alert"
          className="p-4 rounded-lg border border-[#9A3412]/25 bg-[#FDF4F2] text-sm text-[#9A3412]"
        >
          {errorMsg}
        </div>
      )}

      {/* Primary Two-Column Check-In & Personal Insight Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Today Mood, Energy Level, Stress Score & Today's Reflection */}
        <form
          onSubmit={handleGeneratePersonalInsight}
          className="lg:col-span-7 border border-[#1C1917]/12 rounded-lg bg-[#FBF9F5] p-6 sm:p-8 space-y-7"
        >
          {/* 1. Today Mood */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="font-serif text-xl font-medium text-[#1C1917]">
                  Today Mood
                </h2>
                <p className="text-xs text-[#57534E]">{activeMoodSpec.tone}</p>
              </div>
              <span className="font-mono text-sm font-medium text-[#1E3A5F] tabular-nums">
                {todayMood}/5 · {activeMoodSpec.label}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {MOOD_LEVELS.map((m) => {
                const selected = todayMood === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setTodayMood(m.value)}
                    className={`py-2.5 px-2 rounded-md border text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] ${
                      selected
                        ? 'bg-[#1E3A5F] text-[#FBF9F5] border-[#1E3A5F]'
                        : 'bg-[#F4F0E8]/55 text-[#1C1917] border-[#1C1917]/12 hover:bg-[#EBE6DF]'
                    }`}
                  >
                    <div className="font-mono text-sm font-semibold tabular-nums">
                      {m.value}
                    </div>
                    <div className="text-[11px] mt-0.5 truncate">{m.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Energy Level & 3. Stress Score */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 border-t border-[#1C1917]/10">
            {/* Energy Level */}
            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-serif text-lg font-medium text-[#1C1917]">
                  Energy Level
                </h2>
                <span className="font-mono text-xs text-[#1E3A5F] tabular-nums">
                  {energyLevel}/5 · {activeEnergySpec.label}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {ENERGY_LEVELS.map((lvl) => {
                  const active = energyLevel === lvl.value;
                  return (
                    <button
                      key={lvl.value}
                      type="button"
                      onClick={() => setEnergyLevel(lvl.value)}
                      className={`py-2 rounded-md border font-mono text-xs font-medium tabular-nums transition-colors ${
                        active
                          ? 'bg-[#1E3A5F] text-[#FBF9F5] border-[#1E3A5F]'
                          : 'bg-[#F4F0E8]/60 text-[#292524] border-[#1C1917]/12 hover:bg-[#EBE6DF]'
                      }`}
                      title={lvl.label}
                    >
                      {lvl.value}
                    </button>
                  );
                })}
              </div>

              <div className="w-full h-1.5 rounded-sm bg-[#1C1917]/10 overflow-hidden">
                <div
                  className="h-full bg-[#1E3A5F] transition-all"
                  style={{ width: `${Math.max(8, toPct(energyLevel))}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-[#78716C]">
                <span>Depleted</span>
                <span>Restored</span>
              </div>
            </div>

            {/* Stress Score */}
            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-serif text-lg font-medium text-[#1C1917]">
                  Stress Score
                </h2>
                <span
                  className={`font-mono text-xs tabular-nums font-medium ${
                    stressScore >= 4
                      ? 'text-[#9A3412]'
                      : stressScore === 3
                        ? 'text-[#B45309]'
                        : 'text-[#1E3A5F]'
                  }`}
                >
                  {stressScore}/5 · {activeStressSpec.label}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {STRESS_LEVELS.map((lvl) => {
                  const active = stressScore === lvl.value;
                  const highStress = lvl.value >= 4;
                  return (
                    <button
                      key={lvl.value}
                      type="button"
                      onClick={() => setStressScore(lvl.value)}
                      className={`py-2 rounded-md border font-mono text-xs font-medium tabular-nums transition-colors ${
                        active
                          ? highStress
                            ? 'bg-[#9A3412] text-[#FBF9F5] border-[#9A3412]'
                            : 'bg-[#1E3A5F] text-[#FBF9F5] border-[#1E3A5F]'
                          : 'bg-[#F4F0E8]/60 text-[#292524] border-[#1C1917]/12 hover:bg-[#EBE6DF]'
                      }`}
                      title={lvl.label}
                    >
                      {lvl.value}
                    </button>
                  );
                })}
              </div>

              <div className="w-full h-1.5 rounded-sm bg-[#1C1917]/10 overflow-hidden">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${Math.max(8, toPct(stressScore))}%`,
                    backgroundColor:
                      stressScore >= 4
                        ? '#9A3412'
                        : stressScore === 3
                          ? '#B45309'
                          : '#1E3A5F',
                  }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-[#78716C]">
                <span>Calm</span>
                <span>Overwhelmed</span>
              </div>
            </div>
          </div>

          {/* 4. Today's Reflection */}
          <div className="space-y-3 pt-2 border-t border-[#1C1917]/10">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <label
                htmlFor="todays-reflection-input"
                className="font-serif text-xl font-medium text-[#1C1917]"
              >
                Today&apos;s Reflection
              </label>
              <button
                type="button"
                onClick={() =>
                  setSelectedPromptIdx((prev) => (prev + 1) % REFLECTION_PROMPTS.length)
                }
                className="text-xs font-medium text-[#1E3A5F] hover:underline underline-offset-4 whitespace-nowrap"
              >
                Rotate Prompt
              </button>
            </div>

            <p className="text-xs text-[#57534E] italic">
              {REFLECTION_PROMPTS[selectedPromptIdx]}
            </p>

            <textarea
              id="todays-reflection-input"
              rows={5}
              value={todaysReflection}
              onChange={(e) => setTodaysReflection(e.target.value)}
              placeholder="Write candidly about your state of mind, what shaped your day, or what needs care..."
              className="w-full rounded-md border border-[#1C1917]/15 bg-[#F4F0E8]/40 px-4 py-3 text-sm text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="submit"
              disabled={isGenerating}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49] disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Personal Insight...</span>
                </>
              ) : (
                <span>Save Check-In & Generate Personal Insight</span>
              )}
            </button>

            <button
              type="button"
              onClick={handleSaveMetricsOnly}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-medium border border-[#1C1917]/20 text-[#1C1917] rounded-md hover:bg-[#EBE6DF] transition-colors whitespace-nowrap"
            >
              {savedPulseFlag ? (
                <>
                  <Check className="w-4 h-4 text-[#1E3A5F]" />
                  <span>Saved to Telemetry</span>
                </>
              ) : (
                <span>Save Metrics Only</span>
              )}
            </button>
          </div>
        </form>

        {/* Right: 5. Personal Insight Editorial Panel */}
        <aside className="lg:col-span-5 border border-[#1E3A5F]/20 rounded-lg bg-[#F4F0E8]/55 p-6 sm:p-7 space-y-6">
          <div className="border-b border-[#1C1917]/10 pb-4 flex items-baseline justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-[#1E3A5F]">
                Personal Insight · Non-Diagnostic Synthesis
              </div>
              <h2 className="font-serif text-2xl font-medium text-[#1C1917] mt-1">
                {activeInsight ? activeInsight.headline : 'Your Personal Insight'}
              </h2>
            </div>
            {activeInsight && (
              <span className="font-mono text-[11px] text-[#78716C] tabular-nums whitespace-nowrap">
                {new Date(activeInsight.createdAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {activeInsight ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-[#57534E] tabular-nums border-b border-[#1C1917]/10 pb-3">
                <span>
                  Mood {activeInsight.todayMood}/5 ({activeInsight.moodLabel})
                </span>
                <span aria-hidden="true">·</span>
                <span>Energy {activeInsight.energyLevel}/5</span>
                <span aria-hidden="true">·</span>
                <span>Stress {activeInsight.stressScore}/5</span>
              </div>

              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-[#1E3A5F]">
                  Personal Insight
                </div>
                <p className="text-sm text-[#1C1917] leading-relaxed">
                  {activeInsight.personalInsight}
                </p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-[#1C1917]/10">
                <div className="text-xs font-semibold text-[#1C1917]">
                  Energy & Stress Balance
                </div>
                <p className="text-xs sm:text-sm text-[#292524] leading-relaxed">
                  {activeInsight.energyStressNote}
                </p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-[#1C1917]/10">
                <div className="text-xs font-semibold text-[#1C1917]">
                  Pattern & Values Connection
                </div>
                <p className="text-xs sm:text-sm text-[#292524] leading-relaxed">
                  {activeInsight.patternConnection}
                </p>
              </div>

              <div className="rounded-md bg-[#FBF9F5] border border-[#1C1917]/10 p-4 space-y-2.5">
                <div>
                  <div className="text-[11px] font-semibold text-[#1E3A5F]">
                    Grounded Next Step
                  </div>
                  <p className="text-xs text-[#292524] leading-relaxed mt-0.5">
                    {activeInsight.gentleStep}
                  </p>
                </div>
                <div className="pt-2 border-t border-[#1C1917]/10">
                  <div className="text-[11px] font-semibold text-[#78716C]">
                    Reflective Question
                  </div>
                  <p className="font-serif text-sm text-[#1C1917] italic mt-0.5">
                    {activeInsight.reflectiveQuestion}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    onReflectTodayInDialogue({
                      todayMood: activeInsight.todayMood,
                      moodLabel: activeInsight.moodLabel,
                      energyLevel: activeInsight.energyLevel,
                      stressScore: activeInsight.stressScore,
                      todaysReflection: activeInsight.todaysReflection,
                      personalInsight: activeInsight.personalInsight,
                    })
                  }
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1E3A5F] hover:underline underline-offset-4 whitespace-nowrap"
                >
                  <span>Explore in Dialogue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={onOpenWellbeingAtlas}
                  className="text-xs font-medium text-[#57534E] hover:text-[#1C1917] hover:underline underline-offset-4 whitespace-nowrap"
                >
                  View 8 Indices & 6 Risks
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <p className="text-sm text-[#57534E] leading-relaxed">
                Select your <strong className="font-medium text-[#1C1917]">Today Mood</strong>,{' '}
                <strong className="font-medium text-[#1C1917]">Energy Level</strong>, and{' '}
                <strong className="font-medium text-[#1C1917]">Stress Score</strong>, optionally write a short{' '}
                <strong className="font-medium text-[#1C1917]">Today&apos;s Reflection</strong>, and generate your synthesized Personal Insight brief.
              </p>

              <div className="border-t border-[#1C1917]/10 pt-4 space-y-2.5 text-xs">
                <div className="font-medium text-[#1E3A5F]">
                  Live Longitudinal Context ({retentionDays}-Day Window)
                </div>
                <div className="flex justify-between text-[#57534E]">
                  <span>8-Index Equilibrium</span>
                  <span className="font-mono tabular-nums text-[#1C1917]">
                    {indexSuite.indices.some((i) => i.hasData)
                      ? `${indexSuite.overallEquilibrium}/100`
                      : 'Awaiting baseline'}
                  </span>
                </div>
                <div className="flex justify-between text-[#57534E]">
                  <span>6-Signal Risk Posture</span>
                  <span className="font-mono tabular-nums text-[#1C1917]">
                    {riskSuite.signals.some((s) => s.hasData)
                      ? `${riskSuite.aggregateRisk}% (${riskSuite.elevatedCount} elevated)`
                      : 'Awaiting baseline'}
                  </span>
                </div>
                <div className="flex justify-between text-[#57534E]">
                  <span>Layer 2 Active Patterns</span>
                  <span className="font-mono tabular-nums text-[#1C1917]">
                    {hypotheses.filter((h) => h.status !== 'dismissed').length}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-[#1C1917]/10 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() =>
                    onReflectTodayInDialogue({
                      todayMood,
                      moodLabel: activeMoodSpec.label,
                      energyLevel,
                      stressScore,
                      todaysReflection: todaysReflection.trim(),
                    })
                  }
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1E3A5F] hover:underline underline-offset-4 whitespace-nowrap"
                >
                  <span>Open in Dialogue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onOpenWellbeingAtlas}
                  className="text-xs font-medium text-[#57534E] hover:text-[#1C1917] hover:underline underline-offset-4 whitespace-nowrap"
                >
                  Pattern Atlas
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Recent Daily Check-Ins & Personal Insights */}
      {dailyInsights.length > 0 && (
        <section className="space-y-4 pt-2 border-t border-[#1C1917]/10">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-serif text-xl font-medium text-[#1C1917]">
              Recent Daily Reflections & Personal Insights
            </h2>
            <span className="font-mono text-xs text-[#78716C] tabular-nums">
              {dailyInsights.length} saved
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dailyInsights.slice(0, 6).map((item) => {
              const selected = activeInsight?.id === item.id;
              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-lg border transition-colors flex flex-col justify-between space-y-3 ${
                    selected
                      ? 'bg-[#F4F0E8]/85 border-[#1E3A5F]'
                      : 'bg-[#FBF9F5] border-[#1C1917]/12 hover:bg-[#F4F0E8]/45'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedInsightId(item.id)}
                    className="text-left space-y-2"
                  >
                    <div className="flex items-baseline justify-between gap-2 text-[11px] font-mono text-[#78716C] tabular-nums">
                      <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                      <span>
                        Mood {item.todayMood}/5 · Energy {item.energyLevel}/5 · Stress {item.stressScore}/5
                      </span>
                    </div>
                    <h3 className="font-serif text-base font-medium text-[#1C1917]">
                      {item.headline}
                    </h3>
                    {item.todaysReflection && (
                      <p className="text-xs text-[#57534E] line-clamp-2 leading-relaxed">
                        &ldquo;{item.todaysReflection}&rdquo;
                      </p>
                    )}
                    <p className="text-xs text-[#292524] line-clamp-2 leading-relaxed">
                      {item.personalInsight}
                    </p>
                  </button>

                  <div className="flex items-center justify-between pt-2 border-t border-[#1C1917]/10 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSelectedInsightId(item.id)}
                      className="font-medium text-[#1E3A5F] hover:underline underline-offset-4"
                    >
                      View Insight
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteDailyInsight(item.id)}
                      aria-label="Delete daily check-in"
                      className="text-[#78716C] hover:text-[#9A3412] transition-colors p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
