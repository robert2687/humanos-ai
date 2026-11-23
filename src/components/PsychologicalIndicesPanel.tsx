import { useMemo, useState } from 'react';
import {
  PsychologicalIndexKey,
  PsychologicalIndexMetric,
  PsychologicalIndexSuite,
} from '../types/humanos';

interface PsychologicalIndicesPanelProps {
  suite: PsychologicalIndexSuite;
}

type IndexFilter = 'all' | 'protective' | 'strain';

const FILTER_TABS: { id: IndexFilter; label: string }[] = [
  { id: 'all', label: 'All 8 Indices' },
  { id: 'protective', label: 'Protective (6)' },
  { id: 'strain', label: 'Strain Load (2)' },
];

function isElevatedConcern(metric: PsychologicalIndexMetric): boolean {
  if (!metric.hasData) return false;
  if (metric.polarity === 'strain') return metric.score >= 65;
  return metric.score < 42;
}

export function PsychologicalIndicesPanel({ suite }: PsychologicalIndicesPanelProps) {
  const [filter, setFilter] = useState<IndexFilter>('all');
  const [selectedKey, setSelectedKey] = useState<PsychologicalIndexKey>('mood');

  const visibleIndices = useMemo(() => {
    if (filter === 'all') return suite.indices;
    return suite.indices.filter((idx) => idx.polarity === filter);
  }, [suite.indices, filter]);

  const activeMetric =
    suite.indices.find((i) => i.key === selectedKey) || suite.indices[0];

  const hasAnyData = suite.indices.some((i) => i.hasData);

  // SVG chart dimensions for selected index trajectory
  const svgWidth = 640;
  const svgHeight = 190;
  const padLeft = 36;
  const padRight = 20;
  const padTop = 16;
  const padBottom = 30;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const series = activeMetric.series;
  const xFor = (idx: number) => {
    if (series.length <= 1) return padLeft + plotW / 2;
    return padLeft + (idx / (series.length - 1)) * plotW;
  };
  const yFor = (val: number) => {
    const clamped = Math.min(100, Math.max(0, val));
    return padTop + ((100 - clamped) / 100) * plotH;
  };

  const activeStroke =
    activeMetric.polarity === 'strain' ? '#9A3412' : '#1E3A5F';

  return (
    <section className="border border-[#1C1917]/12 rounded-lg bg-[#FBF9F5] p-6 sm:p-7 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1C1917]/10 pb-4">
        <div className="space-y-1 max-w-2xl">
          <div className="text-xs font-medium text-[#1E3A5F]">
            Quantitative Psychological & Wellbeing Indices · 0–100 Normalized Scale
          </div>
          <h2 className="font-serif text-2xl font-medium text-[#1C1917]">
            Eight Core Wellbeing & Stability Indices
          </h2>
          <p className="text-xs text-[#57534E] leading-relaxed">
            Derived strictly from your logged check-ins, self-assessments, and relational closeness within your active {suite.retentionDays}-day window. Non-diagnostic self-observation only.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#F4F0E8] border border-[#1C1917]/10 rounded-lg">
            {FILTER_TABS.map((tab) => {
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
              Equilibrium <span className="font-semibold text-[#1E3A5F]">{suite.overallEquilibrium}/100</span>
            </div>
          )}
        </div>
      </div>

      {/* 8-Index Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {visibleIndices.map((metric) => {
          const isSelected = metric.key === activeMetric.key;
          const concern = isElevatedConcern(metric);
          const barColor = !metric.hasData
            ? '#78716C'
            : metric.polarity === 'strain'
              ? concern
                ? '#9A3412'
                : '#B45309'
              : concern
                ? '#9A3412'
                : '#1E3A5F';

          return (
            <button
              key={metric.key}
              type="button"
              onClick={() => setSelectedKey(metric.key)}
              className={`text-left p-4 rounded-lg border transition-colors flex flex-col justify-between space-y-3 ${
                isSelected
                  ? 'bg-[#F4F0E8]/90 border-[#1E3A5F]'
                  : 'bg-[#F4F0E8]/40 border-[#1C1917]/10 hover:bg-[#F4F0E8]/70'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-[#1C1917]">
                    {metric.label}
                  </span>
                  <span className="text-[11px] text-[#78716C] whitespace-nowrap">
                    {metric.polarity === 'strain' ? 'Strain' : 'Protective'}
                  </span>
                </div>

                <div className="flex items-baseline justify-between gap-2 pt-0.5">
                  <div className="font-mono text-2xl font-medium text-[#1C1917] tabular-nums">
                    {metric.hasData ? metric.score : '—'}
                    <span className="text-xs text-[#78716C] font-normal"> / 100</span>
                  </div>
                  <span className="font-mono text-xs text-[#57534E] tabular-nums">
                    {metric.hasData ? `${metric.scale5.toFixed(1)} / 5` : '— / 5'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="w-full h-1.5 rounded-sm bg-[#1C1917]/10 overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${metric.hasData ? Math.max(4, metric.score) : 0}%`,
                      backgroundColor: barColor,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span
                    className={`font-medium ${
                      concern
                        ? 'text-[#9A3412]'
                        : metric.hasData
                          ? 'text-[#1E3A5F]'
                          : 'text-[#78716C]'
                    }`}
                  >
                    {metric.status}
                  </span>
                  <span className="font-mono text-[#78716C] tabular-nums truncate">
                    {metric.deltaText}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Index Trajectory & 8-Index Side-by-Side Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 border-t border-[#1C1917]/10 pt-6">
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="text-xs text-[#78716C]">
                Selected Index Inspection · {activeMetric.polarity === 'strain' ? 'Strain Load (lower = calmer)' : 'Protective Capacity (higher = steadier)'}
              </div>
              <h3 className="font-serif text-xl font-medium text-[#1C1917]">
                {activeMetric.label}
              </h3>
            </div>
            <div className="font-mono text-sm font-medium text-[#1E3A5F] tabular-nums">
              {activeMetric.hasData ? `${activeMetric.score} / 100 · ${activeMetric.status}` : 'Awaiting logged inputs'}
            </div>
          </div>

          {series.length > 0 ? (
            <div className="border border-[#1C1917]/10 rounded-md bg-[#F4F0E8]/35 p-3 overflow-x-auto">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full min-w-[420px] h-44 block"
                role="img"
                aria-label={`${activeMetric.label} trajectory over recent check-ins`}
              >
                {[0, 25, 50, 75, 100].map((tick) => {
                  const y = yFor(tick);
                  return (
                    <g key={tick}>
                      <line
                        x1={padLeft}
                        y1={y}
                        x2={svgWidth - padRight}
                        y2={y}
                        stroke="#1C1917"
                        strokeOpacity={tick === 50 ? 0.18 : 0.08}
                        strokeDasharray={tick === 50 ? '4 4' : undefined}
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
                        {tick}
                      </text>
                    </g>
                  );
                })}

                {series.length > 1 && (
                  <polyline
                    fill="none"
                    stroke={activeStroke}
                    strokeWidth={2}
                    points={series
                      .map((pt, idx) => `${xFor(idx).toFixed(1)},${yFor(pt.score).toFixed(1)}`)
                      .join(' ')}
                  />
                )}

                {series.map((pt, idx) => (
                  <g key={pt.id}>
                    <circle
                      cx={xFor(idx)}
                      cy={yFor(pt.score)}
                      r={4}
                      fill={activeStroke}
                      stroke="#FBF9F5"
                      strokeWidth={1.5}
                    >
                      <title>{`${pt.label}: ${pt.score}/100`}</title>
                    </circle>
                    {(series.length <= 8 ||
                      idx === 0 ||
                      idx === series.length - 1 ||
                      idx % Math.ceil(series.length / 6) === 0) && (
                      <text
                        x={xFor(idx)}
                        y={svgHeight - 8}
                        textAnchor="middle"
                        fontSize="10"
                        fill="#57534E"
                        fontFamily="ui-monospace, monospace"
                      >
                        {pt.label}
                      </text>
                    )}
                  </g>
                ))}
              </svg>
            </div>
          ) : (
            <div className="border border-[#1C1917]/10 rounded-md bg-[#F4F0E8]/35 p-5 text-xs text-[#57534E] leading-relaxed">
              {activeMetric.hasData
                ? `${activeMetric.label} is currently grounded in your completed self-assessments or Relationship Graph. Log wellbeing check-ins below to plot chronological points here.`
                : `No check-ins or matching self-assessments recorded yet for ${activeMetric.label}. Log a Wellbeing Check-In below (or complete an Assessment in Records) to compute all 8 indices.`}
            </div>
          )}

          <div className="space-y-1 text-xs">
            <p className="text-[#292524] leading-relaxed">{activeMetric.interpretation}</p>
            <p className="text-[#78716C]">Grounding: {activeMetric.formulaNote}</p>
          </div>
        </div>

        {/* 8-Index Comparative Equilibrium Profile */}
        <div className="lg:col-span-5 border border-[#1C1917]/10 rounded-lg bg-[#F4F0E8]/45 p-5 space-y-3">
          <div className="flex items-baseline justify-between gap-2 border-b border-[#1C1917]/10 pb-2.5">
            <div className="text-xs font-semibold text-[#1C1917]">
              Eight-Index Comparative Profile
            </div>
            <div className="font-mono text-[11px] text-[#78716C] tabular-nums">
              {suite.sampleCount} check-ins · {suite.assessmentCount} assessments
            </div>
          </div>

          <div className="space-y-2.5">
            {suite.indices.map((item) => {
              const selected = item.key === activeMetric.key;
              const concern = isElevatedConcern(item);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSelectedKey(item.key)}
                  className={`w-full text-left space-y-1 p-1.5 rounded transition-colors ${
                    selected ? 'bg-[#FBF9F5]' : 'hover:bg-[#FBF9F5]/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className={selected ? 'font-semibold text-[#1E3A5F]' : 'text-[#292524]'}>
                      {item.label}
                    </span>
                    <span className="font-mono tabular-nums text-[#1C1917]">
                      {item.hasData ? `${item.score}/100` : '—'}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-sm bg-[#1C1917]/10 overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${item.hasData ? Math.max(3, item.score) : 0}%`,
                        backgroundColor: !item.hasData
                          ? '#78716C'
                          : item.polarity === 'strain'
                            ? concern
                              ? '#9A3412'
                              : '#B45309'
                            : concern
                              ? '#9A3412'
                              : '#1E3A5F',
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
