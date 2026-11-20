import { useState } from 'react';
import { ArrowRight, Loader2, Search, Trash2 } from 'lucide-react';
import { EventAnalysisRecord, EventLabLens } from '../types/humanos';
import { detectClientCrisisSignals } from '../hooks/useHumanosStore';
import { CrisisBanner } from './CrisisSupportView';

interface EventLabViewProps {
  records: EventAnalysisRecord[];
  onSaveRecord: (
    record: Omit<EventAnalysisRecord, 'id' | 'createdAt'>
  ) => EventAnalysisRecord;
  onDeleteRecord: (id: string) => void;
  onDiscussInDialogue: (record: EventAnalysisRecord) => void;
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
    desc: 'Trigger -> Thought -> Emotion -> Behavior + CBT check',
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

export function EventLabView({
  records,
  onSaveRecord,
  onDeleteRecord,
  onDiscussInDialogue,
  onOpenCrisisSupport,
}: EventLabViewProps) {
  const [lens, setLens] = useState<EventLabLens>('conflict-emotion');
  const [contextCategory, setContextCategory] =
    useState<EventAnalysisRecord['contextCategory']>('Personal');
  const [eventText, setEventText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    records[0]?.id ?? null
  );
  const [searchQuery, setSearchQuery] = useState('');

  const activeRecord =
    records.find((r) => r.id === selectedId) || records[0] || null;

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
      const response = await fetch('/api/analyze-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventDescription: trimmed,
          contextCategory,
          lens,
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

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-10 space-y-10">
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
                  <p>Traces Trigger → Thought → Emotion → Behavior → Consequence with CBT cognitive pattern checks.</p>
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
                <CrisisBanner onOpenResources={onOpenCrisisSupport} />
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
                    <div className="px-5 py-3 text-xs font-semibold text-[#1E3A5F]">
                      Toxicity Detector & Digital Pause Analysis
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
                    <div className="px-5 py-3 text-xs font-semibold text-[#1E3A5F]">
                      Cognitive & Behavioral Sequence
                    </div>
                    <div className="p-5 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-sm">
                        {(
                          [
                            ['Trigger', activeRecord.behavioralLoop.trigger],
                            ['Thought', activeRecord.behavioralLoop.thought],
                            ['Emotion', activeRecord.behavioralLoop.emotion],
                            ['Behavior', activeRecord.behavioralLoop.behavior],
                            ['Consequence', activeRecord.behavioralLoop.consequence],
                          ] as [string, string][]
                        ).map(([step, val]) => (
                          <div key={step} className="p-3 rounded-md bg-[#FBF9F5] border border-[#1C1917]/10 space-y-1">
                            <div className="text-xs font-semibold text-[#1E3A5F]">{step}</div>
                            <p className="text-xs text-[#292524] leading-relaxed">{val}</p>
                          </div>
                        ))}
                      </div>
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
    </div>
  );
}
