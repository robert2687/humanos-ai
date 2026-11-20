import { useState, useEffect, useCallback } from 'react';
import {
  AssessmentRecord,
  CognitiveDistortionReport,
  CrisisRiskCategory,
  DialogueMessage,
  DynamicUserModel,
  DynamicUserModelEntry,
  EventAnalysisRecord,
  ExplainMePortrait,
  GoalHorizon,
  GoalMilestone,
  GoalRecord,
  GoalStatus,
  GrowthArea,
  GrowthAreaPlan,
  GrowthJournalEntry,
  HumanosReport,
  HypothesisStatus,
  LifeTimelineEvent,
  PatternDimension,
  PatternHypothesis,
  PersonalityAnalystProfile,
  ReflectionMode,
  ReflectionSession,
  RelationshipArea,
  RelationshipAreaInsight,
  RelationshipNode,
  UserModelConfidence,
  UserModelDomain,
  UserProfile,
  WellbeingCheckIn,
} from '../types/humanos';

const LEGACY_STORAGE_KEY = 'humanos_platform_state_v1';
const STORAGE_KEY = 'humanos_platform_state_v2';

export interface HumanosWorkspaceState {
  sessions: ReflectionSession[];
  activeSessionId: string;
  eventAnalyses: EventAnalysisRecord[];
  distortionReports: CognitiveDistortionReport[];
  hypotheses: PatternHypothesis[];
  wellbeingCheckIns: WellbeingCheckIn[];
  timelineEvents: LifeTimelineEvent[];
  journalEntries: GrowthJournalEntry[];
  growthPlans: GrowthAreaPlan[];
  goals: GoalRecord[];
  assessments: AssessmentRecord[];
  reports: HumanosReport[];
  relationships: RelationshipNode[];
  relationshipInsights: RelationshipAreaInsight[];
  explainMePortrait: ExplainMePortrait | null;
  personalityProfile: PersonalityAnalystProfile | null;
  dynamicUserModel: DynamicUserModel;
}

interface HumanosRootState {
  users: UserProfile[];
  activeUserId: string;
  workspaces: Record<string, HumanosWorkspaceState>;
}

function inferRelationshipArea(role?: string, area?: string): RelationshipArea {
  if (
    area === 'Romantic Relationships' ||
    area === 'Friendships' ||
    area === 'Family' ||
    area === 'Work Relationships'
  ) {
    return area;
  }
  switch (role) {
    case 'Partner':
      return 'Romantic Relationships';
    case 'Friend':
      return 'Friendships';
    case 'Family':
      return 'Family';
    default:
      return 'Work Relationships';
  }
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function createEmptySession(mode: ReflectionMode = 'insight', title = 'New Reflection'): ReflectionSession {
  return {
    id: createId('sess'),
    title,
    mode,
    updatedAt: new Date().toISOString(),
    messages: [],
  };
}

function migrateDimension(dim: string): PatternDimension {
  switch (dim) {
    case 'Values & Motivations':
    case 'Values':
      return 'Values';
    case 'Strengths & Resilience':
    case 'Strengths':
      return 'Strengths';
    case 'Triggers & Sensitivities':
    case 'Triggers':
      return 'Triggers';
    case 'Recurring Patterns':
    case 'Challenges':
      return 'Challenges';
    case 'Communication & Relational Style':
    case 'Relational & Communication':
      return 'Relational & Communication';
    default:
      return 'Challenges';
  }
}

function createDefaultUserProfile(displayName = 'Primary Reflection Profile'): UserProfile {
  const now = new Date().toISOString();
  return {
    id: createId('usr'),
    displayName,
    email: '',
    focusIntention: 'Self-understanding, emotional steadiness, and values-aligned living',
    primaryAreas: ['Resilience', 'Purpose'],
    createdAt: now,
    updatedAt: now,
  };
}

function createEmptyWorkspace(): HumanosWorkspaceState {
  const firstSession = createEmptySession('insight', 'Initial Reflection');
  return {
    sessions: [firstSession],
    activeSessionId: firstSession.id,
    eventAnalyses: [],
    distortionReports: [],
    hypotheses: [],
    wellbeingCheckIns: [],
    timelineEvents: [],
    journalEntries: [],
    growthPlans: [],
    goals: [],
    assessments: [],
    reports: [],
    relationships: [],
    relationshipInsights: [],
    explainMePortrait: null,
    personalityProfile: null,
    dynamicUserModel: { updatedAt: '', summaryNote: '', entries: [] },
  };
}

function normalizeWorkspace(parsed: Partial<HumanosWorkspaceState> | undefined): HumanosWorkspaceState {
  if (!parsed || !Array.isArray(parsed.sessions) || parsed.sessions.length === 0) {
    return createEmptyWorkspace();
  }
  return {
    sessions: parsed.sessions,
    activeSessionId: parsed.activeSessionId || parsed.sessions[0].id,
    eventAnalyses: Array.isArray(parsed.eventAnalyses)
      ? parsed.eventAnalyses.map((e) => ({
          ...e,
          lens: e.lens || 'conflict-emotion',
          requests: Array.isArray(e.requests) ? e.requests : [],
          behavioralLoop: e.behavioralLoop
            ? {
                ...e.behavioralLoop,
                outcome: e.behavioralLoop.outcome || e.behavioralLoop.consequence || '',
              }
            : e.behavioralLoop,
        }))
      : [],
    distortionReports: Array.isArray(parsed.distortionReports) ? parsed.distortionReports : [],
    hypotheses: Array.isArray(parsed.hypotheses)
      ? parsed.hypotheses.map((h) => ({
          ...h,
          dimension: migrateDimension(h.dimension),
        }))
      : [],
    wellbeingCheckIns: Array.isArray(parsed.wellbeingCheckIns) ? parsed.wellbeingCheckIns : [],
    timelineEvents: Array.isArray(parsed.timelineEvents) ? parsed.timelineEvents : [],
    journalEntries: Array.isArray(parsed.journalEntries) ? parsed.journalEntries : [],
    growthPlans: Array.isArray(parsed.growthPlans) ? parsed.growthPlans : [],
    goals: Array.isArray(parsed.goals) ? parsed.goals : [],
    assessments: Array.isArray(parsed.assessments) ? parsed.assessments : [],
    reports: Array.isArray(parsed.reports) ? parsed.reports : [],
    relationships: Array.isArray(parsed.relationships)
      ? parsed.relationships.map((r) => ({
          ...r,
          area: inferRelationshipArea(r.role, r.area),
        }))
      : [],
    relationshipInsights: Array.isArray(parsed.relationshipInsights) ? parsed.relationshipInsights : [],
    explainMePortrait: parsed.explainMePortrait ?? null,
    personalityProfile: parsed.personalityProfile ?? null,
    dynamicUserModel:
      parsed.dynamicUserModel && Array.isArray(parsed.dynamicUserModel.entries)
        ? parsed.dynamicUserModel
        : { updatedAt: '', summaryNote: '', entries: [] },
  };
}

function getInitialRootState(): HumanosRootState {
  try {
    const rawV2 = localStorage.getItem(STORAGE_KEY);
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as Partial<HumanosRootState>;
      if (Array.isArray(parsed.users) && parsed.users.length > 0 && parsed.workspaces) {
        const activeUserId =
          parsed.activeUserId && parsed.users.some((u) => u.id === parsed.activeUserId)
            ? parsed.activeUserId
            : parsed.users[0].id;
        const normalizedWorkspaces: Record<string, HumanosWorkspaceState> = {};
        for (const u of parsed.users) {
          normalizedWorkspaces[u.id] = normalizeWorkspace(parsed.workspaces[u.id]);
        }
        return {
          users: parsed.users,
          activeUserId,
          workspaces: normalizedWorkspaces,
        };
      }
    }

    // Seamless migration from v1 single-user storage
    const rawLegacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (rawLegacy) {
      const parsedLegacy = JSON.parse(rawLegacy) as Partial<HumanosWorkspaceState>;
      const defaultUser = createDefaultUserProfile();
      return {
        users: [defaultUser],
        activeUserId: defaultUser.id,
        workspaces: {
          [defaultUser.id]: normalizeWorkspace(parsedLegacy),
        },
      };
    }
  } catch {
    // Fallback cleanly if localStorage is unavailable or malformed
  }

  const defaultUser = createDefaultUserProfile();
  return {
    users: [defaultUser],
    activeUserId: defaultUser.id,
    workspaces: {
      [defaultUser.id]: createEmptyWorkspace(),
    },
  };
}

export function detectClientCrisisCategories(text: string): CrisisRiskCategory[] {
  const normalized = text.toLowerCase();
  const matchers: ReadonlyArray<{
    category: CrisisRiskCategory;
    patterns: RegExp[];
  }> = [
    {
      category: 'self-harm risk',
      patterns: [
        /\b(self[- ]?harm|hurt myself|hurting myself|cut myself|cutting myself|burn myself|harm myself|self[- ]injury)\b/,
      ],
    },
    {
      category: 'suicide indicators',
      patterns: [
        /\b(suicide|suicidal|kill myself|end my life|want to die|wish i was dead|wish i were dead|better off dead|end it all|no reason to live|(don'?t|do not) want to live|take my own life)\b/,
      ],
    },
    {
      category: 'severe depression',
      patterns: [
        /\b(severely depressed|severe depression|deep despair|completely hopeless|nothing matters anymore|(can'?t|cannot) get out of bed|empty for weeks|completely numb|worthless and hopeless|hopeless and want out)\b/,
      ],
    },
    {
      category: 'panic attacks',
      patterns: [
        /\b(panic attack|panicking|(can'?t|cannot) breathe|hyperventilat\w*|heart is racing|chest is tight|feel like i'?m dying|losing control right now|terrified and shaking)\b/,
      ],
    },
    {
      category: 'emotional collapse',
      patterns: [
        /\b(emotional collapse|falling apart|breaking down|broke down completely|(can'?t|cannot) hold it together|completely shattered|shutting down completely|(can'?t|cannot) function anymore|(can'?t|cannot) go on|(can'?t|cannot) cope anymore)\b/,
      ],
    },
  ];
  return matchers
    .filter((entry) => entry.patterns.some((rx) => rx.test(normalized)))
    .map((entry) => entry.category);
}

export function detectClientCrisisSignals(text: string): boolean {
  return detectClientCrisisCategories(text).length > 0;
}

export function useHumanosStore() {
  const [root, setRoot] = useState<HumanosRootState>(() => getInitialRootState());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
    } catch {
      // Ignore storage quota errors gracefully
    }
  }, [root]);

  const activeUser =
    root.users.find((u) => u.id === root.activeUserId) || root.users[0];
  const state: HumanosWorkspaceState =
    root.workspaces[activeUser.id] || createEmptyWorkspace();

  const updateActiveWorkspace = useCallback(
    (updater: (prev: HumanosWorkspaceState) => HumanosWorkspaceState) => {
      setRoot((prevRoot) => {
        const uid = prevRoot.activeUserId;
        const currentWs = prevRoot.workspaces[uid] || createEmptyWorkspace();
        return {
          ...prevRoot,
          workspaces: {
            ...prevRoot.workspaces,
            [uid]: updater(currentWs),
          },
        };
      });
    },
    []
  );

  // =========================================================================
  // USERS CRUD
  // =========================================================================

  const createUserProfile = useCallback(
    (input: {
      displayName: string;
      email?: string;
      focusIntention?: string;
      primaryAreas?: GrowthArea[];
    }) => {
      const now = new Date().toISOString();
      const user: UserProfile = {
        id: createId('usr'),
        displayName: input.displayName.trim() || 'New User',
        email: (input.email || '').trim(),
        focusIntention:
          (input.focusIntention || '').trim() ||
          'Reflective clarity, emotional steadiness, and personal growth',
        primaryAreas:
          input.primaryAreas && input.primaryAreas.length > 0
            ? input.primaryAreas
            : ['Resilience', 'Purpose'],
        createdAt: now,
        updatedAt: now,
      };
      setRoot((prev) => ({
        users: [...prev.users, user],
        activeUserId: user.id,
        workspaces: {
          ...prev.workspaces,
          [user.id]: createEmptyWorkspace(),
        },
      }));
      return user;
    },
    []
  );

  const selectUserProfile = useCallback((userId: string) => {
    setRoot((prev) => {
      if (!prev.users.some((u) => u.id === userId)) return prev;
      return {
        ...prev,
        activeUserId: userId,
        workspaces: prev.workspaces[userId]
          ? prev.workspaces
          : { ...prev.workspaces, [userId]: createEmptyWorkspace() },
      };
    });
  }, []);

  const updateUserProfile = useCallback(
    (
      userId: string,
      patch: Partial<Pick<UserProfile, 'displayName' | 'email' | 'focusIntention' | 'primaryAreas'>>
    ) => {
      setRoot((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          u.id === userId
            ? {
                ...u,
                ...patch,
                displayName:
                  patch.displayName !== undefined
                    ? patch.displayName.trim() || u.displayName
                    : u.displayName,
                updatedAt: new Date().toISOString(),
              }
            : u
        ),
      }));
    },
    []
  );

  const deleteUserProfile = useCallback((userId: string) => {
    setRoot((prev) => {
      if (prev.users.length <= 1) return prev;
      const remaining = prev.users.filter((u) => u.id !== userId);
      const nextWorkspaces = { ...prev.workspaces };
      delete nextWorkspaces[userId];
      return {
        users: remaining,
        activeUserId: prev.activeUserId === userId ? remaining[0].id : prev.activeUserId,
        workspaces: nextWorkspaces,
      };
    });
  }, []);

  // =========================================================================
  // SESSIONS
  // =========================================================================

  const activeSession =
    state.sessions.find((s) => s.id === state.activeSessionId) || state.sessions[0];

  const startNewSession = useCallback(
    (mode: ReflectionMode = 'insight', initialTitle = 'New Reflection') => {
      const next = createEmptySession(mode, initialTitle);
      updateActiveWorkspace((prev) => ({
        ...prev,
        sessions: [next, ...prev.sessions],
        activeSessionId: next.id,
      }));
      return next.id;
    },
    [updateActiveWorkspace]
  );

  const selectSession = useCallback(
    (id: string) => {
      updateActiveWorkspace((prev) => ({
        ...prev,
        activeSessionId: id,
      }));
    },
    [updateActiveWorkspace]
  );

  const renameSession = useCallback(
    (id: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      updateActiveWorkspace((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) =>
          s.id === id ? { ...s, title: trimmed.slice(0, 80), updatedAt: new Date().toISOString() } : s
        ),
      }));
    },
    [updateActiveWorkspace]
  );

  const deleteSession = useCallback(
    (id: string) => {
      updateActiveWorkspace((prev) => {
        const remaining = prev.sessions.filter((s) => s.id !== id);
        if (remaining.length === 0) {
          const fresh = createEmptySession('insight', 'New Reflection');
          return {
            ...prev,
            sessions: [fresh],
            activeSessionId: fresh.id,
          };
        }
        return {
          ...prev,
          sessions: remaining,
          activeSessionId: prev.activeSessionId === id ? remaining[0].id : prev.activeSessionId,
        };
      });
    },
    [updateActiveWorkspace]
  );

  const setSessionMode = useCallback(
    (sessionId: string, mode: ReflectionMode) => {
      updateActiveWorkspace((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) =>
          s.id === sessionId ? { ...s, mode, updatedAt: new Date().toISOString() } : s
        ),
      }));
    },
    [updateActiveWorkspace]
  );

  const appendMessages = useCallback(
    (sessionId: string, newMessages: DialogueMessage[], suggestedTitle?: string) => {
      updateActiveWorkspace((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) => {
          if (s.id !== sessionId) return s;
          const updatedTitle =
            s.messages.length === 0 && suggestedTitle
              ? suggestedTitle.slice(0, 56)
              : s.title;
          return {
            ...s,
            title: updatedTitle,
            updatedAt: new Date().toISOString(),
            messages: [...s.messages, ...newMessages],
          };
        }),
      }));
    },
    [updateActiveWorkspace]
  );

  // =========================================================================
  // GOALS CRUD
  // =========================================================================

  const addGoal = useCallback(
    (input: {
      title: string;
      area: GrowthArea;
      horizon: GoalHorizon;
      valuesAnchor: string;
      nextStep: string;
      milestoneLabels?: string[];
    }) => {
      const now = new Date().toISOString();
      const milestones: GoalMilestone[] = (input.milestoneLabels || [])
        .map((label) => label.trim())
        .filter(Boolean)
        .map((label, idx) => ({
          id: `${createId('ms')}_${idx}`,
          label,
          done: false,
        }));
      const goal: GoalRecord = {
        id: createId('goal'),
        title: input.title.trim(),
        area: input.area,
        horizon: input.horizon,
        status: 'active',
        valuesAnchor: input.valuesAnchor.trim(),
        nextStep: input.nextStep.trim(),
        progress: 0,
        milestones,
        createdAt: now,
        updatedAt: now,
      };
      updateActiveWorkspace((prev) => ({
        ...prev,
        goals: [goal, ...prev.goals],
      }));
      return goal;
    },
    [updateActiveWorkspace]
  );

  const updateGoal = useCallback(
    (
      id: string,
      patch: Partial<
        Pick<GoalRecord, 'title' | 'area' | 'horizon' | 'status' | 'valuesAnchor' | 'nextStep' | 'progress'>
      >
    ) => {
      updateActiveWorkspace((prev) => ({
        ...prev,
        goals: prev.goals.map((g) => {
          if (g.id !== id) return g;
          const nextProgress =
            patch.status === 'completed'
              ? 100
              : patch.progress !== undefined
                ? Math.min(100, Math.max(0, Math.round(patch.progress)))
                : g.progress;
          return {
            ...g,
            ...patch,
            progress: nextProgress,
            updatedAt: new Date().toISOString(),
          };
        }),
      }));
    },
    [updateActiveWorkspace]
  );

  const toggleGoalMilestone = useCallback(
    (goalId: string, milestoneId: string) => {
      updateActiveWorkspace((prev) => ({
        ...prev,
        goals: prev.goals.map((g) => {
          if (g.id !== goalId) return g;
          const updatedMilestones = g.milestones.map((m) =>
            m.id === milestoneId ? { ...m, done: !m.done } : m
          );
          const completedCount = updatedMilestones.filter((m) => m.done).length;
          const derivedProgress =
            updatedMilestones.length > 0
              ? Math.round((completedCount / updatedMilestones.length) * 100)
              : g.progress;
          const nextStatus: GoalStatus =
            updatedMilestones.length > 0 && completedCount === updatedMilestones.length
              ? 'completed'
              : g.status === 'completed' && completedCount < updatedMilestones.length
                ? 'active'
                : g.status;
          return {
            ...g,
            milestones: updatedMilestones,
            progress: derivedProgress,
            status: nextStatus,
            updatedAt: new Date().toISOString(),
          };
        }),
      }));
    },
    [updateActiveWorkspace]
  );

  const deleteGoal = useCallback(
    (id: string) => {
      updateActiveWorkspace((prev) => ({
        ...prev,
        goals: prev.goals.filter((g) => g.id !== id),
      }));
    },
    [updateActiveWorkspace]
  );

  // =========================================================================
  // ASSESSMENTS & REPORTS CRUD
  // =========================================================================

  const addAssessment = useCallback(
    (input: Omit<AssessmentRecord, 'id' | 'createdAt'>) => {
      const record: AssessmentRecord = {
        ...input,
        id: createId('asm'),
        createdAt: new Date().toISOString(),
      };
      updateActiveWorkspace((prev) => ({
        ...prev,
        assessments: [record, ...prev.assessments],
      }));
      return record;
    },
    [updateActiveWorkspace]
  );

  const deleteAssessment = useCallback(
    (id: string) => {
      updateActiveWorkspace((prev) => ({
        ...prev,
        assessments: prev.assessments.filter((a) => a.id !== id),
      }));
    },
    [updateActiveWorkspace]
  );

  const addReport = useCallback(
    (report: HumanosReport) => {
      updateActiveWorkspace((prev) => ({
        ...prev,
        reports: [report, ...prev.reports],
      }));
      return report;
    },
    [updateActiveWorkspace]
  );

  const deleteReport = useCallback(
    (id: string) => {
      updateActiveWorkspace((prev) => ({
        ...prev,
        reports: prev.reports.filter((r) => r.id !== id),
      }));
    },
    [updateActiveWorkspace]
  );

  // =========================================================================
  // EXISTING WORKSPACE ACTIONS (Events, Distortions, Hypotheses, Wellbeing, Timeline, Journals, Growth, Relationships, User Model)
  // =========================================================================

  const addEventAnalysis = useCallback(
    (record: Omit<EventAnalysisRecord, 'id' | 'createdAt'>) => {
      const fullRecord: EventAnalysisRecord = {
        ...record,
        id: createId('evt'),
        createdAt: new Date().toISOString(),
      };
      updateActiveWorkspace((prev) => ({
        ...prev,
        eventAnalyses: [fullRecord, ...prev.eventAnalyses],
      }));
      return fullRecord;
    },
    [updateActiveWorkspace]
  );

  const deleteEventAnalysis = useCallback(
    (id: string) => {
      updateActiveWorkspace((prev) => ({
        ...prev,
        eventAnalyses: prev.eventAnalyses.filter((e) => e.id !== id),
      }));
    },
    [updateActiveWorkspace]
  );

  const addDistortionReport = useCallback(
    (report: Omit<CognitiveDistortionReport, 'id' | 'createdAt'>) => {
      const fullReport: CognitiveDistortionReport = {
        ...report,
        id: createId('cog'),
        createdAt: new Date().toISOString(),
      };
      updateActiveWorkspace((prev) => ({
        ...prev,
        distortionReports: [fullReport, ...prev.distortionReports],
      }));
      return fullReport;
    },
    [updateActiveWorkspace]
  );

  const deleteDistortionReport = useCallback(
    (id: string) => {
      updateActiveWorkspace((prev) => ({
        ...prev,
        distortionReports: prev.distortionReports.filter((r) => r.id !== id),
      }));
    },
    [updateActiveWorkspace]
  );

  const addHypothesis = useCallback(
    (input: {
      dimension: PatternDimension;
      statement: string;
      rationale: string;
      source: PatternHypothesis['source'];
      status?: HypothesisStatus;
    }) => {
      updateActiveWorkspace((prev) => {
        const normalized = input.statement.trim().toLowerCase();
        const existing = prev.hypotheses.find(
          (h) => h.statement.trim().toLowerCase() === normalized
        );
        if (existing) {
          return {
            ...prev,
            hypotheses: prev.hypotheses.map((h) =>
              h.id === existing.id
                ? {
                    ...h,
                    evidenceCount: h.evidenceCount + 1,
                    updatedAt: new Date().toISOString(),
                  }
                : h
            ),
          };
        }
        const newEntry: PatternHypothesis = {
          id: createId('pat'),
          dimension: migrateDimension(input.dimension),
          statement: input.statement.trim(),
          rationale: input.rationale.trim(),
          status: input.status || 'hypothesis',
          evidenceCount: 1,
          updatedAt: new Date().toISOString(),
          source: input.source,
        };
        return {
          ...prev,
          hypotheses: [newEntry, ...prev.hypotheses],
        };
      });
    },
    [updateActiveWorkspace]
  );

  const updateHypothesis = useCallback(
    (id: string, patch: Partial<Pick<PatternHypothesis, 'status' | 'statement' | 'dimension' | 'rationale'>>) => {
      updateActiveWorkspace((prev) => ({
        ...prev,
        hypotheses: prev.hypotheses.map((h) =>
          h.id === id ? { ...h, ...patch, updatedAt: new Date().toISOString() } : h
        ),
      }));
    },
    [updateActiveWorkspace]
  );

  const removeHypothesis = useCallback(
    (id: string) => {
      updateActiveWorkspace((prev) => ({
        ...prev,
        hypotheses: prev.hypotheses.filter((h) => h.id !== id),
      }));
    },
    [updateActiveWorkspace]
  );

  const addWellbeingCheckIn = useCallback(
    (input: Omit<WellbeingCheckIn, 'id' | 'createdAt'>) => {
      const entry: WellbeingCheckIn = {
        ...input,
        id: createId('wb'),
        createdAt: new Date().toISOString(),
      };
      updateActiveWorkspace((prev) => ({
        ...prev,
        wellbeingCheckIns: [entry, ...prev.wellbeingCheckIns],
      }));
      return entry;
    },
    [updateActiveWorkspace]
  );

  const deleteWellbeingCheckIn = useCallback(
    (id: string) => {
      updateActiveWorkspace((prev) => ({
        ...prev,
        wellbeingCheckIns: prev.wellbeingCheckIns.filter((w) => w.id !== id),
      }));
    },
    [updateActiveWorkspace]
  );

  const addTimelineEvent = useCallback(
    (input: Omit<LifeTimelineEvent, 'id' | 'createdAt'>) => {
      const entry: LifeTimelineEvent = {
        ...input,
        id: createId('tl'),
        createdAt: new Date().toISOString(),
      };
      updateActiveWorkspace((prev) => ({
        ...prev,
        timelineEvents: [entry, ...prev.timelineEvents],
      }));
      return entry;
    },
    [updateActiveWorkspace]
  );

  const deleteTimelineEvent = useCallback(
    (id: string) => {
      updateActiveWorkspace((prev) => ({
        ...prev,
        timelineEvents: prev.timelineEvents.filter((t) => t.id !== id),
      }));
    },
    [updateActiveWorkspace]
  );

  const addJournalEntry = useCallback(
    (input: Omit<GrowthJournalEntry, 'id' | 'createdAt'>) => {
      const entry: GrowthJournalEntry = {
        ...input,
        id: createId('jrn'),
        createdAt: new Date().toISOString(),
      };
      updateActiveWorkspace((prev) => ({
        ...prev,
        journalEntries: [entry, ...prev.journalEntries],
      }));
      return entry;
    },
    [updateActiveWorkspace]
  );

  const deleteJournalEntry = useCallback(
    (id: string) => {
      updateActiveWorkspace((prev) => ({
        ...prev,
        journalEntries: prev.journalEntries.filter((j) => j.id !== id),
      }));
    },
    [updateActiveWorkspace]
  );

  const addGrowthPlan = useCallback(
    (plan: Omit<GrowthAreaPlan, 'id' | 'createdAt'>) => {
      const entry: GrowthAreaPlan = {
        ...plan,
        id: createId('grw'),
        createdAt: new Date().toISOString(),
      };
      updateActiveWorkspace((prev) => ({
        ...prev,
        growthPlans: [entry, ...prev.growthPlans],
      }));
      return entry;
    },
    [updateActiveWorkspace]
  );

  const deleteGrowthPlan = useCallback(
    (id: string) => {
      updateActiveWorkspace((prev) => ({
        ...prev,
        growthPlans: prev.growthPlans.filter((g) => g.id !== id),
      }));
    },
    [updateActiveWorkspace]
  );

  const addRelationshipNode = useCallback(
    (input: Omit<RelationshipNode, 'id' | 'updatedAt'>) => {
      const node: RelationshipNode = {
        ...input,
        id: createId('rel'),
        updatedAt: new Date().toISOString(),
      };
      updateActiveWorkspace((prev) => ({
        ...prev,
        relationships: [node, ...prev.relationships],
      }));
      return node;
    },
    [updateActiveWorkspace]
  );

  const deleteRelationshipNode = useCallback(
    (id: string) => {
      updateActiveWorkspace((prev) => ({
        ...prev,
        relationships: prev.relationships.filter((r) => r.id !== id),
      }));
    },
    [updateActiveWorkspace]
  );

  const addRelationshipInsight = useCallback(
    (insight: Omit<RelationshipAreaInsight, 'id' | 'createdAt'>) => {
      const entry: RelationshipAreaInsight = {
        ...insight,
        id: createId('relins'),
        createdAt: new Date().toISOString(),
      };
      updateActiveWorkspace((prev) => ({
        ...prev,
        relationshipInsights: [entry, ...prev.relationshipInsights],
      }));
      return entry;
    },
    [updateActiveWorkspace]
  );

  const deleteRelationshipInsight = useCallback(
    (id: string) => {
      updateActiveWorkspace((prev) => ({
        ...prev,
        relationshipInsights: prev.relationshipInsights.filter((i) => i.id !== id),
      }));
    },
    [updateActiveWorkspace]
  );

  const setExplainMePortrait = useCallback(
    (portrait: ExplainMePortrait | null) => {
      updateActiveWorkspace((prev) => ({
        ...prev,
        explainMePortrait: portrait,
      }));
    },
    [updateActiveWorkspace]
  );

  const setPersonalityProfile = useCallback(
    (profile: PersonalityAnalystProfile | null) => {
      updateActiveWorkspace((prev) => ({
        ...prev,
        personalityProfile: profile,
      }));
    },
    [updateActiveWorkspace]
  );

  const setDynamicUserModel = useCallback(
    (model: { summaryNote: string; entries: DynamicUserModelEntry[]; updatedAt?: string }) => {
      updateActiveWorkspace((prev) => {
        const preservedUserEntries = prev.dynamicUserModel.entries.filter(
          (e) => e.source === 'user' || e.confidence === 'confirmed'
        );
        const existingNormalized = new Set(
          preservedUserEntries.map((e) => `${e.domain}:${e.observation.trim().toLowerCase()}`)
        );
        const mergedNew = model.entries.filter(
          (e) => !existingNormalized.has(`${e.domain}:${e.observation.trim().toLowerCase()}`)
        );
        return {
          ...prev,
          dynamicUserModel: {
            updatedAt: model.updatedAt || new Date().toISOString(),
            summaryNote: model.summaryNote,
            entries: [...preservedUserEntries, ...mergedNew],
          },
        };
      });
    },
    [updateActiveWorkspace]
  );

  const upsertUserModelEntry = useCallback(
    (input: {
      domain: UserModelDomain;
      observation: string;
      evidence: string;
      confidence?: UserModelConfidence;
      source?: DynamicUserModelEntry['source'];
    }) => {
      const normalized = input.observation.trim().toLowerCase();
      if (!normalized) return;
      updateActiveWorkspace((prev) => {
        const existing = prev.dynamicUserModel.entries.find(
          (e) =>
            e.domain === input.domain &&
            e.observation.trim().toLowerCase() === normalized
        );
        const now = new Date().toISOString();
        if (existing) {
          return {
            ...prev,
            dynamicUserModel: {
              ...prev.dynamicUserModel,
              updatedAt: now,
              entries: prev.dynamicUserModel.entries.map((e) =>
                e.id === existing.id
                  ? {
                      ...e,
                      confidence:
                        input.confidence ||
                        (e.confidence === 'emerging' ? 'recurring' : e.confidence),
                      evidence: input.evidence || e.evidence,
                      updatedAt: now,
                    }
                  : e
              ),
            },
          };
        }
        const entry: DynamicUserModelEntry = {
          id: createId('um'),
          domain: input.domain,
          observation: input.observation.trim(),
          evidence: input.evidence.trim(),
          confidence: input.confidence || 'emerging',
          source: input.source || 'user',
          updatedAt: now,
        };
        return {
          ...prev,
          dynamicUserModel: {
            ...prev.dynamicUserModel,
            updatedAt: now,
            entries: [entry, ...prev.dynamicUserModel.entries],
          },
        };
      });
    },
    [updateActiveWorkspace]
  );

  const updateUserModelEntry = useCallback(
    (
      id: string,
      patch: Partial<Pick<DynamicUserModelEntry, 'observation' | 'evidence' | 'confidence' | 'domain'>>
    ) => {
      updateActiveWorkspace((prev) => ({
        ...prev,
        dynamicUserModel: {
          ...prev.dynamicUserModel,
          updatedAt: new Date().toISOString(),
          entries: prev.dynamicUserModel.entries.map((e) =>
            e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e
          ),
        },
      }));
    },
    [updateActiveWorkspace]
  );

  const removeUserModelEntry = useCallback(
    (id: string) => {
      updateActiveWorkspace((prev) => ({
        ...prev,
        dynamicUserModel: {
          ...prev.dynamicUserModel,
          updatedAt: new Date().toISOString(),
          entries: prev.dynamicUserModel.entries.filter((e) => e.id !== id),
        },
      }));
    },
    [updateActiveWorkspace]
  );

  const clearAllData = useCallback(() => {
    updateActiveWorkspace(() => createEmptyWorkspace());
  }, [updateActiveWorkspace]);

  return {
    users: root.users,
    activeUser,
    sessions: state.sessions,
    activeSession,
    eventAnalyses: state.eventAnalyses,
    distortionReports: state.distortionReports,
    hypotheses: state.hypotheses,
    wellbeingCheckIns: state.wellbeingCheckIns,
    timelineEvents: state.timelineEvents,
    journalEntries: state.journalEntries,
    growthPlans: state.growthPlans,
    goals: state.goals,
    assessments: state.assessments,
    reports: state.reports,
    relationships: state.relationships,
    relationshipInsights: state.relationshipInsights,
    explainMePortrait: state.explainMePortrait,
    personalityProfile: state.personalityProfile,
    dynamicUserModel: state.dynamicUserModel,
    createUserProfile,
    selectUserProfile,
    updateUserProfile,
    deleteUserProfile,
    startNewSession,
    selectSession,
    renameSession,
    deleteSession,
    setSessionMode,
    appendMessages,
    addGoal,
    updateGoal,
    toggleGoalMilestone,
    deleteGoal,
    addAssessment,
    deleteAssessment,
    addReport,
    deleteReport,
    addEventAnalysis,
    deleteEventAnalysis,
    addDistortionReport,
    deleteDistortionReport,
    addHypothesis,
    updateHypothesis,
    removeHypothesis,
    addWellbeingCheckIn,
    deleteWellbeingCheckIn,
    addTimelineEvent,
    deleteTimelineEvent,
    addJournalEntry,
    deleteJournalEntry,
    addGrowthPlan,
    deleteGrowthPlan,
    addRelationshipNode,
    deleteRelationshipNode,
    addRelationshipInsight,
    deleteRelationshipInsight,
    setExplainMePortrait,
    setPersonalityProfile,
    setDynamicUserModel,
    upsertUserModelEntry,
    updateUserModelEntry,
    removeUserModelEntry,
    clearAllData,
  };
}
