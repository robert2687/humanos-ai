import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Compass, Loader2, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import {
  AuditEntry,
  ClientSurface,
  gatewayFetch,
  GatewaySessionInfo,
  issueNewGatewaySession,
  RateLimitInfo,
} from '../lib/gatewayClient';
import {
  SocialPlatform,
  TimeSeriesMetricPoint,
  VectorRecordDocument,
  WellbeingCheckIn,
} from '../types/humanos';
import { VectorSearchPanel } from './VectorSearchPanel';
import { TimeSeriesPanel } from './TimeSeriesPanel';

interface PhilosophyViewProps {
  vectorDocuments: VectorRecordDocument[];
  timeSeriesPoints: TimeSeriesMetricPoint[];
  retentionDays: number;
  onChangeRetentionDays: (days: number) => void;
  onStartDialogue: () => void;
  onOpenEventLab: () => void;
  onSyncWatchPulse: (input: Omit<WellbeingCheckIn, 'id' | 'createdAt'>) => void;
}

const CORE_PRINCIPLES = [
  { index: '01', title: 'Insight before advice', detail: 'Understanding why a reaction happens creates deeper change than rushed prescriptions.' },
  { index: '02', title: 'Understanding before solutions', detail: 'Trace the emotion, unmet need, and thought pattern before deciding what to fix.' },
  { index: '03', title: 'Curiosity before judgment', detail: 'Every behavior carries a history or protective purpose—never shame human complexity.' },
  { index: '04', title: 'Empathy before correction', detail: 'Emotional safety allows honest self-examination where rigid criticism shuts it down.' },
  { index: '05', title: 'Reflection before action', detail: 'Pause between trigger and response—especially in conflict or heated digital communication.' },
  { index: '06', title: 'Growth before dependency', detail: 'HUMANOS exists to strengthen your own judgment, never to replace your agency.' },
  { index: '07', title: 'Safety above all', detail: 'Crisis or self-harm distress immediately prioritizes stabilization and real human support.' },
  { index: '08', title: 'Scientific integrity', detail: 'Never pretend certainty where uncertainty exists; hold all interpretations probabilistically.' },
];

const KNOWLEDGE_DISCIPLINES = [
  { name: 'Cognitive Behavioral Therapy (CBT)', focus: 'Identifying cognitive distortions such as catastrophizing, personalization, overgeneralization, emotional reasoning, and mind reading.' },
  { name: 'Acceptance & Commitment (ACT)', focus: 'Psychological flexibility and choosing actions aligned with personal values rather than avoidance.' },
  { name: 'Dialectical Behavior (DBT)', focus: 'Emotional regulation, distress tolerance, and constructive interpersonal requests.' },
  { name: 'Positive Psychology', focus: 'Cultivating character strengths, resilience, meaning, and sustainable wellbeing.' },
  { name: 'Behavioral Science', focus: 'Mapping Trigger → Thought → Emotion → Behavior → Outcome cycles without blame.' },
  { name: 'Emotional Intelligence', focus: 'Reading feelings as signals pointing toward unmet human needs and boundaries.' },
  { name: 'Attachment Theory', focus: 'Understanding relational expectations, closeness, distance, and security dynamics.' },
  { name: 'Motivational Psychology', focus: 'Clarifying intrinsic values, purpose discovery, and realistic change over perfection.' },
  { name: 'Conflict Resolution', focus: 'Separating observable facts from interpretations to make both perspectives visible.' },
  { name: 'Wellbeing Research', focus: 'Monitoring observable energy, mood, stress, connection, and self-worth trajectories.' },
];

const EMOTION_MAP = [
  {
    emotion: 'Anger',
    protects: 'Boundaries, fairness, and respect',
    detail: 'Signals that a personal boundary, value, or sense of fairness may feel crossed.',
  },
  {
    emotion: 'Anxiety',
    protects: 'Safety, predictability, and preparedness',
    detail: 'Signals perceived uncertainty or threat, urging preparation or reassurance.',
  },
  {
    emotion: 'Sadness',
    protects: 'Attachment, meaning, and care',
    detail: 'Reflects loss, disappointment, or unmet relational and attachment needs.',
  },
];

const FRONTEND_SURFACES: { id: ClientSurface; name: string; role: string }[] = [
  { id: 'web', name: 'Web Application', role: 'Primary reflective workspace and Digital Twin atlas' },
  { id: 'ios', name: 'Mobile App (iOS / Android)', role: 'On-the-go voice/text check-ins and crisis grounding' },
  { id: 'desktop', name: 'Desktop Application', role: 'Distraction-free long-form journaling and timeline review' },
  { id: 'extension', name: 'Browser Extension', role: 'Pre-send Digital Pause & Toxicity Detector overlay' },
  { id: 'watch', name: 'Smart Watch Integration', role: 'Micro-pulse stress, mood, and paced breathing sync' },
];

const GATEWAY_MODULES = [
  { name: 'Authentication', detail: 'HMAC-SHA256 signed session tokens bound to client surface' },
  { name: 'Authorization', detail: 'Bearer verification middleware protecting all orchestration routes' },
  { name: 'Rate Limiting', detail: 'Sliding-window 5-minute request quota with X-RateLimit headers' },
  { name: 'Session Management', detail: 'Surface-aware session issuance, inspection, and revocation' },
  { name: 'Audit & Compliance', detail: 'Privacy-redacted metadata ledger with zero raw prose stored' },
];

const ORCHESTRATION_MODULES = [
  { name: 'Agent Router', detail: 'Dispatches across Crisis, Conflict, Cognitive, Toxicity, and Layer 4 Human Digital Twin agents' },
  { name: 'Context Manager', detail: 'Assembles bounded conversation, Event Lab, and wellbeing context (Layer 1 active signals)' },
  { name: 'Memory Engine', detail: 'Organizes Layer 2 (Values, Triggers, Strengths, Recurring Concerns), Layer 3 (Career Changes, Losses, Relationships, Achievements, Traumatic Events), and Layer 4 Human Digital Twin—backed by vector indexing (Azure AI Search, Weaviate, Qdrant, Pinecone) and 30–90d time-series telemetry (TimescaleDB, InfluxDB)' },
  { name: 'Safety Engine', detail: 'Pre-flight and post-flight screening for self-harm risk, suicide indicators, severe depression, panic attacks, and emotional collapse' },
  { name: 'Prompt Orchestrator', detail: 'Composes Knowledge Core + Charter + structured Gemini schemas' },
];

export function PhilosophyView({
  vectorDocuments,
  timeSeriesPoints,
  retentionDays,
  onChangeRetentionDays,
  onStartDialogue,
  onOpenEventLab,
  onSyncWatchPulse,
}: PhilosophyViewProps) {
  const [section, setSection] = useState<'charter' | 'architecture'>('charter');
  const [imgFailed, setImgFailed] = useState(false);

  // Live Gateway & Audit State
  const [sessionInfo, setSessionInfo] = useState<GatewaySessionInfo | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loadingGateway, setLoadingGateway] = useState(false);
  const [gatewayError, setGatewayError] = useState<string | null>(null);

  // Companion Surface Test: Browser Extension Pause Check
  const SOCIAL_PLATFORMS: SocialPlatform[] = [
    'Facebook',
    'Instagram',
    'Reddit',
    'Discord',
    'LinkedIn',
    'X/Twitter',
  ];
  const [extPlatform, setExtPlatform] = useState<SocialPlatform>('X/Twitter');
  const [extContext, setExtContext] = useState('');
  const [extDraft, setExtDraft] = useState('');
  const [extLoading, setExtLoading] = useState(false);
  const [extResult, setExtResult] = useState<{
    platform?: string;
    actualIssue: string;
    emotionalTrigger: string;
    likelyOutcome: string;
    healthierAlternative: string;
    escalationRisk: string;
  } | null>(null);

  // Companion Surface Test: Smart Watch Micro-Pulse
  const [watchMood, setWatchMood] = useState(3);
  const [watchStress, setWatchStress] = useState(3);
  const [watchEnergy, setWatchEnergy] = useState(3);
  const [watchSleepHours, setWatchSleepHours] = useState(7);
  const [watchSleepQuality, setWatchSleepQuality] = useState(3);
  const [watchNote, setWatchNote] = useState<string | null>(null);

  const loadGatewayAudit = useCallback(async () => {
    setLoadingGateway(true);
    setGatewayError(null);
    try {
      const [sessRes, auditRes] = await Promise.all([
        gatewayFetch('/api/gateway/session'),
        gatewayFetch('/api/gateway/audit'),
      ]);
      const sessData = await sessRes.json();
      const auditData = await auditRes.json();
      if (!sessRes.ok) throw new Error(sessData.error || 'Could not inspect gateway session.');
      if (!auditRes.ok) throw new Error(auditData.error || 'Could not fetch audit ledger.');
      setSessionInfo(sessData.session);
      setRateLimit(sessData.rateLimit);
      setAuditEntries(Array.isArray(auditData.entries) ? auditData.entries : []);
    } catch (err: unknown) {
      setGatewayError(err instanceof Error ? err.message : 'Unable to reach Gateway.');
    } finally {
      setLoadingGateway(false);
    }
  }, []);

  useEffect(() => {
    if (section === 'architecture') {
      loadGatewayAudit();
    }
  }, [section, loadGatewayAudit]);

  const handleRotateSession = async (surface: ClientSurface = 'web') => {
    setLoadingGateway(true);
    setGatewayError(null);
    try {
      const issued = await issueNewGatewaySession(surface);
      setSessionInfo(issued.session);
      setRateLimit(issued.rateLimit);
      await loadGatewayAudit();
    } catch (err: unknown) {
      setGatewayError(err instanceof Error ? err.message : 'Session rotation failed.');
      setLoadingGateway(false);
    }
  };

  const handleClearAudit = async () => {
    try {
      await gatewayFetch('/api/gateway/audit', { method: 'DELETE' });
      setAuditEntries([]);
    } catch {
      // Ignore error gracefully
    }
  };

  const handleRunExtensionCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extDraft.trim() || extLoading) return;
    setExtLoading(true);
    setGatewayError(null);
    try {
      const res = await gatewayFetch(
        '/api/extension/pause-check',
        {
          method: 'POST',
          body: JSON.stringify({
            platform: extPlatform,
            contextPost: extContext.trim(),
            draftReply: extDraft.trim(),
          }),
        },
        'extension'
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Extension pause check failed.');
      setExtResult(data);
      await loadGatewayAudit();
    } catch (err: unknown) {
      setGatewayError(err instanceof Error ? err.message : 'Extension pause check failed.');
    } finally {
      setExtLoading(false);
    }
  };

  const handleSyncWatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setGatewayError(null);
    try {
      const res = await gatewayFetch(
        '/api/watch/pulse',
        {
          method: 'POST',
          body: JSON.stringify({
            moodPulse: watchMood,
            restingStress: watchStress,
            energy: watchEnergy,
            sleepHours: watchSleepHours,
            sleepQuality: watchSleepQuality,
            breathingMinutes: 2,
          }),
        },
        'watch'
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Watch sync failed.');

      onSyncWatchPulse({
        mood: data.pulse.mood,
        stress: data.pulse.stress,
        anxiety: Math.min(5, Math.max(1, watchStress)),
        socialConnection: 3,
        selfEsteem: 3,
        motivation: data.pulse.energy,
        energy: data.pulse.energy,
        lifeSatisfaction: data.pulse.mood,
        sleepHours: data.pulse.sleepHours,
        sleepQuality: data.pulse.sleepQuality,
        note: 'Synced from Smart Watch micro-pulse',
      });
      setWatchNote(data.guidance);
      await loadGatewayAudit();
    } catch (err: unknown) {
      setGatewayError(err instanceof Error ? err.message : 'Watch sync failed.');
    }
  };

  return (
    <div className="max-w-[1260px] mx-auto px-4 sm:px-8 py-10 space-y-10">
      {/* Sub-navigation Switch */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1C1917]/10 pb-5">
        <div className="flex items-center gap-1 p-1 bg-[#F4F0E8] border border-[#1C1917]/10 rounded-lg">
          <button
            type="button"
            onClick={() => setSection('charter')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              section === 'charter'
                ? 'bg-[#FBF9F5] text-[#1C1917] shadow-xs border border-[#1C1917]/10'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            Charter & Knowledge Core
          </button>
          <button
            type="button"
            onClick={() => setSection('architecture')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              section === 'architecture'
                ? 'bg-[#FBF9F5] text-[#1C1917] shadow-xs border border-[#1C1917]/10'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            System Architecture & Gateway
          </button>
        </div>

        <span className="text-xs text-[#78716C]">
          Non-diagnostic · Privacy-preserving · Local Twin + Gateway Orchestration
        </span>
      </div>

      {section === 'charter' ? (
        <div className="space-y-14">
          {/* Editorial Hero */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch border-b border-[#1C1917]/10 pb-12">
            <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <p className="text-xs font-medium text-[#1E3A5F]">
                  Human Intelligence & Wellbeing Operating Charter
                </p>
                <h1 className="font-serif text-3xl sm:text-5xl font-medium tracking-tight text-[#1C1917] leading-[1.12] [text-wrap:balance]">
                  Become your own clearest, steadiest guide
                </h1>
                <p className="text-base leading-relaxed text-[#57534E]">
                  HUMANOS AI synthesizes evidence-informed behavioral science, emotional intelligence, and structured self-reflection. It does not diagnose, judge, or claim clinical authority—it helps you understand yourself so you can act with maturity and agency.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onStartDialogue}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49] transition-colors whitespace-nowrap"
                >
                  <span>Enter Reflective Dialogue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onOpenEventLab}
                  className="px-5 py-2.5 text-sm font-medium border border-[#1C1917]/20 text-[#1C1917] rounded-md hover:bg-[#EBE6DF] transition-colors whitespace-nowrap"
                >
                  Open Event Lab
                </button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[260px] rounded-lg overflow-hidden border border-[#1C1917]/10 bg-[#EBE6DF]">
                {imgFailed ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center space-y-2 bg-[#F4F0E8]">
                    <Compass className="w-8 h-8 text-[#1E3A5F]" />
                    <div className="font-serif text-lg text-[#1C1917]">Quiet Contemplation</div>
                  </div>
                ) : (
                  <img
                    src="/src/assets/images/editorial_contemplation_study_1795164449478.jpg"
                    alt="Warm morning light passing through linen drapery onto natural limestone in a calm contemplative room"
                    referrerPolicy="no-referrer"
                    onError={() => setImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            </div>
          </section>

          {/* Eight Core Principles */}
          <section className="space-y-6">
            <div className="max-w-2xl space-y-2">
              <h2 className="font-serif text-2xl sm:text-3xl font-medium text-[#1C1917]">
                Eight Operating Principles
              </h2>
              <p className="text-sm text-[#57534E]">
                Every conversation, behavioral map, and wellbeing trend inside HUMANOS is governed by these commitments.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {CORE_PRINCIPLES.map((pillar) => (
                <div
                  key={pillar.index}
                  className="border border-[#1C1917]/10 rounded-lg bg-[#F4F0E8]/45 p-5 space-y-2"
                >
                  <div className="font-mono text-xs text-[#1E3A5F] tabular-nums">
                    {pillar.index}.
                  </div>
                  <h3 className="font-serif text-lg font-medium text-[#1C1917]">
                    {pillar.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-[#57534E]">
                    {pillar.detail}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Knowledge Core */}
          <section className="space-y-6 border-t border-[#1C1917]/10 pt-10">
            <div className="max-w-2xl space-y-2">
              <h2 className="font-serif text-2xl sm:text-3xl font-medium text-[#1C1917]">
                Evidence-Informed Knowledge Core
              </h2>
              <p className="text-sm text-[#57534E]">
                Ten psychological and behavioral disciplines inform HUMANOS reflection lenses, without ever substituting for licensed care.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 divide-y divide-[#1C1917]/10 border-t border-b border-[#1C1917]/10">
              {KNOWLEDGE_DISCIPLINES.map((item) => (
                <div key={item.name} className="py-3.5 space-y-1">
                  <div className="text-sm font-semibold text-[#1C1917]">{item.name}</div>
                  <p className="text-xs leading-relaxed text-[#57534E]">{item.focus}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Emotion Mapping & Ethics Guardian */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 border-t border-[#1C1917]/10 pt-10">
            <div className="lg:col-span-7 space-y-4">
              <h2 className="font-serif text-2xl font-medium text-[#1C1917]">
                Emotion Mapping: Reading Emotional Signals
              </h2>
              <div className="divide-y divide-[#1C1917]/10 border-t border-b border-[#1C1917]/10">
                {EMOTION_MAP.map((item) => (
                  <div key={item.emotion} className="py-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <div className="text-sm font-semibold text-[#1C1917]">{item.emotion}</div>
                      <div className="text-xs text-[#1E3A5F]">{item.protects}</div>
                    </div>
                    <p className="sm:col-span-2 text-sm text-[#57534E] leading-relaxed">
                      {item.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 border border-[#1C1917]/12 rounded-lg bg-[#F4F0E8]/60 p-6 space-y-4 self-start">
              <h2 className="font-serif text-xl font-medium text-[#1C1917]">
                Ethics & Trust Commitments
              </h2>
              <ul className="space-y-3 text-sm text-[#292524] leading-relaxed">
                <li>HUMANOS is not a therapist, psychiatrist, or medical doctor, and never diagnoses disorders.</li>
                <li>It never claims human emotions, consciousness, or professional licensure.</li>
                <li>It never reinforces self-harm, hostility, or emotional dependency.</li>
                <li>All personality insights remain probabilistic (“may”, “might”, “appears”) and open to your revision.</li>
              </ul>
            </div>
          </section>
        </div>
      ) : (
        /* SYSTEM ARCHITECTURE & GATEWAY SECTION */
        <div className="space-y-10">
          <section className="max-w-3xl space-y-2">
            <p className="text-xs font-medium text-[#1E3A5F]">
              Three-Tier Platform Infrastructure
            </p>
            <h1 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-[#1C1917] [text-wrap:balance]">
              Frontend Surfaces, API Gateway & AI Orchestration
            </h1>
            <p className="text-sm sm:text-base text-[#57534E] leading-relaxed">
              Every request from any client surface flows through HMAC-SHA256 session authentication, sliding-window rate limiting, privacy-safe audit logging, and pre-flight Safety & Agent Routing before reaching the model.
            </p>
          </section>

          {/* 3-Tier Architectural Blueprint */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="border border-[#1C1917]/12 rounded-lg bg-[#F4F0E8]/50 p-6 space-y-4">
              <div className="border-b border-[#1C1917]/10 pb-3">
                <div className="font-mono text-xs text-[#1E3A5F]">01. Layer</div>
                <h2 className="font-serif text-xl font-medium text-[#1C1917]">Frontend Apps</h2>
              </div>
              <div className="divide-y divide-[#1C1917]/10">
                {FRONTEND_SURFACES.map((surf) => (
                  <div key={surf.id} className="py-2.5 space-y-0.5">
                    <div className="text-sm font-semibold text-[#1C1917]">{surf.name}</div>
                    <p className="text-xs text-[#57534E]">{surf.role}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-[#1C1917]/12 rounded-lg bg-[#F4F0E8]/50 p-6 space-y-4">
              <div className="border-b border-[#1C1917]/10 pb-3">
                <div className="font-mono text-xs text-[#1E3A5F]">02. Layer</div>
                <h2 className="font-serif text-xl font-medium text-[#1C1917]">API Gateway Layer</h2>
              </div>
              <div className="divide-y divide-[#1C1917]/10">
                {GATEWAY_MODULES.map((mod) => (
                  <div key={mod.name} className="py-2.5 space-y-0.5">
                    <div className="text-sm font-semibold text-[#1C1917]">{mod.name}</div>
                    <p className="text-xs text-[#57534E]">{mod.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-[#1C1917]/12 rounded-lg bg-[#F4F0E8]/50 p-6 space-y-4">
              <div className="border-b border-[#1C1917]/10 pb-3">
                <div className="font-mono text-xs text-[#1E3A5F]">03. Layer</div>
                <h2 className="font-serif text-xl font-medium text-[#1C1917]">AI Orchestration Layer</h2>
              </div>
              <div className="divide-y divide-[#1C1917]/10">
                {ORCHESTRATION_MODULES.map((mod) => (
                  <div key={mod.name} className="py-2.5 space-y-0.5">
                    <div className="text-sm font-semibold text-[#1C1917]">{mod.name}</div>
                    <p className="text-xs text-[#57534E]">{mod.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {gatewayError && (
            <div
              role="alert"
              className="p-4 rounded-lg border border-[#9A3412]/25 bg-[#FDF4F2] text-sm text-[#9A3412]"
            >
              {gatewayError}
            </div>
          )}

          {/* Live Session & Rate Limit Inspector */}
          <section className="border border-[#1C1917]/12 rounded-lg bg-[#FBF9F5] p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1C1917]/10 pb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#1E3A5F]" />
                <h2 className="font-serif text-xl font-medium text-[#1C1917]">
                  Active Gateway Session & Rate Quota
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadGatewayAudit}
                  disabled={loadingGateway}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#1C1917]/20 rounded-md hover:bg-[#EBE6DF]"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingGateway ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRotateSession('web')}
                  disabled={loadingGateway}
                  className="px-3 py-1.5 text-xs font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49]"
                >
                  Rotate Signed Token
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm">
              <div className="p-3.5 rounded-md bg-[#F4F0E8]/55 border border-[#1C1917]/10 space-y-1">
                <div className="text-xs text-[#78716C]">Session Hash</div>
                <div className="font-mono text-sm font-medium text-[#1C1917] tabular-nums">
                  {sessionInfo?.idHash || '—'}
                </div>
              </div>
              <div className="p-3.5 rounded-md bg-[#F4F0E8]/55 border border-[#1C1917]/10 space-y-1">
                <div className="text-xs text-[#78716C]">Client Surface</div>
                <div className="font-mono text-sm font-medium text-[#1C1917] uppercase">
                  {sessionInfo?.surface || 'web'}
                </div>
              </div>
              <div className="p-3.5 rounded-md bg-[#F4F0E8]/55 border border-[#1C1917]/10 space-y-1">
                <div className="text-xs text-[#78716C]">5-Min AI Quota Remaining</div>
                <div className="font-mono text-sm font-medium text-[#1E3A5F] tabular-nums">
                  {rateLimit ? `${rateLimit.remaining} / ${rateLimit.limit}` : '—'}
                </div>
              </div>
              <div className="p-3.5 rounded-md bg-[#F4F0E8]/55 border border-[#1C1917]/10 space-y-1">
                <div className="text-xs text-[#78716C]">Authenticated Requests</div>
                <div className="font-mono text-sm font-medium text-[#1C1917] tabular-nums">
                  {sessionInfo?.requestCount ?? 0}
                </div>
              </div>
            </div>
          </section>

          {/* Companion Surface Endpoints: Browser Extension & Smart Watch */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <form
              onSubmit={handleRunExtensionCheck}
              className="lg:col-span-7 border border-[#1C1917]/12 rounded-lg bg-[#F4F0E8]/50 p-6 space-y-4"
            >
              <div className="space-y-1">
                <div className="text-xs font-mono text-[#1E3A5F]">POST /api/extension/pause-check</div>
                <h3 className="font-serif text-xl font-medium text-[#1C1917]">
                  Browser Extension · Digital Pause Endpoint
                </h3>
                <p className="text-xs text-[#57534E]">
                  Simulates the Browser Extension surface inspecting a heated reply across Facebook, Instagram, Reddit, Discord, LinkedIn, or X/Twitter before posting.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SOCIAL_PLATFORMS.map((plat) => {
                  const active = extPlatform === plat;
                  return (
                    <button
                      key={plat}
                      type="button"
                      onClick={() => setExtPlatform(plat)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-[#1E3A5F] text-[#FBF9F5]'
                          : 'bg-[#FBF9F5] text-[#57534E] border border-[#1C1917]/12 hover:text-[#1C1917]'
                      }`}
                    >
                      {plat}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                value={extContext}
                onChange={(e) => setExtContext(e.target.value)}
                placeholder="Optional post/comment you are replying to..."
                className="w-full px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] focus:outline-none focus:border-[#1E3A5F]"
              />
              <textarea
                value={extDraft}
                onChange={(e) => setExtDraft(e.target.value)}
                rows={2}
                placeholder="Draft reply to check before sending..."
                className="w-full px-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] focus:outline-none focus:border-[#1E3A5F]"
              />
              <button
                type="submit"
                disabled={extLoading || extDraft.trim().length < 4}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49] disabled:opacity-45"
              >
                {extLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Run Extension Check</span>
              </button>

              {extResult && (
                <div className="border-t border-[#1C1917]/10 pt-4 space-y-2 text-xs">
                  {extResult.platform && (
                    <div>
                      <span className="font-semibold text-[#1C1917]">Platform: </span>
                      <span className="text-[#57534E]">{extResult.platform}</span>
                    </div>
                  )}
                  <div>
                    <span className="font-semibold text-[#1C1917]">Escalation Risk: </span>
                    <span className="font-medium text-[#9A3412]">{extResult.escalationRisk}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-[#1C1917]">Emotional Trigger: </span>
                    <span className="text-[#292524]">{extResult.emotionalTrigger}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-[#1E3A5F]">Healthier Alternative: </span>
                    <span className="text-[#1C1917]">{extResult.healthierAlternative}</span>
                  </div>
                </div>
              )}
            </form>

            <form
              onSubmit={handleSyncWatch}
              className="lg:col-span-5 border border-[#1C1917]/12 rounded-lg bg-[#F4F0E8]/50 p-6 space-y-4"
            >
              <div className="space-y-1">
                <div className="text-xs font-mono text-[#1E3A5F]">POST /api/watch/pulse</div>
                <h3 className="font-serif text-xl font-medium text-[#1C1917]">
                  Smart Watch · Micro-Pulse Sync
                </h3>
                <p className="text-xs text-[#57534E]">
                  Syncs lightweight wearable stress, mood, and energy signals straight into your Wellbeing Monitor.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Mood Pulse</span>
                    <span className="font-mono tabular-nums">{watchMood}/5</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={watchMood}
                    onChange={(e) => setWatchMood(Number(e.target.value))}
                    className="w-full accent-[#1E3A5F]"
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Resting Stress</span>
                    <span className="font-mono tabular-nums">{watchStress}/5</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={watchStress}
                    onChange={(e) => setWatchStress(Number(e.target.value))}
                    className="w-full accent-[#1E3A5F]"
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Energy</span>
                    <span className="font-mono tabular-nums">{watchEnergy}/5</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={watchEnergy}
                    onChange={(e) => setWatchEnergy(Number(e.target.value))}
                    className="w-full accent-[#1E3A5F]"
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Sleep Duration</span>
                    <span className="font-mono tabular-nums">{watchSleepHours.toFixed(1)}h</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={12}
                    step={0.5}
                    value={watchSleepHours}
                    onChange={(e) => setWatchSleepHours(Number(e.target.value))}
                    className="w-full accent-[#1E3A5F]"
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Sleep Quality</span>
                    <span className="font-mono tabular-nums">{watchSleepQuality}/5</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={watchSleepQuality}
                    onChange={(e) => setWatchSleepQuality(Number(e.target.value))}
                    className="w-full accent-[#1E3A5F]"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 px-4 text-xs font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49]"
              >
                Sync Watch Pulse to Wellbeing Monitor
              </button>

              {watchNote && (
                <p className="text-xs text-[#1E3A5F] leading-relaxed border-t border-[#1C1917]/10 pt-3">
                  {watchNote}
                </p>
              )}
            </form>
          </section>

          {/* Vector Search & Semantic Memory Providers */}
          <VectorSearchPanel
            documents={vectorDocuments}
            onAfterOperation={loadGatewayAudit}
          />

          {/* Time-Series Telemetry Engine: TimescaleDB & InfluxDB */}
          <TimeSeriesPanel
            points={timeSeriesPoints}
            retentionDays={retentionDays}
            onChangeRetentionDays={onChangeRetentionDays}
            onAfterOperation={loadGatewayAudit}
          />

          {/* Privacy-Preserving Audit & Compliance Ledger */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl font-medium text-[#1C1917]">
                  Audit & Compliance Ledger
                </h2>
                <p className="text-xs text-[#78716C]">
                  Records only routing, safety status, surface, and latency—never private reflection text.
                </p>
              </div>
              {auditEntries.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAudit}
                  className="inline-flex items-center gap-1.5 text-xs text-[#78716C] hover:text-[#9A3412]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Ledger</span>
                </button>
              )}
            </div>

            {auditEntries.length === 0 ? (
              <div className="border border-[#1C1917]/10 rounded-lg p-6 text-sm text-[#78716C] bg-[#F4F0E8]/35">
                No gateway audit entries recorded for this session yet.
              </div>
            ) : (
              <div className="border border-[#1C1917]/10 rounded-lg bg-[#FBF9F5] overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#1C1917]/10 text-[#78716C] bg-[#F4F0E8]/50">
                      <th className="py-2.5 px-3 font-medium">Time</th>
                      <th className="py-2.5 px-3 font-medium">Surface</th>
                      <th className="py-2.5 px-3 font-medium">Endpoint</th>
                      <th className="py-2.5 px-3 font-medium">Routed Agent</th>
                      <th className="py-2.5 px-3 font-medium">Safety Engine</th>
                      <th className="py-2.5 px-3 font-medium text-right">Status</th>
                      <th className="py-2.5 px-3 font-medium text-right">Latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1C1917]/10">
                    {auditEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-[#F4F0E8]/40">
                        <td className="py-2.5 px-3 font-mono tabular-nums text-[#57534E] whitespace-nowrap">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono uppercase text-[#1C1917]">
                          {entry.surface}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[#1C1917]">
                          {entry.endpoint}
                        </td>
                        <td className="py-2.5 px-3 text-[#1E3A5F] font-medium">
                          {entry.routedAgent}
                        </td>
                        <td className="py-2.5 px-3 text-[#292524]">
                          {entry.safetyStatus}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {entry.httpStatus}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#57534E]">
                          {entry.latencyMs}ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
