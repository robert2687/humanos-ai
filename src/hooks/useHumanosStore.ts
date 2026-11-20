import { useState, useEffect, useCallback } from 'react';
import {
  DialogueMessage,
  EventAnalysisRecord,
  ExplainMePortrait,
  GrowthJournalEntry,
  HypothesisStatus,
  LifeTimelineEvent,
  PatternDimension,
  PatternHypothesis,
  ReflectionMode,
  ReflectionSession,
  RelationshipNode,
  WellbeingCheckIn,
} from '../types/humanos';

const STORAGE_KEY = 'humanos_platform_state_v1';

interface HumanosState {
  sessions: ReflectionSession[];
  activeSessionId: string;
  eventAnalyses: EventAnalysisRecord[];
  hypotheses: PatternHypothesis[];
  wellbeingCheckIns: WellbeingCheckIn[];
  timelineEvents: LifeTimelineEvent[];
  journalEntries: GrowthJournalEntry[];
  relationships: RelationshipNode[];
  explainMePortrait: ExplainMePortrait | null;
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
              }))
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
          relationships: Array.isArray(parsed.relationships) ? parsed.relationships : [],
          explainMePortrait: parsed.explainMePortrait ?? null,
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
    hypotheses: [],
    wellbeingCheckIns: [],
    timelineEvents: [],
    journalEntries: [],
    relationships: [],
    explainMePortrait: null,
  };
}

export function detectClientCrisisSignals(text: string): boolean {
  const normalized = text.toLowerCase();
  const patterns = [
    /\b(kill myself|end my life|want to die|wish i was dead|better off dead)\b/,
    /\b(suicide|suicidal|self[- ]harm|hurt myself|cut myself|end it all)\b/,
    /\b(no reason to live|can'?t go on|hopeless and want out)\b/,
  ];
  return patterns.some((rx) => rx.test(normalized));
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

  const setExplainMePortrait = useCallback((portrait: ExplainMePortrait | null) => {
    setState((prev) => ({
      ...prev,
      explainMePortrait: portrait,
    }));
  }, []);

  const clearAllData = useCallback(() => {
    const fresh = createEmptySession('insight', 'Initial Reflection');
    const clean: HumanosState = {
      sessions: [fresh],
      activeSessionId: fresh.id,
      eventAnalyses: [],
      hypotheses: [],
      wellbeingCheckIns: [],
      timelineEvents: [],
      journalEntries: [],
      relationships: [],
      explainMePortrait: null,
    };
    setState(clean);
  }, []);

  return {
    sessions: state.sessions,
    activeSession,
    eventAnalyses: state.eventAnalyses,
    hypotheses: state.hypotheses,
    wellbeingCheckIns: state.wellbeingCheckIns,
    timelineEvents: state.timelineEvents,
    journalEntries: state.journalEntries,
    relationships: state.relationships,
    explainMePortrait: state.explainMePortrait,
    startNewSession,
    selectSession,
    deleteSession,
    setSessionMode,
    appendMessages,
    addEventAnalysis,
    deleteEventAnalysis,
    addHypothesis,
    updateHypothesis,
    removeHypothesis,
    addWellbeingCheckIn,
    deleteWellbeingCheckIn,
    addTimelineEvent,
    deleteTimelineEvent,
    addJournalEntry,
    deleteJournalEntry,
    addRelationshipNode,
    deleteRelationshipNode,
    setExplainMePortrait,
    clearAllData,
  };
}
