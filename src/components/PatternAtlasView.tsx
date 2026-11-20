import { useMemo, useState } from 'react';
import { Check, Compass, Download, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { gatewayFetch } from '../lib/gatewayClient';
import {
  EventAnalysisRecord,
  ExplainMePortrait,
  GrowthJournalEntry,
  HypothesisStatus,
  LifeTimelineEvent,
  PatternDimension,
  PatternHypothesis,
  PersonalityAnalystProfile,
  ReflectionSession,
  RelationshipArea,
  RelationshipAreaInsight,
  RelationshipNode,
  WellbeingCheckIn,
} from '../types/humanos';

interface PatternAtlasViewProps {
  hypotheses: PatternHypothesis[];
  sessions: ReflectionSession[];
  eventAnalyses: EventAnalysisRecord[];
  wellbeingCheckIns: WellbeingCheckIn[];
  timelineEvents: LifeTimelineEvent[];
  journalEntries: GrowthJournalEntry[];
  relationships: RelationshipNode[];
  relationshipInsights: RelationshipAreaInsight[];
  explainMePortrait: ExplainMePortrait | null;
  personalityProfile: PersonalityAnalystProfile | null;
  onAddHypothesis: (input: {
    dimension: PatternDimension;
    statement: string;
    rationale: string;
    source: PatternHypothesis['source'];
    status?: HypothesisStatus;
  }) => void;
  onUpdateHypothesis: (
    id: string,
    patch: Partial<Pick<PatternHypothesis, 'status' | 'statement' | 'dimension' | 'rationale'>>
  ) => void;
  onRemoveHypothesis: (id: string) => void;
  onAddWellbeingCheckIn: (input: Omit<WellbeingCheckIn, 'id' | 'createdAt'>) => void;
  onDeleteWellbeingCheckIn: (id: string) => void;
  onAddTimelineEvent: (input: Omit<LifeTimelineEvent, 'id' | 'createdAt'>) => void;
  onDeleteTimelineEvent: (id: string) => void;
  onAddJournalEntry: (input: Omit<GrowthJournalEntry, 'id' | 'createdAt'>) => void;
  onDeleteJournalEntry: (id: string) => void;
  onAddRelationshipNode: (input: Omit<RelationshipNode, 'id' | 'updatedAt'>) => void;
  onDeleteRelationshipNode: (id: string) => void;
  onAddRelationshipInsight: (
    insight: Omit<RelationshipAreaInsight, 'id' | 'createdAt'>
  ) => RelationshipAreaInsight;
  onDeleteRelationshipInsight: (id: string) => void;
  onSetExplainMePortrait: (portrait: ExplainMePortrait | null) => void;
  onSetPersonalityProfile: (profile: PersonalityAnalystProfile | null) => void;
  onClearAllData: () => void;
}

const DIMENSIONS: PatternDimension[] = [
  'Values',
  'Strengths',
  'Triggers',
  'Challenges',
  'Relational & Communication',
];

const STATUS_LABELS: Record<HypothesisStatus, string> = {
  hypothesis: 'Tentative hypothesis',
  resonates: 'Confirmed by you',
  nuanced: 'Refined by you',
  dismissed: 'Dismissed',
};

const WELLBEING_FIELDS: {
  key: keyof Omit<WellbeingCheckIn, 'id' | 'createdAt' | 'note'>;
  label: string;
  lowLabel: string;
  highLabel: string;
}[] = [
  { key: 'mood', label: 'Mood', lowLabel: 'Heavy', highLabel: 'Steady / Bright' },
  { key: 'stress', label: 'Stress Load', lowLabel: 'Calm', highLabel: 'Overloaded' },
  { key: 'anxiety', label: 'Anxiety', lowLabel: 'At ease', highLabel: 'On edge' },
  { key: 'socialConnection', label: 'Social Connection', lowLabel: 'Isolated', highLabel: 'Connected' },
  { key: 'selfEsteem', label: 'Self-Esteem', lowLabel: 'Self-critical', highLabel: 'Grounded worth' },
  { key: 'motivation', label: 'Motivation', lowLabel: 'Depleted', highLabel: 'Engaged' },
  { key: 'energy', label: 'Energy', lowLabel: 'Exhausted', highLabel: 'Restored' },
  { key: 'lifeSatisfaction', label: 'Life Satisfaction', lowLabel: 'Discontent', highLabel: 'Aligned' },
];

const TIMELINE_CHAPTERS: LifeTimelineEvent['chapter'][] = [
  'Childhood & Foundations',
  'Education & Early Career',
  'Relationships',
  'Turning Point',
  'Present Chapter',
];

const JOURNAL_PROMPTS = [
  'What emotion visited you most strongly today, and what need might it have been protecting?',
  'Where did you act in alignment with your core values today, even in a small moment?',
  'What situation triggered a familiar reaction, and what alternative response feels wiser next time?',
  'What gives your days a sense of meaning or purpose right now?',
];

const RELATIONSHIP_AREAS: {
  area: RelationshipArea;
  defaultRole: RelationshipNode['role'];
  focus: string;
}[] = [
  {
    area: 'Romantic Relationships',
    defaultRole: 'Partner',
    focus: 'Attachment safety, emotional intimacy, bids for connection, and shared expectations.',
  },
  {
    area: 'Friendships',
    defaultRole: 'Friend',
    focus: 'Reciprocity, trust repair, unspoken expectations, and honest boundaries.',
  },
  {
    area: 'Family',
    defaultRole: 'Family',
    focus: 'Inherited roles, individuation vs. obligation, and respectful emotional limits.',
  },
  {
    area: 'Work Relationships',
    defaultRole: 'Colleague',
    focus: 'Psychological safety, role clarity, authority/peer communication, and workload boundaries.',
  },
];

const RELATIONSHIP_ROLES: RelationshipNode['role'][] = [
  'Partner',
  'Friend',
  'Family',
  'Colleague',
  'Mentor',
  'Community',
];

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function PatternAtlasView({
  hypotheses,
  sessions,
  eventAnalyses,
  wellbeingCheckIns,
  timelineEvents,
  journalEntries,
  relationships,
  relationshipInsights,
  explainMePortrait,
  personalityProfile,
  onAddHypothesis,
  onUpdateHypothesis,
  onRemoveHypothesis,
  onAddWellbeingCheckIn,
  onDeleteWellbeingCheckIn,
  onAddTimelineEvent,
  onDeleteTimelineEvent,
  onAddJournalEntry,
  onDeleteJournalEntry,
  onAddRelationshipNode,
  onDeleteRelationshipNode,
  onAddRelationshipInsight,
  onDeleteRelationshipInsight,
  onSetExplainMePortrait,
  onSetPersonalityProfile,
  onClearAllData,
}: PatternAtlasViewProps) {
  const [atlasSection, setAtlasSection] = useState<
    'model' | 'wellbeing' | 'timeline' | 'relationships'
  >('model');
  const [dimensionFilter, setDimensionFilter] = useState<'All' | PatternDimension>('All');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [isProfiling, setIsProfiling] = useState(false);
  const [showAnalystJson, setShowAnalystJson] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDimension, setNewDimension] = useState<PatternDimension>('Values');
  const [newStatement, setNewStatement] = useState('');
  const [newRationale, setNewRationale] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  // Wellbeing Check-in Form
  const [wbForm, setWbForm] = useState({
    mood: 3,
    stress: 3,
    anxiety: 2,
    socialConnection: 3,
    selfEsteem: 3,
    motivation: 3,
    energy: 3,
    lifeSatisfaction: 3,
    note: '',
  });

  // Timeline Form
  const [tlForm, setTlForm] = useState<{
    timeframe: string;
    title: string;
    chapter: LifeTimelineEvent['chapter'];
    emotionalImpact: string;
    patternOrLesson: string;
  }>({
    timeframe: '',
    title: '',
    chapter: 'Turning Point',
    emotionalImpact: '',
    patternOrLesson: '',
  });

  // Growth Journal Form
  const [journalPromptIdx, setJournalPromptIdx] = useState(0);
  const [journalText, setJournalText] = useState('');
  const [journalValue, setJournalValue] = useState('');

  // Relationship Graph Form & Area Specialist
  const [relationshipAreaFilter, setRelationshipAreaFilter] = useState<'All' | RelationshipArea>('All');
  const [relForm, setRelForm] = useState<{
    name: string;
    area: RelationshipArea;
    role: RelationshipNode['role'];
    closeness: number;
    tension: number;
    dynamicNote: string;
    sharedNeed: string;
  }>({
    name: '',
    area: 'Romantic Relationships',
    role: 'Partner',
    closeness: 4,
    tension: 2,
    dynamicNote: '',
    sharedNeed: '',
  });
  const [relInsightArea, setRelInsightArea] = useState<RelationshipArea>('Romantic Relationships');
  const [relSituation, setRelSituation] = useState('');
  const [isAnalyzingRel, setIsAnalyzingRel] = useState(false);

  const filteredRelationships = useMemo(() => {
    if (relationshipAreaFilter === 'All') return relationships;
    return relationships.filter((r) => r.area === relationshipAreaFilter);
  }, [relationships, relationshipAreaFilter]);

  const visibleHypotheses = hypotheses.filter((h) => {
    if (h.status === 'dismissed') return false;
    if (dimensionFilter === 'All') return true;
    return h.dimension === dimensionFilter;
  });

  // Observable non-diagnostic wellbeing indicators computed strictly from logged check-ins
  const wellbeingSignals = useMemo(() => {
    if (wellbeingCheckIns.length === 0) return null;
    const recent = wellbeingCheckIns.slice(0, 7);
    const stressAvg = avg(recent.map((r) => r.stress));
    const energyAvg = avg(recent.map((r) => r.energy));
    const motivAvg = avg(recent.map((r) => r.motivation));
    const moodAvg = avg(recent.map((r) => r.mood));
    const satAvg = avg(recent.map((r) => r.lifeSatisfaction));
    const anxAvg = avg(recent.map((r) => r.anxiety));
    const esteemAvg = avg(recent.map((r) => r.selfEsteem));
    const connAvg = avg(recent.map((r) => r.socialConnection));

    const burnoutLoad = (stressAvg + (6 - energyAvg) + (6 - motivAvg)) / 3;
    const lowMoodStrain = ((6 - moodAvg) + (6 - satAvg)) / 2;
    const resilienceIndex = (moodAvg + esteemAvg + connAvg + energyAvg) / 4;

    const labelForStrain = (val: number) =>
      val >= 3.6 ? 'Elevated strain' : val >= 2.6 ? 'Watchful' : 'Steady';
    const labelForPositive = (val: number) =>
      val >= 3.7 ? 'Grounded' : val >= 2.6 ? 'Moderate' : 'Needs care';

    return {
      sampleCount: recent.length,
      burnoutLoad: { value: burnoutLoad.toFixed(1), status: labelForStrain(burnoutLoad) },
      lowMoodStrain: { value: lowMoodStrain.toFixed(1), status: labelForStrain(lowMoodStrain) },
      anxietyPattern: { value: anxAvg.toFixed(1), status: labelForStrain(anxAvg) },
      selfEsteem: { value: esteemAvg.toFixed(1), status: labelForPositive(esteemAvg) },
      resilience: { value: resilienceIndex.toFixed(1), status: labelForPositive(resilienceIndex) },
    };
  }, [wellbeingCheckIns]);

  const buildFullContextBundle = () => {
    const sessionSummaries = sessions
      .flatMap((s) => s.messages.map((m) => `[${s.title} | ${m.role}]: ${m.content}`))
      .slice(-24)
      .join('\n');

    const eventSummaries = eventAnalyses
      .slice(0, 10)
      .map(
        (e) =>
          `[Event: ${e.summaryTitle}] Facts: ${e.facts.join('; ')} | Emotions: ${e.emotions
            .map((em) => em.name)
            .join(', ')} | Needs: ${e.needs.join(', ')}`
      )
      .join('\n');

    const timelineSummary = timelineEvents
      .slice(0, 10)
      .map((t) => `[Timeline ${t.timeframe} | ${t.chapter}]: ${t.title} — ${t.patternOrLesson}`)
      .join('\n');

    const journalSummary = journalEntries
      .slice(0, 10)
      .map((j) => `[Journal | Value: ${j.valueActivated || 'Reflection'}]: ${j.entry}`)
      .join('\n');

    const relSummary = relationships
      .slice(0, 10)
      .map(
        (r) =>
          `[Relationship ${r.name} (${r.area} / ${r.role}) Closeness=${r.closeness}/5 Tension=${r.tension}/5]: ${r.dynamicNote} | Need: ${r.sharedNeed}`
      )
      .join('\n');

    const wellbeingSummary = wellbeingCheckIns
      .slice(0, 8)
      .map(
        (w) =>
          `[Wellbeing ${new Date(w.createdAt).toLocaleDateString()}]: Mood ${w.mood}/5, Stress ${w.stress}/5, Anxiety ${w.anxiety}/5, Connection ${w.socialConnection}/5, Self-Esteem ${w.selfEsteem}/5, Motivation ${w.motivation}/5, Energy ${w.energy}/5, Satisfaction ${w.lifeSatisfaction}/5${w.note ? ` — ${w.note}` : ''}`
      )
      .join('\n');

    return {
      sessionSummaries,
      eventSummaries,
      wellbeingSummary,
      fullBundle: [
        sessionSummaries,
        eventSummaries,
        timelineSummary,
        journalSummary,
        relSummary,
        wellbeingSummary,
      ]
        .filter(Boolean)
        .join('\n\n'),
    };
  };

  const handleSynthesize = async () => {
    setIsSynthesizing(true);
    setActionError(null);

    try {
      const { sessionSummaries, eventSummaries, wellbeingSummary } = buildFullContextBundle();
      const combined = [sessionSummaries, eventSummaries].filter(Boolean).join('\n\n');
      if (combined.trim().length < 20 && wellbeingSummary.trim().length < 20) {
        throw new Error(
          'Add at least one reflection in Dialogue, an event in Event Lab, or a Wellbeing check-in before synthesizing patterns.'
        );
      }

      const response = await gatewayFetch('/api/synthesize-patterns', {
        method: 'POST',
        body: JSON.stringify({
          reflectionsSummary: combined,
          wellbeingSummary,
          existingHypotheses: hypotheses,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not synthesize patterns.');
      }

      if (Array.isArray(data.hypotheses)) {
        data.hypotheses.forEach(
          (item: { dimension: PatternDimension; statement: string; rationale: string }) => {
            onAddHypothesis({
              dimension: item.dimension,
              statement: item.statement,
              rationale: item.rationale,
              source: 'synthesis',
            });
          }
        );
      }
      setAtlasSection('model');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Pattern synthesis failed.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleExplainMe = async () => {
    setIsExplaining(true);
    setActionError(null);

    try {
      const { fullBundle } = buildFullContextBundle();
      const hypText = hypotheses
        .filter((h) => h.status !== 'dismissed')
        .map((h) => `[${h.dimension}]: ${h.statement}`)
        .join('\n');

      const combined = [hypText, fullBundle].filter(Boolean).join('\n\n');
      if (combined.trim().length < 25) {
        throw new Error(
          'Share a reflection, event analysis, timeline milestone, or wellbeing check-in before generating Explain Me Mode.'
        );
      }

      const response = await gatewayFetch('/api/explain-me', {
        method: 'POST',
        body: JSON.stringify({ contextBundle: combined }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not generate Explain Me portrait.');
      }
      onSetExplainMePortrait(data as ExplainMePortrait);
      setAtlasSection('model');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Explain Me Mode failed.');
    } finally {
      setIsExplaining(false);
    }
  };

  const handleRunPersonalityAnalyst = async () => {
    setIsProfiling(true);
    setActionError(null);

    try {
      const { fullBundle } = buildFullContextBundle();
      const hypText = hypotheses
        .filter((h) => h.status !== 'dismissed')
        .map((h) => `[${h.dimension}]: ${h.statement}`)
        .join('\n');

      const combined = [hypText, fullBundle].filter(Boolean).join('\n\n');
      if (combined.trim().length < 20) {
        throw new Error(
          'Share at least one reflection, event analysis, timeline milestone, or wellbeing check-in before running Personality Analyst.'
        );
      }

      const response = await gatewayFetch('/api/agents/personality-analyst', {
        method: 'POST',
        body: JSON.stringify({ contextBundle: combined }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not generate Personality Analyst profile.');
      }
      onSetPersonalityProfile(data as PersonalityAnalystProfile);
      setAtlasSection('model');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Personality Analyst failed.');
    } finally {
      setIsProfiling(false);
    }
  };

  const handleCreateManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatement.trim()) return;
    onAddHypothesis({
      dimension: newDimension,
      statement: newStatement.trim(),
      rationale: newRationale.trim() || 'Added directly through personal reflection.',
      source: 'user',
      status: 'resonates',
    });
    setNewStatement('');
    setNewRationale('');
    setShowAddForm(false);
  };

  const handleSaveCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    onAddWellbeingCheckIn(wbForm);
    setWbForm((prev) => ({ ...prev, note: '' }));
  };

  const handleSaveTimeline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tlForm.title.trim()) return;
    onAddTimelineEvent({
      timeframe: tlForm.timeframe.trim() || 'Recent',
      title: tlForm.title.trim(),
      chapter: tlForm.chapter,
      emotionalImpact: tlForm.emotionalImpact.trim(),
      patternOrLesson: tlForm.patternOrLesson.trim(),
    });
    setTlForm({
      timeframe: '',
      title: '',
      chapter: 'Turning Point',
      emotionalImpact: '',
      patternOrLesson: '',
    });
  };

  const handleSaveJournal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!journalText.trim()) return;
    onAddJournalEntry({
      prompt: JOURNAL_PROMPTS[journalPromptIdx],
      entry: journalText.trim(),
      valueActivated: journalValue.trim(),
    });
    setJournalText('');
    setJournalValue('');
  };

  const handleSaveRelationship = (e: React.FormEvent) => {
    e.preventDefault();
    if (!relForm.name.trim()) return;
    onAddRelationshipNode({
      name: relForm.name.trim(),
      area: relForm.area,
      role: relForm.role,
      closeness: relForm.closeness,
      tension: relForm.tension,
      dynamicNote: relForm.dynamicNote.trim(),
      sharedNeed: relForm.sharedNeed.trim(),
    });
    setRelForm((prev) => ({
      name: '',
      area: prev.area,
      role: prev.role,
      closeness: 4,
      tension: 2,
      dynamicNote: '',
      sharedNeed: '',
    }));
  };

  const handleAnalyzeRelationshipArea = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = relSituation.trim();
    if (trimmed.length < 10 || isAnalyzingRel) return;

    setIsAnalyzingRel(true);
    setActionError(null);

    try {
      const mappedNodesSummary = relationships
        .filter((r) => r.area === relInsightArea)
        .map(
          (r) =>
            `${r.name} (${r.role}): Closeness ${r.closeness}/5, Tension ${r.tension}/5, Note: ${r.dynamicNote || 'n/a'}, Need: ${r.sharedNeed || 'n/a'}`
        )
        .join('\n');

      const response = await gatewayFetch('/api/agents/relationship-analyst', {
        method: 'POST',
        body: JSON.stringify({
          area: relInsightArea,
          situationOrDynamic: trimmed,
          mappedNodesSummary,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to analyze this relationship dynamic.');
      }

      onAddRelationshipInsight({
        area: relInsightArea,
        situation: trimmed,
        dynamicSummary: data.dynamicSummary || '',
        yourPerspectiveAndNeeds: data.yourPerspectiveAndNeeds || '',
        otherPerspectiveAndNeeds: data.otherPerspectiveAndNeeds || '',
        communicationPattern: data.communicationPattern || '',
        boundaryOrRequest: data.boundaryOrRequest || '',
        reflectionQuestion: data.reflectionQuestion || '',
        crisisDetected: Boolean(data.crisisDetected),
      });
      setRelSituation('');
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to analyze this relationship dynamic.'
      );
    } finally {
      setIsAnalyzingRel(false);
    }
  };

  const handleExportAtlas = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      note: 'HUMANOS AI Human Digital Twin Export — non-diagnostic personal self-reflection archive.',
      explainMePortrait,
      hypotheses: hypotheses.filter((h) => h.status !== 'dismissed'),
      wellbeingCheckIns,
      timelineEvents,
      journalEntries,
      relationships,
      eventAnalysesCount: eventAnalyses.length,
      sessionsCount: sessions.length,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `humanos-digital-twin-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-10 space-y-10">
      {/* Header Split with Fine Art Print */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch border-b border-[#1C1917]/10 pb-10">
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#1E3A5F]">
              Human Digital Twin · Personality DNA & Wellbeing
            </p>
            <h1 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-[#1C1917] [text-wrap:balance]">
              A living portrait of your values, patterns, relationships, and wellbeing
            </h1>
            <p className="text-base leading-relaxed text-[#57534E] max-w-2xl">
              Nothing recorded here is a permanent label or clinical diagnosis. Explore your Personality DNA, activate plain-language Explain Me Mode, track early wellbeing strain, and map your life timeline and relational dynamics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSynthesize}
              disabled={isSynthesizing}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49] disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {isSynthesizing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <span>Synthesize Patterns</span>
              )}
            </button>

            <button
              type="button"
              onClick={handleExplainMe}
              disabled={isExplaining}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-[#1E3A5F]/35 text-[#1E3A5F] rounded-md hover:bg-[#1E3A5F] hover:text-[#FBF9F5] disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {isExplaining ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Writing Portrait...</span>
                </>
              ) : (
                <span>Explain Me Mode</span>
              )}
            </button>

            <button
              type="button"
              onClick={handleRunPersonalityAnalyst}
              disabled={isProfiling}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-[#1C1917]/20 text-[#1C1917] rounded-md hover:bg-[#EBE6DF] disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {isProfiling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Profiling...</span>
                </>
              ) : (
                <span>Personality Analyst</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setAtlasSection('model');
                setShowAddForm((prev) => !prev);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-[#1C1917]/20 text-[#1C1917] rounded-md hover:bg-[#EBE6DF] transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Add Observation</span>
            </button>

            <button
              type="button"
              onClick={handleExportAtlas}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-[#57534E] hover:text-[#1C1917] transition-colors whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="h-full min-h-[220px] rounded-lg overflow-hidden border border-[#1C1917]/10 bg-[#EBE6DF]">
            {imgFailed ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-2 bg-[#F4F0E8]">
                <Compass className="w-8 h-8 text-[#1E3A5F]" />
                <div className="font-serif text-lg text-[#1C1917]">Pattern Equilibrium</div>
              </div>
            ) : (
              <img
                src="/src/assets/images/pattern_atlas_ink_study_1795164449426.jpg"
                alt="Archival ink study of overlapping balanced circles representing psychological self-discovery"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-full h-full object-cover max-h-[280px]"
              />
            )}
          </div>
        </div>
      </section>

      {actionError && (
        <div
          role="alert"
          className="p-4 rounded-lg border border-[#9A3412]/25 bg-[#FDF4F2] text-sm text-[#9A3412]"
        >
          {actionError}
        </div>
      )}

      {/* Primary Sub-Workspace Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F4F0E8] border border-[#1C1917]/10 rounded-lg">
          <button
            type="button"
            onClick={() => setAtlasSection('model')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              atlasSection === 'model'
                ? 'bg-[#FBF9F5] text-[#1C1917] shadow-xs border border-[#1C1917]/10'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            Personality DNA & Explain Me ({hypotheses.filter((h) => h.status !== 'dismissed').length})
          </button>
          <button
            type="button"
            onClick={() => setAtlasSection('wellbeing')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              atlasSection === 'wellbeing'
                ? 'bg-[#FBF9F5] text-[#1C1917] shadow-xs border border-[#1C1917]/10'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            Wellbeing & Risk Signals ({wellbeingCheckIns.length})
          </button>
          <button
            type="button"
            onClick={() => setAtlasSection('timeline')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              atlasSection === 'timeline'
                ? 'bg-[#FBF9F5] text-[#1C1917] shadow-xs border border-[#1C1917]/10'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            Timeline & Growth Journal ({timelineEvents.length + journalEntries.length})
          </button>
          <button
            type="button"
            onClick={() => setAtlasSection('relationships')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              atlasSection === 'relationships'
                ? 'bg-[#FBF9F5] text-[#1C1917] shadow-xs border border-[#1C1917]/10'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            Relationship Graph ({relationships.length})
          </button>
        </div>

        <div className="text-xs text-[#78716C] font-mono tabular-nums">
          <span>{sessions.length} threads</span>
          <span className="mx-2" aria-hidden="true">·</span>
          <span>{eventAnalyses.length} events</span>
          <span className="mx-2" aria-hidden="true">·</span>
          <span>{wellbeingCheckIns.length} check-ins</span>
        </div>
      </div>

      {/* SECTION 1: PERSONALITY DNA & EXPLAIN ME MODE */}
      {atlasSection === 'model' && (
        <div className="space-y-8">
          {/* Structured Personality Analyst Output */}
          {personalityProfile && (
            <section className="border border-[#1C1917]/12 rounded-lg bg-[#FBF9F5] p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[#1C1917]/10 pb-4">
                <div>
                  <div className="text-xs font-medium text-[#1E3A5F]">
                    Personality Analyst · Behavioral Profiling & Growth Detection
                  </div>
                  <h2 className="font-serif text-2xl font-medium text-[#1C1917] mt-1">
                    Structured Personality & Values Profile
                  </h2>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-xs text-[#78716C] tabular-nums">
                    {new Date(personalityProfile.generatedAt).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAnalystJson((prev) => !prev)}
                    className="text-xs font-medium text-[#1E3A5F] hover:underline underline-offset-4 whitespace-nowrap"
                  >
                    {showAnalystJson ? 'Hide JSON' : 'View JSON'}
                  </button>
                </div>
              </div>

              {showAnalystJson ? (
                <pre className="p-4 rounded-md bg-[#F4F0E8] border border-[#1C1917]/10 font-mono text-xs text-[#1C1917] overflow-x-auto leading-relaxed">
                  {JSON.stringify(
                    {
                      dominant_traits: personalityProfile.dominant_traits,
                      values: personalityProfile.values,
                      motivators: personalityProfile.motivators,
                      blind_spots: personalityProfile.blind_spots,
                    },
                    null,
                    2
                  )}
                </pre>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-[#1E3A5F]">Dominant Traits</div>
                  <ul className="space-y-1.5 text-[#292524]">
                    {personalityProfile.dominant_traits.map((item, idx) => (
                      <li key={idx} className="leading-relaxed">{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-[#1E3A5F]">Values</div>
                  <ul className="space-y-1.5 text-[#292524]">
                    {personalityProfile.values.map((item, idx) => (
                      <li key={idx} className="leading-relaxed">{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-[#1E3A5F]">Motivators</div>
                  <ul className="space-y-1.5 text-[#292524]">
                    {personalityProfile.motivators.map((item, idx) => (
                      <li key={idx} className="leading-relaxed">{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-[#9A3412]">Blind Spots</div>
                  <ul className="space-y-1.5 text-[#292524]">
                    {personalityProfile.blind_spots.map((item, idx) => (
                      <li key={idx} className="leading-relaxed">{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {(personalityProfile.strengths?.length > 0 ||
                personalityProfile.growth_opportunities?.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-[#1C1917]/10 pt-5 text-sm">
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-[#1C1917]">Mapped Strengths</div>
                    <ul className="space-y-1 text-[#57534E]">
                      {personalityProfile.strengths.map((s, idx) => (
                        <li key={idx} className="leading-relaxed">{s}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-[#1C1917]">Growth Opportunities</div>
                    <ul className="space-y-1 text-[#57534E]">
                      {personalityProfile.growth_opportunities.map((g, idx) => (
                        <li key={idx} className="leading-relaxed">{g}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Explain Me Portrait Card */}
          {explainMePortrait && (
            <section className="border border-[#1E3A5F]/20 rounded-lg bg-[#F4F0E8]/60 p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#1C1917]/10 pb-4">
                <div>
                  <div className="text-xs font-medium text-[#1E3A5F]">
                    Explain Me Mode · Plain-Language Synthesis
                  </div>
                  <h2 className="font-serif text-2xl font-medium text-[#1C1917] mt-1">
                    How You Appear to Navigate Emotion, Choice, and Connection
                  </h2>
                </div>
                <span className="font-mono text-xs text-[#78716C] tabular-nums">
                  {new Date(explainMePortrait.generatedAt).toLocaleDateString()}
                </span>
              </div>

              <p className="max-w-3xl text-[15.5px] leading-[1.75] text-[#1C1917] whitespace-pre-line">
                {explainMePortrait.plainLanguagePortrait}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-[#1C1917]/10 pt-5 text-sm">
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-[#1C1917]">Values Mapper</div>
                  {explainMePortrait.coreValues.map((cv, idx) => (
                    <div key={idx} className="space-y-0.5">
                      <div className="font-semibold text-[#1E3A5F]">{cv.value}</div>
                      <p className="text-xs text-[#57534E] leading-relaxed">{cv.evidence}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-[#1C1917]">Blind Spot Finder</div>
                  {explainMePortrait.potentialBlindSpots.map((bs, idx) => (
                    <div key={idx} className="space-y-0.5">
                      <div className="font-medium text-[#1C1917]">{bs.pattern}</div>
                      <p className="text-xs text-[#57534E] leading-relaxed">{bs.gentleReframe}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-[#1C1917]">Resilience Strengths</div>
                    <ul className="space-y-1 text-xs text-[#292524]">
                      {explainMePortrait.resilienceStrengths.map((st, idx) => (
                        <li key={idx}>{st}</li>
                      ))}
                    </ul>
                  </div>
                  {explainMePortrait.purposeThread && (
                    <div className="space-y-1 pt-2 border-t border-[#1C1917]/10">
                      <div className="text-xs font-semibold text-[#1E3A5F]">Purpose Thread</div>
                      <p className="text-xs text-[#292524] leading-relaxed">
                        {explainMePortrait.purposeThread}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Manual Observation Drawer */}
          {showAddForm && (
            <form
              onSubmit={handleCreateManual}
              className="border border-[#1C1917]/15 rounded-lg bg-[#F4F0E8]/60 p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl font-medium text-[#1C1917]">
                  Record a Personal Observation
                </h2>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="p-1 text-[#57534E] hover:text-[#1C1917]"
                  aria-label="Close observation form"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#57534E] mb-1.5">
                    Category
                  </label>
                  <select
                    value={newDimension}
                    onChange={(e) => setNewDimension(e.target.value as PatternDimension)}
                    className="w-full px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] text-[#1C1917] focus:outline-none focus:border-[#1E3A5F]"
                  >
                    {DIMENSIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-[#57534E] mb-1.5">
                    Probabilistic Statement
                  </label>
                  <input
                    type="text"
                    value={newStatement}
                    onChange={(e) => setNewStatement(e.target.value)}
                    placeholder="e.g., I notice a tendency toward perfectionism when facing uncertainty."
                    className="w-full px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] text-[#1C1917] focus:outline-none focus:border-[#1E3A5F]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1.5">
                  Supporting Context (Optional)
                </label>
                <input
                  type="text"
                  value={newRationale}
                  onChange={(e) => setNewRationale(e.target.value)}
                  placeholder="Where have you noticed this pattern appear?"
                  className="w-full px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] text-[#1C1917] focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-sm text-[#57534E] hover:text-[#1C1917]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newStatement.trim()}
                  className="px-4 py-2 text-sm font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49] disabled:opacity-45"
                >
                  Save to Atlas
                </button>
              </div>
            </form>
          )}

          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#F4F0E8] border border-[#1C1917]/10 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setDimensionFilter('All')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                dimensionFilter === 'All'
                  ? 'bg-[#FBF9F5] text-[#1C1917] shadow-xs border border-[#1C1917]/10'
                  : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              All Categories
            </button>
            {DIMENSIONS.map((dim) => (
              <button
                key={dim}
                type="button"
                onClick={() => setDimensionFilter(dim)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  dimensionFilter === dim
                    ? 'bg-[#FBF9F5] text-[#1C1917] shadow-xs border border-[#1C1917]/10'
                    : 'text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                {dim}
              </button>
            ))}
          </div>

          {/* Hypotheses Ledger */}
          {visibleHypotheses.length === 0 ? (
            <div className="border border-[#1C1917]/10 rounded-lg bg-[#F4F0E8]/40 p-8 sm:p-12 text-center space-y-3">
              <h2 className="font-serif text-xl font-medium text-[#1C1917]">
                Your Personality DNA is ready for its first observations
              </h2>
              <p className="text-sm text-[#57534E] max-w-lg mx-auto leading-relaxed">
                Reflect in Dialogue, analyze an event in Event Lab, or click “Synthesize Patterns” once you have shared a few entries.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#1C1917]/10 border border-[#1C1917]/10 rounded-lg bg-[#FBF9F5]">
              {visibleHypotheses.map((item) => {
                const isEditing = editingId === item.id;
                return (
                  <div
                    key={item.id}
                    className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-start justify-between gap-5"
                  >
                    <div className="space-y-2 max-w-3xl flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#78716C]">
                        <span className="font-medium text-[#1E3A5F]">{item.dimension}</span>
                        <span aria-hidden="true">·</span>
                        <span>{STATUS_LABELS[item.status]}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {item.evidenceCount}{' '}
                          {item.evidenceCount === 1 ? 'observation' : 'observations'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {new Date(item.updatedAt).toLocaleDateString()}
                        </span>
                      </div>

                      {isEditing ? (
                        <div className="space-y-2 pt-1">
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={2}
                            className="w-full rounded-md border border-[#1E3A5F]/40 bg-[#F4F0E8]/50 p-2.5 text-sm text-[#1C1917] focus:outline-none"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (editText.trim()) {
                                  onUpdateHypothesis(item.id, {
                                    statement: editText.trim(),
                                    status: 'nuanced',
                                  });
                                }
                                setEditingId(null);
                              }}
                              className="px-3 py-1.5 text-xs font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded"
                            >
                              Save Nuance
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1.5 text-xs text-[#57534E]"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="font-serif text-lg text-[#1C1917] leading-snug">
                            {item.statement}
                          </p>
                          {item.rationale && (
                            <p className="text-sm text-[#57534E] leading-relaxed">
                              {item.rationale}
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {item.status !== 'resonates' && (
                        <button
                          type="button"
                          onClick={() => onUpdateHypothesis(item.id, { status: 'resonates' })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#1E3A5F]/30 text-[#1E3A5F] rounded-md hover:bg-[#1E3A5F] hover:text-[#FBF9F5] transition-colors whitespace-nowrap"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Resonates</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(item.id);
                          setEditText(item.statement);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#1C1917]/15 text-[#292524] rounded-md hover:bg-[#EBE6DF] transition-colors whitespace-nowrap"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Refine</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onRemoveHypothesis(item.id)}
                        aria-label="Dismiss observation"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-[#78716C] hover:text-[#9A3412] rounded-md transition-colors whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Dismiss</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: WELLBEING & RISK SIGNALS */}
      {atlasSection === 'wellbeing' && (
        <div className="space-y-8">
          {/* Derived Observable Signals Strip */}
          <div className="border border-[#1C1917]/10 rounded-lg bg-[#F4F0E8]/45 p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-serif text-xl font-medium text-[#1C1917]">
                Observable Wellbeing & Risk Indicators
              </h2>
              <span className="text-xs text-[#78716C]">
                Computed strictly from your check-ins · Non-diagnostic
              </span>
            </div>

            {!wellbeingSignals ? (
              <p className="text-sm text-[#57534E]">
                Log your first check-in below to monitor Burnout Load, Low-Mood Strain, Anxiety Pattern, Self-Esteem Stability, and Resilience indicators.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {(
                  [
                    ['Burnout Load', wellbeingSignals.burnoutLoad, 'Stress + low energy/motivation'],
                    ['Low-Mood Strain', wellbeingSignals.lowMoodStrain, 'Mood & life satisfaction'],
                    ['Anxiety Pattern', wellbeingSignals.anxietyPattern, 'Recent anxiety load'],
                    ['Self-Esteem', wellbeingSignals.selfEsteem, 'Self-worth stability'],
                    ['Resilience Baseline', wellbeingSignals.resilience, 'Recovery & connection'],
                  ] as [string, { value: string; status: string }, string][]
                ).map(([label, metric, sub]) => (
                  <div
                    key={label}
                    className="p-4 rounded-md bg-[#FBF9F5] border border-[#1C1917]/10 space-y-1"
                  >
                    <div className="text-xs font-medium text-[#57534E]">{label}</div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-xl font-medium text-[#1C1917] tabular-nums">
                        {metric.value}
                      </span>
                      <span className="text-xs font-medium text-[#1E3A5F]">
                        / 5 · {metric.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#78716C]">{sub}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <form
              onSubmit={handleSaveCheckIn}
              className="lg:col-span-5 border border-[#1C1917]/12 rounded-lg bg-[#F4F0E8]/55 p-6 space-y-5"
            >
              <div className="space-y-1">
                <h2 className="font-serif text-xl font-medium text-[#1C1917]">
                  Log Observable Wellbeing Check-In
                </h2>
                <p className="text-xs text-[#57534E] leading-relaxed">
                  Track present indicators without judgment or diagnosis. Notice trends across days rather than isolated moments.
                </p>
              </div>

              <div className="space-y-4">
                {WELLBEING_FIELDS.map((field) => {
                  const value = wbForm[field.key];
                  return (
                    <div key={field.key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[#1C1917]">{field.label}</span>
                        <span className="font-mono text-[#1E3A5F] tabular-nums">{value} / 5</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={5}
                        step={1}
                        value={value}
                        onChange={(e) =>
                          setWbForm((prev) => ({
                            ...prev,
                            [field.key]: Number(e.target.value),
                          }))
                        }
                        aria-label={field.label}
                        className="w-full accent-[#1E3A5F] cursor-pointer"
                      />
                      <div className="flex justify-between text-[11px] text-[#78716C]">
                        <span>{field.lowLabel}</span>
                        <span>{field.highLabel}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1.5">
                  Context Note (Optional)
                </label>
                <input
                  type="text"
                  value={wbForm.note}
                  onChange={(e) => setWbForm((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder="Sleep, workload, relational moments, or context..."
                  className="w-full px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] text-[#1C1917] focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 text-sm font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49] transition-colors"
              >
                Save Check-In
              </button>
            </form>

            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-baseline justify-between">
                <h2 className="font-serif text-xl font-medium text-[#1C1917]">
                  Check-In History
                </h2>
                <span className="text-xs text-[#78716C]">
                  Observable self-reports
                </span>
              </div>

              {wellbeingCheckIns.length === 0 ? (
                <div className="border border-[#1C1917]/10 rounded-lg bg-[#F4F0E8]/40 p-8 text-sm text-[#57534E] leading-relaxed">
                  No wellbeing check-ins logged yet. Record your first check-in on the left to build your baseline.
                </div>
              ) : (
                <div className="border border-[#1C1917]/10 rounded-lg bg-[#FBF9F5] overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#1C1917]/10 text-[#78716C] bg-[#F4F0E8]/50">
                        <th className="py-2.5 px-3 font-medium">Date</th>
                        <th className="py-2.5 px-2 font-medium text-right">Mood</th>
                        <th className="py-2.5 px-2 font-medium text-right">Stress</th>
                        <th className="py-2.5 px-2 font-medium text-right">Anx</th>
                        <th className="py-2.5 px-2 font-medium text-right">Conn</th>
                        <th className="py-2.5 px-2 font-medium text-right">Estm</th>
                        <th className="py-2.5 px-2 font-medium text-right">Motiv</th>
                        <th className="py-2.5 px-2 font-medium text-right">Enrg</th>
                        <th className="py-2.5 px-2 font-medium text-right">Satis</th>
                        <th className="py-2.5 px-2 font-medium" aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1C1917]/10">
                      {wellbeingCheckIns.map((entry) => (
                        <tr key={entry.id} className="hover:bg-[#F4F0E8]/40">
                          <td className="py-3 px-3">
                            <div className="font-mono text-[#1C1917] tabular-nums whitespace-nowrap">
                              {new Date(entry.createdAt).toLocaleDateString()}
                            </div>
                            {entry.note && (
                              <div className="text-[11px] text-[#78716C] max-w-[180px] truncate">
                                {entry.note}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-2 text-right font-mono tabular-nums">{entry.mood}</td>
                          <td className="py-3 px-2 text-right font-mono tabular-nums">{entry.stress}</td>
                          <td className="py-3 px-2 text-right font-mono tabular-nums">{entry.anxiety}</td>
                          <td className="py-3 px-2 text-right font-mono tabular-nums">{entry.socialConnection}</td>
                          <td className="py-3 px-2 text-right font-mono tabular-nums">{entry.selfEsteem}</td>
                          <td className="py-3 px-2 text-right font-mono tabular-nums">{entry.motivation}</td>
                          <td className="py-3 px-2 text-right font-mono tabular-nums">{entry.energy}</td>
                          <td className="py-3 px-2 text-right font-mono tabular-nums">{entry.lifeSatisfaction}</td>
                          <td className="py-3 px-2 text-right">
                            <button
                              type="button"
                              onClick={() => onDeleteWellbeingCheckIn(entry.id)}
                              aria-label="Delete wellbeing entry"
                              className="p-1 text-[#78716C] hover:text-[#9A3412]"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: LIFE TIMELINE & GROWTH JOURNAL */}
      {atlasSection === 'timeline' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Life Timeline */}
          <section className="lg:col-span-6 space-y-5">
            <div>
              <h2 className="font-serif text-2xl font-medium text-[#1C1917]">
                Life Timeline
              </h2>
              <p className="text-xs text-[#57534E] mt-1">
                Map formative events, turning points, and the enduring lessons or protective habits they shaped.
              </p>
            </div>

            <form
              onSubmit={handleSaveTimeline}
              className="border border-[#1C1917]/12 rounded-lg bg-[#F4F0E8]/55 p-5 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={tlForm.timeframe}
                  onChange={(e) => setTlForm((p) => ({ ...p, timeframe: e.target.value }))}
                  placeholder="Year / Age (e.g. 2021)"
                  className="px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] focus:outline-none focus:border-[#1E3A5F]"
                />
                <select
                  value={tlForm.chapter}
                  onChange={(e) =>
                    setTlForm((p) => ({
                      ...p,
                      chapter: e.target.value as LifeTimelineEvent['chapter'],
                    }))
                  }
                  className="sm:col-span-2 px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] focus:outline-none focus:border-[#1E3A5F]"
                >
                  {TIMELINE_CHAPTERS.map((ch) => (
                    <option key={ch} value={ch}>
                      {ch}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                value={tlForm.title}
                onChange={(e) => setTlForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Milestone or turning point title..."
                className="w-full px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] focus:outline-none focus:border-[#1E3A5F]"
              />
              <input
                type="text"
                value={tlForm.emotionalImpact}
                onChange={(e) => setTlForm((p) => ({ ...p, emotionalImpact: e.target.value }))}
                placeholder="Emotional impact at the time..."
                className="w-full px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] focus:outline-none focus:border-[#1E3A5F]"
              />
              <input
                type="text"
                value={tlForm.patternOrLesson}
                onChange={(e) => setTlForm((p) => ({ ...p, patternOrLesson: e.target.value }))}
                placeholder="Pattern, belief, or strength it shaped..."
                className="w-full px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] focus:outline-none focus:border-[#1E3A5F]"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!tlForm.title.trim()}
                  className="px-4 py-2 text-xs font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49] disabled:opacity-45"
                >
                  Add Milestone
                </button>
              </div>
            </form>

            {timelineEvents.length === 0 ? (
              <div className="border border-[#1C1917]/10 rounded-lg p-6 text-sm text-[#78716C] bg-[#F4F0E8]/35">
                No life milestones recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-[#1C1917]/10 border border-[#1C1917]/10 rounded-lg bg-[#FBF9F5]">
                {timelineEvents.map((ev) => (
                  <div key={ev.id} className="p-4 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-xs text-[#78716C]">
                        <span className="font-mono font-medium text-[#1E3A5F] tabular-nums">
                          {ev.timeframe}
                        </span>
                        <span className="mx-1.5" aria-hidden="true">·</span>
                        <span>{ev.chapter}</span>
                      </div>
                      <div className="text-sm font-semibold text-[#1C1917]">{ev.title}</div>
                      {ev.emotionalImpact && (
                        <p className="text-xs text-[#57534E]">Impact: {ev.emotionalImpact}</p>
                      )}
                      {ev.patternOrLesson && (
                        <p className="text-xs text-[#292524]">Pattern / Lesson: {ev.patternOrLesson}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteTimelineEvent(ev.id)}
                      aria-label={`Delete ${ev.title}`}
                      className="p-1 text-[#78716C] hover:text-[#9A3412]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Growth Journal & Purpose Discovery */}
          <section className="lg:col-span-6 space-y-5">
            <div>
              <h2 className="font-serif text-2xl font-medium text-[#1C1917]">
                Growth Journal & Purpose
              </h2>
              <p className="text-xs text-[#57534E] mt-1">
                Daily reflective writing anchored in values, emotional awareness, and deliberate growth.
              </p>
            </div>

            <form
              onSubmit={handleSaveJournal}
              className="border border-[#1C1917]/12 rounded-lg bg-[#F4F0E8]/55 p-5 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#1E3A5F]">Reflective Prompt</span>
                <button
                  type="button"
                  onClick={() => setJournalPromptIdx((i) => (i + 1) % JOURNAL_PROMPTS.length)}
                  className="text-xs text-[#57534E] hover:text-[#1C1917] underline underline-offset-4"
                >
                  Next Prompt
                </button>
              </div>
              <p className="font-serif text-base text-[#1C1917]">
                “{JOURNAL_PROMPTS[journalPromptIdx]}”
              </p>
              <textarea
                value={journalText}
                onChange={(e) => setJournalText(e.target.value)}
                rows={4}
                placeholder="Write freely without editing or judging..."
                className="w-full rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] p-3 text-sm leading-relaxed focus:outline-none focus:border-[#1E3A5F]"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <input
                  type="text"
                  value={journalValue}
                  onChange={(e) => setJournalValue(e.target.value)}
                  placeholder="Value activated (e.g. Honesty, Connection)"
                  className="flex-1 min-w-[200px] px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] focus:outline-none focus:border-[#1E3A5F]"
                />
                <button
                  type="submit"
                  disabled={!journalText.trim()}
                  className="px-4 py-2 text-xs font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49] disabled:opacity-45"
                >
                  Save Entry
                </button>
              </div>
            </form>

            {journalEntries.length === 0 ? (
              <div className="border border-[#1C1917]/10 rounded-lg p-6 text-sm text-[#78716C] bg-[#F4F0E8]/35">
                No journal entries recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-[#1C1917]/10 border border-[#1C1917]/10 rounded-lg bg-[#FBF9F5]">
                {journalEntries.map((j) => (
                  <div key={j.id} className="p-4 flex items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="text-xs text-[#78716C]">
                        <span className="font-mono tabular-nums">
                          {new Date(j.createdAt).toLocaleDateString()}
                        </span>
                        {j.valueActivated && (
                          <>
                            <span className="mx-1.5" aria-hidden="true">·</span>
                            <span className="text-[#1E3A5F] font-medium">{j.valueActivated}</span>
                          </>
                        )}
                      </div>
                      <div className="text-xs italic text-[#78716C]">{j.prompt}</div>
                      <p className="text-sm text-[#1C1917] leading-relaxed whitespace-pre-line">
                        {j.entry}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteJournalEntry(j.id)}
                      aria-label="Delete journal entry"
                      className="p-1 text-[#78716C] hover:text-[#9A3412]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* SECTION 4: RELATIONSHIP GRAPH */}
      {atlasSection === 'relationships' && (
        <div className="space-y-8">
          {/* Four Core Relationship Areas Overview & Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {RELATIONSHIP_AREAS.map((item) => {
              const count = relationships.filter((r) => r.area === item.area).length;
              const active = relationshipAreaFilter === item.area;
              return (
                <button
                  key={item.area}
                  type="button"
                  onClick={() => {
                    const next = active ? 'All' : item.area;
                    setRelationshipAreaFilter(next);
                    if (!active) {
                      setRelInsightArea(item.area);
                      setRelForm((p) => ({
                        ...p,
                        area: item.area,
                        role: item.defaultRole,
                      }));
                    }
                  }}
                  className={`text-left p-4 rounded-lg border transition-colors space-y-1.5 ${
                    active
                      ? 'bg-[#EBE6DF] border-[#1E3A5F]'
                      : 'bg-[#F4F0E8]/55 border-[#1C1917]/10 hover:bg-[#F4F0E8]'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-serif text-base font-medium text-[#1C1917]">
                      {item.area}
                    </span>
                    <span className="font-mono text-xs text-[#1E3A5F] tabular-nums">
                      {count}
                    </span>
                  </div>
                  <p className="text-xs text-[#57534E] leading-relaxed">{item.focus}</p>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Form + Area Specialist */}
            <div className="lg:col-span-5 space-y-6">
              <form
                onSubmit={handleSaveRelationship}
                className="border border-[#1C1917]/12 rounded-lg bg-[#F4F0E8]/55 p-6 space-y-4"
              >
                <div className="space-y-1">
                  <h2 className="font-serif text-xl font-medium text-[#1C1917]">
                    Map a Relational Dynamic
                  </h2>
                  <p className="text-xs text-[#57534E]">
                    Place people across your four life areas and observe closeness, tension, and core needs without blame.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#57534E]">
                    Relationship Area
                  </label>
                  <select
                    value={relForm.area}
                    onChange={(e) => {
                      const nextArea = e.target.value as RelationshipArea;
                      const spec = RELATIONSHIP_AREAS.find((a) => a.area === nextArea);
                      setRelForm((p) => ({
                        ...p,
                        area: nextArea,
                        role: spec ? spec.defaultRole : p.role,
                      }));
                    }}
                    className="w-full px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] focus:outline-none focus:border-[#1E3A5F]"
                  >
                    {RELATIONSHIP_AREAS.map((a) => (
                      <option key={a.area} value={a.area}>
                        {a.area}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={relForm.name}
                    onChange={(e) => setRelForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Name or initials"
                    className="px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] focus:outline-none focus:border-[#1E3A5F]"
                  />
                  <select
                    value={relForm.role}
                    onChange={(e) =>
                      setRelForm((p) => ({ ...p, role: e.target.value as RelationshipNode['role'] }))
                    }
                    className="px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] focus:outline-none focus:border-[#1E3A5F]"
                  >
                    {RELATIONSHIP_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="font-medium text-[#1C1917]">Closeness</span>
                      <span className="font-mono tabular-nums text-[#1E3A5F]">{relForm.closeness}/5</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={relForm.closeness}
                      onChange={(e) => setRelForm((p) => ({ ...p, closeness: Number(e.target.value) }))}
                      className="w-full accent-[#1E3A5F]"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="font-medium text-[#1C1917]">Recurring Tension</span>
                      <span className="font-mono tabular-nums text-[#9A3412]">{relForm.tension}/5</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={relForm.tension}
                      onChange={(e) => setRelForm((p) => ({ ...p, tension: Number(e.target.value) }))}
                      className="w-full accent-[#9A3412]"
                    />
                  </div>
                </div>

                <input
                  type="text"
                  value={relForm.dynamicNote}
                  onChange={(e) => setRelForm((p) => ({ ...p, dynamicNote: e.target.value }))}
                  placeholder="Communication or attachment pattern observed..."
                  className="w-full px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] focus:outline-none focus:border-[#1E3A5F]"
                />
                <input
                  type="text"
                  value={relForm.sharedNeed}
                  onChange={(e) => setRelForm((p) => ({ ...p, sharedNeed: e.target.value }))}
                  placeholder="Core need or boundary at play (e.g. Clarity, Safety)..."
                  className="w-full px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] focus:outline-none focus:border-[#1E3A5F]"
                />

                <button
                  type="submit"
                  disabled={!relForm.name.trim()}
                  className="w-full py-2 px-4 text-sm font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49] disabled:opacity-45"
                >
                  Add to Relationship Graph
                </button>
              </form>

              {/* AI Relationship Area Analyst */}
              <form
                onSubmit={handleAnalyzeRelationshipArea}
                className="border border-[#1C1917]/12 rounded-lg bg-[#FBF9F5] p-6 space-y-4"
              >
                <div className="space-y-1">
                  <div className="text-xs font-medium text-[#1E3A5F]">
                    Relationship Specialist Lens
                  </div>
                  <h3 className="font-serif text-lg font-medium text-[#1C1917]">
                    Analyze a Dynamic by Area
                  </h3>
                  <p className="text-xs text-[#57534E]">
                    Examine both perspectives neutrally across Attachment Theory and Conflict Resolution.
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {RELATIONSHIP_AREAS.map((a) => {
                    const active = relInsightArea === a.area;
                    return (
                      <button
                        key={a.area}
                        type="button"
                        onClick={() => setRelInsightArea(a.area)}
                        className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-[#1E3A5F] text-[#FBF9F5]'
                            : 'bg-[#F4F0E8] text-[#57534E] border border-[#1C1917]/10 hover:text-[#1C1917]'
                        }`}
                      >
                        {a.area}
                      </button>
                    );
                  })}
                </div>

                <textarea
                  value={relSituation}
                  onChange={(e) => setRelSituation(e.target.value)}
                  rows={3}
                  placeholder={`Describe a situation or recurring pattern in ${relInsightArea.toLowerCase()}...`}
                  className="w-full rounded-md border border-[#1C1917]/15 bg-[#F4F0E8]/40 p-3 text-sm leading-relaxed text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#1E3A5F]"
                />

                <button
                  type="submit"
                  disabled={isAnalyzingRel || relSituation.trim().length < 10}
                  className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium border border-[#1E3A5F] text-[#1E3A5F] rounded-md hover:bg-[#1E3A5F] hover:text-[#FBF9F5] disabled:opacity-45 transition-colors"
                >
                  {isAnalyzingRel ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mapping Perspectives...</span>
                    </>
                  ) : (
                    <span>Analyze {relInsightArea} Dynamic</span>
                  )}
                </button>
              </form>
            </div>

            {/* Constellation SVG, Dynamics Ledger & Area Insights */}
            <div className="lg:col-span-7 space-y-6">
              <div className="border border-[#1C1917]/10 rounded-lg bg-[#FBF9F5] p-6 space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="space-y-0.5">
                    <h2 className="font-serif text-xl font-medium text-[#1C1917]">
                      Relational Constellation
                    </h2>
                    <div className="text-xs text-[#78716C]">
                      <span>
                        {relationshipAreaFilter === 'All'
                          ? 'All 4 Relationship Areas'
                          : relationshipAreaFilter}
                      </span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span>Proximity reflects closeness · Dashed line reflects tension</span>
                    </div>
                  </div>
                  {relationshipAreaFilter !== 'All' && (
                    <button
                      type="button"
                      onClick={() => setRelationshipAreaFilter('All')}
                      className="text-xs text-[#1E3A5F] hover:underline whitespace-nowrap"
                    >
                      Show all areas
                    </button>
                  )}
                </div>

                {filteredRelationships.length === 0 ? (
                  <p className="text-sm text-[#57534E] py-6">
                    {relationships.length === 0
                      ? 'Add romantic, friendship, family, or work dynamics on the left to visualize closeness, tension, and shared needs across your social system.'
                      : `No entries mapped in ${relationshipAreaFilter} yet.`}
                  </p>
                ) : (
                  <div className="w-full flex justify-center">
                    <svg
                      viewBox="0 0 520 300"
                      className="w-full max-w-[520px] h-auto"
                      role="img"
                      aria-label="Relationship constellation map centered on Self"
                    >
                      <circle cx="260" cy="150" r="55" fill="none" stroke="rgba(28,25,23,0.08)" />
                      <circle cx="260" cy="150" r="105" fill="none" stroke="rgba(28,25,23,0.08)" />
                      <circle cx="260" cy="150" r="142" fill="none" stroke="rgba(28,25,23,0.06)" />

                      {filteredRelationships.slice(0, 10).map((rel, idx, arr) => {
                        const angle = (idx / Math.max(arr.length, 1)) * Math.PI * 2 - Math.PI / 2;
                        const radius = 140 - (rel.closeness - 1) * 22;
                        const x = 260 + Math.cos(angle) * radius;
                        const y = 150 + Math.sin(angle) * radius;
                        const highTension = rel.tension >= 4;

                        return (
                          <g key={rel.id}>
                            <line
                              x1="260"
                              y1="150"
                              x2={x}
                              y2={y}
                              stroke={highTension ? '#9A3412' : '#1E3A5F'}
                              strokeOpacity={highTension ? 0.55 : 0.35}
                              strokeWidth={highTension ? 1.5 : 1}
                              strokeDasharray={rel.tension >= 3 ? '4 4' : undefined}
                            />
                            <circle
                              cx={x}
                              cy={y}
                              r="18"
                              fill="#F4F0E8"
                              stroke={highTension ? '#9A3412' : '#1E3A5F'}
                              strokeWidth="1.25"
                            />
                            <text
                              x={x}
                              y={y + 4}
                              textAnchor="middle"
                              fontSize="10"
                              fontWeight="600"
                              fill="#1C1917"
                            >
                              {rel.name.slice(0, 8)}
                            </text>
                          </g>
                        );
                      })}

                      <circle cx="260" cy="150" r="22" fill="#1E3A5F" />
                      <text
                        x="260"
                        y="154"
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="600"
                        fill="#FBF9F5"
                      >
                        Self
                      </text>
                    </svg>
                  </div>
                )}
              </div>

              {filteredRelationships.length > 0 && (
                <div className="divide-y divide-[#1C1917]/10 border border-[#1C1917]/10 rounded-lg bg-[#FBF9F5]">
                  {filteredRelationships.map((rel) => (
                    <div key={rel.id} className="p-4 flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-xs text-[#78716C] font-mono tabular-nums">
                          <span className="font-sans font-semibold text-[#1E3A5F]">{rel.area}</span>
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span className="font-sans text-[#57534E]">{rel.role}</span>
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span>Closeness {rel.closeness}/5</span>
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span>Tension {rel.tension}/5</span>
                        </div>
                        <div className="text-sm font-semibold text-[#1C1917]">{rel.name}</div>
                        {rel.dynamicNote && (
                          <p className="text-xs text-[#57534E] leading-relaxed">{rel.dynamicNote}</p>
                        )}
                        {rel.sharedNeed && (
                          <p className="text-xs text-[#292524]">Core Need / Boundary: {rel.sharedNeed}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeleteRelationshipNode(rel.id)}
                        aria-label={`Remove ${rel.name}`}
                        className="p-1 text-[#78716C] hover:text-[#9A3412]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Saved AI Relationship Area Analyses */}
              {relationshipInsights.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-serif text-lg font-medium text-[#1C1917]">
                      Area Dynamics Insights
                    </h3>
                    <span className="font-mono text-xs text-[#78716C] tabular-nums">
                      {relationshipInsights.length} saved
                    </span>
                  </div>

                  {relationshipInsights.map((ins) => (
                    <div
                      key={ins.id}
                      className="border border-[#1C1917]/12 rounded-lg bg-[#FBF9F5] p-5 space-y-4"
                    >
                      <div className="flex items-start justify-between gap-3 border-b border-[#1C1917]/10 pb-3">
                        <div className="space-y-1">
                          <div className="text-xs text-[#78716C]">
                            <span className="font-medium text-[#1E3A5F]">{ins.area}</span>
                            <span className="mx-1.5" aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {new Date(ins.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-[#1C1917] leading-relaxed">
                            {ins.dynamicSummary}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onDeleteRelationshipInsight(ins.id)}
                          aria-label="Delete relationship insight"
                          className="p-1 text-[#78716C] hover:text-[#9A3412] shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div className="p-3.5 rounded-md bg-[#F4F0E8]/60 border border-[#1C1917]/10 space-y-1">
                          <div className="font-semibold text-[#1E3A5F]">Your Perspective & Needs</div>
                          <p className="text-[#292524] leading-relaxed">{ins.yourPerspectiveAndNeeds}</p>
                        </div>
                        <div className="p-3.5 rounded-md bg-[#F4F0E8]/60 border border-[#1C1917]/10 space-y-1">
                          <div className="font-semibold text-[#57534E]">Their Likely Perspective & Needs</div>
                          <p className="text-[#292524] leading-relaxed">{ins.otherPerspectiveAndNeeds}</p>
                        </div>
                      </div>

                      <div className="space-y-2 text-xs text-[#292524]">
                        <div>
                          <span className="font-semibold text-[#1C1917]">Communication Pattern: </span>
                          <span>{ins.communicationPattern}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-[#1E3A5F]">Constructive Boundary / Request: </span>
                          <span>{ins.boundaryOrRequest}</span>
                        </div>
                        <div className="text-[#57534E] italic pt-1">
                          Self-Inquiry: {ins.reflectionQuestion}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Local Data Ownership Footer Bar */}
      <section className="border-t border-[#1C1917]/10 pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-[#78716C]">
        <p>
          Your reflections, Human Digital Twin, timeline, relationships, and wellbeing logs are stored locally in your browser.
        </p>
        {confirmClear ? (
          <div className="flex items-center gap-3">
            <span className="text-[#9A3412] font-medium">Clear all local reflections and patterns?</span>
            <button
              type="button"
              onClick={() => {
                onClearAllData();
                setConfirmClear(false);
              }}
              className="px-3 py-1.5 bg-[#9A3412] text-[#FBF9F5] rounded font-medium"
            >
              Confirm Clear
            </button>
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              className="px-2 py-1.5 text-[#57534E] hover:text-[#1C1917]"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="text-[#78716C] hover:text-[#9A3412] underline underline-offset-4 self-start sm:self-auto"
          >
            Reset Local Workspace
          </button>
        )}
      </section>
    </div>
  );
}
