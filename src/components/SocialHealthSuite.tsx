import { useMemo, useState } from 'react';
import { ArrowRight, Check, Copy, Loader2, Trash2 } from 'lucide-react';
import { gatewayFetch } from '../lib/gatewayClient';
import { computeSocialHealthMetrics } from '../lib/socialHealth';
import { detectClientCrisisCategories } from '../hooks/useHumanosStore';
import { CrisisBanner } from './CrisisSupportView';
import {
  AssessmentRecord,
  CommentReviewRecord,
  CrisisRiskCategory,
  EventAnalysisRecord,
  ReflectionSession,
  RelationshipAreaInsight,
  RelationshipNode,
  SocialPlatform,
  WellbeingCheckIn,
} from '../types/humanos';

interface SocialHealthSuiteProps {
  commentReviews: CommentReviewRecord[];
  eventAnalyses: EventAnalysisRecord[];
  relationships: RelationshipNode[];
  relationshipInsights: RelationshipAreaInsight[];
  wellbeingCheckIns: WellbeingCheckIn[];
  assessments: AssessmentRecord[];
  sessions: ReflectionSession[];
  retentionDays: number;
  onAddCommentReview: (
    review: Omit<CommentReviewRecord, 'id' | 'createdAt'>
  ) => CommentReviewRecord;
  onDeleteCommentReview: (id: string) => void;
  onRehearseDigitalPause: (review: CommentReviewRecord) => void;
  onOpenConflictReports: () => void;
  onOpenCrisisSupport: () => void;
}

type ChannelOption = SocialPlatform | 'Direct Message / Email';
type MonitorFilter = 'all' | 'elevated' | 'Comment Review' | 'Relationship Bond';

const CHANNEL_OPTIONS: ChannelOption[] = [
  'Reddit',
  'X/Twitter',
  'LinkedIn',
  'Instagram',
  'Discord',
  'Facebook',
  'Direct Message / Email',
];

const SAMPLE_EXCHANGES: {
  label: string;
  platform: ChannelOption;
  contextComment: string;
  draftReply: string;
}[] = [
  {
    label: 'Loaded Thread Reply',
    platform: 'Reddit',
    contextComment:
      'Anyone who thinks deadlines matter more than burnout is clearly part of the problem.',
    draftReply:
      'You have no idea what my team actually carries every week—stop lecturing people from behind a keyboard.',
  },
  {
    label: 'Defensive Work Message',
    platform: 'Direct Message / Email',
    contextComment:
      'Can you explain why the client deck still isn’t aligned with what we discussed Tuesday?',
    draftReply:
      'If you had read my earlier update instead of changing priorities mid-week, you’d see it already is.',
  },
];

export function SocialHealthSuite({
  commentReviews,
  eventAnalyses,
  relationships,
  relationshipInsights,
  wellbeingCheckIns,
  assessments,
  sessions,
  retentionDays,
  onAddCommentReview,
  onDeleteCommentReview,
  onRehearseDigitalPause,
  onOpenConflictReports,
  onOpenCrisisSupport,
}: SocialHealthSuiteProps) {
  const [platform, setPlatform] = useState<ChannelOption>('Reddit');
  const [contextComment, setContextComment] = useState('');
  const [draftReply, setDraftReply] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(
    commentReviews[0]?.id ?? null
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [monitorFilter, setMonitorFilter] = useState<MonitorFilter>('all');

  const metrics = useMemo(
    () =>
      computeSocialHealthMetrics({
        commentReviews,
        eventAnalyses,
        relationships,
        relationshipInsights,
        wellbeingCheckIns,
        assessments,
        sessions,
        retentionDays,
      }),
    [
      commentReviews,
      eventAnalyses,
      relationships,
      relationshipInsights,
      wellbeingCheckIns,
      assessments,
      sessions,
      retentionDays,
    ]
  );

  const activeReview =
    commentReviews.find((r) => r.id === selectedReviewId) ||
    commentReviews[0] ||
    null;

  const filteredMonitorItems = useMemo(() => {
    if (monitorFilter === 'all') return metrics.monitoredItems;
    if (monitorFilter === 'elevated') {
      return metrics.monitoredItems.filter((i) => i.severity === 'Elevated');
    }
    return metrics.monitoredItems.filter((i) => i.source === monitorFilter);
  }, [metrics.monitoredItems, monitorFilter]);

  const handleRunReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReviewing) return;
    if (draftReply.trim().length < 4 && contextComment.trim().length < 4) return;

    setIsReviewing(true);
    setErrorMsg(null);

    try {
      const response = await gatewayFetch('/api/agents/comment-review', {
        method: 'POST',
        body: JSON.stringify({
          platform,
          contextComment: contextComment.trim(),
          draftReply: draftReply.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not run Toxicity Analysis & Comment Review.');
      }

      const combinedText = `${contextComment}\n${draftReply}`;
      const saved = onAddCommentReview({
        platform,
        contextComment: contextComment.trim(),
        draftReply: draftReply.trim() || contextComment.trim(),
        toxicityScore: typeof data.toxicityScore === 'number' ? data.toxicityScore : 0,
        toxicityTier: data.toxicityTier || 'Low',
        commentVerdict: data.commentVerdict || 'Safe to Post',
        toneAssessment: data.toneAssessment || 'Measured',
        hostilitySignals: Array.isArray(data.hostilitySignals)
          ? data.hostilitySignals
          : [],
        emotionalTrigger: data.emotionalTrigger || '',
        likelyOutcome: data.likelyOutcome || '',
        healthierRewrite: data.healthierRewrite || '',
        crisisDetected: Boolean(
          data.crisisDetected || detectClientCrisisCategories(combinedText).length > 0
        ),
        safetyCategories: Array.from(
          new Set<CrisisRiskCategory>([
            ...detectClientCrisisCategories(combinedText),
            ...(Array.isArray(data.safetyCategories) ? data.safetyCategories : []),
          ])
        ),
      });

      setSelectedReviewId(saved.id);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Unable to run Toxicity Analysis & Comment Review.'
      );
    } finally {
      setIsReviewing(false);
    }
  };

  const handleCopyRewrite = (id: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1600);
  };

  return (
    <div className="space-y-10">
      {/* 1. SOCIAL HEALTH SCORE HEADER & PILLAR BREAKDOWN */}
      <section className="border border-[#1E3A5F]/20 rounded-lg bg-[#FBF9F5] p-6 sm:p-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-5 space-y-2.5">
            <div className="text-xs font-medium text-[#1E3A5F]">
              Digital & Interpersonal Regulation · {retentionDays}-Day Window
            </div>
            <h1 className="font-serif text-3xl font-medium tracking-tight text-[#1C1917] [text-wrap:balance]">
              Social Health Score & Toxicity Screening
            </h1>
            <p className="text-sm text-[#57534E] leading-relaxed">
              Combine pre-send Comment Review, objective Toxicity Analysis, and cross-channel Conflict Monitoring into one grounded Social Health Score.
            </p>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-4 gap-4 border border-[#1C1917]/10 rounded-lg bg-[#F4F0E8]/60 p-5">
            <div className="sm:border-r sm:border-[#1C1917]/10 sm:pr-4 space-y-1">
              <div className="text-xs text-[#78716C]">Social Health Score</div>
              <div className="font-mono text-3xl font-medium text-[#1C1917] tabular-nums">
                {metrics.hasData ? metrics.socialHealthScore : '—'}
                {metrics.hasData && (
                  <span className="text-sm text-[#78716C] font-normal">/100</span>
                )}
              </div>
              <div
                className={`text-xs font-medium ${
                  metrics.status === 'Strained'
                    ? 'text-[#9A3412]'
                    : metrics.status === 'Watchful'
                      ? 'text-[#B45309]'
                      : 'text-[#1E3A5F]'
                }`}
              >
                {metrics.status} posture
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[#57534E]">Discourse Calm</span>
                <span className="font-mono tabular-nums text-[#1C1917]">
                  {metrics.reviewedCount > 0 || metrics.discourseCalm > 0
                    ? `${metrics.discourseCalm}%`
                    : '—'}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-sm bg-[#1C1917]/10 overflow-hidden">
                <div
                  className="h-full bg-[#1E3A5F]"
                  style={{ width: `${metrics.discourseCalm}%` }}
                />
              </div>
              <div className="text-[11px] text-[#78716C] tabular-nums">
                Avg toxicity {metrics.avgToxicity}%
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[#57534E]">Relational Warmth</span>
                <span className="font-mono tabular-nums text-[#1C1917]">
                  {metrics.relationalWarmth > 0 ? `${metrics.relationalWarmth}%` : '—'}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-sm bg-[#1C1917]/10 overflow-hidden">
                <div
                  className="h-full bg-[#1E3A5F]"
                  style={{ width: `${metrics.relationalWarmth}%` }}
                />
              </div>
              <div className="text-[11px] text-[#78716C] tabular-nums">
                {relationships.length} mapped bonds
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[#57534E]">Conflict Resilience</span>
                <span className="font-mono tabular-nums text-[#1C1917]">
                  {metrics.conflictResilience > 0 ? `${metrics.conflictResilience}%` : '—'}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-sm bg-[#1C1917]/10 overflow-hidden">
                <div
                  className="h-full bg-[#1E3A5F]"
                  style={{ width: `${metrics.conflictResilience}%` }}
                />
              </div>
              <div className="text-[11px] text-[#78716C] tabular-nums">
                {metrics.elevatedMonitorCount} elevated monitor{metrics.elevatedMonitorCount === 1 ? '' : 's'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {errorMsg && (
        <div
          role="alert"
          className="p-4 rounded-lg border border-[#9A3412]/25 bg-[#FDF4F2] text-sm text-[#9A3412]"
        >
          {errorMsg}
        </div>
      )}

      {/* 2. TOXICITY ANALYSIS & PRE-SEND COMMENT REVIEW */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <form
          onSubmit={handleRunReview}
          className="lg:col-span-6 border border-[#1C1917]/12 rounded-lg bg-[#F4F0E8]/55 p-6 space-y-5"
        >
          <div className="space-y-1">
            <div className="text-xs font-medium text-[#1E3A5F]">
              Toxicity Detector · Pre-Send Comment Review
            </div>
            <h2 className="font-serif text-xl font-medium text-[#1C1917]">
              Review a Draft Comment or Heated Reply
            </h2>
            <p className="text-xs text-[#57534E] leading-relaxed">
              Score hostility and escalation signals before posting, identify emotional triggers, and craft a grounded rewrite without suppressing your core boundary.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {CHANNEL_OPTIONS.map((ch) => {
              const active = platform === ch;
              return (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setPlatform(ch)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#1E3A5F] text-[#FBF9F5]'
                      : 'bg-[#FBF9F5] text-[#57534E] border border-[#1C1917]/12 hover:text-[#1C1917]'
                  }`}
                >
                  {ch}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-[#78716C]">Quick Examples:</span>
            {SAMPLE_EXCHANGES.map((sample) => (
              <button
                key={sample.label}
                type="button"
                onClick={() => {
                  setPlatform(sample.platform);
                  setContextComment(sample.contextComment);
                  setDraftReply(sample.draftReply);
                }}
                className="text-[#1E3A5F] font-medium hover:underline underline-offset-4 whitespace-nowrap"
              >
                {sample.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="comment-context-input"
              className="text-xs font-medium text-[#57534E]"
            >
              Incoming Post or Comment (optional)
            </label>
            <textarea
              id="comment-context-input"
              rows={2}
              value={contextComment}
              onChange={(e) => setContextComment(e.target.value)}
              placeholder="Paste the post, comment, or message you are responding to..."
              className="w-full rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] p-3 text-sm text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="draft-reply-input"
              className="text-xs font-medium text-[#57534E]"
            >
              Your Draft Comment or Message
            </label>
            <textarea
              id="draft-reply-input"
              rows={3}
              value={draftReply}
              onChange={(e) => setDraftReply(e.target.value)}
              placeholder="Paste or draft what you are considering sending..."
              className="w-full rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] p-3 text-sm text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>

          <button
            type="submit"
            disabled={
              isReviewing ||
              (draftReply.trim().length < 4 && contextComment.trim().length < 4)
            }
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49] disabled:opacity-45 transition-colors"
          >
            {isReviewing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Running Toxicity Analysis...</span>
              </>
            ) : (
              <span>Run Toxicity Analysis & Comment Review</span>
            )}
          </button>
        </form>

        {/* Detailed Toxicity Analysis & Comment Review Result */}
        <div className="lg:col-span-6 space-y-5">
          {activeReview ? (
            <article className="border border-[#1E3A5F]/20 rounded-lg bg-[#FBF9F5] p-6 space-y-5">
              {activeReview.crisisDetected && (
                <CrisisBanner
                  detectedCategories={activeReview.safetyCategories}
                  onOpenResources={onOpenCrisisSupport}
                />
              )}

              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1C1917]/10 pb-4">
                <div className="space-y-1">
                  <div className="text-xs text-[#78716C]">
                    <span className="font-medium text-[#1E3A5F]">
                      {activeReview.platform}
                    </span>
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    <span>{activeReview.toneAssessment}</span>
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {new Date(activeReview.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="font-serif text-xl font-medium text-[#1C1917]">
                    {activeReview.commentVerdict}
                  </h3>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-[11px] text-[#78716C]">Toxicity Score</div>
                    <div
                      className={`font-mono text-2xl font-medium tabular-nums ${
                        activeReview.toxicityTier === 'High'
                          ? 'text-[#9A3412]'
                          : activeReview.toxicityTier === 'Moderate'
                            ? 'text-[#B45309]'
                            : 'text-[#1E3A5F]'
                      }`}
                    >
                      {activeReview.toxicityScore}% · {activeReview.toxicityTier}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteCommentReview(activeReview.id)}
                    aria-label="Delete comment review"
                    className="p-1 text-[#78716C] hover:text-[#9A3412]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="w-full h-1.5 rounded-sm bg-[#1C1917]/10 overflow-hidden">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${Math.max(5, activeReview.toxicityScore)}%`,
                    backgroundColor:
                      activeReview.toxicityTier === 'High'
                        ? '#9A3412'
                        : activeReview.toxicityTier === 'Moderate'
                          ? '#B45309'
                          : '#1E3A5F',
                  }}
                />
              </div>

              {activeReview.hostilitySignals.length > 0 && (
                <div className="space-y-1 text-xs">
                  <span className="font-semibold text-[#1C1917]">
                    Detected Discourse Signals:{' '}
                  </span>
                  <span className="text-[#57534E]">
                    {activeReview.hostilitySignals.join(' · ')}
                  </span>
                </div>
              )}

              <div className="space-y-2 text-xs text-[#292524]">
                <div>
                  <span className="font-semibold text-[#1C1917]">
                    Emotional Trigger:{' '}
                  </span>
                  {activeReview.emotionalTrigger}
                </div>
                <div>
                  <span className="font-semibold text-[#1C1917]">
                    Likely Thread Outcome:{' '}
                  </span>
                  {activeReview.likelyOutcome}
                </div>
              </div>

              <div className="p-4 rounded-md bg-[#F4F0E8]/75 border border-[#1E3A5F]/20 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#1E3A5F]">
                    Calm, Constructive Alternative Comment
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyRewrite(activeReview.id, activeReview.healthierRewrite)
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1E3A5F] hover:underline underline-offset-4 whitespace-nowrap"
                  >
                    {copiedId === activeReview.id ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Rewrite</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-sm text-[#1C1917] leading-relaxed">
                  &ldquo;{activeReview.healthierRewrite}&rdquo;
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => onRehearseDigitalPause(activeReview)}
                  className="inline-flex items-center gap-1.5 font-medium text-[#1E3A5F] hover:underline underline-offset-4 whitespace-nowrap"
                >
                  <span>Explore Trigger in Digital Pause Dialogue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </article>
          ) : (
            <div className="border border-[#1C1917]/10 rounded-lg bg-[#F4F0E8]/35 p-6 text-sm text-[#57534E]">
              Paste a heated post or draft reply on the left (or load a quick example) to score Toxicity Analysis, review hostility cues, and get a calm alternative before sending.
            </div>
          )}

          {commentReviews.length > 1 && (
            <div className="border border-[#1C1917]/10 rounded-lg bg-[#FBF9F5] divide-y divide-[#1C1917]/10">
              {commentReviews.slice(0, 5).map((rev) => (
                <button
                  key={rev.id}
                  type="button"
                  onClick={() => setSelectedReviewId(rev.id)}
                  className={`w-full text-left p-3.5 flex items-center justify-between gap-3 transition-colors ${
                    rev.id === activeReview?.id ? 'bg-[#F4F0E8]/75' : 'hover:bg-[#F4F0E8]/40'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-[11px] font-mono text-[#78716C] tabular-nums">
                      {rev.platform} · {rev.commentVerdict}
                    </div>
                    <div className="text-xs font-medium text-[#1C1917] truncate">
                      {rev.draftReply}
                    </div>
                  </div>
                  <span
                    className={`font-mono text-xs font-medium tabular-nums shrink-0 ${
                      rev.toxicityTier === 'High'
                        ? 'text-[#9A3412]'
                        : rev.toxicityTier === 'Moderate'
                          ? 'text-[#B45309]'
                          : 'text-[#1E3A5F]'
                    }`}
                  >
                    {rev.toxicityScore}%
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 3. CONFLICT MONITORING LEDGER */}
      <section className="border border-[#1C1917]/12 rounded-lg bg-[#FBF9F5] p-6 sm:p-7 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1C1917]/10 pb-4">
          <div className="space-y-1 max-w-2xl">
            <div className="text-xs font-medium text-[#1E3A5F]">
              Cross-Channel Escalation Feed
            </div>
            <h2 className="font-serif text-2xl font-medium text-[#1C1917]">
              Conflict Monitoring
            </h2>
            <p className="text-xs text-[#57534E] leading-relaxed">
              Continuously surfaces high-friction comment reviews, online/conflict Event Lab entries, and strained interpersonal bonds in one monitoring stream.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F4F0E8] border border-[#1C1917]/10 rounded-lg">
              {(
                [
                  { id: 'all', label: `All (${metrics.monitoredItems.length})` },
                  { id: 'elevated', label: `Elevated (${metrics.elevatedMonitorCount})` },
                  { id: 'Comment Review', label: 'Comment Reviews' },
                  { id: 'Relationship Bond', label: 'Relational Bonds' },
                ] as { id: MonitorFilter; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMonitorFilter(tab.id)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    monitorFilter === tab.id
                      ? 'bg-[#FBF9F5] text-[#1C1917] border border-[#1C1917]/10'
                      : 'text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onOpenConflictReports}
              className="text-xs font-medium text-[#1E3A5F] hover:underline underline-offset-4 whitespace-nowrap"
            >
              Open Conflict Reports
            </button>
          </div>
        </div>

        {filteredMonitorItems.length === 0 ? (
          <div className="border border-[#1C1917]/10 rounded-md bg-[#F4F0E8]/40 p-6 text-xs text-[#57534E]">
            No active conflict signals match this filter yet. Comment Reviews, Conflict & Anger Event Lab analyses, and high-tension Relationships automatically surface here.
          </div>
        ) : (
          <div className="divide-y divide-[#1C1917]/10 border border-[#1C1917]/10 rounded-lg">
            {filteredMonitorItems.slice(0, 10).map((item) => (
              <div
                key={item.id}
                className="p-4 flex flex-wrap sm:flex-nowrap items-start justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="text-[11px] font-mono text-[#78716C] tabular-nums">
                    <span>{item.source}</span>
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    <span>{item.tag}</span>
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                  </div>
                  <div className="text-sm font-medium text-[#1C1917]">
                    {item.title}
                  </div>
                  <p className="text-xs text-[#57534E] leading-relaxed">
                    {item.detail}
                  </p>
                </div>

                <span
                  className={`text-xs font-medium whitespace-nowrap shrink-0 ${
                    item.severity === 'Elevated'
                      ? 'text-[#9A3412]'
                      : item.severity === 'Watchful'
                        ? 'text-[#B45309]'
                        : 'text-[#1E3A5F]'
                  }`}
                >
                  {item.severity}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
