import { useState } from 'react';
import { ArrowRight, Loader2, Search, Trash2 } from 'lucide-react';
import {
  CognitiveDistortionKey,
  CognitiveDistortionReport,
  CrisisRiskCategory,
  EventAnalysisRecord,
  EventLabLens,
  SocialPlatform,
} from '../types/humanos';
import {
  detectClientCrisisCategories,
  detectClientCrisisSignals,
} from '../hooks/useHumanosStore';
import { gatewayFetch } from '../lib/gatewayClient';
import { CrisisBanner } from './CrisisSupportView';

interface EventLabViewProps {
  records: EventAnalysisRecord[];
  distortionReports: CognitiveDistortionReport[];
  onSaveRecord: (
    record: Omit<EventAnalysisRecord, 'id' | 'createdAt'>
  ) => EventAnalysisRecord;
  onDeleteRecord: (id: string) => void;
  onSaveDistortionReport: (
    report: Omit<CognitiveDistortionReport, 'id' | 'createdAt'>
  ) => CognitiveDistortionReport;
  onDeleteDistortionReport: (id: string) => void;
  onDiscussInDialogue: (record: EventAnalysisRecord) => void;
  onDiscussDistortionInDialogue: (report: CognitiveDistortionReport) => void;
  onOpenCrisisSupport: () => void;
}

const CONTEXT_CATEGORIES: EventAnalysisRecord['contextCategory'][] = [
  'Personal',
  'Relationship',
  'Work & Purpose',
  'Conflict & Anger',
  'Digital & Online',
];

const LENS_OPTIONS: { id: EventLabLens; label: string; desc: string }[] = [
  {
    id: 'conflict-emotion',
    label: 'Conflict & Emotion',
    desc: 'Facts · Interpretations · Emotions · Needs · Requests',
  },
  {
    id: 'behavioral-loop',
    label: 'Cognitive & Habit Loop',
    desc: 'Trigger → Thought → Emotion → Behavior → Outcome',
  },
  {
    id: 'digital-check',
    label: 'Toxicity & Digital Pause',
    desc: 'Issue · Trigger · Likely Outcome · Healthier Reply',
  },
  {
    id: 'future-self',
    label: 'Future Self Simulator',
    desc: 'Explore 2-week, 6-month, and 3-year decision impacts',
  },
];

const COGNITIVE_DISTORTION_GUIDE: {
  key: CognitiveDistortionKey;
  label: string;
  definition: string;
  innerCue: string;
  sampleThought: string;
  gentleQuestion: string;
}[] = [
  {
    key: 'catastrophizing',
    label: 'Catastrophizing',
    definition:
      'Forecasting the worst-case scenario as though it is already certain, leaving no room for recoverable outcomes.',
    innerCue: '"If this goes wrong, everything will fall apart."',
    sampleThought:
      'I stumbled over one answer in the presentation today, which probably means my manager thinks I am incompetent and my career here is ruined.',
    gentleQuestion:
      'What is the most realistic outcome alongside the worst-case scenario?',
  },
  {
    key: 'personalization',
    label: 'Personalization',
    definition:
      'Taking disproportionate personal blame for external events, outcomes, or another person’s mood.',
    innerCue: '"They seem quiet today—it must be something I did wrong."',
    sampleThought:
      'My friend seemed distracted during dinner and left early, so I must have said something annoying that pushed them away.',
    gentleQuestion:
      'What other factors outside my control could explain this situation?',
  },
  {
    key: 'overgeneralization',
    label: 'Overgeneralization',
    definition:
      'Turning a single setback or painful moment into a sweeping, permanent rule about yourself or life.',
    innerCue: '"I always mess things up; nothing ever works out for me."',
    sampleThought:
      'This project missed its deadline again—I never follow through properly and I always disappoint people who rely on me.',
    gentleQuestion:
      'Is this truly "always" and "never," or is it a specific pattern in a specific context?',
  },
  {
    key: 'emotional reasoning',
    label: 'Emotional Reasoning',
    definition:
      'Treating the intensity of an emotion as objective proof of reality ("I feel it, therefore it must be true").',
    innerCue: '"I feel anxious and inadequate, so I must actually be failing."',
    sampleThought:
      'I feel completely overwhelmed and unworthy today, which proves I am not cut out for the responsibilities I took on.',
    gentleQuestion:
      'If a feeling is a signal rather than a verdict, what need might it be pointing toward?',
  },
  {
    key: 'mind reading',
    label: 'Mind Reading',
    definition:
      'Assuming you know what someone else is silently thinking or judging about you without direct evidence.',
    innerCue: '"They have not replied yet because they are upset with me."',
    sampleThought:
      'She read my message an hour ago and has not texted back, so I know she is irritated with me and pulling away.',
    gentleQuestion:
      'What observable facts do I actually have versus assumptions about their inner state?',
  },
];

const SOCIAL_PLATFORMS: SocialPlatform[] = [
  'Facebook',
  'Instagram',
  'Reddit',
  'Discord',
  'LinkedIn',
  'X/Twitter',
];

export function EventLabView({
  records,
  distortionReports,
  onSaveRecord,
  onDeleteRecord,
  onSaveDistortionReport,
  onDeleteDistortionReport,
  onDiscussInDialogue,
  onDiscussDistortionInDialogue,
  onOpenCrisisSupport,
}: EventLabViewProps) {
  const [labSection, setLabSection] = useState<'events' | 'distortions'>('events');
  const [lens, setLens] = useState<EventLabLens>('conflict-emotion');
  const [socialPlatform, setSocialPlatform] = useState<SocialPlatform>('Reddit');
  const [contextCategory, setContextCategory] =
    useState<EventAnalysisRecord['contextCategory']>('Personal');
  const [eventText, setEventText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    records[0]?.id ?? null
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Cognitive Distortion Analyzer state
  const [thoughtInput, setThoughtInput] = useState('');
  const [isScanningDistortions, setIsScanningDistortions] = useState(false);
  const [distortionError, setDistortionError] = useState<string | null>(null);
  const [selectedDistortionId, setSelectedDistortionId] = useState<string | null>(
    distortionReports[0]?.id ?? null
  );
  const [activeGuideKey, setActiveGuideKey] =
    useState<CognitiveDistortionKey>('catastrophizing');
  const [showDistortionJson, setShowDistortionJson] = useState(false);

  const activeRecord =
    records.find((r) => r.id === selectedId) || records[0] || null;
  const activeDistortionReport =
    distortionReports.find((r) => r.id === selectedDistortionId) ||
    distortionReports[0] ||
    null;
  const activeGuideItem =
    COGNITIVE_DISTORTION_GUIDE.find((g) => g.key === activeGuideKey) ||
    COGNITIVE_DISTORTION_GUIDE[0];

  const filteredRecords = records.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.summaryTitle.toLowerCase().includes(q) ||
      r.rawEvent.toLowerCase().includes(q) ||
      r.needs.some((n) => n.toLowerCase().includes(q))
    );
  });

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = eventText.trim();
    if (!trimmed || isAnalyzing) return;

    setIsAnalyzing(true);
    setErrorMsg(null);

    try {
      const response = await gatewayFetch('/api/analyze-event', {
        method: 'POST',
        body: JSON.stringify({
          eventDescription: trimmed,
          contextCategory,
          lens,
          platform: lens === 'digital-check' ? socialPlatform : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not analyze this situation.');
      }

      const saved = onSaveRecord({
        lens,
        contextCategory,
        rawEvent: trimmed,
        summaryTitle: data.summaryTitle || 'Analyzed Situation',
        facts: Array.isArray(data.facts) ? data.facts : [],
        interpretations: Array.isArray(data.interpretations) ? data.interpretations : [],
        emotions: Array.isArray(data.emotions) ? data.emotions : [],
        needs: Array.isArray(data.needs) ? data.needs : [],
        requests: Array.isArray(data.requests) ? data.requests : [],
        actions: Array.isArray(data.actions) ? data.actions : [],
        behavioralLoop: data.behavioralLoop || null,
        digitalCheck: data.digitalCheck || null,
        futureSimulation: data.futureSimulation || null,
        reflectiveQuestions: Array.isArray(data.reflectiveQuestions)
          ? data.reflectiveQuestions
          : [],
        crisisDetected: Boolean(data.crisisDetected || detectClientCrisisSignals(trimmed)),
        safetyCategories: Array.from(
          new Set<CrisisRiskCategory>([
            ...detectClientCrisisCategories(trimmed),
            ...(Array.isArray(data.detectedRiskCategories) ? data.detectedRiskCategories : []),
          ])
        ),
      });

      setSelectedId(saved.id);
      setEventText('');
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to deconstruct the situation right now.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyzeDistortions = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = thoughtInput.trim();
    if (!trimmed || isScanningDistortions) return;

    setIsScanningDistortions(true);
    setDistortionError(null);

    try {
      const response = await gatewayFetch('/api/agents/cognitive-distortions', {
        method: 'POST',
        body: JSON.stringify({
          thoughtOrSituation: trimmed,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not evaluate cognitive distortions right now.');
      }

      const saved = onSaveDistortionReport({
        rawThought: trimmed,
        thoughtSummary: data.thoughtSummary || 'Thought Pattern Analysis',
        emotionalUndercurrent: data.emotionalUndercurrent || '',
        distortions: Array.isArray(data.distortions) ? data.distortions : [],
        balancedPerspective: data.balancedPerspective || '',
        crisisDetected: Boolean(data.crisisDetected || detectClientCrisisSignals(trimmed)),
        safetyCategories: Array.from(
          new Set<CrisisRiskCategory>([
            ...detectClientCrisisCategories(trimmed),
            ...(Array.isArray(data.detectedRiskCategories) ? data.detectedRiskCategories : []),
          ])
        ),
      });

      setSelectedDistortionId(saved.id);
      setThoughtInput('');
    } catch (err: unknown) {
      setDistortionError(
        err instanceof Error
          ? err.message
          : 'Unable to evaluate cognitive distortions right now.'
      );
    } finally {
      setIsScanningDistortions(false);
    }
  };

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-10 space-y-10">
      {/* Lab Workspace Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1C1917]/10 pb-5">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F4F0E8] border border-[#1C1917]/10 rounded-lg">
          <button
            type="button"
            onClick={() => setLabSection('events')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              labSection === 'events'
                ? 'bg-[#FBF9F5] text-[#1C1917] shadow-xs border border-[#1C1917]/10'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            Event & Loop Deconstruction ({records.length})
          </button>
          <button
            type="button"
            onClick={() => setLabSection('distortions')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              labSection === 'distortions'
                ? 'bg-[#FBF9F5] text-[#1C1917] shadow-xs border border-[#1C1917]/10'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            Cognitive Distortions Analyzer ({distortionReports.length})
          </button>
        </div>
        <div className="text-xs text-[#78716C]">
          <span>CBT + Behavioral Science</span>
          <span className="mx-2" aria-hidden="true">·</span>
          <span>Non-diagnostic self-inquiry</span>
        </div>
      </div>

      {labSection === 'events' ? (
        <>
          {/* Intro & Input Grid */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start border-b border-[#1C1917]/10 pb-10">
        <div className="lg:col-span-5 space-y-4">
          <p className="text-xs font-medium text-[#1E3A5F]">
            Emotional Memory & Analytical Lab
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-[#1C1917] [text-wrap:balance]">
            Deconstruct conflicts, thought loops, messages, and choices
          </h1>
          <p className="text-sm sm:text-base leading-relaxed text-[#57534E]">
            Every entry builds your searchable Emotional Memory. Choose a lens to mediate conflict, surface CBT thought patterns, pause before reactive messaging, or simulate how a decision ages for your future self.
          </p>
        </div>

        <form
          onSubmit={handleAnalyze}
          className="lg:col-span-7 border border-[#1C1917]/12 rounded-lg bg-[#F4F0E8]/55 p-5 sm:p-6 space-y-4"
        >
          {/* Analytical Lens Selector */}
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-[#57534E]">Analytical Lens</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {LENS_OPTIONS.map((opt) => {
                const active = lens === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setLens(opt.id);
                      if (opt.id === 'digital-check') setContextCategory('Digital & Online');
                      if (opt.id === 'future-self') setContextCategory('Work & Purpose');
                    }}
                    className={`text-left p-2.5 rounded-md border transition-colors ${
                      active
                        ? 'bg-[#FBF9F5] border-[#1E3A5F] text-[#1C1917]'
                        : 'bg-[#FBF9F5]/60 border-[#1C1917]/10 text-[#57534E] hover:text-[#1C1917]'
                    }`}
                  >
                    <div className="text-xs font-semibold">{opt.label}</div>
                    <div className="text-[11px] text-[#78716C] mt-0.5 line-clamp-1">
                      {opt.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Context Category */}
          <div className="flex flex-wrap items-center gap-1.5">
            {CONTEXT_CATEGORIES.map((cat) => {
              const active = contextCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setContextCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#1E3A5F] text-[#FBF9F5]'
                      : 'bg-[#FBF9F5] text-[#57534E] border border-[#1C1917]/12 hover:text-[#1C1917]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Supported Social Platforms (when Toxicity & Digital Pause is active) */}
          {lens === 'digital-check' && (
            <div className="space-y-1.5 pt-1">
              <div className="text-xs font-medium text-[#57534E]">Platform</div>
              <div className="flex flex-wrap items-center gap-1.5">
                {SOCIAL_PLATFORMS.map((plat) => {
                  const active = socialPlatform === plat;
                  return (
                    <button
                      key={plat}
                      type="button"
                      onClick={() => setSocialPlatform(plat)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-[#1C1917] text-[#FBF9F5]'
                          : 'bg-[#FBF9F5] text-[#57534E] border border-[#1C1917]/12 hover:text-[#1C1917]'
                      }`}
                    >
                      {plat}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <textarea
            value={eventText}
            onChange={(e) => setEventText(e.target.value)}
            rows={4}
            placeholder={
              lens === 'digital-check'
                ? 'Paste the comment, message, or draft reply you are reacting to...'
                : lens === 'behavioral-loop'
                  ? 'Describe the trigger, what crossed your mind, and how you ended up responding...'
                  : lens === 'future-self'
                    ? 'Describe the decision or boundary you are weighing (for example, changing roles, ending a commitment, or having a hard conversation)...'
                    : 'Describe what happened, what was said or done, and how it landed emotionally...'
            }
            className="w-full rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] p-3.5 text-sm leading-relaxed text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#1E3A5F]"
          />

          {errorMsg && (
            <div
              role="alert"
              className="text-sm text-[#9A3412] bg-[#FDF4F2] border border-[#9A3412]/25 rounded-md p-3"
            >
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-[#78716C]">
              Saved privately in your Emotional Memory archive
            </span>
            <button
              type="submit"
              disabled={isAnalyzing || eventText.trim().length < 8}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49] disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <span>
                  {lens === 'digital-check'
                    ? 'Examine Message'
                    : lens === 'behavioral-loop'
                      ? 'Map Thought & Habit Loop'
                      : lens === 'future-self'
                        ? 'Simulate Decision Impact'
                        : 'Deconstruct Event'}
                </span>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* Active Analysis Ledger & Saved Emotional Memory */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <aside className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-medium text-[#1C1917]">
              Emotional Memory
            </h2>
            <span className="font-mono text-xs text-[#78716C] tabular-nums">
              {records.length} {records.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search memory, triggers, or needs..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>

          {filteredRecords.length === 0 ? (
            <div className="border border-[#1C1917]/10 rounded-lg p-5 text-sm text-[#78716C] bg-[#F4F0E8]/40">
              {records.length === 0
                ? 'No Emotional Memory records yet. Select a lens and describe a situation or decision above.'
                : 'No records match your search filter.'}
            </div>
          ) : (
            <div className="divide-y divide-[#1C1917]/10 border border-[#1C1917]/10 rounded-lg bg-[#F4F0E8]/40">
              {filteredRecords.map((item) => {
                const selected = activeRecord?.id === item.id;
                return (
                  <div
                    key={item.id}
                    className={`p-4 flex items-start justify-between gap-3 transition-colors ${
                      selected ? 'bg-[#EBE6DF]/80' : 'hover:bg-[#F4F0E8]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className="text-left min-w-0 flex-1 space-y-1"
                    >
                      <div className="text-xs text-[#78716C]">
                        <span>{item.contextCategory}</span>
                        <span className="mx-1.5" aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-[#1C1917] truncate">
                        {item.summaryTitle}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteRecord(item.id)}
                      aria-label={`Delete ${item.summaryTitle}`}
                      className="p-1 text-[#78716C] hover:text-[#9A3412] rounded shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        <div className="lg:col-span-8">
          {!activeRecord ? (
            <div className="border border-[#1C1917]/10 rounded-lg bg-[#F4F0E8]/35 p-8 sm:p-12 space-y-6">
              <h3 className="font-serif text-2xl font-medium text-[#1C1917]">
                Four Analytical Lenses
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm text-[#57534E]">
                <div className="space-y-1.5">
                  <div className="font-semibold text-[#1C1917]">Conflict & Emotion</div>
                  <p>Separates observable facts from assumptions, maps emotional signals, and turns unmet needs into respectful requests.</p>
                </div>
                <div className="space-y-1.5">
                  <div className="font-semibold text-[#1C1917]">Cognitive & Habit Loop</div>
                  <p>Traces Trigger → Thought → Emotion → Behavior → Outcome with CBT cognitive pattern checks.</p>
                </div>
                <div className="space-y-1.5">
                  <div className="font-semibold text-[#1C1917]">Toxicity & Digital Pause</div>
                  <p>Clarifies the core issue and emotional trigger behind heated online replies before impulsive escalation.</p>
                </div>
                <div className="space-y-1.5">
                  <div className="font-semibold text-[#1C1917]">Future Self Simulator</div>
                  <p>Explores short-, medium-, and long-term emotional, relational, and values alignment tradeoffs before you decide.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {activeRecord.crisisDetected && (
                <CrisisBanner
                  detectedCategories={activeRecord.safetyCategories}
                  onOpenResources={onOpenCrisisSupport}
                />
              )}

              <div className="border border-[#1C1917]/12 rounded-lg bg-[#FBF9F5] p-6 sm:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#1C1917]/10 pb-5">
                  <div className="space-y-1.5">
                    <div className="text-xs text-[#78716C]">
                      <span>{activeRecord.contextCategory}</span>
                      <span className="mx-2" aria-hidden="true">·</span>
                      <span>
                        {LENS_OPTIONS.find((l) => l.id === activeRecord.lens)?.label || 'Conflict & Emotion'}
                      </span>
                      <span className="mx-2" aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {new Date(activeRecord.createdAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <h3 className="font-serif text-2xl font-medium text-[#1C1917]">
                      {activeRecord.summaryTitle}
                    </h3>
                    <p className="text-sm text-[#57534E] leading-relaxed pt-1">
                      “{activeRecord.rawEvent}”
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDiscussInDialogue(activeRecord)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49] transition-colors whitespace-nowrap shrink-0 self-start"
                  >
                    <span>Explore in Dialogue</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Future Self Simulator Section */}
                {activeRecord.futureSimulation && activeRecord.futureSimulation.shortTermImpact && (
                  <div className="border border-[#1C1917]/12 rounded-lg bg-[#F4F0E8]/55 divide-y divide-[#1C1917]/10">
                    <div className="px-5 py-3 text-xs font-semibold text-[#1E3A5F]">
                      Future Self Consequence Horizon
                    </div>
                    <div className="p-5 space-y-5 text-sm">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-3.5 rounded-md bg-[#FBF9F5] border border-[#1C1917]/10 space-y-1">
                          <div className="text-xs font-semibold text-[#1E3A5F]">1–2 Weeks (Short-Term)</div>
                          <p className="text-[#292524] leading-relaxed">{activeRecord.futureSimulation.shortTermImpact}</p>
                        </div>
                        <div className="p-3.5 rounded-md bg-[#FBF9F5] border border-[#1C1917]/10 space-y-1">
                          <div className="text-xs font-semibold text-[#1E3A5F]">6–12 Months (Medium-Term)</div>
                          <p className="text-[#292524] leading-relaxed">{activeRecord.futureSimulation.mediumTermImpact}</p>
                        </div>
                        <div className="p-3.5 rounded-md bg-[#FBF9F5] border border-[#1C1917]/10 space-y-1">
                          <div className="text-xs font-semibold text-[#1E3A5F]">3–5 Years (Long-Term)</div>
                          <p className="text-[#292524] leading-relaxed">{activeRecord.futureSimulation.longTermImpact}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-[#1C1917]">Values Alignment</div>
                          <p className="text-[#292524] leading-relaxed">{activeRecord.futureSimulation.valuesAlignment}</p>
                        </div>
                        {activeRecord.futureSimulation.hiddenTradeoffs?.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-xs font-semibold text-[#1C1917]">Hidden Tradeoffs to Consider</div>
                            <ul className="space-y-1 text-[#292524]">
                              {activeRecord.futureSimulation.hiddenTradeoffs.map((t, i) => (
                                <li key={i} className="leading-relaxed">{t}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Digital Behavior Check Section */}
                {activeRecord.digitalCheck && activeRecord.digitalCheck.actualIssue && (
                  <div className="border border-[#1C1917]/12 rounded-lg bg-[#F4F0E8]/55 divide-y divide-[#1C1917]/10">
                    <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#1E3A5F]">
                        Toxicity Detector & Digital Pause Analysis
                      </span>
                      {activeRecord.digitalCheck.platform && (
                        <span className="text-xs text-[#78716C]">
                          {activeRecord.digitalCheck.platform}
                        </span>
                      )}
                    </div>
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-[#1C1917]">1. Actual Issue</div>
                        <p className="text-[#292524] leading-relaxed">{activeRecord.digitalCheck.actualIssue}</p>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-[#1C1917]">2. Emotional Trigger</div>
                        <p className="text-[#292524] leading-relaxed">{activeRecord.digitalCheck.emotionalTrigger}</p>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-[#1C1917]">3. Likely Outcome of Impulse</div>
                        <p className="text-[#292524] leading-relaxed">{activeRecord.digitalCheck.likelyOutcome}</p>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-[#1E3A5F]">4. Healthier Alternative</div>
                        <p className="text-[#1C1917] leading-relaxed font-medium">
                          {activeRecord.digitalCheck.healthierAlternative}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Behavioral & Cognitive Loop Section */}
                {activeRecord.behavioralLoop && activeRecord.behavioralLoop.trigger && (
                  <div className="border border-[#1C1917]/12 rounded-lg bg-[#F4F0E8]/55 divide-y divide-[#1C1917]/10">
                    <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#1E3A5F]">
                        Behavioral & Cognitive Chain
                      </span>
                      <span className="text-xs text-[#78716C]">
                        Trigger → Thought → Emotion → Behavior → Outcome
                      </span>
                    </div>
                    <div className="p-5 space-y-5">
                      <div className="space-y-1.5">
                        {(
                          [
                            [
                              '01',
                              'Trigger',
                              'Observable event or internal cue',
                              activeRecord.behavioralLoop.trigger,
                            ],
                            [
                              '02',
                              'Thought',
                              'Automatic interpretation or belief',
                              activeRecord.behavioralLoop.thought,
                            ],
                            [
                              '03',
                              'Emotion',
                              'Felt emotional & bodily signal',
                              activeRecord.behavioralLoop.emotion,
                            ],
                            [
                              '04',
                              'Behavior',
                              'Action, avoidance, or coping reaction',
                              activeRecord.behavioralLoop.behavior,
                            ],
                            [
                              '05',
                              'Outcome',
                              'Immediate & relational result',
                              activeRecord.behavioralLoop.outcome ||
                                activeRecord.behavioralLoop.consequence ||
                                '',
                            ],
                          ] as [string, string, string, string][]
                        ).map(([num, step, cue, val], idx, arr) => (
                          <div key={step} className="space-y-1.5">
                            <div className="p-3.5 rounded-md bg-[#FBF9F5] border border-[#1C1917]/10 grid grid-cols-1 sm:grid-cols-12 gap-2 items-baseline">
                              <div className="sm:col-span-4 space-y-0.5">
                                <div className="text-xs font-semibold text-[#1E3A5F]">
                                  <span className="font-mono tabular-nums mr-1.5 text-[#78716C]">
                                    {num}.
                                  </span>
                                  {step}
                                </div>
                                <div className="text-[11px] text-[#78716C]">{cue}</div>
                              </div>
                              <p className="sm:col-span-8 text-sm text-[#292524] leading-relaxed">
                                {val}
                              </p>
                            </div>
                            {idx < arr.length - 1 && (
                              <div
                                className="flex justify-center sm:justify-start sm:pl-6 text-xs font-mono text-[#78716C] select-none"
                                aria-hidden="true"
                              >
                                ↓
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {activeRecord.behavioralLoop.interruptionPoint && (
                        <div className="p-4 rounded-md bg-[#FBF9F5] border border-[#1E3A5F]/25 space-y-1">
                          <div className="text-xs font-semibold text-[#1E3A5F]">
                            Where a Pause Shifts the Outcome
                          </div>
                          <p className="text-sm text-[#1C1917] leading-relaxed">
                            {activeRecord.behavioralLoop.interruptionPoint}
                          </p>
                        </div>
                      )}
                      {activeRecord.behavioralLoop.cognitivePatterns?.length > 0 && (
                        <div className="text-sm space-y-1">
                          <div className="text-xs font-semibold text-[#57534E]">
                            CBT Cognitive Distortion Check
                          </div>
                          <p className="text-[#292524]">
                            {activeRecord.behavioralLoop.cognitivePatterns.join(' · ')}
                          </p>
                        </div>
                      )}
                      {activeRecord.behavioralLoop.distortionChecks &&
                        activeRecord.behavioralLoop.distortionChecks.length > 0 && (
                          <div className="space-y-2.5 pt-2 border-t border-[#1C1917]/10">
                            <div className="text-xs font-semibold text-[#1E3A5F]">
                              Structured Distortion Breakdown
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {activeRecord.behavioralLoop.distortionChecks.map((dc) => (
                                <div
                                  key={dc.key}
                                  className="p-3 rounded-md bg-[#FBF9F5] border border-[#1C1917]/10 space-y-1 text-xs"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-[#1C1917]">{dc.name}</span>
                                    <span className="text-[#78716C]">
                                      {dc.present ? 'Signaled' : 'Not signaled'}
                                    </span>
                                  </div>
                                  <p className="text-[#57534E] leading-relaxed">
                                    {dc.evidenceSignal}
                                  </p>
                                  {dc.present && dc.groundedReframe && (
                                    <p className="text-[#1C1917] leading-relaxed pt-1">
                                      Reframe: {dc.groundedReframe}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      {activeRecord.behavioralLoop.awarenessNote && (
                        <p className="text-sm text-[#57534E] leading-relaxed">
                          {activeRecord.behavioralLoop.awarenessNote}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Standard Conflict & Emotional Layers */}
                <div className="divide-y divide-[#1C1917]/10">
                  {activeRecord.facts.length > 0 && (
                    <div className="py-4 grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-4 space-y-0.5">
                        <div className="text-xs font-semibold text-[#1C1917]">
                          01. Observable Facts
                        </div>
                        <div className="text-xs text-[#78716C]">
                          What a camera or microphone would record
                        </div>
                      </div>
                      <ul className="sm:col-span-8 space-y-1.5 text-sm text-[#292524]">
                        {activeRecord.facts.map((fact, idx) => (
                          <li key={idx} className="leading-relaxed">
                            {fact}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {activeRecord.interpretations.length > 0 && (
                    <div className="py-4 grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-4 space-y-0.5">
                        <div className="text-xs font-semibold text-[#1C1917]">
                          02. Interpretations & Beliefs
                        </div>
                        <div className="text-xs text-[#78716C]">
                          Meanings or assumptions applied
                        </div>
                      </div>
                      <ul className="sm:col-span-8 space-y-1.5 text-sm text-[#292524]">
                        {activeRecord.interpretations.map((item, idx) => (
                          <li key={idx} className="leading-relaxed">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {activeRecord.emotions.length > 0 && (
                    <div className="py-4 grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-4 space-y-0.5">
                        <div className="text-xs font-semibold text-[#1C1917]">
                          03. Emotions & Signal Mapping
                        </div>
                        <div className="text-xs text-[#78716C]">
                          Feelings and what they may be protecting
                        </div>
                      </div>
                      <div className="sm:col-span-8 space-y-2.5">
                        {activeRecord.emotions.map((em, idx) => (
                          <div key={idx} className="text-sm">
                            <span className="font-semibold text-[#1E3A5F]">{em.name}: </span>
                            <span className="text-[#292524]">{em.signal}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeRecord.needs.length > 0 && (
                    <div className="py-4 grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-4 space-y-0.5">
                        <div className="text-xs font-semibold text-[#1C1917]">
                          04. Underlying Needs
                        </div>
                        <div className="text-xs text-[#78716C]">
                          Core human needs activated or unmet
                        </div>
                      </div>
                      <ul className="sm:col-span-8 space-y-1.5 text-sm text-[#292524]">
                        {activeRecord.needs.map((need, idx) => (
                          <li key={idx} className="leading-relaxed">
                            {need}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {activeRecord.requests && activeRecord.requests.length > 0 && (
                    <div className="py-4 grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-4 space-y-0.5">
                        <div className="text-xs font-semibold text-[#1C1917]">
                          05. Constructive Requests
                        </div>
                        <div className="text-xs text-[#78716C]">
                          Clear, respectful ways to ask for change
                        </div>
                      </div>
                      <ul className="sm:col-span-8 space-y-1.5 text-sm text-[#292524]">
                        {activeRecord.requests.map((reqItem, idx) => (
                          <li key={idx} className="leading-relaxed">
                            {reqItem}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {activeRecord.actions.length > 0 && (
                    <div className="py-4 grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-4 space-y-0.5">
                        <div className="text-xs font-semibold text-[#1C1917]">
                          06. Grounded Next Actions
                        </div>
                        <div className="text-xs text-[#78716C]">
                          Values-aligned steps within your control
                        </div>
                      </div>
                      <ul className="sm:col-span-8 space-y-1.5 text-sm text-[#292524]">
                        {activeRecord.actions.map((action, idx) => (
                          <li key={idx} className="leading-relaxed">
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {activeRecord.reflectiveQuestions.length > 0 && (
                  <div className="border-t border-[#1C1917]/10 pt-5 space-y-2">
                    <div className="text-xs font-semibold text-[#57534E]">
                      Questions for Deeper Self-Inquiry
                    </div>
                    <ul className="space-y-1.5 text-sm text-[#1C1917]">
                      {activeRecord.reflectiveQuestions.map((q, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
        </>
      ) : (
        /* SECTION 2: DEDICATED COGNITIVE DISTORTIONS ANALYZER */
        <div className="space-y-10">
          {/* Intro, Reference Selector & Thought Input */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start border-b border-[#1C1917]/10 pb-10">
            <div className="lg:col-span-5 space-y-5">
              <div className="space-y-3">
                <p className="text-xs font-medium text-[#1E3A5F]">
                  Cognitive Distortion Analyzer · Evidence-Informed CBT
                </p>
                <h1 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-[#1C1917] [text-wrap:balance]">
                  Spot thinking shortcuts before they harden into truth
                </h1>
                <p className="text-sm sm:text-base leading-relaxed text-[#57534E]">
                  Under stress, the mind reaches for fast protective shortcuts. Examine any automatic thought across five core distortions—with curiosity rather than self-criticism.
                </p>
              </div>

              {/* Interactive 5-Distortion Guide */}
              <div className="border border-[#1C1917]/12 rounded-lg bg-[#F4F0E8]/55 p-4 space-y-3">
                <div className="text-xs font-semibold text-[#1C1917]">
                  Five Core Cognitive Distortions
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {COGNITIVE_DISTORTION_GUIDE.map((item) => {
                    const active = activeGuideKey === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setActiveGuideKey(item.key)}
                        className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-[#1E3A5F] text-[#FBF9F5]'
                            : 'bg-[#FBF9F5] text-[#57534E] border border-[#1C1917]/12 hover:text-[#1C1917]'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
                <div className="pt-1 space-y-2 text-xs text-[#292524]">
                  <p className="leading-relaxed">{activeGuideItem.definition}</p>
                  <p className="text-[#57534E] italic">{activeGuideItem.innerCue}</p>
                  <p className="text-[#1E3A5F]">
                    Inquiry: {activeGuideItem.gentleQuestion}
                  </p>
                  <button
                    type="button"
                    onClick={() => setThoughtInput(activeGuideItem.sampleThought)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1E3A5F] hover:underline pt-1"
                  >
                    <span>Load example thought into analyzer</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <form
              onSubmit={handleAnalyzeDistortions}
              className="lg:col-span-7 border border-[#1C1917]/12 rounded-lg bg-[#F4F0E8]/55 p-5 sm:p-6 space-y-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <label
                  htmlFor="cognitive-thought-input"
                  className="text-xs font-semibold text-[#1C1917]"
                >
                  Automatic Thought or Stressful Interpretation
                </label>
                <span className="text-xs text-[#78716C]">
                  Evaluates all 5 distortions simultaneously
                </span>
              </div>

              <textarea
                id="cognitive-thought-input"
                value={thoughtInput}
                onChange={(e) => setThoughtInput(e.target.value)}
                rows={6}
                placeholder="Write down the thought looping in your mind (e.g. 'Nobody replied to my message—they must be annoyed with me, and I always ruin friendships')..."
                className="w-full rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] p-4 text-sm leading-relaxed text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#1E3A5F]"
              />

              {distortionError && (
                <div
                  role="alert"
                  className="text-sm text-[#9A3412] bg-[#FDF4F2] border border-[#9A3412]/25 rounded-md p-3"
                >
                  {distortionError}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-4">
                <span className="text-xs text-[#78716C]">
                  Catastrophizing · Personalization · Overgeneralization · Emotional Reasoning · Mind Reading
                </span>
                <button
                  type="submit"
                  disabled={isScanningDistortions || thoughtInput.trim().length < 8}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49] disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {isScanningDistortions ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Evaluating Patterns...</span>
                    </>
                  ) : (
                    <span>Analyze Thought Patterns</span>
                  )}
                </button>
              </div>
            </form>
          </section>

          {/* Saved Distortion Scans & Active Result */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <aside className="lg:col-span-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl font-medium text-[#1C1917]">
                  Thought Checks
                </h2>
                <span className="font-mono text-xs text-[#78716C] tabular-nums">
                  {distortionReports.length}{' '}
                  {distortionReports.length === 1 ? 'scan' : 'scans'}
                </span>
              </div>

              {distortionReports.length === 0 ? (
                <div className="border border-[#1C1917]/10 rounded-lg p-5 text-sm text-[#78716C] bg-[#F4F0E8]/40">
                  No cognitive distortion scans saved yet. Enter an automatic thought or load one of the five examples above.
                </div>
              ) : (
                <div className="divide-y divide-[#1C1917]/10 border border-[#1C1917]/10 rounded-lg bg-[#F4F0E8]/40">
                  {distortionReports.map((rep) => {
                    const selected = activeDistortionReport?.id === rep.id;
                    const activeCount = rep.distortions.filter((d) => d.present).length;
                    return (
                      <div
                        key={rep.id}
                        className={`p-4 flex items-start justify-between gap-3 transition-colors ${
                          selected ? 'bg-[#EBE6DF]/80' : 'hover:bg-[#F4F0E8]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedDistortionId(rep.id)}
                          className="text-left min-w-0 flex-1 space-y-1"
                        >
                          <div className="text-xs text-[#78716C]">
                            <span className="font-mono tabular-nums">
                              {activeCount} signaled
                            </span>
                            <span className="mx-1.5" aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {new Date(rep.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="text-sm font-semibold text-[#1C1917] truncate">
                            {rep.thoughtSummary}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteDistortionReport(rep.id)}
                          aria-label={`Delete ${rep.thoughtSummary}`}
                          className="p-1 text-[#78716C] hover:text-[#9A3412] rounded shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </aside>

            <div className="lg:col-span-8">
              {!activeDistortionReport ? (
                <div className="border border-[#1C1917]/10 rounded-lg bg-[#F4F0E8]/35 p-8 sm:p-10 space-y-6">
                  <h3 className="font-serif text-2xl font-medium text-[#1C1917]">
                    What the Cognitive Distortion Analyzer Checks
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm text-[#57534E]">
                    {COGNITIVE_DISTORTION_GUIDE.map((item) => (
                      <div key={item.key} className="space-y-1">
                        <div className="font-semibold text-[#1C1917]">{item.label}</div>
                        <p className="leading-relaxed">{item.definition}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {activeDistortionReport.crisisDetected && (
                    <CrisisBanner
                      detectedCategories={activeDistortionReport.safetyCategories}
                      onOpenResources={onOpenCrisisSupport}
                    />
                  )}

                  <div className="border border-[#1C1917]/12 rounded-lg bg-[#FBF9F5] p-6 sm:p-8 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#1C1917]/10 pb-5">
                      <div className="space-y-1.5">
                        <div className="text-xs text-[#78716C]">
                          <span>Cognitive Distortion Analyzer</span>
                          <span className="mx-2" aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {
                              activeDistortionReport.distortions.filter((d) => d.present)
                                .length
                            }{' '}
                            of 5 signaled
                          </span>
                          <span className="mx-2" aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {new Date(activeDistortionReport.createdAt).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <h3 className="font-serif text-2xl font-medium text-[#1C1917]">
                          {activeDistortionReport.thoughtSummary}
                        </h3>
                        <p className="text-sm text-[#57534E] leading-relaxed pt-1">
                          “{activeDistortionReport.rawThought}”
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0 self-start">
                        <button
                          type="button"
                          onClick={() => setShowDistortionJson((prev) => !prev)}
                          className="px-3 py-2 text-xs font-medium border border-[#1C1917]/20 text-[#57534E] rounded-md hover:text-[#1C1917] hover:bg-[#EBE6DF] transition-colors whitespace-nowrap"
                        >
                          {showDistortionJson ? 'Hide JSON' : 'View JSON'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onDiscussDistortionInDialogue(activeDistortionReport)
                          }
                          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49] transition-colors whitespace-nowrap"
                        >
                          <span>Explore in Dialogue</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {showDistortionJson && (
                      <pre className="p-4 rounded-md bg-[#F4F0E8] border border-[#1C1917]/10 text-xs font-mono text-[#1C1917] overflow-x-auto leading-relaxed">
                        {JSON.stringify(
                          {
                            thoughtSummary: activeDistortionReport.thoughtSummary,
                            emotionalUndercurrent:
                              activeDistortionReport.emotionalUndercurrent,
                            distortions: activeDistortionReport.distortions,
                            balancedPerspective:
                              activeDistortionReport.balancedPerspective,
                          },
                          null,
                          2
                        )}
                      </pre>
                    )}

                    {activeDistortionReport.emotionalUndercurrent && (
                      <div className="p-4 rounded-md bg-[#F4F0E8]/60 border border-[#1C1917]/10 space-y-1">
                        <div className="text-xs font-semibold text-[#1E3A5F]">
                          Emotional Undercurrent
                        </div>
                        <p className="text-sm text-[#292524] leading-relaxed">
                          {activeDistortionReport.emotionalUndercurrent}
                        </p>
                      </div>
                    )}

                    {/* All 5 Canonical Cognitive Distortions */}
                    <div className="divide-y divide-[#1C1917]/10">
                      {[...activeDistortionReport.distortions]
                        .sort((a, b) => Number(b.present) - Number(a.present))
                        .map((item) => (
                          <div key={item.key} className="py-5 space-y-2.5">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <h4 className="font-serif text-lg font-medium text-[#1C1917]">
                                {item.name}
                              </h4>
                              <span
                                className={`text-xs font-medium ${
                                  item.present ? 'text-[#1E3A5F]' : 'text-[#78716C]'
                                }`}
                              >
                                {item.present
                                  ? 'Signaled in framing · Worth gently testing'
                                  : 'Not strongly signaled'}
                              </span>
                            </div>

                            <p className="text-sm text-[#57534E] leading-relaxed">
                              {item.evidenceSignal}
                            </p>

                            {item.present && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 text-sm">
                                <div className="p-3.5 rounded-md bg-[#F4F0E8]/60 border border-[#1C1917]/10 space-y-1">
                                  <div className="text-xs font-semibold text-[#57534E]">
                                    Why this protection makes sense
                                  </div>
                                  <p className="text-[#292524] leading-relaxed">
                                    {item.compassionateContext}
                                  </p>
                                </div>
                                <div className="p-3.5 rounded-md bg-[#F4F0E8]/60 border border-[#1C1917]/10 space-y-1">
                                  <div className="text-xs font-semibold text-[#1E3A5F]">
                                    Grounded Reframe
                                  </div>
                                  <p className="text-[#1C1917] leading-relaxed">
                                    {item.groundedReframe}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>

                    {activeDistortionReport.balancedPerspective && (
                      <div className="border-t border-[#1C1917]/10 pt-5 space-y-1.5">
                        <div className="text-xs font-semibold text-[#1E3A5F]">
                          Balanced Perspective
                        </div>
                        <p className="text-sm sm:text-base text-[#1C1917] leading-relaxed">
                          {activeDistortionReport.balancedPerspective}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
