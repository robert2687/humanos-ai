import { useMemo, useState } from 'react';
import { ArrowRight, Download, Loader2, Trash2 } from 'lucide-react';
import { gatewayFetch } from '../lib/gatewayClient';
import { computePsychologicalIndices } from '../lib/psychologicalIndices';
import {
  computeRiskForecasts,
  formatRiskForecastSummary,
} from '../lib/riskForecasts';
import { detectClientCrisisCategories } from '../hooks/useHumanosStore';
import { CrisisBanner } from './CrisisSupportView';
import {
  AssessmentRecord,
  ConflictReport,
  ConflictReportScope,
  CrisisRiskCategory,
  EventAnalysisRecord,
  ReflectionSession,
  RelationshipArea,
  RelationshipAreaInsight,
  RelationshipNode,
  WellbeingCheckIn,
} from '../types/humanos';

type RelationalPillarTab =
  | 'partner'
  | 'family'
  | 'work'
  | 'conflict-reports';

interface RelationshipsViewProps {
  relationships: RelationshipNode[];
  relationshipInsights: RelationshipAreaInsight[];
  conflictReports: ConflictReport[];
  eventAnalyses: EventAnalysisRecord[];
  wellbeingCheckIns: WellbeingCheckIn[];
  assessments: AssessmentRecord[];
  sessions: ReflectionSession[];
  retentionDays: number;
  onAddRelationshipNode: (input: Omit<RelationshipNode, 'id' | 'updatedAt'>) => void;
  onDeleteRelationshipNode: (id: string) => void;
  onAddRelationshipInsight: (
    insight: Omit<RelationshipAreaInsight, 'id' | 'createdAt'>
  ) => RelationshipAreaInsight;
  onDeleteRelationshipInsight: (id: string) => void;
  onAddConflictReport: (
    report: Omit<ConflictReport, 'id' | 'createdAt'>
  ) => ConflictReport;
  onDeleteConflictReport: (id: string) => void;
  onDiscussInDialogue: (input: {
    mode: 'relationship' | 'de-escalation';
    title: string;
    summary: string;
    scriptOrNeed?: string;
  }) => void;
  onOpenSocialHealth?: () => void;
  onOpenCrisisSupport: () => void;
}

const DOMAIN_SPECS: Record<
  'partner' | 'family' | 'work',
  {
    title: string;
    area: RelationshipArea;
    defaultRole: RelationshipNode['role'];
    roleOptions: RelationshipNode['role'][];
    subtitle: string;
    placeholder: string;
    starters: string[];
  }
> = {
  partner: {
    title: 'Partner Dynamics',
    area: 'Romantic Relationships',
    defaultRole: 'Partner',
    roleOptions: ['Partner'],
    subtitle:
      'Examine attachment patterns, emotional safety, bids for connection, and recurring misattunements between partners without taking sides.',
    placeholder:
      'Describe a recurring pattern, emotional disconnect, or unspoken expectation with your partner...',
    starters: [
      'When logistics pile up, one of us withdraws into silence while the other pushes harder for immediate reassurance.',
      'I feel unheard when sharing stress at the end of the day because it immediately turns into problem-solving.',
    ],
  },
  family: {
    title: 'Family Insights',
    area: 'Family',
    defaultRole: 'Family',
    roleOptions: ['Family', 'Mentor'],
    subtitle:
      'Clarify inherited roles, obligation vs. autonomy, generational expectations, and respectful boundaries across family relationships.',
    placeholder:
      'Describe a family dynamic, boundary tension, holiday pressure, or inherited role you are navigating...',
    starters: [
      'Saying no to a family request immediately leaves me feeling guilty, as if prioritizing my rest means letting everyone down.',
      'Every family gathering slips back into old roles where my adult boundaries are treated as personal rejection.',
    ],
  },
  work: {
    title: 'Work Relationship Analysis',
    area: 'Work Relationships',
    defaultRole: 'Colleague',
    roleOptions: ['Colleague', 'Mentor'],
    subtitle:
      'Assess psychological safety, role clarity, manager/peer communication friction, and sustainable boundaries at work.',
    placeholder:
      'Describe a workplace relationship dynamic, feedback tension, authority boundary, or team friction...',
    starters: [
      'A manager keeps shifting priorities without acknowledging existing workload, and I hesitate to push back.',
      'A teammate’s terse messages trigger defensiveness even when the underlying issue may just be unclear ownership.',
    ],
  },
};

const CONFLICT_SCOPES: ConflictReportScope[] = [
  'Partner Dynamics',
  'Family Insights',
  'Work Relationship Analysis',
  'Cross-System Conflict',
];

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function RelationshipsView({
  relationships,
  relationshipInsights,
  conflictReports,
  eventAnalyses,
  wellbeingCheckIns,
  assessments,
  sessions,
  retentionDays,
  onAddRelationshipNode,
  onDeleteRelationshipNode,
  onAddRelationshipInsight,
  onDeleteRelationshipInsight,
  onAddConflictReport,
  onDeleteConflictReport,
  onDiscussInDialogue,
  onOpenSocialHealth,
  onOpenCrisisSupport,
}: RelationshipsViewProps) {
  const [activePillar, setActivePillar] = useState<RelationalPillarTab>('partner');
  const [actionError, setActionError] = useState<string | null>(null);

  // Domain-scoped analyzer state
  const [situationInput, setSituationInput] = useState('');
  const [isAnalyzingArea, setIsAnalyzingArea] = useState(false);

  // Node mapper state
  const [nodeName, setNodeName] = useState('');
  const [nodeRole, setNodeRole] = useState<RelationshipNode['role']>('Partner');
  const [nodeCloseness, setNodeCloseness] = useState(4);
  const [nodeTension, setNodeTension] = useState(2);
  const [nodeDynamic, setNodeDynamic] = useState('');
  const [nodeNeed, setNodeNeed] = useState('');

  // Conflict Reports state
  const [conflictScope, setConflictScope] =
    useState<ConflictReportScope>('Cross-System Conflict');
  const [conflictFocus, setConflictFocus] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(
    conflictReports[0]?.id ?? null
  );

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

  const relRisk = riskSuite.signals.find((s) => s.key === 'relationship-risk');
  const conflictRisk = riskSuite.signals.find((s) => s.key === 'conflict-probability');

  const activeSpec =
    activePillar === 'conflict-reports' ? null : DOMAIN_SPECS[activePillar];

  const scopedNodes = useMemo(() => {
    if (!activeSpec) return relationships;
    return relationships.filter((r) => r.area === activeSpec.area);
  }, [relationships, activeSpec]);

  const scopedInsights = useMemo(() => {
    if (!activeSpec) return relationshipInsights;
    return relationshipInsights.filter((i) => i.area === activeSpec.area);
  }, [relationshipInsights, activeSpec]);

  const conflictEvents = useMemo(
    () =>
      eventAnalyses.filter(
        (e) =>
          e.contextCategory === 'Conflict & Anger' ||
          e.contextCategory === 'Relationship' ||
          e.lens === 'conflict-emotion'
      ),
    [eventAnalyses]
  );

  const selectedReport =
    conflictReports.find((r) => r.id === selectedReportId) ||
    conflictReports[0] ||
    null;

  const handleSwitchPillar = (pillar: RelationalPillarTab) => {
    setActivePillar(pillar);
    setActionError(null);
    if (pillar !== 'conflict-reports') {
      setNodeRole(DOMAIN_SPECS[pillar].defaultRole);
      if (pillar === 'partner') setConflictScope('Partner Dynamics');
      if (pillar === 'family') setConflictScope('Family Insights');
      if (pillar === 'work') setConflictScope('Work Relationship Analysis');
    }
  };

  const handleAddNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSpec || !nodeName.trim()) return;
    onAddRelationshipNode({
      name: nodeName.trim(),
      area: activeSpec.area,
      role: nodeRole,
      closeness: nodeCloseness,
      tension: nodeTension,
      dynamicNote: nodeDynamic.trim(),
      sharedNeed: nodeNeed.trim(),
    });
    setNodeName('');
    setNodeDynamic('');
    setNodeNeed('');
    setNodeCloseness(4);
    setNodeTension(2);
  };

  const handleAnalyzeDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSpec) return;
    const trimmed = situationInput.trim();
    if (trimmed.length < 10 || isAnalyzingArea) return;

    setIsAnalyzingArea(true);
    setActionError(null);

    try {
      const mappedNodesSummary = scopedNodes
        .map(
          (r) =>
            `${r.name} (${r.role}): Closeness ${r.closeness}/5, Tension ${r.tension}/5, Note: ${r.dynamicNote || 'n/a'}, Need: ${r.sharedNeed || 'n/a'}`
        )
        .join('\n');

      const response = await gatewayFetch('/api/agents/relationship-analyst', {
        method: 'POST',
        body: JSON.stringify({
          area: activeSpec.area,
          situationOrDynamic: trimmed,
          mappedNodesSummary,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Unable to analyze ${activeSpec.title}.`);
      }

      onAddRelationshipInsight({
        area: activeSpec.area,
        situation: trimmed,
        dynamicSummary: data.dynamicSummary || '',
        yourPerspectiveAndNeeds: data.yourPerspectiveAndNeeds || '',
        otherPerspectiveAndNeeds: data.otherPerspectiveAndNeeds || '',
        communicationPattern: data.communicationPattern || '',
        boundaryOrRequest: data.boundaryOrRequest || '',
        reflectionQuestion: data.reflectionQuestion || '',
        crisisDetected: Boolean(
          data.crisisDetected || detectClientCrisisCategories(trimmed).length > 0
        ),
        safetyCategories: Array.from(
          new Set<CrisisRiskCategory>([
            ...detectClientCrisisCategories(trimmed),
            ...(Array.isArray(data.detectedRiskCategories)
              ? data.detectedRiskCategories
              : []),
          ])
        ),
      });
      setSituationInput('');
    } catch (err: unknown) {
      setActionError(
        err instanceof Error
          ? err.message
          : 'Unable to analyze this relational dynamic.'
      );
    } finally {
      setIsAnalyzingArea(false);
    }
  };

  const handleGenerateConflictReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGeneratingReport) return;

    setIsGeneratingReport(true);
    setActionError(null);

    try {
      const targetArea: RelationshipArea | null =
        conflictScope === 'Partner Dynamics'
          ? 'Romantic Relationships'
          : conflictScope === 'Family Insights'
            ? 'Family'
            : conflictScope === 'Work Relationship Analysis'
              ? 'Work Relationships'
              : null;

      const filteredNodes = targetArea
        ? relationships.filter((r) => r.area === targetArea)
        : relationships;
      const filteredInsights = targetArea
        ? relationshipInsights.filter((i) => i.area === targetArea)
        : relationshipInsights;

      const mappedNodesSummary = filteredNodes
        .map(
          (r) =>
            `${r.name} (${r.area} / ${r.role}): Closeness ${r.closeness}/5, Tension ${r.tension}/5 | Pattern: ${r.dynamicNote || 'n/a'} | Need: ${r.sharedNeed || 'n/a'}`
        )
        .join('\n');

      const areaInsightsSummary = filteredInsights
        .slice(0, 6)
        .map(
          (ins) =>
            `[${ins.area}] ${ins.dynamicSummary} | Pattern: ${ins.communicationPattern} | Boundary: ${ins.boundaryOrRequest}`
        )
        .join('\n');

      const conflictEventsSummary = conflictEvents
        .slice(0, 8)
        .map(
          (ev) =>
            `[Event ${ev.summaryTitle} (${ev.contextCategory})]: Facts: ${ev.facts.join('; ')} | Emotions: ${ev.emotions.map((em) => em.name).join(', ')} | Needs: ${ev.needs.join(', ')}`
        )
        .join('\n');

      const response = await gatewayFetch('/api/agents/conflict-report', {
        method: 'POST',
        body: JSON.stringify({
          scope: conflictScope,
          focusPrompt: conflictFocus.trim(),
          mappedNodesSummary,
          areaInsightsSummary,
          conflictEventsSummary,
          riskPostureSummary: formatRiskForecastSummary(riskSuite),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not generate Conflict Report.');
      }

      const saved = onAddConflictReport({
        scope: data.scope || conflictScope,
        title: data.title || `${conflictScope} · Conflict Report`,
        deEscalationUrgency: data.deEscalationUrgency || 'Moderate',
        conflictSummary: data.conflictSummary || '',
        coreTriggers: Array.isArray(data.coreTriggers) ? data.coreTriggers : [],
        selfNeeds: Array.isArray(data.selfNeeds) ? data.selfNeeds : [],
        otherNeeds: Array.isArray(data.otherNeeds) ? data.otherNeeds : [],
        communicationBreakdown: data.communicationBreakdown || '',
        repairOptions: Array.isArray(data.repairOptions) ? data.repairOptions : [],
        constructiveScript: data.constructiveScript || '',
        reflectionQuestion: data.reflectionQuestion || '',
        crisisDetected: Boolean(data.crisisDetected),
        safetyCategories: Array.isArray(data.safetyCategories)
          ? data.safetyCategories
          : [],
      });

      setSelectedReportId(saved.id);
      setConflictFocus('');
    } catch (err: unknown) {
      setActionError(
        err instanceof Error
          ? err.message
          : 'Unable to generate Conflict Report.'
      );
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleExportConflictReport = (report: ConflictReport) => {
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `humanos-conflict-report-${report.scope.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const partnerCount = relationships.filter(
    (r) => r.area === 'Romantic Relationships'
  ).length;
  const familyCount = relationships.filter((r) => r.area === 'Family').length;
  const workCount = relationships.filter(
    (r) => r.area === 'Work Relationships'
  ).length;

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-10 space-y-8">
      {/* Header */}
      <section className="flex flex-wrap items-end justify-between gap-6 border-b border-[#1C1917]/10 pb-7">
        <div className="space-y-2.5 max-w-2xl">
          <div className="text-xs font-medium text-[#1E3A5F]">
            Relational Intelligence & Conflict Mediation
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-[#1C1917] [text-wrap:balance]">
            Partner dynamics, family systems, workplace friction, and conflict reports
          </h1>
          <p className="text-sm sm:text-base text-[#57534E] leading-relaxed">
            Explore both perspectives without blame. Surface unspoken needs, communication cycles, boundary clarity, and actionable repair reports across every sphere of your relational life.
          </p>
        </div>

        {/* Live Relational & Conflict Risk Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 border border-[#1C1917]/10 rounded-lg bg-[#F4F0E8]/60 px-5 py-3.5">
          <div>
            <div className="text-[11px] text-[#78716C]">Mapped Bonds</div>
            <div className="font-mono text-lg font-medium text-[#1C1917] tabular-nums">
              {relationships.length}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#78716C]">Relationship Risk</div>
            <div
              className={`font-mono text-lg font-medium tabular-nums ${
                relRisk?.tier === 'Elevated'
                  ? 'text-[#9A3412]'
                  : relRisk?.tier === 'Watchful'
                    ? 'text-[#B45309]'
                    : 'text-[#1E3A5F]'
              }`}
            >
              {relRisk?.hasData ? `${relRisk.probability}%` : '—'}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#78716C]">Conflict Probability</div>
            <div
              className={`font-mono text-lg font-medium tabular-nums ${
                conflictRisk?.tier === 'Elevated'
                  ? 'text-[#9A3412]'
                  : conflictRisk?.tier === 'Watchful'
                    ? 'text-[#B45309]'
                    : 'text-[#1E3A5F]'
              }`}
            >
              {conflictRisk?.hasData ? `${conflictRisk.probability}%` : '—'}
            </div>
          </div>
        </div>
      </section>

      {/* Primary Pillar Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F4F0E8] border border-[#1C1917]/10 rounded-lg">
          <button
            type="button"
            onClick={() => handleSwitchPillar('partner')}
            className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activePillar === 'partner'
                ? 'bg-[#FBF9F5] text-[#1C1917] border border-[#1C1917]/10'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            Partner Dynamics ({partnerCount})
          </button>
          <button
            type="button"
            onClick={() => handleSwitchPillar('family')}
            className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activePillar === 'family'
                ? 'bg-[#FBF9F5] text-[#1C1917] border border-[#1C1917]/10'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            Family Insights ({familyCount})
          </button>
          <button
            type="button"
            onClick={() => handleSwitchPillar('work')}
            className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activePillar === 'work'
                ? 'bg-[#FBF9F5] text-[#1C1917] border border-[#1C1917]/10'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            Work Relationship Analysis ({workCount})
          </button>
          <button
            type="button"
            onClick={() => handleSwitchPillar('conflict-reports')}
            className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activePillar === 'conflict-reports'
                ? 'bg-[#FBF9F5] text-[#1C1917] border border-[#1C1917]/10'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            Conflict Reports ({conflictReports.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-[#78716C] font-mono tabular-nums">
          <span>
            {relationshipInsights.length} area analyses · {conflictEvents.length} event logs
          </span>
          {onOpenSocialHealth && (
            <button
              type="button"
              onClick={onOpenSocialHealth}
              className="font-sans font-medium text-[#1E3A5F] hover:underline underline-offset-4 whitespace-nowrap"
            >
              Social Health &amp; Conflict Monitor
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="p-4 rounded-lg border border-[#9A3412]/25 bg-[#FDF4F2] text-sm text-[#9A3412]"
        >
          {actionError}
        </div>
      )}

      {/* DOMAIN VIEWS: Partner Dynamics | Family Insights | Work Relationship Analysis */}
      {activeSpec && (
        <div className="space-y-8">
          {/* Domain Metrics Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 border border-[#1C1917]/10 rounded-lg bg-[#F4F0E8]/45 p-5">
            <div className="sm:col-span-2 space-y-1">
              <div className="text-xs font-medium text-[#1E3A5F]">
                {activeSpec.area}
              </div>
              <h2 className="font-serif text-xl font-medium text-[#1C1917]">
                {activeSpec.title}
              </h2>
              <p className="text-xs text-[#57534E] leading-relaxed">
                {activeSpec.subtitle}
              </p>
            </div>
            <div>
              <div className="text-xs text-[#78716C]">Average Closeness</div>
              <div className="font-mono text-2xl font-medium text-[#1E3A5F] tabular-nums mt-1">
                {scopedNodes.length > 0
                  ? `${avg(scopedNodes.map((n) => n.closeness)).toFixed(1)}/5`
                  : '—'}
              </div>
              <div className="text-[11px] text-[#78716C] mt-0.5 tabular-nums">
                {scopedNodes.length} mapped node{scopedNodes.length === 1 ? '' : 's'}
              </div>
            </div>
            <div>
              <div className="text-xs text-[#78716C]">Recurring Tension</div>
              <div
                className={`font-mono text-2xl font-medium tabular-nums mt-1 ${
                  avg(scopedNodes.map((n) => n.tension)) >= 3.5
                    ? 'text-[#9A3412]'
                    : 'text-[#1C1917]'
                }`}
              >
                {scopedNodes.length > 0
                  ? `${avg(scopedNodes.map((n) => n.tension)).toFixed(1)}/5`
                  : '—'}
              </div>
              <div className="text-[11px] text-[#78716C] mt-0.5 tabular-nums">
                {scopedInsights.length} saved insight{scopedInsights.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Specialist Analyzer + Quick Node Mapper */}
            <div className="lg:col-span-5 space-y-6">
              <form
                onSubmit={handleAnalyzeDomain}
                className="border border-[#1C1917]/12 rounded-lg bg-[#FBF9F5] p-6 space-y-4"
              >
                <div className="space-y-1">
                  <div className="text-xs font-medium text-[#1E3A5F]">
                    Neutral Two-Perspective Lens
                  </div>
                  <h3 className="font-serif text-lg font-medium text-[#1C1917]">
                    Analyze {activeSpec.title}
                  </h3>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] text-[#78716C]">Starter Situations</div>
                  <div className="flex flex-col gap-1.5">
                    {activeSpec.starters.map((starter, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSituationInput(starter)}
                        className="text-left p-2.5 rounded-md border border-[#1C1917]/10 bg-[#F4F0E8]/50 hover:bg-[#EBE6DF] text-xs text-[#57534E] leading-snug transition-colors"
                      >
                        {starter}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  value={situationInput}
                  onChange={(e) => setSituationInput(e.target.value)}
                  rows={4}
                  placeholder={activeSpec.placeholder}
                  className="w-full rounded-md border border-[#1C1917]/15 bg-[#F4F0E8]/40 p-3 text-sm text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                />

                <button
                  type="submit"
                  disabled={isAnalyzingArea || situationInput.trim().length < 10}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49] disabled:opacity-45 transition-colors"
                >
                  {isAnalyzingArea ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mapping Both Perspectives...</span>
                    </>
                  ) : (
                    <span>Generate {activeSpec.title} Analysis</span>
                  )}
                </button>
              </form>

              {/* Map Node in this Domain */}
              <form
                onSubmit={handleAddNode}
                className="border border-[#1C1917]/10 rounded-lg bg-[#F4F0E8]/55 p-6 space-y-4"
              >
                <div className="space-y-1">
                  <h3 className="font-serif text-lg font-medium text-[#1C1917]">
                    Add {activeSpec.title} Node
                  </h3>
                  <p className="text-xs text-[#57534E]">
                    Track closeness, recurring tension, and unspoken needs in your Relationship Graph.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={nodeName}
                    onChange={(e) => setNodeName(e.target.value)}
                    placeholder="Name or initials"
                    className="px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] focus:outline-none focus:border-[#1E3A5F]"
                  />
                  <select
                    value={nodeRole}
                    onChange={(e) =>
                      setNodeRole(e.target.value as RelationshipNode['role'])
                    }
                    className="px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] focus:outline-none focus:border-[#1E3A5F]"
                  >
                    {activeSpec.roleOptions.map((r) => (
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
                      <span className="font-mono tabular-nums text-[#1E3A5F]">
                        {nodeCloseness}/5
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={nodeCloseness}
                      onChange={(e) => setNodeCloseness(Number(e.target.value))}
                      className="w-full accent-[#1E3A5F]"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="font-medium text-[#1C1917]">Tension</span>
                      <span className="font-mono tabular-nums text-[#9A3412]">
                        {nodeTension}/5
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={nodeTension}
                      onChange={(e) => setNodeTension(Number(e.target.value))}
                      className="w-full accent-[#9A3412]"
                    />
                  </div>
                </div>

                <input
                  type="text"
                  value={nodeDynamic}
                  onChange={(e) => setNodeDynamic(e.target.value)}
                  placeholder="Observed pattern or friction..."
                  className="w-full px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] focus:outline-none focus:border-[#1E3A5F]"
                />
                <input
                  type="text"
                  value={nodeNeed}
                  onChange={(e) => setNodeNeed(e.target.value)}
                  placeholder="Shared need or boundary (e.g. Predictability, Appreciation)..."
                  className="w-full px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] focus:outline-none focus:border-[#1E3A5F]"
                />

                <button
                  type="submit"
                  disabled={!nodeName.trim()}
                  className="w-full py-2 px-4 text-xs sm:text-sm font-medium border border-[#1E3A5F] text-[#1E3A5F] rounded-md hover:bg-[#1E3A5F] hover:text-[#FBF9F5] disabled:opacity-45 transition-colors"
                >
                  Save {activeSpec.area} Node
                </button>
              </form>
            </div>

            {/* Right Column: Scoped Nodes + Scoped Insights */}
            <div className="lg:col-span-7 space-y-6">
              {scopedNodes.length > 0 && (
                <div className="border border-[#1C1917]/10 rounded-lg bg-[#FBF9F5] divide-y divide-[#1C1917]/10">
                  {scopedNodes.map((node) => (
                    <div
                      key={node.id}
                      className="p-4 flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="text-xs font-mono text-[#78716C] tabular-nums">
                          <span className="font-sans font-semibold text-[#1E3A5F]">
                            {node.role}
                          </span>
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span>Closeness {node.closeness}/5</span>
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span
                            className={
                              node.tension >= 4 ? 'text-[#9A3412] font-medium' : ''
                            }
                          >
                            Tension {node.tension}/5
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-[#1C1917]">
                          {node.name}
                        </div>
                        {node.dynamicNote && (
                          <p className="text-xs text-[#57534E] leading-relaxed">
                            {node.dynamicNote}
                          </p>
                        )}
                        {node.sharedNeed && (
                          <p className="text-xs text-[#292524]">
                            Need / Boundary: {node.sharedNeed}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeleteRelationshipNode(node.id)}
                        aria-label={`Remove ${node.name}`}
                        className="p-1 text-[#78716C] hover:text-[#9A3412]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {scopedInsights.length === 0 ? (
                <div className="border border-[#1C1917]/10 rounded-lg bg-[#F4F0E8]/35 p-6 text-sm text-[#57534E]">
                  No {activeSpec.title} insights generated yet. Select a starter prompt or describe a dynamic on the left to examine both perspectives clearly.
                </div>
              ) : (
                <div className="space-y-4">
                  {scopedInsights.map((ins) => (
                    <article
                      key={ins.id}
                      className="border border-[#1C1917]/12 rounded-lg bg-[#FBF9F5] p-6 space-y-4"
                    >
                      {ins.crisisDetected && (
                        <CrisisBanner
                          detectedCategories={ins.safetyCategories}
                          onOpenResources={onOpenCrisisSupport}
                        />
                      )}

                      <div className="flex items-start justify-between gap-3 border-b border-[#1C1917]/10 pb-3">
                        <div className="space-y-1">
                          <div className="text-xs text-[#78716C]">
                            <span className="font-medium text-[#1E3A5F]">
                              {activeSpec.title}
                            </span>
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
                          <div className="font-semibold text-[#1E3A5F]">
                            Your Perspective & Needs
                          </div>
                          <p className="text-[#292524] leading-relaxed">
                            {ins.yourPerspectiveAndNeeds}
                          </p>
                        </div>
                        <div className="p-3.5 rounded-md bg-[#F4F0E8]/60 border border-[#1C1917]/10 space-y-1">
                          <div className="font-semibold text-[#57534E]">
                            Their Likely Perspective & Needs
                          </div>
                          <p className="text-[#292524] leading-relaxed">
                            {ins.otherPerspectiveAndNeeds}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 text-xs text-[#292524]">
                        <div>
                          <span className="font-semibold text-[#1C1917]">
                            Communication Pattern:{' '}
                          </span>
                          {ins.communicationPattern}
                        </div>
                        <div>
                          <span className="font-semibold text-[#1E3A5F]">
                            Constructive Boundary / Request:{' '}
                          </span>
                          {ins.boundaryOrRequest}
                        </div>
                        <div className="italic text-[#57534E] pt-1">
                          Reflection Prompt: {ins.reflectionQuestion}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[#1C1917]/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setConflictScope(
                              activePillar === 'partner'
                                ? 'Partner Dynamics'
                                : activePillar === 'family'
                                  ? 'Family Insights'
                                  : 'Work Relationship Analysis'
                            );
                            setConflictFocus(ins.situation);
                            setActivePillar('conflict-reports');
                          }}
                          className="text-[#1E3A5F] font-medium hover:underline underline-offset-4 whitespace-nowrap"
                        >
                          Draft Conflict Report from This
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onDiscussInDialogue({
                              mode: 'relationship',
                              title: `${activeSpec.title} Reflection`,
                              summary: ins.dynamicSummary,
                              scriptOrNeed: ins.boundaryOrRequest,
                            })
                          }
                          className="inline-flex items-center gap-1 text-[#1C1917] font-medium hover:underline underline-offset-4 whitespace-nowrap"
                        >
                          <span>Explore in Dialogue</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PILLAR 4: CONFLICT REPORTS */}
      {activePillar === 'conflict-reports' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Conflict Report Synthesizer */}
          <div className="lg:col-span-5 space-y-6">
            <form
              onSubmit={handleGenerateConflictReport}
              className="border border-[#1C1917]/12 rounded-lg bg-[#FBF9F5] p-6 space-y-5"
            >
              <div className="space-y-1">
                <div className="text-xs font-medium text-[#1E3A5F]">
                  Conflict Mediator · De-Escalation Dossier
                </div>
                <h2 className="font-serif text-xl font-medium text-[#1C1917]">
                  Generate a Conflict Report
                </h2>
                <p className="text-xs text-[#57534E] leading-relaxed">
                  Synthesizes triggers, unmet needs on both sides, communication breakdowns, repair pathways, and a calm first-person script.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#57534E]">
                  Report Scope
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {CONFLICT_SCOPES.map((sc) => {
                    const active = conflictScope === sc;
                    return (
                      <button
                        key={sc}
                        type="button"
                        onClick={() => setConflictScope(sc)}
                        className={`px-3 py-2 text-xs font-medium rounded-md border text-left transition-colors ${
                          active
                            ? 'bg-[#1E3A5F] text-[#FBF9F5] border-[#1E3A5F]'
                            : 'bg-[#F4F0E8]/60 text-[#1C1917] border-[#1C1917]/12 hover:bg-[#EBE6DF]'
                        }`}
                      >
                        {sc}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="conflict-focus-input"
                  className="text-xs font-medium text-[#57534E]"
                >
                  Conflict Context or Incident Focus (optional if records exist)
                </label>
                <textarea
                  id="conflict-focus-input"
                  rows={4}
                  value={conflictFocus}
                  onChange={(e) => setConflictFocus(e.target.value)}
                  placeholder="Describe a specific disagreement, recurring standoff, or boundary tension you want untangled..."
                  className="w-full rounded-md border border-[#1C1917]/15 bg-[#F4F0E8]/40 p-3 text-sm text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                />
              </div>

              <div className="border-t border-[#1C1917]/10 pt-3 space-y-1 text-xs text-[#57534E] font-mono tabular-nums">
                <div className="flex justify-between">
                  <span>High-Tension Bonds (&ge;3/5)</span>
                  <span className="text-[#1C1917]">
                    {relationships.filter((r) => r.tension >= 3).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Area Dynamics Saved</span>
                  <span className="text-[#1C1917]">
                    {relationshipInsights.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Conflict / Relational Events</span>
                  <span className="text-[#1C1917]">{conflictEvents.length}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isGeneratingReport}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49] disabled:opacity-45 transition-colors"
              >
                {isGeneratingReport ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Synthesizing Conflict Report...</span>
                  </>
                ) : (
                  <span>Generate Conflict Report</span>
                )}
              </button>
            </form>

            {/* Quick Import from Recent Event Lab Conflict Logs */}
            {conflictEvents.length > 0 && (
              <div className="border border-[#1C1917]/10 rounded-lg bg-[#F4F0E8]/50 p-5 space-y-3">
                <div className="text-xs font-semibold text-[#1C1917]">
                  Recent Conflict & Relational Event Logs
                </div>
                <div className="space-y-2">
                  {conflictEvents.slice(0, 4).map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() =>
                        setConflictFocus(
                          `${ev.summaryTitle}: ${ev.rawEvent.slice(0, 260)}`
                        )
                      }
                      className="w-full text-left p-3 rounded-md bg-[#FBF9F5] border border-[#1C1917]/10 hover:border-[#1E3A5F]/40 transition-colors space-y-1"
                    >
                      <div className="flex justify-between text-[11px] font-mono text-[#78716C] tabular-nums">
                        <span>{ev.contextCategory}</span>
                        <span>{new Date(ev.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="text-xs font-medium text-[#1C1917]">
                        {ev.summaryTitle}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Generated Conflict Reports */}
          <div className="lg:col-span-7 space-y-6">
            {selectedReport ? (
              <article className="border border-[#1E3A5F]/20 rounded-lg bg-[#FBF9F5] p-6 sm:p-7 space-y-5">
                {selectedReport.crisisDetected && (
                  <CrisisBanner
                    detectedCategories={selectedReport.safetyCategories}
                    onOpenResources={onOpenCrisisSupport}
                  />
                )}

                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1C1917]/10 pb-4">
                  <div className="space-y-1">
                    <div className="text-xs text-[#78716C]">
                      <span className="font-medium text-[#1E3A5F]">
                        {selectedReport.scope}
                      </span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span
                        className={`font-medium ${
                          selectedReport.deEscalationUrgency === 'Elevated'
                            ? 'text-[#9A3412]'
                            : selectedReport.deEscalationUrgency === 'Moderate'
                              ? 'text-[#B45309]'
                              : 'text-[#1E3A5F]'
                        }`}
                      >
                        {selectedReport.deEscalationUrgency} de-escalation urgency
                      </span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {new Date(selectedReport.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h2 className="font-serif text-2xl font-medium text-[#1C1917]">
                      {selectedReport.title}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleExportConflictReport(selectedReport)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#1C1917]/15 text-[#1C1917] rounded-md hover:bg-[#EBE6DF] transition-colors whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export JSON</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteConflictReport(selectedReport.id)}
                      aria-label="Delete conflict report"
                      className="p-1.5 text-[#78716C] hover:text-[#9A3412]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-sm text-[#1C1917] leading-relaxed">
                  {selectedReport.conflictSummary}
                </p>

                {selectedReport.coreTriggers.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-[#1C1917]">
                      Core Escalation Triggers
                    </div>
                    <ul className="space-y-1 text-xs text-[#292524]">
                      {selectedReport.coreTriggers.map((t, i) => (
                        <li key={i}>· {t}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-md bg-[#F4F0E8]/60 border border-[#1C1917]/10 space-y-1.5">
                    <div className="font-semibold text-[#1E3A5F]">
                      Your Unspoken Needs
                    </div>
                    <ul className="space-y-1 text-[#292524]">
                      {selectedReport.selfNeeds.map((n, i) => (
                        <li key={i}>· {n}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-4 rounded-md bg-[#F4F0E8]/60 border border-[#1C1917]/10 space-y-1.5">
                    <div className="font-semibold text-[#57534E]">
                      Their Likely Unspoken Needs
                    </div>
                    <ul className="space-y-1 text-[#292524]">
                      {selectedReport.otherNeeds.map((n, i) => (
                        <li key={i}>· {n}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="font-semibold text-[#1C1917]">
                    Communication Breakdown Pattern
                  </div>
                  <p className="text-[#292524] leading-relaxed">
                    {selectedReport.communicationBreakdown}
                  </p>
                </div>

                {selectedReport.repairOptions.length > 0 && (
                  <div className="space-y-1.5 text-xs">
                    <div className="font-semibold text-[#1E3A5F]">
                      Constructive Repair Options
                    </div>
                    <ul className="space-y-1 text-[#292524]">
                      {selectedReport.repairOptions.map((opt, i) => (
                        <li key={i}>· {opt}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="p-4 rounded-md bg-[#F4F0E8]/80 border border-[#1E3A5F]/20 space-y-1.5">
                  <div className="text-xs font-semibold text-[#1E3A5F]">
                    Grounded Communication Script (Adaptable)
                  </div>
                  <p className="text-sm text-[#1C1917] leading-relaxed">
                    &ldquo;{selectedReport.constructiveScript}&rdquo;
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#1C1917]/10 text-xs">
                  <span className="italic text-[#57534E] max-w-md">
                    {selectedReport.reflectionQuestion}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onDiscussInDialogue({
                        mode: 'de-escalation',
                        title: selectedReport.title,
                        summary: selectedReport.conflictSummary,
                        scriptOrNeed: selectedReport.constructiveScript,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49] transition-colors whitespace-nowrap"
                  >
                    <span>Rehearse in De-Escalation Dialogue</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </article>
            ) : (
              <div className="border border-[#1C1917]/10 rounded-lg bg-[#F4F0E8]/35 p-6 text-sm text-[#57534E]">
                No Conflict Reports generated yet. Choose a scope on the left (Partner Dynamics, Family Insights, Work Relationship Analysis, or Cross-System Conflict) and generate your structured de-escalation and repair brief.
              </div>
            )}

            {/* Saved Conflict Reports Archive List */}
            {conflictReports.length > 1 && (
              <div className="space-y-3">
                <div className="text-xs font-medium text-[#78716C]">
                  Saved Conflict Reports Archive
                </div>
                <div className="divide-y divide-[#1C1917]/10 border border-[#1C1917]/10 rounded-lg bg-[#FBF9F5]">
                  {conflictReports.map((rep) => {
                    const active = rep.id === selectedReport?.id;
                    return (
                      <div
                        key={rep.id}
                        className={`p-3.5 flex items-center justify-between gap-3 ${
                          active ? 'bg-[#F4F0E8]/75' : ''
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedReportId(rep.id)}
                          className="text-left space-y-0.5 flex-1 min-w-0"
                        >
                          <div className="text-[11px] font-mono text-[#78716C] tabular-nums">
                            {rep.scope} · {rep.deEscalationUrgency} urgency ·{' '}
                            {new Date(rep.createdAt).toLocaleDateString()}
                          </div>
                          <div className="text-sm font-medium text-[#1C1917] truncate">
                            {rep.title}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteConflictReport(rep.id)}
                          aria-label="Delete archived conflict report"
                          className="p-1 text-[#78716C] hover:text-[#9A3412]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
