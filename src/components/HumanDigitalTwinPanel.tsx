import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { detectClientCrisisCategories } from '../hooks/useHumanosStore';
import { CrisisBanner } from './CrisisSupportView';
import {
  DynamicUserModel,
  HumanDigitalTwinSnapshot,
  LifeHistoryDomain,
  LifeTimelineEvent,
  PatternDimension,
  PatternHypothesis,
} from '../types/humanos';

interface HumanDigitalTwinPanelProps {
  sessionsCount: number;
  eventAnalysesCount: number;
  wellbeingCount: number;
  retentionDays: number;
  equilibriumScore?: number;
  hasIndicesData?: boolean;
  aggregateRiskPct?: number;
  elevatedRiskCount?: number;
  onOpenWellbeing?: () => void;
  hypotheses: PatternHypothesis[];
  timelineEvents: LifeTimelineEvent[];
  dynamicUserModel: DynamicUserModel;
  digitalTwinSnapshot: HumanDigitalTwinSnapshot | null;
  isAggregating: boolean;
  onAggregateTwin: () => void;
  onSelectLayer2Dimension: (dimension: PatternDimension) => void;
  onOpenLayer3Timeline: (domain?: LifeHistoryDomain) => void;
  onOpenCrisisSupport: () => void;
}

const LAYER2_CORE_CATEGORIES: {
  dimension: PatternDimension;
  label: string;
  subtitle: string;
}[] = [
  { dimension: 'Values', label: 'Values', subtitle: 'Ethical anchors & meaning' },
  { dimension: 'Triggers', label: 'Triggers', subtitle: 'Sensitivities & threat cues' },
  { dimension: 'Strengths', label: 'Strengths', subtitle: 'Resilience & capacities' },
  { dimension: 'Recurring Concerns', label: 'Recurring Concerns', subtitle: 'Persistent tensions & themes' },
];

const LAYER3_CORE_DOMAINS: {
  domain: LifeHistoryDomain;
  subtitle: string;
}[] = [
  { domain: 'Career Changes', subtitle: 'Transitions & identity shifts' },
  { domain: 'Losses', subtitle: 'Grief, endings & adaptation' },
  { domain: 'Relationships', subtitle: 'Formative bonds & attachment' },
  { domain: 'Achievements', subtitle: 'Earned efficacy & milestones' },
  { domain: 'Traumatic Events', subtitle: 'Protective imprints (trauma-aware)' },
];

export function HumanDigitalTwinPanel({
  sessionsCount,
  eventAnalysesCount,
  wellbeingCount,
  retentionDays,
  equilibriumScore,
  hasIndicesData,
  aggregateRiskPct,
  elevatedRiskCount = 0,
  onOpenWellbeing,
  hypotheses,
  timelineEvents,
  dynamicUserModel,
  digitalTwinSnapshot,
  isAggregating,
  onAggregateTwin,
  onSelectLayer2Dimension,
  onOpenLayer3Timeline,
  onOpenCrisisSupport,
}: HumanDigitalTwinPanelProps) {
  const [showSnapshotJson, setShowSnapshotJson] = useState(false);

  const activeHypotheses = hypotheses.filter((h) => h.status !== 'dismissed');
  const layer2Counts = LAYER2_CORE_CATEGORIES.map((cat) => ({
    ...cat,
    count: activeHypotheses.filter((h) => h.dimension === cat.dimension).length,
  }));

  const layer3Counts = LAYER3_CORE_DOMAINS.map((item) => ({
    ...item,
    count: timelineEvents.filter((ev) => (ev.domain || 'Career Changes') === item.domain).length,
  }));

  const timelineRiskCategories = Array.from(
    new Set(
      timelineEvents.flatMap((ev) =>
        detectClientCrisisCategories(
          `${ev.title} ${ev.emotionalImpact} ${ev.patternOrLesson}`
        )
      )
    )
  );

  return (
    <section className="border border-[#1E3A5F]/20 rounded-lg bg-[#FBF9F5] p-6 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1C1917]/10 pb-5">
        <div className="space-y-1.5 max-w-2xl">
          <div className="text-xs font-medium text-[#1E3A5F]">
            Layer 4 · Human Digital Twin — Aggregated Model · The Core Intelligence Asset
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-medium text-[#1C1917] [text-wrap:balance]">
            Four-Layer Memory & Living Intelligence Architecture
          </h2>
          <p className="text-sm text-[#57534E] leading-relaxed">
            Unifies Layer 1 active session & wellbeing telemetry ({retentionDays}-day window), Layer 2 recurring pattern memory, and Layer 3 formative life history into one evolving, probabilistic model.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {digitalTwinSnapshot && (
            <button
              type="button"
              onClick={() => setShowSnapshotJson((prev) => !prev)}
              className="text-xs font-medium text-[#1E3A5F] hover:underline underline-offset-4 whitespace-nowrap"
            >
              {showSnapshotJson ? 'Hide Twin JSON' : 'View Twin JSON'}
            </button>
          )}
          <button
            type="button"
            onClick={onAggregateTwin}
            disabled={isAggregating}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49] disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {isAggregating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Aggregating Layer 4 Twin...</span>
              </>
            ) : (
              <span>Aggregate Layer 4 Digital Twin</span>
            )}
          </button>
        </div>
      </div>

      {/* 3 Feeder Layers Architecture Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Layer 1 */}
        <div className="lg:col-span-3 border border-[#1C1917]/10 rounded-lg bg-[#F4F0E8]/55 p-4 space-y-3">
          <div className="border-b border-[#1C1917]/10 pb-2">
            <div className="font-mono text-[11px] text-[#1E3A5F]">Layer 1</div>
            <div className="font-serif text-base font-medium text-[#1C1917]">
              Active Context & Telemetry
            </div>
          </div>
          <div className="space-y-1.5 text-xs text-[#292524]">
            <div className="flex justify-between">
              <span className="text-[#57534E]">Dialogue Threads</span>
              <span className="font-mono tabular-nums font-medium">{sessionsCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#57534E]">Event Analyses</span>
              <span className="font-mono tabular-nums font-medium">{eventAnalysesCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#57534E]">Wellbeing Check-Ins</span>
              <span className="font-mono tabular-nums font-medium">{wellbeingCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#57534E]">User Model Entries</span>
              <span className="font-mono tabular-nums font-medium">{dynamicUserModel.entries.length}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-[#1C1917]/10">
              <span className="text-[#78716C]">Time-Series Window</span>
              <span className="font-mono tabular-nums text-[#1E3A5F]">{retentionDays}d</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#78716C]">8-Index Equilibrium</span>
              {onOpenWellbeing ? (
                <button
                  type="button"
                  onClick={onOpenWellbeing}
                  className="font-mono tabular-nums text-[#1E3A5F] hover:underline underline-offset-4 whitespace-nowrap"
                >
                  {hasIndicesData && typeof equilibriumScore === 'number'
                    ? `${equilibriumScore}/100`
                    : 'View 8 Indices'}
                </button>
              ) : (
                <span className="font-mono tabular-nums text-[#1E3A5F]">
                  {hasIndicesData && typeof equilibriumScore === 'number'
                    ? `${equilibriumScore}/100`
                    : '—'}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#78716C]">6-Signal Risk Posture</span>
              {onOpenWellbeing ? (
                <button
                  type="button"
                  onClick={onOpenWellbeing}
                  className={`font-mono tabular-nums hover:underline underline-offset-4 whitespace-nowrap ${
                    elevatedRiskCount > 0 ? 'text-[#9A3412] font-medium' : 'text-[#1E3A5F]'
                  }`}
                >
                  {typeof aggregateRiskPct === 'number'
                    ? elevatedRiskCount > 0
                      ? `${aggregateRiskPct}% (${elevatedRiskCount} elevated)`
                      : `${aggregateRiskPct}%`
                    : 'View 6 Risks'}
                </button>
              ) : (
                <span
                  className={`font-mono tabular-nums whitespace-nowrap ${
                    elevatedRiskCount > 0 ? 'text-[#9A3412] font-medium' : 'text-[#1E3A5F]'
                  }`}
                >
                  {typeof aggregateRiskPct === 'number'
                    ? elevatedRiskCount > 0
                      ? `${aggregateRiskPct}% (${elevatedRiskCount} elevated)`
                      : `${aggregateRiskPct}%`
                    : '—'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Layer 2 */}
        <div className="lg:col-span-4 border border-[#1C1917]/10 rounded-lg bg-[#F4F0E8]/55 p-4 space-y-3">
          <div className="border-b border-[#1C1917]/10 pb-2">
            <div className="font-mono text-[11px] text-[#1E3A5F]">Layer 2</div>
            <div className="font-serif text-base font-medium text-[#1C1917]">
              Values, Triggers, Strengths & Recurring Concerns
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {layer2Counts.map((item) => (
              <button
                key={item.dimension}
                type="button"
                onClick={() => onSelectLayer2Dimension(item.dimension)}
                className="text-left p-2.5 rounded-md bg-[#FBF9F5] border border-[#1C1917]/10 hover:border-[#1E3A5F]/40 transition-colors space-y-0.5"
              >
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-xs font-semibold text-[#1C1917]">{item.label}</span>
                  <span className="font-mono text-xs text-[#1E3A5F] tabular-nums">{item.count}</span>
                </div>
                <div className="text-[11px] text-[#78716C] leading-snug">{item.subtitle}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Layer 3 */}
        <div className="lg:col-span-5 border border-[#1C1917]/10 rounded-lg bg-[#F4F0E8]/55 p-4 space-y-3">
          <div className="flex items-baseline justify-between border-b border-[#1C1917]/10 pb-2 gap-2">
            <div>
              <div className="font-mono text-[11px] text-[#1E3A5F]">Layer 3</div>
              <div className="font-serif text-base font-medium text-[#1C1917]">
                Formative Life History
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenLayer3Timeline()}
              className="text-xs text-[#1E3A5F] hover:underline underline-offset-4 whitespace-nowrap"
            >
              Open Timeline
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {layer3Counts.map((item) => (
              <button
                key={item.domain}
                type="button"
                onClick={() => onOpenLayer3Timeline(item.domain)}
                className="text-left p-2.5 rounded-md bg-[#FBF9F5] border border-[#1C1917]/10 hover:border-[#1E3A5F]/40 transition-colors space-y-0.5"
              >
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-xs font-semibold text-[#1C1917] truncate">
                    {item.domain}
                  </span>
                  <span className="font-mono text-xs text-[#1E3A5F] tabular-nums">
                    {item.count}
                  </span>
                </div>
                <div className="text-[11px] text-[#78716C] leading-snug">{item.subtitle}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Layer 4 Synthesized Human Digital Twin Output */}
      {digitalTwinSnapshot ? (
        <div className="space-y-6 pt-2 border-t border-[#1C1917]/10">
          {(digitalTwinSnapshot.crisisDetected || timelineRiskCategories.length > 0) && (
            <CrisisBanner
              detectedCategories={timelineRiskCategories}
              onOpenResources={onOpenCrisisSupport}
            />
          )}

          {showSnapshotJson && (
            <pre className="p-4 rounded-md bg-[#F4F0E8] border border-[#1C1917]/10 font-mono text-xs text-[#1C1917] overflow-x-auto leading-relaxed">
              {JSON.stringify(digitalTwinSnapshot, null, 2)}
            </pre>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs text-[#78716C]">
                  <span className="font-medium text-[#1E3A5F]">Synthesized Identity Thesis</span>
                  <span className="font-mono tabular-nums">
                    {new Date(digitalTwinSnapshot.generatedAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="font-serif text-xl text-[#1C1917] leading-snug">
                  {digitalTwinSnapshot.identityThesis}
                </p>
              </div>
              <p className="text-sm text-[#292524] leading-relaxed">
                {digitalTwinSnapshot.aggregatedSummary}
              </p>
            </div>

            <div className="lg:col-span-5 border border-[#1C1917]/10 rounded-lg bg-[#F4F0E8]/60 p-4 space-y-3">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-[#1E3A5F]">Decision Compass</div>
                <p className="text-xs text-[#292524] leading-relaxed">
                  {digitalTwinSnapshot.decisionCompass}
                </p>
              </div>
              {digitalTwinSnapshot.layer1Signals.length > 0 && (
                <div className="space-y-1 border-t border-[#1C1917]/10 pt-3">
                  <div className="text-xs font-semibold text-[#1C1917]">Layer 1 Active Signals</div>
                  <ul className="space-y-1 text-xs text-[#57534E]">
                    {digitalTwinSnapshot.layer1Signals.map((sig, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {sig}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Layer 2 Four-Pillar Synthesis */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-[#1E3A5F]">
              Layer 2 Aggregated Pattern Memory
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-3.5 rounded-md border border-[#1C1917]/10 bg-[#F4F0E8]/40 space-y-1.5">
                <div className="font-semibold text-[#1C1917]">Values</div>
                <ul className="space-y-1 text-[#57534E]">
                  {digitalTwinSnapshot.layer2Patterns.values.map((v, i) => (
                    <li key={i} className="leading-relaxed">{v}</li>
                  ))}
                </ul>
              </div>
              <div className="p-3.5 rounded-md border border-[#1C1917]/10 bg-[#F4F0E8]/40 space-y-1.5">
                <div className="font-semibold text-[#9A3412]">Triggers</div>
                <ul className="space-y-1 text-[#57534E]">
                  {digitalTwinSnapshot.layer2Patterns.triggers.map((t, i) => (
                    <li key={i} className="leading-relaxed">{t}</li>
                  ))}
                </ul>
              </div>
              <div className="p-3.5 rounded-md border border-[#1C1917]/10 bg-[#F4F0E8]/40 space-y-1.5">
                <div className="font-semibold text-[#1E3A5F]">Strengths</div>
                <ul className="space-y-1 text-[#57534E]">
                  {digitalTwinSnapshot.layer2Patterns.strengths.map((s, i) => (
                    <li key={i} className="leading-relaxed">{s}</li>
                  ))}
                </ul>
              </div>
              <div className="p-3.5 rounded-md border border-[#1C1917]/10 bg-[#F4F0E8]/40 space-y-1.5">
                <div className="font-semibold text-[#1C1917]">Recurring Concerns</div>
                <ul className="space-y-1 text-[#57534E]">
                  {digitalTwinSnapshot.layer2Patterns.recurringConcerns.map((c, i) => (
                    <li key={i} className="leading-relaxed">{c}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Layer 3 Narrative Threads */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-[#1E3A5F]">
              Layer 3 Formative Life-History Threads
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
              {digitalTwinSnapshot.layer3Narrative.map((item) => (
                <div
                  key={item.domain}
                  className="p-3.5 rounded-md border border-[#1C1917]/10 bg-[#FBF9F5] space-y-1.5"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-[#1C1917]">{item.domain}</span>
                    <span className="font-mono text-[11px] text-[#1E3A5F] tabular-nums">
                      {item.count}
                    </span>
                  </div>
                  <p className="text-[#57534E] leading-relaxed">{item.synthesis}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Protective Loops, Resilience Levers, Next Inquiry */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 border-t border-[#1C1917]/10 pt-4 text-xs">
            <div className="space-y-1.5">
              <div className="font-semibold text-[#1C1917]">Protective Loops to Notice</div>
              <ul className="space-y-1 text-[#57534E]">
                {digitalTwinSnapshot.protectiveLoops.map((loop, idx) => (
                  <li key={idx} className="leading-relaxed">{loop}</li>
                ))}
              </ul>
            </div>
            <div className="space-y-1.5">
              <div className="font-semibold text-[#1E3A5F]">Resilience Levers</div>
              <ul className="space-y-1 text-[#292524]">
                {digitalTwinSnapshot.resilienceLevers.map((lev, idx) => (
                  <li key={idx} className="leading-relaxed">{lev}</li>
                ))}
              </ul>
            </div>
            <div className="space-y-1.5">
              <div className="font-semibold text-[#1C1917]">Suggested Next Inquiry</div>
              <p className="text-[#292524] leading-relaxed italic">
                {digitalTwinSnapshot.suggestedNextInquiry}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-t border-[#1C1917]/10 pt-4 text-xs text-[#57534E] leading-relaxed">
          Click “Aggregate Layer 4 Digital Twin” once you have recorded reflections, Layer 2 patterns, or Layer 3 life-history milestones to synthesize your core Human Digital Twin asset.
        </div>
      )}
    </section>
  );
}
