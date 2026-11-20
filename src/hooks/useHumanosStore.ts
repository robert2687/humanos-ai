import { useState, useEffect, useCallback } from 'react';
import {
  CognitiveDistortionReport,
  CrisisRiskCategory,
  DialogueMessage,
  DynamicUserModel,
  DynamicUserModelEntry,
  EventAnalysisRecord,
  ExplainMePortrait,
  GrowthAreaPlan,
  GrowthJournalEntry,
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
  WellbeingCheckIn,
} from '../types/humanos';

const STORAGE_KEY = 'humanos_platform_state_v1';

interface HumanosState {
  sessions: ReflectionSession[];
  activeSessionId: string;
  eventAnalyses: EventAnalysisRecord[];
  distortionReports: CognitiveDistortionReport[];
  hypotheses: PatternHypothesis[];
  wellbeingCheckIns: WellbeingCheckIn[];
  timelineEvents: LifeTimelineEvent[];
  journalEntries: GrowthJournalEntry[];
  growthPlans: GrowthAreaPlan[];
  relationships: RelationshipNode[];
  relationshipInsights: RelationshipAreaInsight[];
  explainMePortrait: ExplainMePortrait | null;
  personalityProfile: PersonalityAnalystProfile | null;
  dynamicUserModel: DynamicUserModel;
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

function getInitialState(): HumanosState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<HumanosState>;
      if (Array.isArray(parsed.sessions) && parsed.sessions.length > 0) {
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
          distortionReports: Array.isArray(parsed.distortionReports)
            ? parsed.distortionReports
            : [],
          hypotheses: Array.isArray(parsed.hypotheses)
            ? parsed.hypotheses.map((h) => ({
                ...h,
                dimension: migrateDimension(h.dimension),
              }))
            : [],
          wellbeingCheckIns: Array.isArray(parsed.wellbeingCheckIns)
            ? parsed.wellbeingCheckIns
            : [],
          timelineEvents: Array.isArray(parsed.timelineEvents) ? parsed.timelineEvents : [],
          journalEntries: Array.isArray(parsed.journalEntries) ? parsed.journalEntries : [],
          growthPlans: Array.isArray(parsed.growthPlans) ? parsed.growthPlans : [],
          relationships: Array.isArray(parsed.relationships)
            ? parsed.relationships.map((r) => ({
                ...r,
                area: inferRelationshipArea(r.role, r.area),
              }))
            : [],
          relationshipInsights: Array.isArray(parsed.relationshipInsights)
            ? parsed.relationshipInsights
            : [],
          explainMePortrait: parsed.explainMePortrait ?? null,
          personalityProfile: parsed.personalityProfile ?? null,
          dynamicUserModel:
            parsed.dynamicUserModel && Array.isArray(parsed.dynamicUserModel.entries)
              ? parsed.dynamicUserModel
              : { updatedAt: '', summaryNote: '', entries: [] },
        };
      }
    }
  } catch {
    // Fallback to clean initial state if localStorage is unavailable or malformed
  }

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
    relationships: [],
    relationshipInsights: [],
    explainMePortrait: null,
    personalityProfile: null,
    dynamicUserModel: { updatedAt: '', summaryNote: '', entries: [] },
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
  const [state, setState] = useState<HumanosState>(() => getInitialState());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors gracefully
    }
  }, [state]);

  const activeSession =
    state.sessions.find((s) => s.id === state.activeSessionId) || state.sessions[0];

  const startNewSession = useCallback((mode: ReflectionMode = 'insight', initialTitle = 'New Reflection') => {
    const next = createEmptySession(mode, initialTitle);
    setState((prev) => ({
      ...prev,
      sessions: [next, ...prev.sessions],
      activeSessionId: next.id,
    }));
    return next.id;
  }, []);

  const selectSession = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      activeSessionId: id,
    }));
  }, []);

  const deleteSession = useCallback((id: string) => {
    setState((prev) => {
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
  }, []);

  const setSessionMode = useCallback((sessionId: string, mode: ReflectionMode) => {
    setState((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) =>
        s.id === sessionId ? { ...s, mode, updatedAt: new Date().toISOString() } : s
      ),
    }));
  }, []);

  const appendMessages = useCallback(
    (sessionId: string, newMessages: DialogueMessage[], suggestedTitle?: string) => {
      setState((prev) => ({
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
    []
  );

  const addEventAnalysis = useCallback((record: Omit<EventAnalysisRecord, 'id' | 'createdAt'>) => {
    const fullRecord: EventAnalysisRecord = {
      ...record,
      id: createId('evt'),
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      eventAnalyses: [fullRecord, ...prev.eventAnalyses],
    }));
    return fullRecord;
  }, []);

  const deleteEventAnalysis = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      eventAnalyses: prev.eventAnalyses.filter((e) => e.id !== id),
    }));
  }, []);

  const addDistortionReport = useCallback(
    (report: Omit<CognitiveDistortionReport, 'id' | 'createdAt'>) => {
      const fullReport: CognitiveDistortionReport = {
        ...report,
        id: createId('cog'),
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        distortionReports: [fullReport, ...prev.distortionReports],
      }));
      return fullReport;
    },
    []
  );

  const deleteDistortionReport = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      distortionReports: prev.distortionReports.filter((r) => r.id !== id),
    }));
  }, []);

  const addHypothesis = useCallback(
    (input: {
      dimension: PatternDimension;
      statement: string;
      rationale: string;
      source: PatternHypothesis['source'];
      status?: HypothesisStatus;
    }) => {
      setState((prev) => {
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
    []
  );

  const updateHypothesis = useCallback(
    (id: string, patch: Partial<Pick<PatternHypothesis, 'status' | 'statement' | 'dimension' | 'rationale'>>) => {
      setState((prev) => ({
        ...prev,
        hypotheses: prev.hypotheses.map((h) =>
          h.id === id ? { ...h, ...patch, updatedAt: new Date().toISOString() } : h
        ),
      }));
    },
    []
  );

  const removeHypothesis = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      hypotheses: prev.hypotheses.filter((h) => h.id !== id),
    }));
  }, []);

  const addWellbeingCheckIn = useCallback((input: Omit<WellbeingCheckIn, 'id' | 'createdAt'>) => {
    const entry: WellbeingCheckIn = {
      ...input,
      id: createId('wb'),
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      wellbeingCheckIns: [entry, ...prev.wellbeingCheckIns],
    }));
    return entry;
  }, []);

  const deleteWellbeingCheckIn = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      wellbeingCheckIns: prev.wellbeingCheckIns.filter((w) => w.id !== id),
    }));
  }, []);

  const addTimelineEvent = useCallback((input: Omit<LifeTimelineEvent, 'id' | 'createdAt'>) => {
    const entry: LifeTimelineEvent = {
      ...input,
      id: createId('tl'),
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      timelineEvents: [entry, ...prev.timelineEvents],
    }));
    return entry;
  }, []);

  const deleteTimelineEvent = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      timelineEvents: prev.timelineEvents.filter((t) => t.id !== id),
    }));
  }, []);

  const addJournalEntry = useCallback((input: Omit<GrowthJournalEntry, 'id' | 'createdAt'>) => {
    const entry: GrowthJournalEntry = {
      ...input,
      id: createId('jrn'),
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      journalEntries: [entry, ...prev.journalEntries],
    }));
    return entry;
  }, []);

  const deleteJournalEntry = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      journalEntries: prev.journalEntries.filter((j) => j.id !== id),
    }));
  }, []);

  const addGrowthPlan = useCallback(
    (plan: Omit<GrowthAreaPlan, 'id' | 'createdAt'>) => {
      const entry: GrowthAreaPlan = {
        ...plan,
        id: createId('grw'),
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        growthPlans: [entry, ...prev.growthPlans],
      }));
      return entry;
    },
    []
  );

  const deleteGrowthPlan = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      growthPlans: prev.growthPlans.filter((g) => g.id !== id),
    }));
  }, []);

  const addRelationshipNode = useCallback(
    (input: Omit<RelationshipNode, 'id' | 'updatedAt'>) => {
      const node: RelationshipNode = {
        ...input,
        id: createId('rel'),
        updatedAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        relationships: [node, ...prev.relationships],
      }));
      return node;
    },
    []
  );

  const deleteRelationshipNode = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      relationships: prev.relationships.filter((r) => r.id !== id),
    }));
  }, []);

  const addRelationshipInsight = useCallback(
    (insight: Omit<RelationshipAreaInsight, 'id' | 'createdAt'>) => {
      const entry: RelationshipAreaInsight = {
        ...insight,
        id: createId('relins'),
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        relationshipInsights: [entry, ...prev.relationshipInsights],
      }));
      return entry;
    },
    []
  );

  const deleteRelationshipInsight = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      relationshipInsights: prev.relationshipInsights.filter((i) => i.id !== id),
    }));
  }, []);

  const setExplainMePortrait = useCallback((portrait: ExplainMePortrait | null) => {
    setState((prev) => ({
      ...prev,
      explainMePortrait: portrait,
    }));
  }, []);

  const setPersonalityProfile = useCallback((profile: PersonalityAnalystProfile | null) => {
    setState((prev) => ({
      ...prev,
      personalityProfile: profile,
    }));
  }, []);

  const setDynamicUserModel = useCallback(
    (model: { summaryNote: string; entries: DynamicUserModelEntry[]; updatedAt?: string }) => {
      setState((prev) => {
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
    []
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
      setState((prev) => {
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
    []
  );

  const updateUserModelEntry = useCallback(
    (
      id: string,
      patch: Partial<Pick<DynamicUserModelEntry, 'observation' | 'evidence' | 'confidence' | 'domain'>>
    ) => {
      setState((prev) => ({
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
    []
  );

  const removeUserModelEntry = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      dynamicUserModel: {
        ...prev.dynamicUserModel,
        updatedAt: new Date().toISOString(),
        entries: prev.dynamicUserModel.entries.filter((e) => e.id !== id),
      },
    }));
  }, []);

  const clearAllData = useCallback(() => {
    const fresh = createEmptySession('insight', 'Initial Reflection');
    const clean: HumanosState = {
      sessions: [fresh],
      activeSessionId: fresh.id,
      eventAnalyses: [],
      distortionReports: [],
      hypotheses: [],
      wellbeingCheckIns: [],
      timelineEvents: [],
      journalEntries: [],
      growthPlans: [],
      relationships: [],
      relationshipInsights: [],
      explainMePortrait: null,
      personalityProfile: null,
      dynamicUserModel: { updatedAt: '', summaryNote: '', entries: [] },
    };
    setState(clean);
  }, []);

  return {
    sessions: state.sessions,
    activeSession,
    eventAnalyses: state.eventAnalyses,
    distortionReports: state.distortionReports,
    hypotheses: state.hypotheses,
    wellbeingCheckIns: state.wellbeingCheckIns,
    timelineEvents: state.timelineEvents,
    journalEntries: state.journalEntries,
    growthPlans: state.growthPlans,
    relationships: state.relationships,
    relationshipInsights: state.relationshipInsights,
    explainMePortrait: state.explainMePortrait,
    personalityProfile: state.personalityProfile,
    dynamicUserModel: state.dynamicUserModel,
    startNewSession,
    selectSession,
    deleteSession,
    setSessionMode,
    appendMessages,
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
