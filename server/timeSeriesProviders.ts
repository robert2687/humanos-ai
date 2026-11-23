export type TimeSeriesProviderId = 'timescaledb' | 'influxdb';

export type TimeSeriesBucketWindow = '1h' | '1d' | '7d';

export type TimeSeriesSource = 'wellbeing-checkin' | 'smart-watch' | 'assessment';

export interface TimeSeriesMetricPoint {
  id: string;
  timestamp: string;
  source: TimeSeriesSource;
  measurement: string;
  mood: number;
  stress: number;
  anxiety: number;
  energy: number;
  resilience: number;
  burnoutLoad: number;
  sleepHours?: number;
  sleepQuality?: number;
  assessmentScore?: number;
}

export interface TimeSeriesProviderMeta {
  id: TimeSeriesProviderId;
  name: string;
  subtitle: string;
  queryLanguage: string;
  capabilities: string[];
  defaultContainer: string;
}

export interface TimeSeriesBucketSummary {
  bucketStart: string;
  bucketLabel: string;
  sampleCount: number;
  avgMood: number;
  avgStress: number;
  avgAnxiety: number;
  avgEnergy: number;
  avgResilience: number;
  avgBurnoutLoad: number;
  avgSleepHours: number;
  avgSleepQuality: number;
  avgWellbeingIndex: number;
  peakStress: number;
}

export const TIMESERIES_PROVIDER_CATALOG: readonly TimeSeriesProviderMeta[] = [
  {
    id: 'timescaledb',
    name: 'TimescaleDB',
    subtitle:
      'PostgreSQL time-series hypertables with continuous aggregates and time_bucket() rollups.',
    queryLanguage: 'SQL · time_bucket()',
    capabilities: [
      'Hypertable Partitioning',
      'Continuous Aggregates',
      'Gapfill & Rolling Averages',
    ],
    defaultContainer: 'humanos_wellbeing_metrics',
  },
  {
    id: 'influxdb',
    name: 'InfluxDB',
    subtitle:
      'Purpose-built time-series engine storing tagged wellbeing measurements via Line Protocol.',
    queryLanguage: 'Flux / InfluxQL · aggregateWindow()',
    capabilities: [
      'Line Protocol Ingestion',
      'Tag-Indexed Measurements',
      'Sub-Second Downsampling',
    ],
    defaultContainer: 'wellbeing_metrics',
  },
];

const VALID_PROVIDER_IDS = new Set<TimeSeriesProviderId>(
  TIMESERIES_PROVIDER_CATALOG.map((p) => p.id)
);

export function normalizeTimeSeriesProvider(raw: unknown): TimeSeriesProviderId {
  const lower = String(raw || '').toLowerCase().trim() as TimeSeriesProviderId;
  if (VALID_PROVIDER_IDS.has(lower)) return lower;
  if (lower.includes('influx')) return 'influxdb';
  return 'timescaledb';
}

export function normalizeBucketWindow(raw: unknown): TimeSeriesBucketWindow {
  const clean = String(raw || '').trim();
  if (clean === '1h' || clean === '1d' || clean === '7d') return clean;
  return '1d';
}

export const MIN_RETENTION_DAYS = 30;
export const MAX_RETENTION_DAYS = 90;
export const DEFAULT_RETENTION_DAYS = 90;

export function normalizeRetentionDays(raw: unknown): number {
  const num = Number(raw);
  if (!Number.isFinite(num)) return DEFAULT_RETENTION_DAYS;
  return Math.min(MAX_RETENTION_DAYS, Math.max(MIN_RETENTION_DAYS, Math.round(num)));
}

// Session-isolated time-series stores keyed by `${sessionHash}:${provider}`
const sessionSeriesStores = new Map<string, Map<string, TimeSeriesMetricPoint>>();
const sessionRetentionDays = new Map<string, number>();

export function getSessionRetentionDays(sessionHash: string): number {
  return sessionRetentionDays.get(sessionHash) ?? DEFAULT_RETENTION_DAYS;
}

export function pruneTimeSeriesByRetention(
  sessionHash: string,
  retentionDays: number,
  provider?: TimeSeriesProviderId
): number {
  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let pruned = 0;
  const targets = provider
    ? [provider]
    : TIMESERIES_PROVIDER_CATALOG.map((p) => p.id);

  for (const target of targets) {
    const store = sessionSeriesStores.get(`${sessionHash}:${target}`);
    if (!store) continue;
    for (const [id, pt] of store.entries()) {
      const tsMs = Date.parse(pt.timestamp);
      if (Number.isFinite(tsMs) && tsMs < cutoffMs) {
        store.delete(id);
        pruned += 1;
      }
    }
  }
  return pruned;
}

export function setSessionRetentionDays(
  sessionHash: string,
  rawDays: unknown
): { retentionDays: number; prunedCount: number } {
  const retentionDays = normalizeRetentionDays(rawDays);
  sessionRetentionDays.set(sessionHash, retentionDays);
  const prunedCount = pruneTimeSeriesByRetention(sessionHash, retentionDays);
  return { retentionDays, prunedCount };
}

function getSessionSeriesStore(
  sessionHash: string,
  provider: TimeSeriesProviderId
): Map<string, TimeSeriesMetricPoint> {
  const key = `${sessionHash}:${provider}`;
  let store = sessionSeriesStores.get(key);
  if (!store) {
    store = new Map<string, TimeSeriesMetricPoint>();
    sessionSeriesStores.set(key, store);
  }
  return store;
}

function validateSafeEndpointUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl.trim());
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Configured time-series endpoint must use http or https protocol.');
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === '169.254.169.254' ||
    host === 'metadata.google.internal' ||
    host.endsWith('.internal')
  ) {
    throw new Error('Configured time-series endpoint points to a restricted metadata host.');
  }
  return parsed.origin + parsed.pathname.replace(/\/+$/, '');
}

function getProviderEnvConfig(provider: TimeSeriesProviderId): {
  cloudConfigured: boolean;
  targetContainer: string;
} {
  if (provider === 'influxdb') {
    const url = (process.env.INFLUXDB_URL || '').trim();
    const token = (process.env.INFLUXDB_TOKEN || '').trim();
    const bucket = (process.env.INFLUXDB_BUCKET || 'wellbeing_metrics').trim();
    return {
      cloudConfigured: Boolean(url && token),
      targetContainer: bucket || 'wellbeing_metrics',
    };
  }
  const restUrl = (process.env.TIMESCALE_REST_URL || '').trim();
  const apiKey = (process.env.TIMESCALE_API_KEY || '').trim();
  const table = (process.env.TIMESCALE_TABLE || 'humanos_wellbeing_metrics').trim();
  return {
    cloudConfigured: Boolean(restUrl && apiKey),
    targetContainer: table || 'humanos_wellbeing_metrics',
  };
}

export function buildTimeSeriesRetentionPreview(
  provider: TimeSeriesProviderId,
  container: string,
  retentionDays: number
): string {
  if (provider === 'influxdb') {
    const seconds = retentionDays * 86400;
    return `InfluxDB Bucket "${container}" · retentionRules: [{ type: "expire", everySeconds: ${seconds} }] (${retentionDays} days)`;
  }
  return `SELECT add_retention_policy('${container}', INTERVAL '${retentionDays} days', if_not_exists => TRUE);`;
}

export function listTimeSeriesProviderStatuses(sessionHash: string) {
  const retentionDays = getSessionRetentionDays(sessionHash);
  return TIMESERIES_PROVIDER_CATALOG.map((meta) => {
    const cfg = getProviderEnvConfig(meta.id);
    const store = getSessionSeriesStore(sessionHash, meta.id);
    const timestamps = Array.from(store.values())
      .map((p) => p.timestamp)
      .filter((ts) => Number.isFinite(Date.parse(ts)))
      .sort((a, b) => Date.parse(a) - Date.parse(b));
    return {
      ...meta,
      targetContainer: cfg.targetContainer,
      cloudConfigured: cfg.cloudConfigured,
      executionMode: cfg.cloudConfigured
        ? ('external-cloud-cluster' as const)
        : ('local-timeseries-runtime' as const),
      pointCount: store.size,
      retentionDays,
      retentionPolicyPreview: buildTimeSeriesRetentionPreview(
        meta.id,
        cfg.targetContainer,
        retentionDays
      ),
      oldestPointAt: timestamps[0] ?? null,
    };
  });
}

export function clearTimeSeriesStore(
  sessionHash: string,
  provider?: TimeSeriesProviderId
): void {
  if (provider) {
    sessionSeriesStores.delete(`${sessionHash}:${provider}`);
    return;
  }
  for (const meta of TIMESERIES_PROVIDER_CATALOG) {
    sessionSeriesStores.delete(`${sessionHash}:${meta.id}`);
  }
}

function escapeLineTag(val: string): string {
  return val.replace(/[,= \n\r]/g, '_');
}

export function formatInfluxLineProtocol(points: TimeSeriesMetricPoint[]): string {
  return points
    .map((pt) => {
      const tsMs = Number.isFinite(Date.parse(pt.timestamp))
        ? Date.parse(pt.timestamp)
        : Date.now();
      const fields = [
        `mood=${pt.mood}`,
        `stress=${pt.stress}`,
        `anxiety=${pt.anxiety}`,
        `energy=${pt.energy}`,
        `resilience=${pt.resilience}`,
        `burnout_load=${pt.burnoutLoad}`,
        `sleep_hours=${pt.sleepHours ?? 7}`,
        `sleep_quality=${pt.sleepQuality ?? 3}`,
      ];
      if (typeof pt.assessmentScore === 'number') {
        fields.push(`assessment_score=${pt.assessmentScore}`);
      }
      return `${escapeLineTag(pt.measurement || 'humanos_wellbeing')},source=${escapeLineTag(
        pt.source
      )} ${fields.join(',')} ${tsMs}`;
    })
    .join('\n');
}

async function writeToExternalInfluxDb(points: TimeSeriesMetricPoint[]): Promise<void> {
  const baseUrl = validateSafeEndpointUrl(process.env.INFLUXDB_URL || '');
  const token = (process.env.INFLUXDB_TOKEN || '').trim();
  const org = encodeURIComponent((process.env.INFLUXDB_ORG || 'humanos').trim());
  const bucket = encodeURIComponent(
    (process.env.INFLUXDB_BUCKET || 'wellbeing_metrics').trim()
  );
  const body = formatInfluxLineProtocol(points);
  const response = await fetch(
    `${baseUrl}/api/v2/write?org=${org}&bucket=${bucket}&precision=ms`,
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'text/plain; charset=utf-8',
      },
      body,
      signal: AbortSignal.timeout(8000),
    }
  );
  if (!response.ok) {
    throw new Error(`InfluxDB write failed (${response.status}).`);
  }
}

async function writeToExternalTimescaleRest(points: TimeSeriesMetricPoint[]): Promise<void> {
  const baseUrl = validateSafeEndpointUrl(process.env.TIMESCALE_REST_URL || '');
  const apiKey = (process.env.TIMESCALE_API_KEY || '').trim();
  const table = encodeURIComponent(
    (process.env.TIMESCALE_TABLE || 'humanos_wellbeing_metrics').trim()
  );
  const response = await fetch(`${baseUrl}/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(
      points.map((pt) => ({
        id: pt.id,
        time: pt.timestamp,
        source: pt.source,
        measurement: pt.measurement,
        mood: pt.mood,
        stress: pt.stress,
        anxiety: pt.anxiety,
        energy: pt.energy,
        resilience: pt.resilience,
        burnout_load: pt.burnoutLoad,
        sleep_hours: pt.sleepHours ?? 7,
        sleep_quality: pt.sleepQuality ?? 3,
        assessment_score: pt.assessmentScore ?? null,
      }))
    ),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`TimescaleDB write failed (${response.status}).`);
  }
}

function getBucketWindowMs(window: TimeSeriesBucketWindow): number {
  if (window === '1h') return 1000 * 60 * 60;
  if (window === '7d') return 1000 * 60 * 60 * 24 * 7;
  return 1000 * 60 * 60 * 24;
}

function formatBucketLabel(bucketStartIso: string, window: TimeSeriesBucketWindow): string {
  const date = new Date(bucketStartIso);
  if (window === '1h') {
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function buildTimeSeriesQueryPreview(
  provider: TimeSeriesProviderId,
  container: string,
  window: TimeSeriesBucketWindow,
  retentionDays = DEFAULT_RETENTION_DAYS
): string {
  if (provider === 'influxdb') {
    return `from(bucket: "${container}") |> range(start: -${retentionDays}d) |> filter(fn: (r) => r._measurement == "humanos_wellbeing") |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)`;
  }
  const sqlInterval = window === '1h' ? '1 hour' : window === '7d' ? '7 days' : '1 day';
  return `SELECT time_bucket('${sqlInterval}', time) AS bucket, AVG(mood) AS avg_mood, AVG(stress) AS avg_stress, AVG(sleep_hours) AS avg_sleep_hours, AVG(energy) AS avg_energy, AVG(resilience) AS avg_resilience, MAX(stress) AS peak_stress FROM ${container} WHERE time >= NOW() - INTERVAL '${retentionDays} days' GROUP BY bucket ORDER BY bucket ASC;`;
}

export async function writeTimeSeriesPoints(params: {
  sessionHash: string;
  provider: TimeSeriesProviderId;
  points: TimeSeriesMetricPoint[];
  retentionDays?: number;
}): Promise<{
  provider: TimeSeriesProviderId;
  providerName: string;
  executionMode: 'external-cloud-cluster' | 'local-timeseries-runtime';
  writtenCount: number;
  prunedCount: number;
  retentionDays: number;
  totalPoints: number;
  lineProtocolPreview: string;
}> {
  const { sessionHash, provider, points } = params;
  const retentionDays =
    params.retentionDays !== undefined
      ? normalizeRetentionDays(params.retentionDays)
      : getSessionRetentionDays(sessionHash);
  if (params.retentionDays !== undefined) {
    sessionRetentionDays.set(sessionHash, retentionDays);
  }
  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  const meta = TIMESERIES_PROVIDER_CATALOG.find((p) => p.id === provider)!;
  const cfg = getProviderEnvConfig(provider);
  const store = getSessionSeriesStore(sessionHash, provider);

  const retainedIncoming: TimeSeriesMetricPoint[] = [];
  let rejectedExpired = 0;

  for (const pt of points) {
    const tsMs = Date.parse(pt.timestamp);
    if (Number.isFinite(tsMs) && tsMs < cutoffMs) {
      rejectedExpired += 1;
      continue;
    }
    retainedIncoming.push(pt);
    store.set(pt.id, pt);
  }

  const sweptStored = pruneTimeSeriesByRetention(sessionHash, retentionDays, provider);

  if (cfg.cloudConfigured && retainedIncoming.length > 0) {
    if (provider === 'influxdb') {
      await writeToExternalInfluxDb(retainedIncoming);
    } else {
      await writeToExternalTimescaleRest(retainedIncoming);
    }
  }

  return {
    provider,
    providerName: meta.name,
    executionMode: cfg.cloudConfigured
      ? 'external-cloud-cluster'
      : 'local-timeseries-runtime',
    writtenCount: retainedIncoming.length,
    prunedCount: rejectedExpired + sweptStored,
    retentionDays,
    totalPoints: store.size,
    lineProtocolPreview: formatInfluxLineProtocol(retainedIncoming.slice(0, 2)),
  };
}

export async function queryTimeSeriesBuckets(params: {
  sessionHash: string;
  provider: TimeSeriesProviderId;
  bucketWindow?: TimeSeriesBucketWindow;
  sourceFilter?: string;
  retentionDays?: number;
}): Promise<{
  provider: TimeSeriesProviderId;
  providerName: string;
  executionMode: 'external-cloud-cluster' | 'local-timeseries-runtime';
  bucketWindow: TimeSeriesBucketWindow;
  retentionDays: number;
  prunedCount: number;
  totalPoints: number;
  queryPreview: string;
  retentionPolicyPreview: string;
  buckets: TimeSeriesBucketSummary[];
  recentPoints: TimeSeriesMetricPoint[];
}> {
  const { sessionHash, provider, sourceFilter } = params;
  const retentionDays =
    params.retentionDays !== undefined
      ? normalizeRetentionDays(params.retentionDays)
      : getSessionRetentionDays(sessionHash);
  if (params.retentionDays !== undefined) {
    sessionRetentionDays.set(sessionHash, retentionDays);
  }
  const prunedCount = pruneTimeSeriesByRetention(sessionHash, retentionDays, provider);

  const bucketWindow = normalizeBucketWindow(params.bucketWindow);
  const meta = TIMESERIES_PROVIDER_CATALOG.find((p) => p.id === provider)!;
  const cfg = getProviderEnvConfig(provider);
  const store = getSessionSeriesStore(sessionHash, provider);

  const allPoints = Array.from(store.values())
    .filter((pt) => {
      if (sourceFilter && sourceFilter !== 'all') {
        return pt.source === sourceFilter;
      }
      return true;
    })
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

  const windowMs = getBucketWindowMs(bucketWindow);
  const grouped = new Map<number, TimeSeriesMetricPoint[]>();

  for (const pt of allPoints) {
    const ms = Number.isFinite(Date.parse(pt.timestamp))
      ? Date.parse(pt.timestamp)
      : Date.now();
    const bucketKey = Math.floor(ms / windowMs) * windowMs;
    const list = grouped.get(bucketKey) || [];
    list.push(pt);
    grouped.set(bucketKey, list);
  }

  const avg = (nums: number[]) =>
    nums.length ? Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2)) : 0;

  const buckets: TimeSeriesBucketSummary[] = Array.from(grouped.entries())
    .sort(([a], [b]) => a - b)
    .map(([bucketMs, rows]) => {
      const bucketStart = new Date(bucketMs).toISOString();
      const avgMood = avg(rows.map((r) => r.mood));
      const avgStress = avg(rows.map((r) => r.stress));
      const avgAnxiety = avg(rows.map((r) => r.anxiety));
      const avgEnergy = avg(rows.map((r) => r.energy));
      const avgResilience = avg(rows.map((r) => r.resilience));
      const avgBurnoutLoad = avg(rows.map((r) => r.burnoutLoad));
      const avgSleepHours = avg(rows.map((r) => r.sleepHours ?? 7));
      const avgSleepQuality = avg(rows.map((r) => r.sleepQuality ?? 3));
      const sleepHoursScore5 = Math.min(5, Math.max(1, (avgSleepHours / 8) * 5));
      const avgWellbeingIndex = Math.round(
        (((avgMood + (6 - avgStress) + avgEnergy + avgResilience + (avgSleepQuality + sleepHoursScore5) / 2) / 5 - 1) /
          4) *
          100
      );

      return {
        bucketStart,
        bucketLabel: formatBucketLabel(bucketStart, bucketWindow),
        sampleCount: rows.length,
        avgMood,
        avgStress,
        avgAnxiety,
        avgEnergy,
        avgResilience,
        avgBurnoutLoad,
        avgSleepHours,
        avgSleepQuality,
        avgWellbeingIndex: Math.min(100, Math.max(0, avgWellbeingIndex)),
        peakStress: Number(Math.max(...rows.map((r) => r.stress)).toFixed(2)),
      };
    });

  return {
    provider,
    providerName: meta.name,
    executionMode: cfg.cloudConfigured
      ? 'external-cloud-cluster'
      : 'local-timeseries-runtime',
    bucketWindow,
    retentionDays,
    prunedCount,
    totalPoints: allPoints.length,
    queryPreview: buildTimeSeriesQueryPreview(
      provider,
      cfg.targetContainer,
      bucketWindow,
      retentionDays
    ),
    retentionPolicyPreview: buildTimeSeriesRetentionPreview(
      provider,
      cfg.targetContainer,
      retentionDays
    ),
    buckets,
    recentPoints: [...allPoints].reverse().slice(0, 12),
  };
}
