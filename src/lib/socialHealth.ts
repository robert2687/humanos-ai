import { computePsychologicalIndices } from './psychologicalIndices';
import { computeRiskForecasts } from './riskForecasts';
import {
  AssessmentRecord,
  CommentReviewRecord,
  EventAnalysisRecord,
  ReflectionSession,
  RelationshipAreaInsight,
  RelationshipNode,
  WellbeingCheckIn,
} from '../types/humanos';

export interface ConflictMonitorItem {
  id: string;
  source: 'Comment Review' | 'Event Lab' | 'Relationship Bond';
  title: string;
  detail: string;
  severity: 'Elevated' | 'Watchful' | 'Calm';
  timestamp: string;
  tag: string;
}

export interface SocialHealthMetrics {
  socialHealthScore: number;
  status: 'Constructive' | 'Watchful' | 'Strained' | 'Baseline';
  hasData: boolean;
  discourseCalm: number;
  relationalWarmth: number;
  conflictResilience: number;
  avgToxicity: number;
  safePostRate: number;
  reviewedCount: number;
  elevatedMonitorCount: number;
  watchfulMonitorCount: number;
  monitoredItems: ConflictMonitorItem[];
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function computeSocialHealthMetrics(input: {
  commentReviews: CommentReviewRecord[];
  eventAnalyses: EventAnalysisRecord[];
  relationships: RelationshipNode[];
  relationshipInsights: RelationshipAreaInsight[];
  wellbeingCheckIns: WellbeingCheckIn[];
  assessments: AssessmentRecord[];
  sessions: ReflectionSession[];
  retentionDays: number;
}): SocialHealthMetrics {
  const {
    commentReviews,
    eventAnalyses,
    relationships,
    relationshipInsights,
    wellbeingCheckIns,
    assessments,
    sessions,
    retentionDays,
  } = input;

  const indexSuite = computePsychologicalIndices({
    wellbeingCheckIns,
    assessments,
    relationships,
    retentionDays,
  });

  const riskSuite = computeRiskForecasts({
    wellbeingCheckIns,
    assessments,
    relationships,
    relationshipInsights,
    eventAnalyses,
    sessions,
    indexSuite,
    retentionDays,
  });

  const socialConnIdx = indexSuite.indices.find((i) => i.key === 'social-connection');
  const conflictProb = riskSuite.signals.find((s) => s.key === 'conflict-probability');
  const relRisk = riskSuite.signals.find((s) => s.key === 'relationship-risk');

  const avgToxicity =
    commentReviews.length > 0
      ? Math.round(avg(commentReviews.map((c) => c.toxicityScore)))
      : 0;

  const safePosts = commentReviews.filter((c) => c.commentVerdict === 'Safe to Post').length;
  const safePostRate =
    commentReviews.length > 0 ? Math.round((safePosts / commentReviews.length) * 100) : 100;

  // 1. Discourse Calm (0-100): inverse toxicity + bonus when digital/conflict reflections are calm
  const discourseCalm =
    commentReviews.length > 0
      ? clamp(Math.round(100 - avgToxicity * 0.85), 5, 98)
      : socialConnIdx?.hasData
        ? clamp(socialConnIdx.score, 25, 90)
        : 0;

  // 2. Relational Warmth (0-100): Social Connection Index blended with inverse Relationship Risk
  const relationalWarmth = socialConnIdx?.hasData
    ? relRisk?.hasData
      ? clamp(Math.round(socialConnIdx.score * 0.65 + (100 - relRisk.probability) * 0.35), 5, 98)
      : socialConnIdx.score
    : relationships.length > 0
      ? clamp(
          Math.round(
            ((avg(relationships.map((r) => r.closeness)) +
              (6 - avg(relationships.map((r) => r.tension)))) /
              2 -
              1) *
              25
          ),
          5,
          98
        )
      : 0;

  // 3. Conflict Resilience (0-100): inverse Conflict Probability adjusted upward for proactive de-escalation work
  const proactivePauseCount =
    sessions.filter((s) => s.mode === 'de-escalation' || s.mode === 'digital-pause').length +
    commentReviews.filter((c) => c.commentVerdict !== 'Safe to Post').length;
  const conflictResilience = conflictProb?.hasData
    ? clamp(Math.round(100 - conflictProb.probability + Math.min(10, proactivePauseCount * 2)), 5, 98)
    : commentReviews.length > 0
      ? clamp(Math.round(100 - avgToxicity * 0.7), 10, 96)
      : 0;

  const activePillars = [
    commentReviews.length > 0 ? discourseCalm : null,
    socialConnIdx?.hasData || relationships.length > 0 ? relationalWarmth : null,
    conflictProb?.hasData || commentReviews.length > 0 ? conflictResilience : null,
  ].filter((v): v is number => v !== null);

  const hasData = activePillars.length > 0;
  const socialHealthScore = hasData ? Math.round(avg(activePillars)) : 0;

  const status: SocialHealthMetrics['status'] = !hasData
    ? 'Baseline'
    : socialHealthScore >= 70
      ? 'Constructive'
      : socialHealthScore >= 48
        ? 'Watchful'
        : 'Strained';

  // Assemble unified Conflict Monitoring items across comments, events, and relational bonds
  const monitoredItems: ConflictMonitorItem[] = [];

  for (const rev of commentReviews) {
    const severity: ConflictMonitorItem['severity'] =
      rev.toxicityScore >= 60 || rev.toxicityTier === 'High'
        ? 'Elevated'
        : rev.toxicityScore >= 32 || rev.commentVerdict !== 'Safe to Post'
          ? 'Watchful'
          : 'Calm';
    monitoredItems.push({
      id: `mon_rev_${rev.id}`,
      source: 'Comment Review',
      title: `${rev.platform} · ${rev.commentVerdict} (${rev.toxicityScore}% toxicity)`,
      detail:
        rev.hostilitySignals.length > 0
          ? `Signals: ${rev.hostilitySignals.slice(0, 3).join(', ')} — "${rev.draftReply.slice(0, 110)}"`
          : `"${rev.draftReply.slice(0, 120)}"`,
      severity,
      timestamp: rev.createdAt,
      tag: rev.platform,
    });
  }

  for (const ev of eventAnalyses) {
    if (
      ev.contextCategory === 'Conflict & Anger' ||
      ev.contextCategory === 'Digital & Online' ||
      ev.contextCategory === 'Relationship' ||
      ev.lens === 'digital-check'
    ) {
      const isConflictHeavy =
        ev.contextCategory === 'Conflict & Anger' ||
        ev.crisisDetected ||
        Boolean(ev.digitalCheck?.emotionalTrigger);
      monitoredItems.push({
        id: `mon_ev_${ev.id}`,
        source: 'Event Lab',
        title: ev.summaryTitle,
        detail: ev.emotions.length
          ? `Emotions: ${ev.emotions.map((e) => e.name).join(', ')} · Needs: ${ev.needs.slice(0, 3).join(', ')}`
          : ev.rawEvent.slice(0, 120),
        severity: isConflictHeavy ? 'Elevated' : 'Watchful',
        timestamp: ev.createdAt,
        tag: ev.contextCategory,
      });
    }
  }

  for (const rel of relationships) {
    if (rel.tension >= 3) {
      monitoredItems.push({
        id: `mon_rel_${rel.id}`,
        source: 'Relationship Bond',
        title: `${rel.name} (${rel.area}) · Tension ${rel.tension}/5`,
        detail: rel.dynamicNote || `Closeness ${rel.closeness}/5 · Shared need: ${rel.sharedNeed || 'Respect & clarity'}`,
        severity: rel.tension >= 4 ? 'Elevated' : 'Watchful',
        timestamp: rel.updatedAt,
        tag: rel.area,
      });
    }
  }

  const severityRank: Record<ConflictMonitorItem['severity'], number> = {
    Elevated: 0,
    Watchful: 1,
    Calm: 2,
  };

  monitoredItems.sort((a, b) => {
    const rankDiff = severityRank[a.severity] - severityRank[b.severity];
    if (rankDiff !== 0) return rankDiff;
    return Date.parse(b.timestamp) - Date.parse(a.timestamp);
  });

  return {
    socialHealthScore,
    status,
    hasData,
    discourseCalm,
    relationalWarmth,
    conflictResilience,
    avgToxicity,
    safePostRate,
    reviewedCount: commentReviews.length,
    elevatedMonitorCount: monitoredItems.filter((i) => i.severity === 'Elevated').length,
    watchfulMonitorCount: monitoredItems.filter((i) => i.severity === 'Watchful').length,
    monitoredItems,
  };
}
