import { useState, useRef, useEffect } from 'react';
import {
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  DialogueMessage,
  EmergingHypothesis,
  EventAnalysisRecord,
  PatternDimension,
  PatternHypothesis,
  ReflectionMode,
  ReflectionSession,
  WellbeingCheckIn,
} from '../types/humanos';
import { detectClientCrisisSignals } from '../hooks/useHumanosStore';
import { CrisisBanner } from './CrisisSupportView';

interface DialogueViewProps {
  sessions: ReflectionSession[];
  activeSession: ReflectionSession;
  hypotheses: PatternHypothesis[];
  wellbeingCheckIns: WellbeingCheckIn[];
  activeEventContext: EventAnalysisRecord | null;
  onClearEventContext: () => void;
  onSelectSession: (id: string) => void;
  onNewSession: (mode?: ReflectionMode) => void;
  onDeleteSession: (id: string) => void;
  onSetMode: (sessionId: string, mode: ReflectionMode) => void;
  onAppendMessages: (
    sessionId: string,
    messages: DialogueMessage[],
    suggestedTitle?: string
  ) => void;
  onAddHypothesis: (input: {
    dimension: PatternDimension;
    statement: string;
    rationale: string;
    source: 'dialogue';
  }) => void;
  onUpdateHypothesisStatus: (id: string, status: 'resonates' | 'dismissed') => void;
  onOpenCrisisSupport: () => void;
  onOpenAtlas: () => void;
}

const MODE_OPTIONS: { id: ReflectionMode; label: string; focus: string }[] = [
  {
    id: 'insight',
    label: 'Insight',
    focus: 'Connect reactions to underlying needs, beliefs, and patterns gently.',
  },
  {
    id: 'self-reflection',
    label: 'Self-Reflection',
    focus: 'Explore Trigger -> Thought -> Emotion -> Behavior loops and cognitive habits.',
  },
  {
    id: 'relationship',
    label: 'Relationships',
    focus: 'Examine communication dynamics and unspoken needs without taking sides.',
  },
  {
    id: 'growth',
    label: 'Growth',
    focus: 'Clarify core values, strengths, purpose, and realistic next steps.',
  },
  {
    id: 'de-escalation',
    label: 'Conflict',
    focus: 'Separate facts from interpretations, uncover needs, and form constructive requests.',
  },
  {
    id: 'digital-pause',
    label: 'Digital Pause',
    focus: 'Transform heated online replies or conflicts into conscious communication.',
  },
];

const STARTER_REFLECTIONS: { mode: ReflectionMode; label: string; prompt: string }[] = [
  {
    mode: 'self-reflection',
    label: 'Recurring reaction loop',
    prompt:
      'I noticed I shut down completely when someone gives me critical feedback, even when they are trying to help.',
  },
  {
    mode: 'relationship',
    label: 'Unresolved interpersonal tension',
    prompt:
      'My partner and I keep having the same argument where I feel unheard and they feel blamed. I want to understand both sides.',
  },
  {
    mode: 'digital-pause',
    label: 'Heated message or online conflict',
    prompt:
      'Someone left a dismissive comment on my work online and I drafted a sharp reply. Before sending it, I want to check what is actually going on.',
  },
  {
    mode: 'growth',
    label: 'Values & life direction',
    prompt:
      'On paper things look stable, yet I feel restless and disconnected from what actually matters to me.',
  },
];

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export function DialogueView({
  sessions,
  activeSession,
  hypotheses,
  wellbeingCheckIns,
  activeEventContext,
  onClearEventContext,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onSetMode,
  onAppendMessages,
  onAddHypothesis,
  onUpdateHypothesisStatus,
  onOpenCrisisSupport,
  onOpenAtlas,
}: DialogueViewProps) {
  const [draft, setDraft] = useState('');
  const [includeStructuredCard, setIncludeStructuredCard] = useState(false);
  const [includeBreakdown, setIncludeBreakdown] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedBreakdowns, setExpandedBreakdowns] = useState<Record<string, boolean>>({});
  const [adoptedHypotheses, setAdoptedHypotheses] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const streamEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeSession.messages.length, isSending]);

  const currentModeMeta =
    MODE_OPTIONS.find((m) => m.id === activeSession.mode) || MODE_OPTIONS[0];

  const hasCrisisInSession =
    activeSession.messages.some((m) => m.crisisDetected) ||
    detectClientCrisisSignals(draft);

  const visibleHypotheses = hypotheses
    .filter((h) => h.status !== 'dismissed')
    .slice(0, 4);

  const buildWellbeingSummary = () => {
    if (wellbeingCheckIns.length === 0) return '';
    return wellbeingCheckIns
      .slice(0, 5)
      .map(
        (w) =>
          `${new Date(w.createdAt).toLocaleDateString()}: mood=${w.mood}/5, stress=${w.stress}/5, anxiety=${w.anxiety}/5, connection=${w.socialConnection}/5, selfEsteem=${w.selfEsteem}/5, motivation=${w.motivation}/5, energy=${w.energy}/5, satisfaction=${w.lifeSatisfaction}/5${w.note ? ` (${w.note})` : ''}`
      )
      .join('\n');
  };

  const sendReflection = async (overrideText?: string, overrideMode?: ReflectionMode) => {
    const text = (overrideText ?? draft).trim();
    if (!text || isSending) return;

    const sessionId = activeSession.id;
    const effectiveMode = overrideMode ?? activeSession.mode;
    if (overrideMode && overrideMode !== activeSession.mode) {
      onSetMode(sessionId, overrideMode);
    }

    const clientCrisis = detectClientCrisisSignals(text);
    const userMessage: DialogueMessage = {
      id: `msg_${Date.now()}_u`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      mode: effectiveMode,
      crisisDetected: clientCrisis,
    };

    const nextHistory = [...activeSession.messages, userMessage];
    const suggestedTitle =
      activeSession.messages.length === 0
        ? text.length > 48
          ? `${text.slice(0, 48).trim()}...`
          : text
        : undefined;

    onAppendMessages(sessionId, [userMessage], suggestedTitle);
    if (!overrideText) setDraft('');
    setErrorMsg(null);
    setIsSending(true);

    try {
      const response = await fetch('/api/dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextHistory.map((m) => ({ role: m.role, content: m.content })),
          mode: effectiveMode,
          profileHypotheses: hypotheses.filter((h) => h.status !== 'dismissed'),
          wellbeingSummary: buildWellbeingSummary(),
          includeStructuredCard,
          includeBreakdown,
          activeEventContext,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to generate a reflective response.');
      }

      const assistantMsg: DialogueMessage = {
        id: `msg_${Date.now()}_a`,
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toISOString(),
        mode: effectiveMode,
        crisisDetected: Boolean(data.crisisDetected || clientCrisis),
        structuredCard: data.structuredCard || null,
        eventBreakdown: data.eventBreakdown || null,
        cognitivePatterns: Array.isArray(data.cognitivePatterns) ? data.cognitivePatterns : [],
        emergingHypotheses: Array.isArray(data.emergingHypotheses)
          ? data.emergingHypotheses
          : [],
        followUpQuestions: Array.isArray(data.followUpQuestions)
          ? data.followUpQuestions
          : [],
      };

      onAppendMessages(sessionId, [assistantMsg]);
      if (assistantMsg.eventBreakdown) {
        setExpandedBreakdowns((prev) => ({ ...prev, [assistantMsg.id]: true }));
      }
      if (activeEventContext) {
        onClearEventContext();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong while reflecting.';
      setErrorMsg(msg);
    } finally {
      setIsSending(false);
    }
  };

  const handleAdoptHypothesis = (msgId: string, idx: number, item: EmergingHypothesis) => {
    const key = `${msgId}_${idx}`;
    onAddHypothesis({
      dimension: item.dimension,
      statement: item.observation,
      rationale: item.rationale,
      source: 'dialogue',
    });
    setAdoptedHypotheses((prev) => ({ ...prev, [key]: true }));
  };

  const exportSessionMarkdown = () => {
    const lines: string[] = [
      `# HUMANOS AI — ${activeSession.title}`,
      `Focus: ${currentModeMeta.label}`,
      `Updated: ${new Date(activeSession.updatedAt).toLocaleString()}`,
      '',
      '---',
      '',
    ];
    activeSession.messages.forEach((m) => {
      lines.push(`### ${m.role === 'user' ? 'You' : 'HUMANOS'}`);
      lines.push(m.content);
      if (m.structuredCard) {
        lines.push('');
        lines.push(`- Observation: ${m.structuredCard.observation}`);
        lines.push(`- Emotion: ${m.structuredCard.emotion}`);
        lines.push(`- Possible Need: ${m.structuredCard.possibleNeed}`);
        lines.push(`- Reflection: ${m.structuredCard.reflection}`);
        lines.push(`- Practical Next Step: ${m.structuredCard.practicalNextStep}`);
      }
      if (m.eventBreakdown) {
        lines.push('');
        lines.push('**Conflict & Emotional Breakdown**');
        lines.push(`- Facts: ${m.eventBreakdown.facts.join('; ')}`);
        lines.push(`- Interpretations: ${m.eventBreakdown.interpretations.join('; ')}`);
        lines.push(`- Emotions: ${m.eventBreakdown.emotions.join('; ')}`);
        lines.push(`- Needs: ${m.eventBreakdown.needs.join('; ')}`);
        if (m.eventBreakdown.requests?.length) {
          lines.push(`- Constructive Requests: ${m.eventBreakdown.requests.join('; ')}`);
        }
        lines.push(`- Actions: ${m.eventBreakdown.actions.join('; ')}`);
      }
      lines.push('');
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `humanos-reflection-${activeSession.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Reflection Stream (8 columns) */}
        <section className="lg:col-span-8 flex flex-col space-y-6">
          {/* Lens / Mode Selector Bar */}
          <div className="border-b border-[#1C1917]/10 pb-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="font-serif text-2xl sm:text-3xl font-medium tracking-tight text-[#1C1917] [text-wrap:balance]">
                {activeSession.messages.length === 0
                  ? 'Reflective Intelligence Space'
                  : activeSession.title}
              </h1>
              {activeSession.messages.length > 0 && (
                <button
                  type="button"
                  onClick={exportSessionMarkdown}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#57534E] hover:text-[#1C1917] transition-colors whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Notes</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#F4F0E8] border border-[#1C1917]/10 rounded-lg w-fit">
              {MODE_OPTIONS.map((mode) => {
                const active = activeSession.mode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => onSetMode(activeSession.id, mode.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-[#FBF9F5] text-[#1C1917] shadow-xs border border-[#1C1917]/10'
                        : 'text-[#57534E] hover:text-[#1C1917]'
                    }`}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[#78716C]">{currentModeMeta.focus}</p>
          </div>

          {/* Active Event Lab Context Bridge */}
          {activeEventContext && (
            <div className="border border-[#1E3A5F]/25 bg-[#F4F0E8] rounded-lg p-4 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-medium text-[#1E3A5F]">
                  Attached Event Analysis · {activeEventContext.contextCategory}
                </div>
                <div className="text-sm font-semibold text-[#1C1917]">
                  {activeEventContext.summaryTitle}
                </div>
                <p className="text-xs text-[#57534E] line-clamp-2">
                  {activeEventContext.rawEvent}
                </p>
              </div>
              <button
                type="button"
                onClick={onClearEventContext}
                aria-label="Detach event context"
                className="p-1.5 text-[#57534E] hover:text-[#1C1917] rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Crisis Stabilization Banner */}
          {hasCrisisInSession && <CrisisBanner onOpenResources={onOpenCrisisSupport} />}

          {/* Empty State / Contemplative Entry */}
          {activeSession.messages.length === 0 ? (
            <div className="py-4 space-y-8">
              <div className="space-y-3 max-w-2xl">
                <p className="font-serif text-xl text-[#292524] leading-relaxed">
                  Insight before advice. Understanding before solutions. Begin with whatever is on your mind—a feeling, a relational conflict, a cognitive loop, or a message you want to pause before sending.
                </p>
                <p className="text-sm text-[#78716C]">
                  HUMANOS offers evidence-informed psychological reflection without clinical diagnosis, labels, or judgment.
                </p>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-medium text-[#78716C]">
                  Starting points to explore
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {STARTER_REFLECTIONS.map((starter) => (
                    <button
                      key={starter.label}
                      type="button"
                      onClick={() => sendReflection(starter.prompt, starter.mode)}
                      className="text-left p-4 rounded-lg border border-[#1C1917]/10 bg-[#F4F0E8]/55 hover:bg-[#F4F0E8] hover:border-[#1C1917]/25 transition-colors space-y-1.5"
                    >
                      <div className="text-xs font-medium text-[#1E3A5F]">
                        {starter.label}
                      </div>
                      <p className="text-sm text-[#292524] leading-relaxed line-clamp-3">
                        “{starter.prompt}”
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Editorial Conversation Stream */
            <div className="divide-y divide-[#1C1917]/10">
              {activeSession.messages.map((msg) => {
                const isUser = msg.role === 'user';
                const breakdownOpen = Boolean(expandedBreakdowns[msg.id]);

                return (
                  <article key={msg.id} className="py-6 first:pt-2 space-y-4">
                    <div className="flex items-center gap-2 text-xs text-[#78716C]">
                      <span
                        className={`font-semibold ${
                          isUser ? 'text-[#1C1917]' : 'text-[#1E3A5F]'
                        }`}
                      >
                        {isUser ? 'You' : 'HUMANOS'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {msg.mode && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="capitalize">{msg.mode.replace('-', ' ')}</span>
                        </>
                      )}
                    </div>

                    <div className="max-w-prose space-y-3 text-[15.5px] leading-[1.7] text-[#1C1917] whitespace-pre-line">
                      {msg.content}
                    </div>

                    {/* Structured Guidance Card (OBSERVATION / EMOTION / POSSIBLE NEED / REFLECTION / PRACTICAL NEXT STEP) */}
                    {msg.structuredCard && (
                      <div className="border border-[#1C1917]/12 rounded-lg bg-[#F4F0E8]/55 divide-y divide-[#1C1917]/10 text-sm">
                        {(
                          [
                            ['Observation', msg.structuredCard.observation],
                            ['Emotion', msg.structuredCard.emotion],
                            ['Possible Need', msg.structuredCard.possibleNeed],
                            ['Reflection', msg.structuredCard.reflection],
                            ['Practical Next Step', msg.structuredCard.practicalNextStep],
                          ] as [string, string][]
                        ).map(([label, value]) =>
                          value ? (
                            <div
                              key={label}
                              className="px-4 py-3 grid grid-cols-1 sm:grid-cols-4 gap-2"
                            >
                              <div className="text-xs font-semibold text-[#1E3A5F] pt-0.5">
                                {label}
                              </div>
                              <p className="sm:col-span-3 text-[#292524] leading-relaxed">
                                {value}
                              </p>
                            </div>
                          ) : null
                        )}
                      </div>
                    )}

                    {/* Gentle Cognitive Pattern Notice */}
                    {msg.cognitivePatterns && msg.cognitivePatterns.length > 0 && (
                      <div className="border border-[#1C1917]/10 rounded-lg bg-[#FBF9F5] px-4 py-3 space-y-1">
                        <div className="text-xs font-medium text-[#57534E]">
                          Cognitive Perspective Check
                        </div>
                        {msg.cognitivePatterns.map((pattern, idx) => (
                          <p key={idx} className="text-sm text-[#292524] leading-relaxed">
                            {pattern}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Optional Conflict & Emotional Analysis Breakdown */}
                    {msg.eventBreakdown && (
                      <div className="border border-[#1C1917]/12 rounded-lg bg-[#F4F0E8]/60 overflow-hidden">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedBreakdowns((prev) => ({
                              ...prev,
                              [msg.id]: !prev[msg.id],
                            }))
                          }
                          className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-semibold text-[#1C1917] hover:bg-[#EBE6DF]/60 transition-colors"
                        >
                          <span>Conflict & Emotional Breakdown (Facts · Interpretations · Emotions · Needs · Requests)</span>
                          {breakdownOpen ? (
                            <ChevronUp className="w-4 h-4 text-[#57534E]" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-[#57534E]" />
                          )}
                        </button>
                        {breakdownOpen && (
                          <div className="border-t border-[#1C1917]/10 divide-y divide-[#1C1917]/10 text-sm">
                            {(
                              [
                                ['Facts', msg.eventBreakdown.facts],
                                ['Interpretations', msg.eventBreakdown.interpretations],
                                ['Emotions', msg.eventBreakdown.emotions],
                                ['Needs', msg.eventBreakdown.needs],
                                ['Requests', msg.eventBreakdown.requests || []],
                                ['Actions', msg.eventBreakdown.actions],
                              ] as [string, string[]][]
                            ).map(([label, items]) =>
                              items.length > 0 ? (
                                <div
                                  key={label}
                                  className="px-4 py-3 grid grid-cols-1 sm:grid-cols-4 gap-2"
                                >
                                  <div className="text-xs font-semibold text-[#57534E] pt-0.5">
                                    {label}
                                  </div>
                                  <ul className="sm:col-span-3 space-y-1 text-[#292524]">
                                    {items.map((entry, idx) => (
                                      <li key={idx} className="leading-relaxed">
                                        {entry}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Emerging Probabilistic Observations */}
                    {msg.emergingHypotheses && msg.emergingHypotheses.length > 0 && (
                      <div className="border border-[#1C1917]/12 rounded-lg bg-[#FBF9F5] p-4 space-y-3">
                        <div className="text-xs font-medium text-[#57534E]">
                          Tentative observations for your Pattern Atlas
                        </div>
                        <div className="divide-y divide-[#1C1917]/10">
                          {msg.emergingHypotheses.map((hyp, idx) => {
                            const adopted = Boolean(adoptedHypotheses[`${msg.id}_${idx}`]);
                            return (
                              <div
                                key={idx}
                                className="py-2.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                              >
                                <div className="space-y-0.5">
                                  <div className="text-xs text-[#78716C]">{hyp.dimension}</div>
                                  <p className="text-sm text-[#1C1917]">{hyp.observation}</p>
                                </div>
                                <button
                                  type="button"
                                  disabled={adopted}
                                  onClick={() => handleAdoptHypothesis(msg.id, idx, hyp)}
                                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors inline-flex items-center gap-1.5 ${
                                    adopted
                                      ? 'bg-[#EBE6DF] text-[#57534E]'
                                      : 'border border-[#1E3A5F]/30 text-[#1E3A5F] hover:bg-[#1E3A5F] hover:text-[#FBF9F5]'
                                  }`}
                                >
                                  {adopted ? (
                                    <>
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Added to Atlas</span>
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>Save to Atlas</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Follow-up Reflective Questions */}
                    {msg.followUpQuestions && msg.followUpQuestions.length > 0 && (
                      <div className="pt-1 flex flex-wrap gap-2">
                        {msg.followUpQuestions.map((q, idx) => (
                          <button
                            key={idx}
                            type="button"
                            disabled={isSending}
                            onClick={() => sendReflection(q)}
                            className="text-left text-xs px-3 py-2 rounded-md border border-[#1C1917]/12 bg-[#F4F0E8]/60 hover:bg-[#EBE6DF] text-[#292524] transition-colors"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}

              {isSending && (
                <div className="py-6 flex items-center gap-2.5 text-sm text-[#57534E]">
                  <Loader2 className="w-4 h-4 animate-spin text-[#1E3A5F]" />
                  <span>Reflecting carefully on what you shared...</span>
                </div>
              )}
              <div ref={streamEndRef} />
            </div>
          )}

          {/* Error Feedback */}
          {errorMsg && (
            <div
              role="alert"
              className="p-4 rounded-lg border border-[#9A3412]/30 bg-[#FDF4F2] text-sm text-[#9A3412]"
            >
              {errorMsg}
            </div>
          )}

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendReflection();
            }}
            className="border border-[#1C1917]/15 rounded-lg bg-[#F4F0E8]/40 p-3 sm:p-4 space-y-3 focus-within:border-[#1E3A5F]/50 transition-colors"
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendReflection();
                }
              }}
              rows={3}
              placeholder="Describe what happened, what you felt, or a pattern you want to understand..."
              className="w-full bg-transparent text-[15px] leading-relaxed text-[#1C1917] placeholder:text-[#78716C] resize-none focus:outline-none"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#1C1917]/10">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <label className="inline-flex items-center gap-2 text-xs text-[#57534E] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeStructuredCard}
                    onChange={(e) => setIncludeStructuredCard(e.target.checked)}
                    className="rounded border-[#1C1917]/30 text-[#1E3A5F] focus:ring-[#1E3A5F]"
                  />
                  <span>Structured guidance card</span>
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-[#57534E] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeBreakdown}
                    onChange={(e) => setIncludeBreakdown(e.target.checked)}
                    className="rounded border-[#1C1917]/30 text-[#1E3A5F] focus:ring-[#1E3A5F]"
                  />
                  <span>Conflict & emotion breakdown</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isSending || !draft.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-[#1E3A5F] text-[#FBF9F5] hover:bg-[#162C49] disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                <span>{isSending ? 'Reflecting...' : 'Reflect'}</span>
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </form>
        </section>

        {/* Right Context Rail (4 columns) */}
        <aside className="lg:col-span-4 space-y-6">
          {/* Charter Boundary Note */}
          <div className="border border-[#1C1917]/10 rounded-lg bg-[#F4F0E8]/50 p-5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#1C1917]">
              <BookOpen className="w-4 h-4 text-[#1E3A5F]" />
              <span>Ethics & Reflective Scope</span>
            </div>
            <p className="text-xs leading-relaxed text-[#57534E]">
              HUMANOS provides evidence-informed reflection and emotional clarity. It is not therapy, psychiatry, or medical care, never claims human emotion or consciousness, and never diagnoses.
            </p>
          </div>

          {/* Working Probabilistic Model Preview */}
          <div className="border border-[#1C1917]/10 rounded-lg bg-[#F4F0E8]/50 p-5 space-y-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-serif text-lg font-medium text-[#1C1917]">
                Long-Term Human Model
              </h2>
              <button
                type="button"
                onClick={onOpenAtlas}
                className="text-xs font-medium text-[#1E3A5F] hover:underline underline-offset-4 whitespace-nowrap"
              >
                Open Atlas
              </button>
            </div>

            {visibleHypotheses.length === 0 ? (
              <p className="text-xs leading-relaxed text-[#78716C]">
                As you reflect, HUMANOS notes tentative patterns across your values, strengths, triggers, and challenges—never assuming permanence.
              </p>
            ) : (
              <div className="divide-y divide-[#1C1917]/10">
                {visibleHypotheses.map((item) => (
                  <div key={item.id} className="py-3 first:pt-0 last:pb-0 space-y-2">
                    <div className="text-xs text-[#78716C]">
                      <span>{item.dimension}</span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span>
                        {item.status === 'resonates' ? 'Confirmed by you' : 'Tentative'}
                      </span>
                    </div>
                    <p className="text-sm text-[#292524] leading-snug">{item.statement}</p>
                    {item.status === 'hypothesis' && (
                      <div className="flex items-center gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => onUpdateHypothesisStatus(item.id, 'resonates')}
                          className="text-xs font-medium text-[#1E3A5F] hover:underline underline-offset-2"
                        >
                          Resonates
                        </button>
                        <span className="text-[#78716C]" aria-hidden="true">·</span>
                        <button
                          type="button"
                          onClick={() => onUpdateHypothesisStatus(item.id, 'dismissed')}
                          className="text-xs text-[#78716C] hover:text-[#1C1917]"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Saved Reflection Threads */}
          <div className="border border-[#1C1917]/10 rounded-lg bg-[#F4F0E8]/50 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg font-medium text-[#1C1917]">
                Reflection Threads
              </h2>
              <button
                type="button"
                onClick={() => onNewSession('insight')}
                className="text-xs font-medium text-[#1E3A5F] hover:underline underline-offset-4"
              >
                + New
              </button>
            </div>

            <div className="divide-y divide-[#1C1917]/10 max-h-72 overflow-y-auto">
              {sessions.map((s) => {
                const isActive = s.id === activeSession.id;
                const confirming = confirmDeleteId === s.id;
                return (
                  <div
                    key={s.id}
                    className={`py-2.5 flex items-center justify-between gap-2 ${
                      isActive ? 'text-[#1C1917]' : 'text-[#57534E]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectSession(s.id)}
                      className="text-left min-w-0 flex-1 space-y-0.5"
                    >
                      <div
                        className={`text-sm truncate ${
                          isActive ? 'font-semibold text-[#1E3A5F]' : 'hover:text-[#1C1917]'
                        }`}
                      >
                        {s.title}
                      </div>
                      <div className="text-xs text-[#78716C] font-mono tabular-nums">
                        <span>{s.messages.length} turns</span>
                        <span className="mx-1.5" aria-hidden="true">·</span>
                        <span>{formatShortDate(s.updatedAt)}</span>
                      </div>
                    </button>

                    {confirming ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteSession(s.id);
                            setConfirmDeleteId(null);
                          }}
                          className="text-xs font-medium text-[#9A3412] hover:underline"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs text-[#78716C]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      sessions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(s.id)}
                          aria-label={`Delete thread ${s.title}`}
                          className="p-1.5 text-[#78716C] hover:text-[#9A3412] rounded transition-colors shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
