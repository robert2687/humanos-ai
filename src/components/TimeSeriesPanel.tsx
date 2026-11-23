import { useCallback, useEffect, useState } from 'react';
import { Activity, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { gatewayFetch } from '../lib/gatewayClient';
import {
  TimeSeriesBucketSummary,
  TimeSeriesBucketWindow,
  TimeSeriesMetricPoint,
  TimeSeriesProviderId,
  TimeSeriesProviderStatus,
  TimeSeriesQueryResponse,
  TimeSeriesSource,
} from '../types/humanos';

interface TimeSeriesPanelProps {
  points: TimeSeriesMetricPoint[];
  retentionDays?: number;
  onChangeRetentionDays?: (days: number) => void;
  onAfterOperation?: () => void;
}

const BUCKET_WINDOWS: { id: TimeSeriesBucketWindow; label: string }[] = [
  { id: '1h', label: '1h Bucket' },
  { id: '1d', label: '1d Bucket' },
  { id: '7d', label: '7d Bucket' },
];

const SOURCE_FILTERS: { id: 'all' | TimeSeriesSource; label: string }[] = [
  { id: 'all', label: 'All Sources' },
  { id: 'wellbeing-checkin', label: 'Wellbeing Check-ins' },
  { id: 'smart-watch', label: 'Smart Watch' },
  { id: 'assessment', label: 'Assessments' },
];

interface SeriesLineDef {
  key: keyof Pick<
    TimeSeriesBucketSummary,
    'avgMood' | 'avgStress' | 'avgSleepQuality' | 'avgEnergy' | 'avgResilience' | 'avgBurnoutLoad'
  >;
  label: string;
  stroke: string;
}

const CHART_SERIES: SeriesLineDef[] = [
  { key: 'avgMood', label: 'Avg Mood', stroke: '#1E3A5F' },
  { key: 'avgStress', label: 'Avg Stress', stroke: '#9A3412' },
  { key: 'avgSleepQuality', label: 'Avg Sleep Qual', stroke: '#475569' },
  { key: 'avgEnergy', label: 'Avg Energy', stroke: '#3F6212' },
  { key: 'avgBurnoutLoad', label: 'Avg Burnout Load', stroke: '#B45309' },
];

function TimeSeriesTrajectoryChart({
  buckets,
}: {
  buckets: TimeSeriesBucketSummary[];
}) {
  if (buckets.length === 0) return null;

  const width = 760;
  const height = 220;
  const padLeft = 36;
  const padRight = 24;
  const padTop = 18;
  const padBottom = 34;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const xForIndex = (idx: number) => {
    if (buckets.length === 1) return padLeft + plotW / 2;
    return padLeft + (idx / (buckets.length - 1)) * plotW;
  };

  const yForValue = (val: number) => {
    const clamped = Math.min(5, Math.max(1, val));
    return padTop + ((5 - clamped) / 4) * plotH;
  };

  return (
    <div className="border border-[#1C1917]/10 rounded-md bg-[#F4F0E8]/30 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs font-medium text-[#1C1917]">
          Bucketed Wellbeing Trajectory (1.0 – 5.0 Scale)
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#57534E]">
          {CHART_SERIES.map((series) => (
            <span key={series.key} className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span
                className="inline-block w-3 h-0.5"
                style={{ backgroundColor: series.stroke }}
                aria-hidden="true"
              />
              <span>{series.label}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[460px] h-48 block"
          role="img"
          aria-label="Time-series trajectory chart comparing mood, resilience, stress, and burnout load across time buckets"
        >
          {[1, 2, 3, 4, 5].map((tick) => {
            const y = yForValue(tick);
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
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

          {CHART_SERIES.map((series) => {
            const coords = buckets.map((b, idx) => ({
              x: xForIndex(idx),
              y: yForValue(b[series.key]),
              val: b[series.key],
            }));
            const pointsAttr = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');

            return (
              <g key={series.key}>
                {coords.length > 1 && (
                  <polyline
                    fill="none"
                    stroke={series.stroke}
                    strokeWidth={2}
                    points={pointsAttr}
                  />
                )}
                {coords.map((c, idx) => (
                  <circle
                    key={idx}
                    cx={c.x}
                    cy={c.y}
                    r={3.5}
                    fill={series.stroke}
                    stroke="#FBF9F5"
                    strokeWidth={1.2}
                  >
                    <title>{`${series.label}: ${c.val.toFixed(2)}`}</title>
                  </circle>
                ))}
              </g>
            );
          })}

          {buckets.map((b, idx) => {
            const showLabel =
              buckets.length <= 8 ||
              idx === 0 ||
              idx === buckets.length - 1 ||
              idx % Math.ceil(buckets.length / 6) === 0;
            if (!showLabel) return null;
            return (
              <text
                key={b.bucketStart}
                x={xForIndex(idx)}
                y={height - 10}
                textAnchor="middle"
                fontSize="10"
                fill="#57534E"
                fontFamily="ui-monospace, monospace"
              >
                {b.bucketLabel}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export function TimeSeriesPanel({
  points,
  retentionDays: propRetentionDays,
  onChangeRetentionDays,
  onAfterOperation,
}: TimeSeriesPanelProps) {
  const [providers, setProviders] = useState<TimeSeriesProviderStatus[]>([]);
  const [selectedProvider, setSelectedProvider] =
    useState<TimeSeriesProviderId>('timescaledb');
  const [bucketWindow, setBucketWindow] = useState<TimeSeriesBucketWindow>('1d');
  const [sourceFilter, setSourceFilter] = useState<'all' | TimeSeriesSource>('all');
  const [localRetentionDays, setLocalRetentionDays] = useState<number>(
    propRetentionDays ?? 90
  );
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [isUpdatingRetention, setIsUpdatingRetention] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ingestNotice, setIngestNotice] = useState<string | null>(null);
  const [lineProtocolPreview, setLineProtocolPreview] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<TimeSeriesQueryResponse | null>(null);

  const effectiveRetentionDays = propRetentionDays ?? localRetentionDays;

  useEffect(() => {
    if (typeof propRetentionDays === 'number') {
      setLocalRetentionDays(propRetentionDays);
    }
  }, [propRetentionDays]);

  const loadStatuses = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await gatewayFetch('/api/timeseries/status');
      const data = await res.json();
      if (res.ok && Array.isArray(data.providers)) {
        setProviders(data.providers);
      }
    } catch {
      // Non-blocking on initial mount
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  const activeProviderMeta = providers.find((p) => p.id === selectedProvider);

  const handleUpdateRetention = async (days: number) => {
    const clamped = Math.min(90, Math.max(30, Math.round(days)));
    setLocalRetentionDays(clamped);
    onChangeRetentionDays?.(clamped);
    setIsUpdatingRetention(true);
    setError(null);
    try {
      const res = await gatewayFetch('/api/timeseries/retention', {
        method: 'POST',
        body: JSON.stringify({ retentionDays: clamped }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not update retention policy.');
      }
      if (Array.isArray(data.providers)) {
        setProviders(data.providers);
      }
      setIngestNotice(
        `Applied ${data.retentionDays}-day retention window across TimescaleDB & InfluxDB (${data.prunedCount} expired point${data.prunedCount === 1 ? '' : 's'} pruned).`
      );
      onAfterOperation?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Retention update failed.');
    } finally {
      setIsUpdatingRetention(false);
    }
  };

  const handleIngestPoints = async () => {
    if (points.length === 0) {
      setError(
        'No wellbeing check-ins, Smart Watch pulses, or assessments available yet. Log a check-in or assessment first.'
      );
      return;
    }

    setIsIngesting(true);
    setError(null);
    setIngestNotice(null);
    try {
      const res = await gatewayFetch('/api/timeseries/ingest', {
        method: 'POST',
        body: JSON.stringify({
          provider: selectedProvider,
          retentionDays: effectiveRetentionDays,
          points,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not ingest time-series telemetry.');
      }
      if (Array.isArray(data.providers)) {
        setProviders(data.providers);
      }
      if (typeof data.lineProtocolPreview === 'string') {
        setLineProtocolPreview(data.lineProtocolPreview);
      }
      const prunedSuffix =
        typeof data.prunedCount === 'number' && data.prunedCount > 0
          ? `, ${data.prunedCount} outside ${data.retentionDays}d window skipped`
          : '';
      setIngestNotice(
        `Ingested ${data.writtenCount} metric points into ${data.providerName} (${data.totalPoints} active within ${data.retentionDays}d window${prunedSuffix}, ${data.latencyMs}ms).`
      );
      onAfterOperation?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Time-series ingestion failed.');
    } finally {
      setIsIngesting(false);
    }
  };

  const handleQueryBuckets = async () => {
    if (isQuerying) return;
    setIsQuerying(true);
    setError(null);
    try {
      const res = await gatewayFetch('/api/timeseries/query', {
        method: 'POST',
        body: JSON.stringify({
          provider: selectedProvider,
          bucketWindow,
          sourceFilter,
          retentionDays: effectiveRetentionDays,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Time-series query failed.');
      }
      setQueryResult(data as TimeSeriesQueryResponse);
      onAfterOperation?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Time-series query failed.');
    } finally {
      setIsQuerying(false);
    }
  };

  const handleClearProvider = async () => {
    setError(null);
    setIngestNotice(null);
    setLineProtocolPreview(null);
    try {
      const res = await gatewayFetch(
        `/api/timeseries/clear?provider=${selectedProvider}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (res.ok && Array.isArray(data.providers)) {
        setProviders(data.providers);
      }
      setQueryResult(null);
    } catch {
      // Ignore cleanup errors gracefully
    }
  };

  return (
    <section className="border border-[#1C1917]/12 rounded-lg bg-[#FBF9F5] p-6 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1C1917]/10 pb-5">
        <div className="space-y-1.5 max-w-2xl">
          <div className="text-xs font-medium text-[#1E3A5F]">
            Wellbeing Telemetry · Time-Series Persistence & Downsampling
          </div>
          <h2 className="font-serif text-2xl font-medium text-[#1C1917]">
            TimescaleDB & InfluxDB
          </h2>
          <p className="text-xs sm:text-sm text-[#57534E] leading-relaxed">
            Streams wellbeing check-ins, Smart Watch micro-pulses, and assessment baselines into time-series hypertables or buckets for continuous rollups across 1-hour, daily, and 7-day windows.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadStatuses}
            disabled={loadingStatus}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#1C1917]/20 rounded-md hover:bg-[#EBE6DF] whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleIngestPoints}
            disabled={isIngesting || points.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49] disabled:opacity-45 whitespace-nowrap"
          >
            {isIngesting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Ingesting ({points.length})...</span>
              </>
            ) : (
              <>
                <Activity className="w-3.5 h-3.5" />
                <span className="tabular-nums">Ingest {points.length} Points</span>
              </>
            )}
          </button>

          {(activeProviderMeta?.pointCount ?? 0) > 0 && (
            <button
              type="button"
              onClick={handleClearProvider}
              aria-label="Clear time-series store"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-[#78716C] hover:text-[#9A3412] whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* 2 Time-Series Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {providers.map((provider) => {
          const active = selectedProvider === provider.id;
          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => {
                setSelectedProvider(provider.id);
                setQueryResult(null);
              }}
              className={`text-left p-5 rounded-lg border transition-colors flex flex-col justify-between space-y-3 ${
                active
                  ? 'border-[#1E3A5F] bg-[#F4F0E8]/85'
                  : 'border-[#1C1917]/12 bg-[#F4F0E8]/35 hover:bg-[#F4F0E8]/65'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-serif text-lg font-medium text-[#1C1917]">
                    {provider.name}
                  </span>
                  <span className="font-mono text-xs text-[#1E3A5F] tabular-nums shrink-0">
                    {provider.pointCount} pts
                  </span>
                </div>
                <p className="text-xs text-[#57534E] leading-relaxed">{provider.subtitle}</p>
              </div>

              <div className="border-t border-[#1C1917]/10 pt-2.5 space-y-1 text-[11px] text-[#78716C]">
                <div className="font-mono truncate text-[#1C1917]">
                  {provider.queryLanguage}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">Target: {provider.targetContainer}</span>
                  <span className="font-medium text-[#1E3A5F] whitespace-nowrap">
                    {provider.cloudConfigured ? 'Cloud Live' : 'Local Runtime'}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-md border border-[#9A3412]/25 bg-[#FDF4F2] text-xs sm:text-sm text-[#9A3412]"
        >
          {error}
        </div>
      )}

      {ingestNotice && (
        <div className="p-3.5 rounded-md border border-[#1E3A5F]/20 bg-[#F4F0E8]/60 text-xs sm:text-sm text-[#1E3A5F] space-y-2">
          <div>{ingestNotice}</div>
          {lineProtocolPreview && selectedProvider === 'influxdb' && (
            <pre className="p-2.5 rounded bg-[#FBF9F5] border border-[#1C1917]/10 font-mono text-[11px] text-[#292524] overflow-x-auto">
              {lineProtocolPreview}
            </pre>
          )}
        </div>
      )}

      {/* Retention Policy & Query Controls */}
      <div className="space-y-4 border-t border-[#1C1917]/10 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#1C1917]/10">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-[#1C1917]">
              Retention Window (30–90 days):
            </span>
            <div className="flex items-center gap-1">
              {[30, 60, 90].map((days) => {
                const active = effectiveRetentionDays === days;
                return (
                  <button
                    key={days}
                    type="button"
                    disabled={isUpdatingRetention}
                    onClick={() => handleUpdateRetention(days)}
                    className={`px-2.5 py-1 text-xs font-mono font-medium rounded-md transition-colors whitespace-nowrap tabular-nums ${
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
            <input
              type="range"
              min={30}
              max={90}
              step={5}
              value={effectiveRetentionDays}
              disabled={isUpdatingRetention}
              onChange={(e) => setLocalRetentionDays(Number(e.target.value))}
              onMouseUp={() => handleUpdateRetention(localRetentionDays)}
              onTouchEnd={() => handleUpdateRetention(localRetentionDays)}
              aria-label="Retention policy days"
              className="w-28 accent-[#1E3A5F] cursor-pointer"
            />
            <span className="font-mono text-xs text-[#1E3A5F] tabular-nums">
              {effectiveRetentionDays} days
            </span>
          </div>

          {activeProviderMeta?.retentionPolicyPreview && (
            <span className="font-mono text-[11px] text-[#78716C] truncate max-w-xl">
              {activeProviderMeta.retentionPolicyPreview}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-[#57534E]">Window:</span>
            {BUCKET_WINDOWS.map((win) => {
              const active = bucketWindow === win.id;
              return (
                <button
                  key={win.id}
                  type="button"
                  onClick={() => setBucketWindow(win.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#1E3A5F] text-[#FBF9F5]'
                      : 'bg-[#F4F0E8] text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  {win.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-[#57534E]">Source:</span>
            {SOURCE_FILTERS.map((src) => {
              const active = sourceFilter === src.id;
              return (
                <button
                  key={src.id}
                  type="button"
                  onClick={() => setSourceFilter(src.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#1E3A5F] text-[#FBF9F5]'
                      : 'bg-[#F4F0E8] text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  {src.label}
                </button>
              );
            })}

            <button
              type="button"
              onClick={handleQueryBuckets}
              disabled={isQuerying}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49] disabled:opacity-45 whitespace-nowrap ml-2"
            >
              {isQuerying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Querying...</span>
                </>
              ) : (
                <span>Run Bucket Query</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Aggregated Time-Series Results */}
      {queryResult && (
        <div className="space-y-4 border-t border-[#1C1917]/10 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#78716C] font-mono tabular-nums">
            <span>
              {queryResult.providerName} · {queryResult.totalPoints} points across{' '}
              {queryResult.buckets.length} bucket
              {queryResult.buckets.length === 1 ? '' : 's'} ({queryResult.bucketWindow})
            </span>
            <span>
              {queryResult.executionMode === 'external-cloud-cluster'
                ? 'External Cloud'
                : 'Local Time-Series Runtime'}{' '}
              · {queryResult.latencyMs}ms
            </span>
          </div>

          <pre className="p-3 rounded-md bg-[#F4F0E8]/70 border border-[#1C1917]/10 font-mono text-[11px] text-[#292524] overflow-x-auto">
            {queryResult.queryPreview}
          </pre>

          {queryResult.buckets.length === 0 ? (
            <div className="p-4 rounded-md bg-[#F4F0E8]/45 text-xs text-[#57534E]">
              No metric points stored in {queryResult.providerName} for this filter yet. Click Ingest {points.length} Points above first.
            </div>
          ) : (
            <>
              <TimeSeriesTrajectoryChart buckets={queryResult.buckets} />

              <div className="border border-[#1C1917]/10 rounded-md bg-[#FBF9F5] overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#1C1917]/10 text-[#78716C] bg-[#F4F0E8]/50">
                      <th className="py-2.5 px-3 font-medium">Window</th>
                      <th className="py-2.5 px-2 font-medium text-right">Samples</th>
                      <th className="py-2.5 px-2 font-medium text-right">Mood</th>
                      <th className="py-2.5 px-2 font-medium text-right">Stress</th>
                      <th className="py-2.5 px-2 font-medium text-right">Sleep</th>
                      <th className="py-2.5 px-2 font-medium text-right">Energy</th>
                      <th className="py-2.5 px-2 font-medium text-right">Resil</th>
                      <th className="py-2.5 px-2 font-medium text-right">Burnout</th>
                      <th className="py-2.5 px-2 font-medium text-right">Peak Str</th>
                      <th className="py-2.5 px-3 font-medium text-right">Wellbeing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1C1917]/10 font-mono tabular-nums">
                    {queryResult.buckets.map((bucket) => (
                      <tr key={bucket.bucketStart} className="hover:bg-[#F4F0E8]/35">
                        <td className="py-2.5 px-3 text-[#1C1917] whitespace-nowrap">
                          {bucket.bucketLabel}
                        </td>
                        <td className="py-2.5 px-2 text-right text-[#57534E]">
                          {bucket.sampleCount}
                        </td>
                        <td className="py-2.5 px-2 text-right text-[#1E3A5F]">
                          {bucket.avgMood.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-2 text-right text-[#9A3412]">
                          {bucket.avgStress.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-2 text-right text-[#475569] whitespace-nowrap">
                          {(bucket.avgSleepHours ?? 7).toFixed(1)}h · {(bucket.avgSleepQuality ?? 3).toFixed(1)}
                        </td>
                        <td className="py-2.5 px-2 text-right text-[#3F6212]">
                          {bucket.avgEnergy.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-2 text-right text-[#57534E]">
                          {bucket.avgResilience.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-2 text-right text-[#B45309]">
                          {bucket.avgBurnoutLoad.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-2 text-right text-[#9A3412] font-semibold">
                          {bucket.peakStress.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#1E3A5F] font-semibold">
                          {bucket.avgWellbeingIndex ?? 50}/100
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
