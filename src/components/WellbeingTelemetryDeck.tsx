import { useMemo, useState } from 'react';
import { WellbeingCheckIn } from '../types/humanos';

interface WellbeingTelemetryDeckProps {
  wellbeingCheckIns: WellbeingCheckIn[];
  retentionDays: number;
  onChangeRetentionDays: (days: number) => void;
  onApplyRetentionSweep: (days?: number) => { removedCheckIns: number };
}

type TelemetryFocus =
  | 'overview'
  | 'mood'
  | 'stress'
  | 'sleep'
  | 'energy'
  | 'wellbeing';

const FOCUS_TABS: { id: TelemetryFocus; label: string }[] = [
  { id: 'overview', label: 'All 5 Signals' },
  { id: 'mood', label: 'Mood Trends' },
  { id: 'stress', label: 'Stress Scores' },
  { id: 'sleep', label: 'Sleep Data' },
  { id: 'energy', label: 'Energy Data' },
  { id: 'wellbeing', label: 'Wellbeing Metrics' },
];

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function formatDelta(current: number, baseline: number, unit = ''): string {
  const diff = current - baseline;
  if (Math.abs(diff) < 0.05) return 'Steady vs baseline';
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff.toFixed(1)}${unit} vs baseline`;
}

export function WellbeingTelemetryDeck({
  wellbeingCheckIns,
  retentionDays,
  onChangeRetentionDays,
  onApplyRetentionSweep,
}: WellbeingTelemetryDeckProps) {
  const [focus, setFocus] = useState<TelemetryFocus>('overview');
  const [sweepNotice, setSweepNotice] = useState<string | null>(null);

  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const expiredCount = useMemo(
    () =>
      wellbeingCheckIns.filter((entry) => {
        const ms = Date.parse(entry.createdAt);
        return Number.isFinite(ms) && ms < cutoffMs;
      }).length,
    [wellbeingCheckIns, cutoffMs]
  );

  const chronological = useMemo(
    () =>
      [...wellbeingCheckIns]
        .filter((entry) => {
          const ms = Date.parse(entry.createdAt);
          return !Number.isFinite(ms) || ms >= cutoffMs;
        })
        .slice(0, 24)
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
        .map((entry) => {
          const sleepHours = entry.sleepHours ?? 7;
          const sleepQuality = entry.sleepQuality ?? 3;
          const sleepScore5 = Math.min(5, Math.max(1, (sleepHours / 8) * 5));
          const resilience =
            (entry.mood + entry.selfEsteem + entry.socialConnection + entry.energy) / 4;
          const burnoutLoad =
            (entry.stress + (6 - entry.energy) + (6 - entry.motivation)) / 3;
          const compositeRaw =
            (((entry.mood +
              (6 - entry.stress) +
              entry.energy +
              resilience +
              (sleepQuality + sleepScore5) / 2) /
              5 -
              1) /
              4) *
            100;

          return {
            id: entry.id,
            label: new Date(entry.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            }),
            mood: entry.mood,
            lifeSatisfaction: entry.lifeSatisfaction,
            stress: entry.stress,
            anxiety: entry.anxiety,
            sleepHours,
            sleepQuality,
            sleepScore5,
            energy: entry.energy,
            motivation: entry.motivation,
            resilience,
            burnoutLoad,
            wellbeingIndex: Math.round(Math.min(100, Math.max(0, compositeRaw))),
          };
        }),
    [wellbeingCheckIns, cutoffMs]
  );

  const summary = useMemo(() => {
    if (chronological.length === 0) return null;
    const latest = chronological[chronological.length - 1];
    const prior = chronological.length > 1 ? chronological.slice(0, -1) : chronological;

    const avgMood = avg(chronological.map((d) => d.mood));
    const avgSatisfaction = avg(chronological.map((d) => d.lifeSatisfaction));
    const avgStress = avg(chronological.map((d) => d.stress));
    const peakStress = Math.max(...chronological.map((d) => d.stress));
    const avgAnxiety = avg(chronological.map((d) => d.anxiety));
    const avgSleepHours = avg(chronological.map((d) => d.sleepHours));
    const avgSleepQuality = avg(chronological.map((d) => d.sleepQuality));
    const avgEnergy = avg(chronological.map((d) => d.energy));
    const avgMotivation = avg(chronological.map((d) => d.motivation));
    const avgResilience = avg(chronological.map((d) => d.resilience));
    const avgWellbeingIndex = Math.round(avg(chronological.map((d) => d.wellbeingIndex)));

    return {
      sampleCount: chronological.length,
      mood: {
        value: avgMood.toFixed(1),
        delta: formatDelta(latest.mood, avg(prior.map((p) => p.mood))),
        sub: `Satisfaction ${avgSatisfaction.toFixed(1)} / 5`,
      },
      stress: {
        value: avgStress.toFixed(1),
        delta: `Peak ${peakStress.toFixed(1)} / 5`,
        sub: `Anxiety avg ${avgAnxiety.toFixed(1)} / 5`,
      },
      sleep: {
        value: `${avgSleepHours.toFixed(1)}h`,
        delta:
          avgSleepHours < 6.5
            ? 'Short sleep load'
            : avgSleepHours >= 7.2 && avgSleepQuality >= 3.5
              ? 'Restorative'
              : 'Moderate recovery',
        sub: `Quality ${avgSleepQuality.toFixed(1)} / 5`,
      },
      energy: {
        value: avgEnergy.toFixed(1),
        delta: formatDelta(latest.energy, avg(prior.map((p) => p.energy))),
        sub: `Motivation ${avgMotivation.toFixed(1)} / 5`,
      },
      wellbeing: {
        value: `${avgWellbeingIndex}/100`,
        delta:
          avgWellbeingIndex >= 68
            ? 'Steady baseline'
            : avgWellbeingIndex >= 46
              ? 'Watchful load'
              : 'Elevated strain',
        sub: `Resilience ${avgResilience.toFixed(1)} / 5`,
      },
    };
  }, [chronological]);

  const activeSeries = useMemo(() => {
    switch (focus) {
      case 'mood':
        return [
          { label: 'Mood', stroke: '#1E3A5F', getValue: (d: (typeof chronological)[number]) => d.mood },
          {
            label: 'Life Satisfaction',
            stroke: '#475569',
            getValue: (d: (typeof chronological)[number]) => d.lifeSatisfaction,
          },
        ];
      case 'stress':
        return [
          { label: 'Stress Score', stroke: '#9A3412', getValue: (d: (typeof chronological)[number]) => d.stress },
          { label: 'Anxiety Load', stroke: '#B45309', getValue: (d: (typeof chronological)[number]) => d.anxiety },
        ];
      case 'sleep':
        return [
          {
            label: 'Sleep Quality (1–5)',
            stroke: '#1E3A5F',
            getValue: (d: (typeof chronological)[number]) => d.sleepQuality,
          },
          {
            label: 'Sleep Duration (scaled vs 8h)',
            stroke: '#3F6212',
            getValue: (d: (typeof chronological)[number]) => d.sleepScore5,
          },
        ];
      case 'energy':
        return [
          { label: 'Energy', stroke: '#3F6212', getValue: (d: (typeof chronological)[number]) => d.energy },
          { label: 'Motivation', stroke: '#1E3A5F', getValue: (d: (typeof chronological)[number]) => d.motivation },
        ];
      case 'wellbeing':
        return [
          { label: 'Resilience', stroke: '#3F6212', getValue: (d: (typeof chronological)[number]) => d.resilience },
          { label: 'Burnout Load', stroke: '#9A3412', getValue: (d: (typeof chronological)[number]) => d.burnoutLoad },
        ];
      default:
        return [
          { label: 'Mood', stroke: '#1E3A5F', getValue: (d: (typeof chronological)[number]) => d.mood },
          { label: 'Stress', stroke: '#9A3412', getValue: (d: (typeof chronological)[number]) => d.stress },
          { label: 'Sleep Quality', stroke: '#475569', getValue: (d: (typeof chronological)[number]) => d.sleepQuality },
          { label: 'Energy', stroke: '#3F6212', getValue: (d: (typeof chronological)[number]) => d.energy },
          { label: 'Resilience', stroke: '#78350F', getValue: (d: (typeof chronological)[number]) => d.resilience },
        ];
    }
  }, [focus, chronological]);

  const svgWidth = 820;
  const svgHeight = 220;
  const padLeft = 36;
  const padRight = 24;
  const padTop = 18;
  const padBottom = 34;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const xFor = (idx: number) => {
    if (chronological.length <= 1) return padLeft + plotW / 2;
    return padLeft + (idx / (chronological.length - 1)) * plotW;
  };
  const yFor = (val: number) => {
    const clamped = Math.min(5, Math.max(1, val));
    return padTop + ((5 - clamped) / 4) * plotH;
  };

  return (
    <section className="border border-[#1C1917]/12 rounded-lg bg-[#FBF9F5] p-6 sm:p-7 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1C1917]/10 pb-4">
        <div className="space-y-1">
          <div className="text-xs font-medium text-[#1E3A5F]">
            Personal Telemetry · Five Observable Pillars
          </div>
          <h2 className="font-serif text-2xl font-medium text-[#1C1917]">
            Mood Trends, Stress Scores, Sleep Data & Energy Metrics
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-[#57534E]">Retention (30–90d):</span>
          <div className="flex items-center gap-1">
            {[30, 60, 90].map((days) => {
              const active = retentionDays === days;
              return (
                <button
                  key={days}
                  type="button"
                  onClick={() => {
                    onChangeRetentionDays(days);
                    setSweepNotice(null);
                  }}
                  className={`px-2 py-1 font-mono font-medium rounded transition-colors whitespace-nowrap tabular-nums ${
                    active
                      ? 'bg-[#1E3A5F] text-[#FBF9F5]'
                      : 'bg-[#F4F0E8] text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  {days}d
                </button>
              );
            })}
          </div>
          {expiredCount > 0 && (
            <button
              type="button"
              onClick={() => {
                const res = onApplyRetentionSweep(retentionDays);
                setSweepNotice(
                  `Removed ${res.removedCheckIns} reading${res.removedCheckIns === 1 ? '' : 's'} older than ${retentionDays} days.`
                );
              }}
              className="px-2.5 py-1 font-medium border border-[#9A3412]/35 text-[#9A3412] rounded hover:bg-[#FDF4F2] whitespace-nowrap tabular-nums"
            >
              Prune {expiredCount} Aged
            </button>
          )}
          <span className="text-[#78716C] font-mono tabular-nums whitespace-nowrap">
            {summary
              ? `${summary.sampleCount} active (${retentionDays}d window)`
              : `0 readings · ${retentionDays}d window`}
          </span>
        </div>
      </div>

      {sweepNotice && (
        <div className="p-3 rounded-md border border-[#1E3A5F]/20 bg-[#F4F0E8]/60 text-xs text-[#1E3A5F]">
          {sweepNotice}
        </div>
      )}

      {!summary ? (
        <p className="text-sm text-[#57534E] leading-relaxed">
          Log your first check-in below (or sync a Smart Watch pulse) to plot real Mood Trends, Stress Scores, Sleep Data, Energy Data, and composite Wellbeing Metrics across time.
        </p>
      ) : (
        <>
          {/* 5-Pillar Summary Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {(
              [
                ['Mood Trends', summary.mood],
                ['Stress Scores', summary.stress],
                ['Sleep Data', summary.sleep],
                ['Energy Data', summary.energy],
                ['Wellbeing Metrics', summary.wellbeing],
              ] as [string, { value: string; delta: string; sub: string }][]
            ).map(([title, item]) => (
              <div
                key={title}
                className="p-4 rounded-md bg-[#F4F0E8]/50 border border-[#1C1917]/10 space-y-1"
              >
                <div className="text-xs font-medium text-[#57534E]">{title}</div>
                <div className="font-mono text-2xl font-medium text-[#1C1917] tabular-nums">
                  {item.value}
                </div>
                <div className="text-xs font-medium text-[#1E3A5F] tabular-nums">
                  {item.delta}
                </div>
                <div className="text-[11px] text-[#78716C] font-mono tabular-nums">
                  {item.sub}
                </div>
              </div>
            ))}
          </div>

          {/* Interactive Focus Switcher + Chronological Chart */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F4F0E8] border border-[#1C1917]/10 rounded-lg">
                {FOCUS_TABS.map((tab) => {
                  const active = focus === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFocus(tab.id)}
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

              <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#57534E]">
                {activeSeries.map((s) => (
                  <span
                    key={s.label}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <span
                      className="inline-block w-3 h-0.5"
                      style={{ backgroundColor: s.stroke }}
                      aria-hidden="true"
                    />
                    <span>{s.label}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="border border-[#1C1917]/10 rounded-md bg-[#F4F0E8]/30 p-4 overflow-x-auto">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full min-w-[480px] h-48 block"
                role="img"
                aria-label="Chronological chart tracking mood trends, stress scores, sleep data, energy data, and wellbeing metrics"
              >
                {[1, 2, 3, 4, 5].map((tick) => {
                  const y = yFor(tick);
                  return (
                    <g key={tick}>
                      <line
                        x1={padLeft}
                        y1={y}
                        x2={svgWidth - padRight}
                        y2={y}
                        stroke="#1C1917"
                        strokeOpacity={0.1}
                        strokeWidth={1}
                      />
                      <text
                        x={padLeft - 8}
                        y={y + 3}
                        textAnchor="end"
                        fontSize="10"
                        fill="#78716C"
                        fontFamily="ui-monospace, monospace"
                      >
                        {tick}.0
                      </text>
                    </g>
                  );
                })}

                {activeSeries.map((series) => {
                  const pts = chronological.map((row, idx) => ({
                    x: xFor(idx),
                    y: yFor(series.getValue(row)),
                    val: series.getValue(row),
                    rawSleepHours: row.sleepHours,
                  }));
                  const attr = pts
                    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
                    .join(' ');
                  return (
                    <g key={series.label}>
                      {pts.length > 1 && (
                        <polyline
                          fill="none"
                          stroke={series.stroke}
                          strokeWidth={2}
                          points={attr}
                        />
                      )}
                      {pts.map((p, idx) => (
                        <circle
                          key={idx}
                          cx={p.x}
                          cy={p.y}
                          r={3.5}
                          fill={series.stroke}
                          stroke="#FBF9F5"
                          strokeWidth={1.2}
                        >
                          <title>
                            {focus === 'sleep' && series.label.includes('Duration')
                              ? `${p.rawSleepHours.toFixed(1)} hrs`
                              : `${series.label}: ${p.val.toFixed(2)} / 5`}
                          </title>
                        </circle>
                      ))}
                    </g>
                  );
                })}

                {chronological.map((row, idx) => {
                  const show =
                    chronological.length <= 8 ||
                    idx === 0 ||
                    idx === chronological.length - 1 ||
                    idx % Math.ceil(chronological.length / 6) === 0;
                  if (!show) return null;
                  return (
                    <text
                      key={row.id}
                      x={xFor(idx)}
                      y={svgHeight - 10}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#57534E"
                      fontFamily="ui-monospace, monospace"
                    >
                      {row.label}
                    </text>
                  );
                })}
              </svg>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
