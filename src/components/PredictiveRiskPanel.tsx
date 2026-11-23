import { useMemo, useState } from 'react';
import { RiskForecastSuite, RiskSignalKey } from '../types/humanos';

interface PredictiveRiskPanelProps {
  suite: RiskForecastSuite;
  onOpenCrisisSupport?: () => void;
}

type RiskFilter = 'all' | 'active-concerns' | 'stress-burnout' | 'relational-conflict';

const RISK_FILTERS: { id: RiskFilter; label: string }[] = [
  { id: 'all', label: 'All 6 Risk Models' },
  { id: 'active-concerns', label: 'Watchful & Elevated' },
  { id: 'stress-burnout', label: 'Stress & Decline' },
  { id: 'relational-conflict', label: 'Relational & Conflict' },
];

export function PredictiveRiskPanel({
  suite,
  onOpenCrisisSupport,
}: PredictiveRiskPanelProps) {
  const [filter, setFilter] = useState<RiskFilter>('all');
  const [selectedKey, setSelectedKey] = useState<RiskSignalKey>('burnout-risk');

  const visibleSignals = useMemo(() => {
    if (filter === 'all') return suite.signals;
    if (filter === 'active-concerns') {
      return suite.signals.filter(
        (s) => s.hasData && (s.tier === 'Elevated' || s.tier === 'Watchful')
      );
    }
    return suite.signals.filter((s) => s.category === filter);
  }, [suite.signals, filter]);

  const activeSignal =
    suite.signals.find((s) => s.key === selectedKey) || suite.signals[0];

  const hasAnyData = suite.signals.some((s) => s.hasData);

  return (
    <section className="border border-[#1C1917]/12 rounded-lg bg-[#FBF9F5] p-6 sm:p-7 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1C1917]/10 pb-4">
        <div className="space-y-1 max-w-2xl">
          <div className="text-xs font-medium text-[#1E3A5F]">
            Early-Warning Risk Models · Longitudinal Velocity & Context Signals
          </div>
          <h2 className="font-serif text-2xl font-medium text-[#1C1917]">
            Predictive Wellbeing & Relational Risk Signals
          </h2>
          <p className="text-xs text-[#57534E] leading-relaxed">
            Non-diagnostic early-warning probabilities modeled from check-in slopes, sleep deficits, relational tension, and Event Lab triggers across your active {suite.retentionDays}-day window.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F4F0E8] border border-[#1C1917]/10 rounded-lg">
            {RISK_FILTERS.map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#FBF9F5] text-[#1C1917] border border-[#1C1917]/10'
                      : 'text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {hasAnyData && (
            <div className="text-xs text-[#57534E] font-mono tabular-nums whitespace-nowrap">
              Aggregate Risk{' '}
              <span
                className={`font-semibold ${
                  suite.aggregateRisk >= 65
                    ? 'text-[#9A3412]'
                    : suite.aggregateRisk >= 40
                      ? 'text-[#B45309]'
                      : 'text-[#1E3A5F]'
                }`}
              >
                {suite.aggregateRisk}%
              </span>
            </div>
          )}
        </div>
      </div>

      {visibleSignals.length === 0 ? (
        <div className="border border-[#1C1917]/10 rounded-md bg-[#F4F0E8]/40 p-6 text-xs text-[#57534E]">
          No signals are currently in the Watchful or Elevated tier for this window.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleSignals.map((signal) => {
            const selected = signal.key === activeSignal.key;
            const barColor = !signal.hasData
              ? '#78716C'
              : signal.tier === 'Elevated'
                ? '#9A3412'
                : signal.tier === 'Watchful'
                  ? '#B45309'
                  : '#1E3A5F';

            return (
              <button
                key={signal.key}
                type="button"
                onClick={() => setSelectedKey(signal.key)}
                className={`text-left p-4 rounded-lg border transition-colors flex flex-col justify-between space-y-3 ${
                  selected
                    ? 'bg-[#F4F0E8]/90 border-[#1E3A5F]'
                    : 'bg-[#F4F0E8]/40 border-[#1C1917]/10 hover:bg-[#F4F0E8]/70'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-[#1C1917]">
                      {signal.label}
                    </span>
                    <span className="text-[11px] font-mono text-[#78716C] whitespace-nowrap">
                      {signal.trend}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-2xl font-medium text-[#1C1917] tabular-nums">
                      {signal.hasData ? `${signal.probability}%` : '—'}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        !signal.hasData
                          ? 'text-[#78716C]'
                          : signal.tier === 'Elevated'
                            ? 'text-[#9A3412]'
                            : signal.tier === 'Watchful'
                              ? 'text-[#B45309]'
                              : 'text-[#1E3A5F]'
                      }`}
                    >
                      {signal.hasData ? `${signal.tier} risk` : 'No data'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="w-full h-1.5 rounded-sm bg-[#1C1917]/10 overflow-hidden">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${signal.hasData ? Math.max(4, signal.probability) : 0}%`,
                        backgroundColor: barColor,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-[#57534E] leading-snug line-clamp-2">
                    {signal.drivers[0]}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Selected Signal Drivers & Preventive Buffer */}
      <div className="border border-[#1C1917]/10 rounded-lg bg-[#F4F0E8]/45 p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-6 space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-serif text-lg font-medium text-[#1C1917]">
              {activeSignal.label} · Signal Drivers
            </h3>
            <span className="font-mono text-xs text-[#1E3A5F] tabular-nums">
              {activeSignal.hasData
                ? `${activeSignal.probability}% · ${activeSignal.tier} · ${activeSignal.trend}`
                : 'Awaiting workspace inputs'}
            </span>
          </div>
          <ul className="space-y-1 text-xs text-[#292524]">
            {activeSignal.drivers.map((drv, idx) => (
              <li key={idx} className="leading-relaxed">
                · {drv}
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-6 space-y-2 lg:border-l lg:border-[#1C1917]/10 lg:pl-5">
          <div className="text-xs font-semibold text-[#1E3A5F]">
            Preventive Buffer & Reflective Step
          </div>
          <p className="text-xs text-[#292524] leading-relaxed">
            {activeSignal.preventiveStep}
          </p>
          {suite.elevatedCount > 0 && onOpenCrisisSupport && (
            <div className="pt-1 flex items-center justify-between gap-3 text-xs border-t border-[#1C1917]/10">
              <span className="text-[#9A3412] font-medium tabular-nums">
                {suite.elevatedCount} signal{suite.elevatedCount === 1 ? '' : 's'} currently elevated
              </span>
              <button
                type="button"
                onClick={onOpenCrisisSupport}
                className="text-[#1E3A5F] font-medium hover:underline underline-offset-4 whitespace-nowrap"
              >
                Open Grounding & Support
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
