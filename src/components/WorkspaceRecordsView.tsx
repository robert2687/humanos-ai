import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Download,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { gatewayFetch, GatewaySessionInfo, RateLimitInfo } from '../lib/gatewayClient';
import { detectClientCrisisCategories } from '../hooks/useHumanosStore';
import { CrisisBanner } from './CrisisSupportView';
import {
  AssessmentInstrument,
  AssessmentRecord,
  AssessmentTier,
  CognitiveDistortionReport,
  DynamicUserModel,
  EventAnalysisRecord,
  GoalHorizon,
  GoalRecord,
  GoalStatus,
  GrowthArea,
  GrowthAreaPlan,
  GrowthJournalEntry,
  HumanosReport,
  LifeTimelineEvent,
  PatternHypothesis,
  ReflectionMode,
  ReflectionSession,
  RelationshipNode,
  ReportKind,
  UserProfile,
  WellbeingCheckIn,
} from '../types/humanos';

export type RecordSection =
  | 'users'
  | 'sessions'
  | 'goals'
  | 'journals'
  | 'assessments'
  | 'reports';

interface WorkspaceRecordsViewProps {
  users: UserProfile[];
  activeUser: UserProfile;
  sessions: ReflectionSession[];
  activeSession: ReflectionSession;
  goals: GoalRecord[];
  journalEntries: GrowthJournalEntry[];
  assessments: AssessmentRecord[];
  reports: HumanosReport[];
  wellbeingCheckIns: WellbeingCheckIn[];
  distortionReports: CognitiveDistortionReport[];
  eventAnalyses: EventAnalysisRecord[];
  hypotheses: PatternHypothesis[];
  growthPlans: GrowthAreaPlan[];
  timelineEvents: LifeTimelineEvent[];
  relationships: RelationshipNode[];
  dynamicUserModel: DynamicUserModel;
  onCreateUser: (input: {
    displayName: string;
    email?: string;
    focusIntention?: string;
    primaryAreas?: GrowthArea[];
  }) => UserProfile;
  onSelectUser: (userId: string) => void;
  onUpdateUser: (
    userId: string,
    patch: Partial<Pick<UserProfile, 'displayName' | 'email' | 'focusIntention' | 'primaryAreas'>>
  ) => void;
  onDeleteUser: (userId: string) => void;
  onStartNewSession: (mode?: ReflectionMode, title?: string) => string;
  onSelectSessionAndOpenDialogue: (sessionId: string) => void;
  onRenameSession: (id: string, title: string) => void;
  onDeleteSession: (id: string) => void;
  onAddGoal: (input: {
    title: string;
    area: GrowthArea;
    horizon: GoalHorizon;
    valuesAnchor: string;
    nextStep: string;
    milestoneLabels?: string[];
  }) => GoalRecord;
  onUpdateGoal: (
    id: string,
    patch: Partial<
      Pick<GoalRecord, 'title' | 'area' | 'horizon' | 'status' | 'valuesAnchor' | 'nextStep' | 'progress'>
    >
  ) => void;
  onToggleGoalMilestone: (goalId: string, milestoneId: string) => void;
  onDeleteGoal: (id: string) => void;
  onAddJournalEntry: (input: Omit<GrowthJournalEntry, 'id' | 'createdAt'>) => GrowthJournalEntry;
  onDeleteJournalEntry: (id: string) => void;
  onReflectJournalInDialogue: (entry: GrowthJournalEntry) => void;
  onAddAssessment: (input: Omit<AssessmentRecord, 'id' | 'createdAt'>) => AssessmentRecord;
  onDeleteAssessment: (id: string) => void;
  onAddReport: (report: HumanosReport) => HumanosReport;
  onDeleteReport: (id: string) => void;
  onOpenCrisisSupport: () => void;
}

const GROWTH_AREAS: GrowthArea[] = [
  'Confidence',
  'Discipline',
  'Habits',
  'Resilience',
  'Purpose',
  'Life Goals',
];

const MODE_LABELS: Record<ReflectionMode, string> = {
  insight: 'Insight',
  'self-reflection': 'Self-Reflection',
  relationship: 'Relationships',
  growth: 'Personal Growth',
  'de-escalation': 'De-Escalation',
  'digital-pause': 'Digital Pause',
};

const GOAL_HORIZONS: GoalHorizon[] = ['Near-term', 'Medium-term', 'Long-term'];

const ASSESSMENT_INSTRUMENTS: {
  instrument: AssessmentInstrument;
  subtitle: string;
  invertStrain: boolean;
  questions: string[];
}[] = [
  {
    instrument: 'Resilience Check',
    subtitle: 'Measures emotional recovery speed, adaptability under stress, and grounded perspective.',
    invertStrain: false,
    questions: [
      'When an unexpected setback occurs, I can steady myself before reacting.',
      'I remind myself that difficult moments are temporary rather than permanent.',
      'I reach out to supportive people or healthy routines when pressure rises.',
      'Even in uncertainty, I retain confidence in my ability to learn and adapt.',
    ],
  },
  {
    instrument: 'Burnout Screen',
    subtitle: 'Non-diagnostic screen for chronic exhaustion, cynicism, and depleted recovery bandwidth.',
    invertStrain: true,
    questions: [
      'I wake up already feeling depleted before my responsibilities begin.',
      'Small everyday requests feel disproportionately heavy or irritating.',
      'It feels hard to care about work or goals that normally matter to me.',
      'Rest or weekends no longer leave me feeling meaningfully restored.',
    ],
  },
  {
    instrument: 'Anxiety Pattern',
    subtitle: 'Tracks worry loops, physical tension, and hyper-vigilant anticipation.',
    invertStrain: true,
    questions: [
      'My mind repeatedly rehearses worst-case scenarios about upcoming events.',
      'I notice physical tension (tight chest, restlessness, racing thoughts) during ordinary days.',
      'Uncertainty feels hard to tolerate without seeking immediate reassurance.',
      'Worry makes it difficult to stay present during conversations or rest.',
    ],
  },
  {
    instrument: 'Mood & Depression Strain',
    subtitle: 'Gentle check on emotional heaviness, loss of pleasure, and motivation strain.',
    invertStrain: true,
    questions: [
      'Activities I normally appreciate feel muted, flat, or hard to initiate.',
      'I carry a lingering heaviness or emptiness across consecutive days.',
      'Self-critical thoughts convince me that effort will not change anything.',
      'Basic daily routines take noticeably more effort than usual.',
    ],
  },
  {
    instrument: 'Self-Esteem Reflection',
    subtitle: 'Examines earned self-respect, boundaries, and freedom from harsh perfectionism.',
    invertStrain: false,
    questions: [
      'I treat myself with fair respect even when I make a mistake.',
      'I can hold healthy boundaries without feeling deeply guilty for having needs.',
      'My sense of worth stays intact even when others disagree or pull back.',
      'I recognize my real strengths rather than dismissing them as luck.',
    ],
  },
  {
    instrument: 'Values Alignment',
    subtitle: 'Reflects how closely daily time and decisions match your stated personal values.',
    invertStrain: false,
    questions: [
      'My daily schedule reflects what I genuinely care about most.',
      'Recent difficult decisions felt consistent with my personal integrity.',
      'I spend energy on relationships and aims that feel meaningful, not merely urgent.',
      'I have a clear sense of direction for my next chapter.',
    ],
  },
];

const REPORT_KINDS: ReportKind[] = [
  'Holistic Wellbeing & Growth Report',
  'Behavioral & Cognitive Summary',
  'Relational & Values Brief',
  'Session & Goal Progress Digest',
];

export function WorkspaceRecordsView({
  users,
  activeUser,
  sessions,
  activeSession,
  goals,
  journalEntries,
  assessments,
  reports,
  wellbeingCheckIns,
  distortionReports,
  eventAnalyses,
  hypotheses,
  growthPlans,
  timelineEvents,
  relationships,
  dynamicUserModel,
  onCreateUser,
  onSelectUser,
  onUpdateUser,
  onDeleteUser,
  onStartNewSession,
  onSelectSessionAndOpenDialogue,
  onRenameSession,
  onDeleteSession,
  onAddGoal,
  onUpdateGoal,
  onToggleGoalMilestone,
  onDeleteGoal,
  onAddJournalEntry,
  onDeleteJournalEntry,
  onReflectJournalInDialogue,
  onAddAssessment,
  onDeleteAssessment,
  onAddReport,
  onDeleteReport,
  onOpenCrisisSupport,
}: WorkspaceRecordsViewProps) {
  const [section, setSection] = useState<RecordSection>('users');
  const [actionError, setActionError] = useState<string | null>(null);

  // Users state
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserFocus, setNewUserFocus] = useState('');
  const [editUserName, setEditUserName] = useState(activeUser.displayName);
  const [editUserEmail, setEditUserEmail] = useState(activeUser.email || '');
  const [editUserFocus, setEditUserFocus] = useState(activeUser.focusIntention);
  const [userSavedFlag, setUserSavedFlag] = useState(false);

  useEffect(() => {
    setEditUserName(activeUser.displayName);
    setEditUserEmail(activeUser.email || '');
    setEditUserFocus(activeUser.focusIntention);
  }, [activeUser]);

  // Sessions state
  const [sessionFilter, setSessionFilter] = useState<'all' | ReflectionMode>('all');
  const [sessionQuery, setSessionQuery] = useState('');
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newSessionMode, setNewSessionMode] = useState<ReflectionMode>('insight');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState('');
  const [gatewaySession, setGatewaySession] = useState<GatewaySessionInfo | null>(null);
  const [gatewayRateLimit, setGatewayRateLimit] = useState<RateLimitInfo | null>(null);

  useEffect(() => {
    if (section === 'sessions') {
      gatewayFetch('/api/gateway/session')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.session) setGatewaySession(data.session);
          if (data?.rateLimit) setGatewayRateLimit(data.rateLimit);
        })
        .catch(() => {
          // Non-blocking telemetry read
        });
    }
  }, [section]);

  // Goals state
  const [goalAreaFilter, setGoalAreaFilter] = useState<'All' | GrowthArea>('All');
  const [goalTitle, setGoalTitle] = useState('');
  const [goalArea, setGoalArea] = useState<GrowthArea>('Purpose');
  const [goalHorizon, setGoalHorizon] = useState<GoalHorizon>('Near-term');
  const [goalAnchor, setGoalAnchor] = useState('');
  const [goalNextStep, setGoalNextStep] = useState('');
  const [goalMilestonesInput, setGoalMilestonesInput] = useState('');

  // Journals state
  const [journalAreaFilter, setJournalAreaFilter] = useState<'All' | GrowthArea>('All');
  const [journalSearch, setJournalSearch] = useState('');
  const [journalArea, setJournalArea] = useState<GrowthArea>('Resilience');
  const [journalPrompt, setJournalPrompt] = useState(
    'What mattered most in how you responded today, and what are you learning about yourself?'
  );
  const [journalBody, setJournalBody] = useState('');
  const [journalValue, setJournalValue] = useState('');

  // Assessments state
  const [selectedInstrument, setSelectedInstrument] =
    useState<AssessmentInstrument>('Resilience Check');
  const [assessmentRatings, setAssessmentRatings] = useState<number[]>([3, 3, 3, 3]);
  const [assessmentNote, setAssessmentNote] = useState('');

  // Reports state
  const [reportKind, setReportKind] = useState<ReportKind>('Holistic Wellbeing & Growth Report');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const activeInstrumentSpec =
    ASSESSMENT_INSTRUMENTS.find((i) => i.instrument === selectedInstrument) ||
    ASSESSMENT_INSTRUMENTS[0];

  const handleSelectInstrument = (inst: AssessmentInstrument) => {
    setSelectedInstrument(inst);
    setAssessmentRatings([3, 3, 3, 3]);
    setAssessmentNote('');
  };

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    const q = sessionQuery.trim().toLowerCase();
    return sessions.filter((s) => {
      if (sessionFilter !== 'all' && s.mode !== sessionFilter) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.messages.some((m) => m.content.toLowerCase().includes(q))
      );
    });
  }, [sessions, sessionFilter, sessionQuery]);

  // Filtered Goals & Stats
  const filteredGoals = useMemo(() => {
    if (goalAreaFilter === 'All') return goals;
    return goals.filter((g) => g.area === goalAreaFilter);
  }, [goals, goalAreaFilter]);

  const goalStats = useMemo(() => {
    const active = goals.filter((g) => g.status === 'active').length;
    const completed = goals.filter((g) => g.status === 'completed').length;
    const avgProgress =
      goals.length > 0
        ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length)
        : 0;
    return { active, completed, avgProgress };
  }, [goals]);

  const promotableModelGoals = useMemo(
    () =>
      dynamicUserModel.entries
        .filter((e) => e.domain === 'goals' || e.domain === 'aspirations')
        .filter(
          (e) =>
            !goals.some(
              (g) => g.title.trim().toLowerCase() === e.observation.trim().slice(0, 80).toLowerCase()
            )
        )
        .slice(0, 4),
    [dynamicUserModel.entries, goals]
  );

  // Filtered Journals
  const filteredJournals = useMemo(() => {
    const q = journalSearch.trim().toLowerCase();
    return journalEntries.filter((j) => {
      if (journalAreaFilter !== 'All' && j.area !== journalAreaFilter) return false;
      if (!q) return true;
      return (
        j.entry.toLowerCase().includes(q) ||
        j.prompt.toLowerCase().includes(q) ||
        j.valueActivated.toLowerCase().includes(q)
      );
    });
  }, [journalEntries, journalAreaFilter, journalSearch]);

  // Handlers
  const handleSaveActiveUser = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser(activeUser.id, {
      displayName: editUserName,
      email: editUserEmail,
      focusIntention: editUserFocus,
    });
    setUserSavedFlag(true);
    setTimeout(() => setUserSavedFlag(false), 1800);
  };

  const handleToggleUserFocusArea = (area: GrowthArea) => {
    const has = activeUser.primaryAreas.includes(area);
    const updated = has
      ? activeUser.primaryAreas.filter((a) => a !== area)
      : [...activeUser.primaryAreas, area];
    onUpdateUser(activeUser.id, { primaryAreas: updated });
  };

  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim()) return;
    onCreateUser({
      displayName: newUserName.trim(),
      email: newUserEmail.trim(),
      focusIntention: newUserFocus.trim(),
    });
    setNewUserName('');
    setNewUserEmail('');
    setNewUserFocus('');
  };

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    const id = onStartNewSession(
      newSessionMode,
      newSessionTitle.trim() || `${MODE_LABELS[newSessionMode]} Reflection`
    );
    setNewSessionTitle('');
    onSelectSessionAndOpenDialogue(id);
  };

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;
    onAddGoal({
      title: goalTitle.trim(),
      area: goalArea,
      horizon: goalHorizon,
      valuesAnchor: goalAnchor.trim() || 'Self-respect and steady growth',
      nextStep: goalNextStep.trim() || 'Define one calm 15-minute first action.',
      milestoneLabels: goalMilestonesInput
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean),
    });
    setGoalTitle('');
    setGoalAnchor('');
    setGoalNextStep('');
    setGoalMilestonesInput('');
  };

  const handleSaveJournal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!journalBody.trim()) return;
    onAddJournalEntry({
      area: journalArea,
      prompt: journalPrompt.trim(),
      entry: journalBody.trim(),
      valueActivated: journalValue.trim(),
    });
    setJournalBody('');
    setJournalValue('');
  };

  const handleSubmitAssessment = (e: React.FormEvent) => {
    e.preventDefault();
    const spec = activeInstrumentSpec;
    const avgScore =
      assessmentRatings.reduce((acc, n) => acc + n, 0) / assessmentRatings.length;
    // Normalized 0..100 where higher means healthier resilience/alignment or higher strain when invertStrain is true
    const compositeScore = Math.round(((avgScore - 1) / 4) * 100);

    let tier: AssessmentTier = 'Moderate Load';
    let summaryNote = '';
    if (spec.invertStrain) {
      if (compositeScore >= 68) {
        tier = 'Elevated Strain';
        summaryNote = `${spec.instrument} responses suggest elevated strain (${compositeScore}/100). Consider easing non-essential pressure, restoring sleep/connection, and leaning on trusted support.`;
      } else if (compositeScore >= 40) {
        tier = 'Moderate Load';
        summaryNote = `${spec.instrument} responses point to moderate load (${compositeScore}/100)—worth gentle pacing and boundary protection before fatigue compounds.`;
      } else {
        tier = 'Steady';
        summaryNote = `${spec.instrument} responses appear relatively steady (${compositeScore}/100) right now.`;
      }
    } else {
      if (compositeScore >= 68) {
        tier = 'Steady';
        summaryNote = `${spec.instrument} reflects strong grounded capacity (${compositeScore}/100) in your current season.`;
      } else if (compositeScore >= 40) {
        tier = 'Moderate Load';
        summaryNote = `${spec.instrument} indicates moderate grounding (${compositeScore}/100) with clear room to strengthen daily practices.`;
      } else {
        tier = 'Elevated Strain';
        summaryNote = `${spec.instrument} score is lower (${compositeScore}/100), signaling a gentle opportunity to rebuild confidence, support, or values alignment.`;
      }
    }

    const categories = detectClientCrisisCategories(assessmentNote);
    onAddAssessment({
      instrument: spec.instrument,
      responses: spec.questions.map((question, i) => ({
        question,
        score: assessmentRatings[i] ?? 3,
      })),
      compositeScore,
      tier,
      summaryNote,
      reflectionNote: assessmentNote.trim(),
      crisisDetected: categories.length > 0,
      safetyCategories: categories,
    });
    setAssessmentNote('');
  };

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    setActionError(null);
    try {
      const userLine = `User Profile: ${activeUser.displayName}${activeUser.email ? ` (${activeUser.email})` : ''} | Focus: ${activeUser.focusIntention} | Areas: ${activeUser.primaryAreas.join(', ')}`;
      const sessionLines = sessions
        .flatMap((s) =>
          s.messages.slice(-4).map((m) => `[Session "${s.title}" (${s.mode}) | ${m.role}]: ${m.content.slice(0, 320)}`)
        )
        .slice(-16)
        .join('\n');
      const goalLines = goals
        .slice(0, 10)
        .map(
          (g) =>
            `[Goal ${g.area} | ${g.status} | ${g.progress}% | ${g.horizon}]: ${g.title} — Anchor: ${g.valuesAnchor}`
        )
        .join('\n');
      const growthPlanLines = growthPlans
        .slice(0, 6)
        .map(
          (p) =>
            `[Growth Coaching ${p.area}]: ${p.currentPattern} — Anchor: ${p.valuesAnchor} — Step: ${p.smallSustainableStep}`
        )
        .join('\n');
      const journalLines = journalEntries
        .slice(0, 10)
        .map((j) => `[Journal ${j.area || 'General'} | Value: ${j.valueActivated || 'n/a'}]: ${j.entry.slice(0, 320)}`)
        .join('\n');
      const assessmentLines = assessments
        .slice(0, 8)
        .map(
          (a) =>
            `[Assessment ${a.instrument}]: ${a.compositeScore}/100 (${a.tier}) — ${a.summaryNote}${a.reflectionNote ? ` Note: ${a.reflectionNote}` : ''}`
        )
        .join('\n');
      const wellbeingLines = wellbeingCheckIns
        .slice(0, 6)
        .map(
          (w) =>
            `[Wellbeing ${new Date(w.createdAt).toLocaleDateString()}]: Mood ${w.mood}/5, Stress ${w.stress}/5, Anxiety ${w.anxiety}/5, Energy ${w.energy}/5, Self-Esteem ${w.selfEsteem}/5`
        )
        .join('\n');
      const eventLines = eventAnalyses
        .slice(0, 6)
        .map((e) => `[Event ${e.summaryTitle}]: Needs ${e.needs.join(', ')}`)
        .join('\n');
      const modelLines = dynamicUserModel.entries
        .slice(0, 14)
        .map((m) => `[Model ${m.domain} | ${m.confidence}]: ${m.observation}`)
        .join('\n');
      const hypLines = hypotheses
        .filter((h) => h.status !== 'dismissed')
        .slice(0, 8)
        .map((h) => `[Hypothesis ${h.dimension}]: ${h.statement}`)
        .join('\n');
      const timelineLines = timelineEvents
        .slice(0, 5)
        .map((t) => `[Timeline ${t.timeframe}]: ${t.title}`)
        .join('\n');
      const relLines = relationships
        .slice(0, 6)
        .map((r) => `[Relationship ${r.name} (${r.area})]: Closeness ${r.closeness}/5 Tension ${r.tension}/5`)
        .join('\n');

      const recordsOnly = [
        sessionLines,
        goalLines,
        growthPlanLines,
        journalLines,
        assessmentLines,
        wellbeingLines,
        eventLines,
        modelLines,
        hypLines,
        timelineLines,
        relLines,
      ]
        .filter(Boolean)
        .join('\n\n');

      if (recordsOnly.trim().length < 20) {
        throw new Error(
          'Add at least one Dialogue session, Goal, Journal entry, or Assessment before generating a HUMANOS Report.'
        );
      }

      const contextBundle = [userLine, recordsOnly].filter(Boolean).join('\n\n');
      const response = await gatewayFetch('/api/agents/report', {
        method: 'POST',
        body: JSON.stringify({
          kind: reportKind,
          userDisplayName: activeUser.displayName,
          contextBundle,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not generate HUMANOS Report.');
      }

      onAddReport(data as HumanosReport);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Report generation failed.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleDownloadReportMarkdown = (report: HumanosReport) => {
    const md = [
      `# ${report.title}`,
      `Profile: ${activeUser.displayName} · Category: ${report.kind} · Generated: ${new Date(report.generatedAt).toLocaleString()}`,
      '',
      '## Executive Summary',
      report.executiveSummary,
      '',
      '## Key Probabilistic Patterns',
      ...report.keyPatterns.map((p) => `- ${p}`),
      '',
      '## Wellbeing & Assessment Trajectory',
      report.wellbeingTrajectory,
      '',
      '## Goals & Values Alignment',
      report.goalsAndValuesAlignment,
      '',
      '## Recommended Next Steps',
      ...report.recommendedNextSteps.map((s, idx) => `${idx + 1}. ${s}`),
      '',
      '---',
      report.ethicalNote,
    ].join('\n');

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `humanos-report-${report.generatedAt.slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const latestAssessmentWithCrisis = assessments.find((a) => a.crisisDetected);

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-10 space-y-8">
      {/* Header Overview */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-[#1C1917]/10 pb-8">
        <div className="space-y-2.5 max-w-3xl">
          <p className="text-xs font-medium text-[#1E3A5F]">
            Workspace Records · {activeUser.displayName}
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-[#1C1917] [text-wrap:balance]">
            Users, Sessions, Goals, Journals, Assessments, and Reports
          </h1>
          <p className="text-sm sm:text-base text-[#57534E] leading-relaxed">
            Manage personal reflection profiles, review dialogue threads, track values-anchored goals, archive daily journals, complete non-diagnostic self-assessments, and synthesize longitudinal reports.
          </p>
        </div>

        <div className="text-xs text-[#78716C] font-mono tabular-nums shrink-0">
          <span>{users.length} users</span>
          <span className="mx-2" aria-hidden="true">·</span>
          <span>{sessions.length} sessions</span>
          <span className="mx-2" aria-hidden="true">·</span>
          <span>{goals.length} goals</span>
          <span className="mx-2" aria-hidden="true">·</span>
          <span>{assessments.length} assessments</span>
        </div>
      </section>

      {/* 6 Core Entity Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F4F0E8] border border-[#1C1917]/10 rounded-lg w-fit">
        {(
          [
            { id: 'users', label: `Users (${users.length})` },
            { id: 'sessions', label: `Sessions (${sessions.length})` },
            { id: 'goals', label: `Goals (${goals.length})` },
            { id: 'journals', label: `Journals (${journalEntries.length})` },
            { id: 'assessments', label: `Assessments (${assessments.length})` },
            { id: 'reports', label: `Reports (${reports.length})` },
          ] as const
        ).map((tab) => {
          const active = section === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSection(tab.id)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                active
                  ? 'bg-[#FBF9F5] text-[#1C1917] shadow-xs border border-[#1C1917]/10'
                  : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {actionError && (
        <div
          role="alert"
          className="p-4 rounded-lg border border-[#9A3412]/25 bg-[#FDF4F2] text-sm text-[#9A3412]"
        >
          {actionError}
        </div>
      )}

      {/* =================================================================== */}
      {/* 1. USERS */}
      {/* =================================================================== */}
      {section === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleSaveActiveUser}
            className="lg:col-span-6 border border-[#1C1917]/12 rounded-lg bg-[#FBF9F5] p-6 space-y-5 self-start"
          >
            <div className="flex items-baseline justify-between border-b border-[#1C1917]/10 pb-3">
              <div>
                <div className="text-xs font-medium text-[#1E3A5F]">Active Profile</div>
                <h2 className="font-serif text-xl font-medium text-[#1C1917]">
                  {activeUser.displayName}
                </h2>
              </div>
              <span className="font-mono text-xs text-[#78716C] tabular-nums">
                Updated {new Date(activeUser.updatedAt).toLocaleDateString()}
              </span>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#57534E]">Display Name</label>
                <input
                  type="text"
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] focus:outline-none focus:border-[#1E3A5F]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#57534E]">
                  Contact Email (optional local record)
                </label>
                <input
                  type="email"
                  value={editUserEmail}
                  onChange={(e) => setEditUserEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#57534E]">
                  Current Focus Intention
                </label>
                <textarea
                  value={editUserFocus}
                  onChange={(e) => setEditUserFocus(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-[#57534E]">Primary Growth Areas</div>
                <div className="flex flex-wrap gap-1.5">
                  {GROWTH_AREAS.map((area) => {
                    const selected = activeUser.primaryAreas.includes(area);
                    return (
                      <button
                        key={area}
                        type="button"
                        onClick={() => handleToggleUserFocusArea(area)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                          selected
                            ? 'bg-[#1E3A5F] text-[#FBF9F5]'
                            : 'bg-[#F4F0E8] text-[#57534E] hover:text-[#1C1917]'
                        }`}
                      >
                        {area}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49] transition-colors whitespace-nowrap"
              >
                Save Profile Details
              </button>
              {userSavedFlag && (
                <span className="inline-flex items-center gap-1 text-xs text-[#1E3A5F]">
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved</span>
                </span>
              )}
            </div>
          </form>

          <div className="lg:col-span-6 space-y-6">
            {/* User Switcher Directory */}
            <section className="border border-[#1C1917]/12 rounded-lg bg-[#F4F0E8]/45 p-6 space-y-4">
              <div className="space-y-1">
                <h2 className="font-serif text-xl font-medium text-[#1C1917]">
                  User Profiles ({users.length})
                </h2>
                <p className="text-xs text-[#57534E]">
                  Each user profile isolates its own Sessions, Goals, Journals, Assessments, Reports, and Digital Twin memory locally.
                </p>
              </div>

              <div className="divide-y divide-[#1C1917]/10 border-t border-b border-[#1C1917]/10">
                {users.map((u) => {
                  const isCurrent = u.id === activeUser.id;
                  return (
                    <div key={u.id} className="py-3.5 flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm font-semibold text-[#1C1917]">
                          <span className="truncate">{u.displayName}</span>
                          {isCurrent && (
                            <span className="text-xs font-medium text-[#1E3A5F] whitespace-nowrap">
                              · Active
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#57534E] truncate">
                          {u.email ? `${u.email} · ` : ''}
                          {u.focusIntention}
                        </div>
                        <div className="text-[11px] font-mono text-[#78716C] tabular-nums">
                          {u.primaryAreas.join(' / ') || 'General'} · Created {new Date(u.createdAt).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!isCurrent && (
                          <button
                            type="button"
                            onClick={() => onSelectUser(u.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-[#1E3A5F]/35 text-[#1E3A5F] rounded-md hover:bg-[#1E3A5F] hover:text-[#FBF9F5] transition-colors whitespace-nowrap"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Switch</span>
                          </button>
                        )}
                        {users.length > 1 && (
                          <button
                            type="button"
                            onClick={() => onDeleteUser(u.id)}
                            aria-label={`Delete user ${u.displayName}`}
                            className="p-1.5 text-[#78716C] hover:text-[#9A3412] transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Add New User Form */}
            <form
              onSubmit={handleCreateUserSubmit}
              className="border border-[#1C1917]/12 rounded-lg bg-[#FBF9F5] p-6 space-y-4"
            >
              <h3 className="font-serif text-lg font-medium text-[#1C1917]">
                Create Additional User Profile
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Profile name (e.g., Work Journal)"
                  className="px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] focus:outline-none focus:border-[#1E3A5F]"
                  required
                />
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="Optional email"
                  className="px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>
              <input
                type="text"
                value={newUserFocus}
                onChange={(e) => setNewUserFocus(e.target.value)}
                placeholder="Focus intention for this profile..."
                className="w-full px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] focus:outline-none focus:border-[#1E3A5F]"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49] whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add User Profile</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. SESSIONS */}
      {/* =================================================================== */}
      {section === 'sessions' && (
        <div className="space-y-6">
          {/* Gateway + New Session Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={handleCreateSession}
              className="lg:col-span-8 border border-[#1C1917]/12 rounded-lg bg-[#F4F0E8]/50 p-5 flex flex-col sm:flex-row sm:items-end gap-3"
            >
              <div className="flex-1 space-y-1">
                <label className="block text-xs font-medium text-[#57534E]">
                  Start New Reflection Session
                </label>
                <input
                  type="text"
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  placeholder="Session title (e.g., Career decision check-in)"
                  className="w-full px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#57534E]">Mode</label>
                <select
                  value={newSessionMode}
                  onChange={(e) => setNewSessionMode(e.target.value as ReflectionMode)}
                  className="px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] focus:outline-none focus:border-[#1E3A5F]"
                >
                  {(Object.keys(MODE_LABELS) as ReflectionMode[]).map((m) => (
                    <option key={m} value={m}>
                      {MODE_LABELS[m]}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49] whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create & Open</span>
              </button>
            </form>

            <div className="lg:col-span-4 border border-[#1C1917]/12 rounded-lg bg-[#FBF9F5] p-5 flex flex-col justify-between space-y-2">
              <div className="text-xs font-medium text-[#1E3A5F]">Gateway Session Telemetry</div>
              <div className="text-xs text-[#57534E] font-mono tabular-nums space-y-1">
                <div>Hash: {gatewaySession?.idHash || 'Pending'}</div>
                <div>
                  Surface: {(gatewaySession?.surface || 'web').toUpperCase()} · Requests:{' '}
                  {gatewaySession?.requestCount ?? 0}
                </div>
                {gatewayRateLimit && (
                  <div>
                    5-Min Quota: {gatewayRateLimit.remaining} / {gatewayRateLimit.limit}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {(['all', 'insight', 'self-reflection', 'relationship', 'growth', 'de-escalation', 'digital-pause'] as const).map(
                (m) => {
                  const active = sessionFilter === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSessionFilter(m)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-[#1E3A5F] text-[#FBF9F5]'
                          : 'bg-[#F4F0E8] text-[#57534E] hover:text-[#1C1917]'
                      }`}
                    >
                      {m === 'all' ? 'All Modes' : MODE_LABELS[m]}
                    </button>
                  );
                }
              )}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={sessionQuery}
                onChange={(e) => setSessionQuery(e.target.value)}
                placeholder="Search sessions..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] focus:outline-none focus:border-[#1E3A5F]"
              />
            </div>
          </div>

          {/* Sessions Table */}
          <div className="border border-[#1C1917]/12 rounded-lg bg-[#FBF9F5] overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#1C1917]/10 text-xs text-[#78716C] bg-[#F4F0E8]/50">
                  <th className="py-3 px-4 font-medium">Session Title</th>
                  <th className="py-3 px-4 font-medium">Focus Mode</th>
                  <th className="py-3 px-4 font-medium text-right">Turns</th>
                  <th className="py-3 px-4 font-medium">Updated</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1C1917]/10">
                {filteredSessions.map((sess) => {
                  const isCurrent = sess.id === activeSession.id;
                  const isEditing = editingSessionId === sess.id;
                  return (
                    <tr key={sess.id} className="hover:bg-[#F4F0E8]/40">
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editingSessionTitle}
                              onChange={(e) => setEditingSessionTitle(e.target.value)}
                              className="px-2 py-1 text-xs rounded border border-[#1E3A5F] bg-[#FBF9F5]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                onRenameSession(sess.id, editingSessionTitle);
                                setEditingSessionId(null);
                              }}
                              className="text-xs font-medium text-[#1E3A5F]"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div className="font-medium text-[#1C1917]">
                              {sess.title}
                              {isCurrent && (
                                <span className="ml-2 text-xs font-normal text-[#1E3A5F]">
                                  · Active
                                </span>
                              )}
                            </div>
                            {sess.messages.length > 0 && (
                              <div className="text-xs text-[#78716C] line-clamp-1 max-w-md">
                                {sess.messages[sess.messages.length - 1].content}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#57534E] whitespace-nowrap">
                        {MODE_LABELS[sess.mode]}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-[#57534E]">
                        {sess.messages.length}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs tabular-nums text-[#78716C] whitespace-nowrap">
                        {new Date(sess.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectSessionAndOpenDialogue(sess.id)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#1E3A5F] hover:underline underline-offset-4 whitespace-nowrap"
                          >
                            <span>Open</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSessionId(sess.id);
                              setEditingSessionTitle(sess.title);
                            }}
                            aria-label="Rename session"
                            className="p-1 text-[#78716C] hover:text-[#1C1917]"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteSession(sess.id)}
                            aria-label="Delete session"
                            className="p-1 text-[#78716C] hover:text-[#9A3412]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. GOALS */}
      {/* =================================================================== */}
      {section === 'goals' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleCreateGoal}
            className="lg:col-span-5 border border-[#1C1917]/12 rounded-lg bg-[#F4F0E8]/55 p-6 space-y-4 self-start"
          >
            <div className="space-y-1">
              <h2 className="font-serif text-xl font-medium text-[#1C1917]">
                Create Values-Aligned Goal
              </h2>
              <p className="text-xs text-[#57534E]">
                Connect tangible milestones across Confidence, Discipline, Habits, Resilience, Purpose, or Life Goals.
              </p>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                placeholder="Goal title (e.g., Protect 30 min morning quiet reflection)"
                className="w-full px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] focus:outline-none focus:border-[#1E3A5F]"
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs text-[#57534E]">Growth Area</label>
                  <select
                    value={goalArea}
                    onChange={(e) => setGoalArea(e.target.value as GrowthArea)}
                    className="w-full px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5]"
                  >
                    {GROWTH_AREAS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs text-[#57534E]">Horizon</label>
                  <select
                    value={goalHorizon}
                    onChange={(e) => setGoalHorizon(e.target.value as GoalHorizon)}
                    className="w-full px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5]"
                  >
                    {GOAL_HORIZONS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <input
                type="text"
                value={goalAnchor}
                onChange={(e) => setGoalAnchor(e.target.value)}
                placeholder="Core value this honors (e.g., Autonomy, Presence, Integrity)"
                className="w-full px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5]"
              />

              <input
                type="text"
                value={goalNextStep}
                onChange={(e) => setGoalNextStep(e.target.value)}
                placeholder="Smallest concrete next step..."
                className="w-full px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5]"
              />

              <input
                type="text"
                value={goalMilestonesInput}
                onChange={(e) => setGoalMilestonesInput(e.target.value)}
                placeholder="Optional milestones (comma-separated)"
                className="w-full px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 text-xs font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49]"
            >
              Add Goal to Workspace
            </button>

            {promotableModelGoals.length > 0 && (
              <div className="border-t border-[#1C1917]/10 pt-4 space-y-2">
                <div className="text-xs font-medium text-[#1E3A5F]">
                  Promote from Dynamic User Model ({promotableModelGoals.length})
                </div>
                <div className="space-y-1.5">
                  {promotableModelGoals.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-2 text-xs text-[#292524]"
                    >
                      <span className="truncate">{entry.observation}</span>
                      <button
                        type="button"
                        onClick={() =>
                          onAddGoal({
                            title: entry.observation.slice(0, 80),
                            area: entry.domain === 'aspirations' ? 'Purpose' : 'Life Goals',
                            horizon: entry.domain === 'aspirations' ? 'Long-term' : 'Medium-term',
                            valuesAnchor: 'Aligned with Dynamic User Model',
                            nextStep: 'Break into one sustainable weekly practice.',
                          })
                        }
                        className="text-xs font-medium text-[#1E3A5F] hover:underline whitespace-nowrap shrink-0"
                      >
                        + Track Goal
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>

          <div className="lg:col-span-7 space-y-5">
            {/* Goal Summary & Filter */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1C1917]/10 pb-4">
              <div className="text-xs text-[#57534E] font-mono tabular-nums">
                <span>{goalStats.active} active</span>
                <span className="mx-2" aria-hidden="true">·</span>
                <span>{goalStats.completed} completed</span>
                <span className="mx-2" aria-hidden="true">·</span>
                <span>Avg progress {goalStats.avgProgress}%</span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(['All', ...GROWTH_AREAS] as const).map((area) => {
                  const active = goalAreaFilter === area;
                  return (
                    <button
                      key={area}
                      type="button"
                      onClick={() => setGoalAreaFilter(area)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-[#1E3A5F] text-[#FBF9F5]'
                          : 'bg-[#F4F0E8] text-[#57534E] hover:text-[#1C1917]'
                      }`}
                    >
                      {area}
                    </button>
                  );
                })}
              </div>
            </div>

            {filteredGoals.length === 0 ? (
              <div className="border border-[#1C1917]/10 rounded-lg p-8 text-sm text-[#78716C] bg-[#F4F0E8]/35">
                No goals tracked in this category yet. Create a goal on the left or promote an observation from your Dynamic User Model.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredGoals.map((goal) => (
                  <article
                    key={goal.id}
                    className="border border-[#1C1917]/12 rounded-lg bg-[#FBF9F5] p-5 space-y-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-xs text-[#78716C]">
                          <span className="font-medium text-[#1E3A5F]">{goal.area}</span>
                          <span className="mx-2" aria-hidden="true">·</span>
                          <span>{goal.horizon}</span>
                          <span className="mx-2" aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{goal.progress}% complete</span>
                        </div>
                        <h3 className="font-serif text-lg font-medium text-[#1C1917]">
                          {goal.title}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          aria-label="Goal status"
                          value={goal.status}
                          onChange={(e) =>
                            onUpdateGoal(goal.id, { status: e.target.value as GoalStatus })
                          }
                          className="px-2 py-1 text-xs rounded border border-[#1C1917]/15 bg-[#F4F0E8]/60 text-[#1C1917]"
                        >
                          <option value="active">Active</option>
                          <option value="paused">Paused</option>
                          <option value="completed">Completed</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => onDeleteGoal(goal.id)}
                          aria-label="Delete goal"
                          className="p-1.5 text-[#78716C] hover:text-[#9A3412]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#57534E]">
                      <div>
                        <span className="font-semibold text-[#1C1917]">Values Anchor: </span>
                        {goal.valuesAnchor}
                      </div>
                      <div>
                        <span className="font-semibold text-[#1C1917]">Next Step: </span>
                        {goal.nextStep}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-[#78716C]">
                        <span>Progress</span>
                        <span className="font-mono tabular-nums">{goal.progress}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={goal.progress}
                        onChange={(e) =>
                          onUpdateGoal(goal.id, { progress: Number(e.target.value) })
                        }
                        className="w-full accent-[#1E3A5F]"
                      />
                    </div>

                    {goal.milestones.length > 0 && (
                      <div className="border-t border-[#1C1917]/10 pt-3 space-y-1.5">
                        <div className="text-xs font-medium text-[#57534E]">Milestones</div>
                        <div className="space-y-1">
                          {goal.milestones.map((ms) => (
                            <label
                              key={ms.id}
                              className="flex items-center gap-2.5 text-xs text-[#292524] cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={ms.done}
                                onChange={() => onToggleGoalMilestone(goal.id, ms.id)}
                                className="accent-[#1E3A5F]"
                              />
                              <span className={ms.done ? 'line-through text-[#78716C]' : ''}>
                                {ms.label}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 4. JOURNALS */}
      {/* =================================================================== */}
      {section === 'journals' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleSaveJournal}
            className="lg:col-span-5 border border-[#1C1917]/12 rounded-lg bg-[#F4F0E8]/55 p-6 space-y-4 self-start"
          >
            <div className="space-y-1">
              <h2 className="font-serif text-xl font-medium text-[#1C1917]">
                New Journal Entry
              </h2>
              <p className="text-xs text-[#57534E]">
                Entries stay synced with Growth Journal inside Pattern Atlas and inform your Reports & Dynamic User Model.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs text-[#57534E]">Focus Area</label>
                <select
                  value={journalArea}
                  onChange={(e) => setJournalArea(e.target.value as GrowthArea)}
                  className="w-full px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5]"
                >
                  {GROWTH_AREAS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs text-[#57534E]">Guiding Prompt</label>
                <input
                  type="text"
                  value={journalPrompt}
                  onChange={(e) => setJournalPrompt(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-md border border-[#1C1917]/15 bg-[#FBF9F5]"
                />
              </div>

              <textarea
                value={journalBody}
                onChange={(e) => setJournalBody(e.target.value)}
                rows={5}
                placeholder="Write candidly about today's moments, emotional signals, or lessons..."
                className="w-full px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] focus:outline-none focus:border-[#1E3A5F]"
                required
              />

              <input
                type="text"
                value={journalValue}
                onChange={(e) => setJournalValue(e.target.value)}
                placeholder="Value practiced or sought (optional)"
                className="w-full px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 text-xs font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49]"
            >
              Save Journal Entry
            </button>
          </form>

          <div className="lg:col-span-7 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1C1917]/10 pb-4">
              <div className="flex flex-wrap gap-1.5">
                {(['All', ...GROWTH_AREAS] as const).map((area) => {
                  const active = journalAreaFilter === area;
                  return (
                    <button
                      key={area}
                      type="button"
                      onClick={() => setJournalAreaFilter(area)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-[#1E3A5F] text-[#FBF9F5]'
                          : 'bg-[#F4F0E8] text-[#57534E] hover:text-[#1C1917]'
                      }`}
                    >
                      {area}
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={journalSearch}
                  onChange={(e) => setJournalSearch(e.target.value)}
                  placeholder="Search journals..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-[#1C1917]/15 bg-[#FBF9F5]"
                />
              </div>
            </div>

            {filteredJournals.length === 0 ? (
              <div className="border border-[#1C1917]/10 rounded-lg p-8 text-sm text-[#78716C] bg-[#F4F0E8]/35">
                No journal entries match your current filter. Write a reflection on the left to build your archive.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredJournals.map((entry) => (
                  <article
                    key={entry.id}
                    className="border border-[#1C1917]/12 rounded-lg bg-[#FBF9F5] p-5 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="text-xs text-[#78716C]">
                        <span className="font-medium text-[#1E3A5F]">
                          {entry.area || 'Reflection'}
                        </span>
                        {entry.valueActivated && (
                          <>
                            <span className="mx-2" aria-hidden="true">·</span>
                            <span>Value: {entry.valueActivated}</span>
                          </>
                        )}
                        <span className="mx-2" aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          type="button"
                          onClick={() => onReflectJournalInDialogue(entry)}
                          className="text-xs font-medium text-[#1E3A5F] hover:underline underline-offset-4 whitespace-nowrap"
                        >
                          Reflect in Dialogue
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteJournalEntry(entry.id)}
                          aria-label="Delete journal entry"
                          className="p-1 text-[#78716C] hover:text-[#9A3412]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="text-xs italic text-[#57534E]">{entry.prompt}</div>
                    <p className="text-sm text-[#1C1917] leading-relaxed whitespace-pre-wrap">
                      {entry.entry}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 5. ASSESSMENTS */}
      {/* =================================================================== */}
      {section === 'assessments' && (
        <div className="space-y-8">
          {latestAssessmentWithCrisis && (
            <CrisisBanner
              detectedCategories={latestAssessmentWithCrisis.safetyCategories}
              onOpenResources={onOpenCrisisSupport}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Assessment Instrument Runner */}
            <form
              onSubmit={handleSubmitAssessment}
              className="lg:col-span-6 border border-[#1C1917]/12 rounded-lg bg-[#F4F0E8]/55 p-6 space-y-5 self-start"
            >
              <div className="space-y-2">
                <div className="text-xs font-medium text-[#1E3A5F]">
                  Non-Diagnostic Self-Assessment Instrument
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ASSESSMENT_INSTRUMENTS.map((spec) => {
                    const active = selectedInstrument === spec.instrument;
                    return (
                      <button
                        key={spec.instrument}
                        type="button"
                        onClick={() => handleSelectInstrument(spec.instrument)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-[#1E3A5F] text-[#FBF9F5]'
                            : 'bg-[#FBF9F5] text-[#57534E] border border-[#1C1917]/12 hover:text-[#1C1917]'
                        }`}
                      >
                        {spec.instrument}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-[#57534E] pt-1">{activeInstrumentSpec.subtitle}</p>
              </div>

              <div className="space-y-4 divide-y divide-[#1C1917]/10">
                {activeInstrumentSpec.questions.map((question, qIdx) => {
                  const val = assessmentRatings[qIdx] ?? 3;
                  return (
                    <div key={qIdx} className="pt-3 first:pt-0 space-y-2">
                      <div className="text-sm text-[#1C1917] leading-snug">
                        <span className="font-mono text-xs text-[#1E3A5F] mr-2 tabular-nums">
                          0{qIdx + 1}.
                        </span>
                        {question}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-[#78716C]">Rarely (1)</span>
                        <div className="flex items-center gap-1.5">
                          {[1, 2, 3, 4, 5].map((num) => (
                            <button
                              key={num}
                              type="button"
                              onClick={() =>
                                setAssessmentRatings((prev) => {
                                  const next = [...prev];
                                  next[qIdx] = num;
                                  return next;
                                })
                              }
                              className={`w-8 h-8 text-xs font-mono tabular-nums rounded-md border transition-colors ${
                                val === num
                                  ? 'bg-[#1E3A5F] text-[#FBF9F5] border-[#1E3A5F]'
                                  : 'bg-[#FBF9F5] text-[#57534E] border-[#1C1917]/15 hover:text-[#1C1917]'
                              }`}
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                        <span className="text-[11px] text-[#78716C]">Often (5)</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <textarea
                value={assessmentNote}
                onChange={(e) => setAssessmentNote(e.target.value)}
                rows={2}
                placeholder="Optional context or observation about what is influencing these ratings..."
                className="w-full px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5]"
              />

              <button
                type="submit"
                className="w-full py-2.5 px-4 text-xs font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49]"
              >
                Complete & Save Assessment
              </button>
            </form>

            {/* Saved Assessment Ledger & Cross-Module Summary */}
            <div className="lg:col-span-6 space-y-6">
              <div className="grid grid-cols-3 gap-4 border border-[#1C1917]/12 rounded-lg bg-[#FBF9F5] p-5">
                <div>
                  <div className="text-xs text-[#78716C]">Structured Screens</div>
                  <div className="font-mono text-2xl font-medium text-[#1C1917] tabular-nums">
                    {assessments.length}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#78716C]">Wellbeing Check-ins</div>
                  <div className="font-mono text-2xl font-medium text-[#1C1917] tabular-nums">
                    {wellbeingCheckIns.length}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#78716C]">CBT Thought Checks</div>
                  <div className="font-mono text-2xl font-medium text-[#1C1917] tabular-nums">
                    {distortionReports.length}
                  </div>
                </div>
              </div>

              {assessments.length === 0 ? (
                <div className="border border-[#1C1917]/10 rounded-lg p-8 text-sm text-[#78716C] bg-[#F4F0E8]/35">
                  No structured self-assessments recorded yet. Select any instrument on the left (Resilience Check, Burnout Screen, Anxiety Pattern, Mood & Depression Strain, Self-Esteem Reflection, or Values Alignment) to log a baseline.
                </div>
              ) : (
                <div className="space-y-4">
                  {assessments.map((item) => (
                    <article
                      key={item.id}
                      className="border border-[#1C1917]/12 rounded-lg bg-[#FBF9F5] p-5 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-0.5">
                          <div className="text-xs text-[#78716C] font-mono tabular-nums">
                            {new Date(item.createdAt).toLocaleString()}
                          </div>
                          <h3 className="font-serif text-lg font-medium text-[#1C1917]">
                            {item.instrument}
                          </h3>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="font-mono text-base font-semibold text-[#1E3A5F] tabular-nums">
                              {item.compositeScore}/100
                            </div>
                            <div
                              className={`text-xs font-medium ${
                                item.tier === 'Elevated Strain'
                                  ? 'text-[#9A3412]'
                                  : 'text-[#57534E]'
                              }`}
                            >
                              {item.tier}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onDeleteAssessment(item.id)}
                            aria-label="Delete assessment"
                            className="p-1 text-[#78716C] hover:text-[#9A3412]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-[#292524] leading-relaxed">{item.summaryNote}</p>
                      {item.reflectionNote && (
                        <p className="text-xs text-[#57534E] italic border-t border-[#1C1917]/10 pt-2">
                          “{item.reflectionNote}”
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 6. REPORTS */}
      {/* =================================================================== */}
      {section === 'reports' && (
        <div className="space-y-8">
          <div className="border border-[#1C1917]/12 rounded-lg bg-[#F4F0E8]/55 p-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="text-xs font-medium text-[#1E3A5F]">
                Longitudinal Synthesis · {activeUser.displayName}
              </div>
              <h2 className="font-serif text-xl font-medium text-[#1C1917]">
                Generate Non-Diagnostic HUMANOS Report
              </h2>
              <p className="text-xs text-[#57534E] max-w-2xl">
                Synthesizes across your Users profile, Sessions, Goals, Journals, Assessments, and Dynamic User Model into a structured, exportable brief.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <select
                value={reportKind}
                onChange={(e) => setReportKind(e.target.value as ReportKind)}
                className="px-3 py-2 text-xs font-medium rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] text-[#1C1917]"
              >
                {REPORT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleGenerateReport}
                disabled={isGeneratingReport}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49] disabled:opacity-50 whitespace-nowrap"
              >
                {isGeneratingReport ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Synthesizing Report...</span>
                  </>
                ) : (
                  <span>Generate Report</span>
                )}
              </button>
            </div>
          </div>

          {reports.length === 0 ? (
            <div className="border border-[#1C1917]/10 rounded-lg p-10 text-center space-y-2 bg-[#F4F0E8]/35">
              <div className="font-serif text-lg text-[#1C1917]">No HUMANOS Reports generated yet</div>
              <p className="text-sm text-[#57534E] max-w-lg mx-auto">
                Choose a report focus above and click Generate Report once you have at least one reflection session, goal, journal entry, or self-assessment.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {reports.map((report) => (
                <article
                  key={report.id}
                  className="border border-[#1C1917]/12 rounded-lg bg-[#FBF9F5] p-6 sm:p-8 space-y-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1C1917]/10 pb-4">
                    <div className="space-y-1">
                      <div className="text-xs text-[#78716C] font-mono tabular-nums">
                        <span className="font-sans font-medium text-[#1E3A5F]">{report.kind}</span>
                        <span className="mx-2" aria-hidden="true">·</span>
                        <span>{new Date(report.generatedAt).toLocaleString()}</span>
                      </div>
                      <h3 className="font-serif text-2xl font-medium text-[#1C1917]">
                        {report.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDownloadReportMarkdown(report)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#1C1917]/20 rounded-md hover:bg-[#EBE6DF] whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Markdown</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteReport(report.id)}
                        aria-label="Delete report"
                        className="p-1.5 text-[#78716C] hover:text-[#9A3412]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 max-w-3xl">
                    <div className="text-xs font-semibold text-[#1E3A5F]">Executive Summary</div>
                    <p className="text-sm text-[#1C1917] leading-relaxed">
                      {report.executiveSummary}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-[#1C1917]/10 pt-5">
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-[#1E3A5F]">
                        Key Probabilistic Patterns
                      </div>
                      <ul className="space-y-1.5 text-sm text-[#292524]">
                        {report.keyPatterns.map((p, idx) => (
                          <li key={idx} className="leading-relaxed">
                            · {p}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-[#1E3A5F]">
                        Recommended Next Steps
                      </div>
                      <ol className="space-y-1.5 text-sm text-[#292524]">
                        {report.recommendedNextSteps.map((step, idx) => (
                          <li key={idx} className="leading-relaxed">
                            <span className="font-mono text-xs text-[#1E3A5F] mr-1.5 tabular-nums">
                              0{idx + 1}.
                            </span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-[#1C1917]/10 pt-5 text-sm">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-[#1E3A5F]">
                        Wellbeing & Assessment Trajectory
                      </div>
                      <p className="text-[#57534E] leading-relaxed">{report.wellbeingTrajectory}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-[#1E3A5F]">
                        Goals & Values Alignment
                      </div>
                      <p className="text-[#57534E] leading-relaxed">
                        {report.goalsAndValuesAlignment}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-[#1C1917]/10 pt-4 text-xs text-[#78716C] italic">
                    {report.ethicalNote}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
