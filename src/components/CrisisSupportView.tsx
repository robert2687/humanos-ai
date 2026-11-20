import { useEffect, useState } from 'react';
import { PhoneCall, MessageSquareHeart, Globe, HeartHandshake, Loader2, ShieldAlert } from 'lucide-react';
import { gatewayFetch } from '../lib/gatewayClient';
import { CrisisRiskCategory, SafetyAssessment } from '../types/humanos';

const RISK_CATEGORY_LABELS: Record<CrisisRiskCategory, string> = {
  'self-harm risk': 'Self-Harm Risk',
  'suicide indicators': 'Suicide Indicators',
  'severe depression': 'Severe Depression',
  'panic attacks': 'Panic Attacks',
  'emotional collapse': 'Emotional Collapse',
};

export const DETECTION_DOMAINS: ReadonlyArray<{
  category: CrisisRiskCategory;
  label: string;
  signalFocus: string;
  stabilizationResponse: string;
}> = [
  {
    category: 'self-harm risk',
    label: 'Self-Harm Risk',
    signalFocus: 'Urges, plans, or active thoughts around physical self-injury.',
    stabilizationResponse: 'Immediate safety containment, Crisis Text Line / 988 connection, and zero-shame grounding.',
  },
  {
    category: 'suicide indicators',
    label: 'Suicide Indicators',
    signalFocus: 'Expressions of wanting to die, ending life, or feeling others would be better off.',
    stabilizationResponse: 'Highest-priority Crisis Guardian override directing immediately to 988 and live human support.',
  },
  {
    category: 'severe depression',
    label: 'Severe Depression',
    signalFocus: 'Profound hopelessness, persistent numbness, or inability to sustain daily basics.',
    stabilizationResponse: 'Low-pressure emotional validation and warm encouragement toward trusted people or licensed care.',
  },
  {
    category: 'panic attacks',
    label: 'Panic Attacks',
    signalFocus: 'Acute terror waves, racing heart, breathlessness, or fear of losing control.',
    stabilizationResponse: 'Immediate 4-4-6 paced exhalations and 5-4-3-2-1 sensory grounding to steady the nervous system.',
  },
  {
    category: 'emotional collapse',
    label: 'Emotional Collapse',
    signalFocus: 'Acute breaking point where coping capacity feels exhausted and functioning breaks down.',
    stabilizationResponse: 'Gentle pacing, stepping away from heavy problem-solving, and anchoring with safe human support.',
  },
];

interface CrisisBannerProps {
  detectedCategories?: CrisisRiskCategory[];
  onOpenResources?: () => void;
}

export function CrisisBanner({ detectedCategories, onOpenResources }: CrisisBannerProps) {
  const uniqueLabels = Array.from(
    new Set((detectedCategories || []).map((c) => RISK_CATEGORY_LABELS[c] || c))
  );

  return (
    <div
      role="alert"
      className="bg-[#FDF4F2] border border-[#9A3412]/25 rounded-lg p-4 sm:p-5 text-[#1C1917]"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#9A3412]">
            <HeartHandshake className="w-4 h-4 shrink-0" />
            <span>Immediate Support Is Available</span>
          </div>
          {uniqueLabels.length > 0 && (
            <div className="text-xs text-[#9A3412]/90">
              <span>Signals noticed:</span>{' '}
              <span>{uniqueLabels.join(' · ')}</span>
            </div>
          )}
          <p className="text-sm leading-relaxed text-[#292524]">
            If you are experiencing acute panic, emotional collapse, deep hopelessness, or thoughts of harming yourself, you do not have to carry this alone. HUMANOS is a reflective tool and cannot provide crisis or medical care—please connect with a trained person right now.
          </p>
          <div className="pt-1 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-[#1C1917]">
            <a
              href="tel:988"
              className="inline-flex items-center gap-1.5 underline underline-offset-4 decoration-[#9A3412]/40 hover:decoration-[#9A3412]"
            >
              <PhoneCall className="w-3.5 h-3.5 text-[#9A3412]" />
              <span>Call or text 988 (US & Canada)</span>
            </a>
            <span className="text-[#78716C]" aria-hidden="true">·</span>
            <span>Text HOME to 741741</span>
            <span className="text-[#78716C]" aria-hidden="true">·</span>
            <a
              href="https://findahelpline.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 underline underline-offset-4 decoration-[#9A3412]/40 hover:decoration-[#9A3412]"
            >
              <Globe className="w-3.5 h-3.5 text-[#9A3412]" />
              <span>International Helplines</span>
            </a>
          </div>
        </div>
        {onOpenResources && (
          <button
            type="button"
            onClick={onOpenResources}
            className="self-start px-3.5 py-2 text-xs font-medium bg-[#9A3412] text-[#FBF9F5] rounded-md hover:bg-[#7C2D12] transition-colors whitespace-nowrap shrink-0"
          >
            Grounding & Helplines
          </button>
        )}
      </div>
    </div>
  );
}

const HELPLINES = [
  {
    region: 'United States & Canada',
    service: '988 Suicide & Crisis Lifeline',
    contact: 'Call or text 988',
    hours: '24/7 · Free & Confidential',
    link: 'https://988lifeline.org/',
  },
  {
    region: 'United States & Canada',
    service: 'Crisis Text Line',
    contact: 'Text HOME to 741741',
    hours: '24/7 · Free SMS Support',
    link: 'https://www.crisistextline.org/',
  },
  {
    region: 'United Kingdom',
    service: 'Samaritans / NHS Mental Health',
    contact: 'Call 116 123 or NHS 111',
    hours: '24/7 · Free & Confidential',
    link: 'https://www.samaritans.org/',
  },
  {
    region: 'Australia',
    service: 'Lifeline Australia',
    contact: 'Call 13 11 14 or text 0477 13 11 14',
    hours: '24/7 · Crisis Support',
    link: 'https://www.lifeline.org.au/',
  },
  {
    region: 'Worldwide Directory',
    service: 'Find A Helpline',
    contact: 'findahelpline.com',
    hours: '130+ Countries · Verified Local Lines',
    link: 'https://findahelpline.com/',
  },
];

const SENSORY_STEPS = [
  { count: '5', sense: 'See', prompt: 'Name five quiet details visible in the room around you.' },
  { count: '4', sense: 'Feel', prompt: 'Notice four physical sensations—chair support, feet on floor, fabric texture.' },
  { count: '3', sense: 'Hear', prompt: 'Listen for three subtle sounds near or far.' },
  { count: '2', sense: 'Smell', prompt: 'Notice two scents in the air, or take two slow breaths.' },
  { count: '1', sense: 'Anchor', prompt: 'Identify one person you trust or one next safe step for the next hour.' },
];

export function CrisisSupportView() {
  const [breathingActive, setBreathingActive] = useState(false);
  const [phase, setPhase] = useState<'Inhale' | 'Hold' | 'Exhale'>('Inhale');
  const [secondsLeft, setSecondsLeft] = useState(4);
  const [checkedSteps, setCheckedSteps] = useState<string[]>([]);

  // Crisis Guardian Detection Check
  const [checkText, setCheckText] = useState('');
  const [isScreening, setIsScreening] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<SafetyAssessment | null>(null);

  useEffect(() => {
    if (!breathingActive) return;

    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev > 1) return prev - 1;
        setPhase((currentPhase) => {
          if (currentPhase === 'Inhale') {
            setSecondsLeft(4);
            return 'Hold';
          }
          if (currentPhase === 'Hold') {
            setSecondsLeft(6);
            return 'Exhale';
          }
          setSecondsLeft(4);
          return 'Inhale';
        });
        return 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [breathingActive]);

  const toggleBreathing = () => {
    if (breathingActive) {
      setBreathingActive(false);
      setPhase('Inhale');
      setSecondsLeft(4);
    } else {
      setPhase('Inhale');
      setSecondsLeft(4);
      setBreathingActive(true);
    }
  };

  const toggleSensoryStep = (count: string) => {
    setCheckedSteps((prev) =>
      prev.includes(count) ? prev.filter((item) => item !== count) : [...prev, count]
    );
  };

  const handleRunCrisisScreening = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = checkText.trim();
    if (trimmed.length < 6 || isScreening) return;

    setIsScreening(true);
    setScreenError(null);

    try {
      const response = await gatewayFetch('/api/agents/crisis-guardian', {
        method: 'POST',
        body: JSON.stringify({
          text: trimmed,
          contextSource: 'Crisis Support Screening',
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to run Crisis Guardian check right now.');
      }
      setAssessment(data);
    } catch (err: unknown) {
      setScreenError(
        err instanceof Error ? err.message : 'Unable to run Crisis Guardian check right now.'
      );
    } finally {
      setIsScreening(false);
    }
  };

  return (
    <div className="max-w-[1160px] mx-auto px-4 sm:px-8 py-10 space-y-12">
      {/* Header */}
      <section className="max-w-3xl space-y-3">
        <p className="text-xs font-medium tracking-wider uppercase text-[#9A3412]">
          Safety & Stabilization · Crisis Guardian
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-[#1C1917] [text-wrap:balance]">
          Immediate human support and grounding
        </h1>
        <p className="text-base leading-relaxed text-[#57534E]">
          When emotional pain feels overwhelming, safety and steady human connection come first. HUMANOS AI is a reflective instrument, not an emergency service or clinical provider. Please reach out directly to a trained responder or trusted person.
        </p>
      </section>

      {/* Helplines Directory */}
      <section aria-labelledby="helplines-heading" className="space-y-4">
        <div className="flex items-baseline justify-between border-b border-[#1C1917]/10 pb-3">
          <h2 id="helplines-heading" className="font-serif text-xl font-medium text-[#1C1917]">
            24/7 Confidential Crisis Services
          </h2>
          <span className="text-xs text-[#78716C]">Free · Non-judgmental · Immediate</span>
        </div>

        <div className="divide-y divide-[#1C1917]/10 border border-[#1C1917]/10 rounded-lg bg-[#F4F0E8]/60">
          {HELPLINES.map((line) => (
            <div
              key={line.service}
              className="p-4 sm:px-6 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-0.5">
                <div className="text-xs text-[#78716C]">
                  <span>{line.region}</span>
                  <span className="mx-2" aria-hidden="true">·</span>
                  <span>{line.hours}</span>
                </div>
                <div className="text-base font-semibold text-[#1C1917]">{line.service}</div>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-sm font-medium text-[#9A3412] tabular-nums">
                  {line.contact}
                </span>
                <a
                  href={line.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs font-medium border border-[#1C1917]/20 rounded-md text-[#1C1917] hover:bg-[#EBE6DF] transition-colors whitespace-nowrap"
                >
                  Open Resource
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Stabilization Tools */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-2">
        {/* Paced Breathing */}
        <div className="lg:col-span-5 border border-[#1C1917]/10 rounded-lg bg-[#F4F0E8]/50 p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-2">
            <h2 className="font-serif text-xl font-medium text-[#1C1917]">
              4-4-6 Nervous System Pacing
            </h2>
            <p className="text-sm leading-relaxed text-[#57534E]">
              Longer exhales gently signal safety to the nervous system during panic attacks or acute distress. Follow the cadence at your own comfort.
            </p>
          </div>

          <div className="py-6 border-y border-[#1C1917]/10 flex flex-col items-center justify-center text-center space-y-2">
            <span className="text-xs uppercase tracking-widest text-[#78716C]">
              {breathingActive ? 'Current Phase' : 'Ready'}
            </span>
            <div className="font-serif text-3xl font-medium text-[#1E3A5F]">
              {breathingActive ? phase : 'Steady Breath'}
            </div>
            <div className="font-mono text-2xl text-[#1C1917] tabular-nums">
              {breathingActive ? `${secondsLeft}s` : '4s · 4s · 6s'}
            </div>
          </div>

          <button
            type="button"
            onClick={toggleBreathing}
            className="w-full py-2.5 px-4 text-sm font-medium rounded-md bg-[#1E3A5F] text-[#FBF9F5] hover:bg-[#162C49] transition-colors whitespace-nowrap"
          >
            {breathingActive ? 'Pause Breathing Guide' : 'Begin Paced Breathing'}
          </button>
        </div>

        {/* 5-4-3-2-1 Grounding */}
        <div className="lg:col-span-7 border border-[#1C1917]/10 rounded-lg bg-[#F4F0E8]/50 p-6 space-y-4">
          <div className="flex items-baseline justify-between gap-4">
            <div className="space-y-1">
              <h2 className="font-serif text-xl font-medium text-[#1C1917]">
                5-4-3-2-1 Sensory Grounding
              </h2>
              <p className="text-sm text-[#57534E]">
                Return attention gently from overwhelming thoughts into present physical reality.
              </p>
            </div>
            {checkedSteps.length > 0 && (
              <button
                type="button"
                onClick={() => setCheckedSteps([])}
                className="text-xs font-medium text-[#57534E] hover:text-[#1C1917] underline underline-offset-4 whitespace-nowrap"
              >
                Reset
              </button>
            )}
          </div>

          <div className="divide-y divide-[#1C1917]/10">
            {SENSORY_STEPS.map((step) => {
              const checked = checkedSteps.includes(step.count);
              return (
                <button
                  key={step.count}
                  type="button"
                  onClick={() => toggleSensoryStep(step.count)}
                  className="w-full py-3 flex items-start gap-4 text-left hover:bg-[#EBE6DF]/50 px-2 rounded transition-colors"
                >
                  <span
                    className={`font-mono text-sm w-7 h-7 flex items-center justify-center rounded border shrink-0 tabular-nums transition-colors ${
                      checked
                        ? 'bg-[#1E3A5F] text-[#FBF9F5] border-[#1E3A5F]'
                        : 'border-[#1C1917]/20 text-[#1C1917]'
                    }`}
                  >
                    {step.count}
                  </span>
                  <div className="space-y-0.5">
                    <div className={`text-sm font-semibold ${checked ? 'line-through text-[#78716C]' : 'text-[#1C1917]'}`}>
                      {step.sense}
                    </div>
                    <p className="text-sm text-[#57534E]">{step.prompt}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Crisis Guardian 5-Domain Detection & Distress Check */}
      <section aria-labelledby="detection-heading" className="space-y-6 border-t border-[#1C1917]/10 pt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="space-y-1 max-w-2xl">
            <h2 id="detection-heading" className="font-serif text-xl sm:text-2xl font-medium text-[#1C1917]">
              Crisis Guardian · Five Detection Domains
            </h2>
            <p className="text-sm text-[#57534E]">
              Every reflection across HUMANOS is screened in real time for acute distress indicators—never to label or diagnose, only to pause reflection and prioritize stabilization and human care.
            </p>
          </div>
          <span className="text-xs text-[#78716C]">Non-diagnostic screening · Safety above all</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {DETECTION_DOMAINS.map((domain, index) => {
            const matchedSignal = assessment?.signals.find(
              (s) => s.category === domain.category
            );
            const active = Boolean(matchedSignal?.detected);
            return (
              <div
                key={domain.category}
                className={`p-4 rounded-lg border space-y-2 transition-colors ${
                  active
                    ? 'bg-[#FDF4F2] border-[#9A3412]/35'
                    : 'bg-[#F4F0E8]/45 border-[#1C1917]/10'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-[#78716C]">
                  <span>0{index + 1}.</span>
                  {assessment && (
                    <span className={active ? 'text-[#9A3412] font-semibold' : 'text-[#78716C]'}>
                      {active ? 'Signaled' : 'Clear'}
                    </span>
                  )}
                </div>
                <div className={`text-sm font-semibold ${active ? 'text-[#9A3412]' : 'text-[#1C1917]'}`}>
                  {domain.label}
                </div>
                <p className="text-xs leading-relaxed text-[#57534E]">
                  {matchedSignal?.rationale || domain.signalFocus}
                </p>
              </div>
            );
          })}
        </div>

        <form
          onSubmit={handleRunCrisisScreening}
          className="border border-[#1C1917]/12 rounded-lg bg-[#F4F0E8]/55 p-6 space-y-4"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1E3A5F]">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Gentle Distress & Grounding Check</span>
              </div>
              <p className="text-xs text-[#57534E]">
                If you are unsure what you are feeling right now, describe it briefly to receive tailored stabilization pacing and human-support guidance.
              </p>
            </div>
            {assessment && (
              <button
                type="button"
                onClick={() => setAssessment(null)}
                className="text-xs text-[#57534E] hover:text-[#1C1917] underline underline-offset-4 whitespace-nowrap"
              >
                Clear Check
              </button>
            )}
          </div>

          <textarea
            value={checkText}
            onChange={(e) => setCheckText(e.target.value)}
            rows={3}
            placeholder="Share what feels heavy, overwhelming, or frightening right now..."
            className="w-full rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] p-3 text-sm leading-relaxed text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#1E3A5F]"
          />

          {screenError && (
            <div className="text-xs text-[#9A3412] bg-[#FDF4F2] border border-[#9A3412]/20 rounded px-3 py-2">
              {screenError}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-[#78716C]">
              Screens across all 5 indicators · No clinical labels
            </span>
            <button
              type="submit"
              disabled={isScreening || checkText.trim().length < 6}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49] disabled:opacity-45 transition-colors whitespace-nowrap"
            >
              {isScreening ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Screening & Grounding...</span>
                </>
              ) : (
                <span>Check Distress & Grounding</span>
              )}
            </button>
          </div>

          {assessment && (
            <div
              className={`mt-4 rounded-md border p-4 space-y-2.5 ${
                assessment.crisisDetected
                  ? 'bg-[#FDF4F2] border-[#9A3412]/30'
                  : 'bg-[#FBF9F5] border-[#1C1917]/10'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className={assessment.crisisDetected ? 'font-semibold text-[#9A3412]' : 'font-semibold text-[#1E3A5F]'}>
                  {assessment.crisisDetected
                    ? 'Stabilization Priority Active'
                    : assessment.severity === 'elevated-distress'
                      ? 'Elevated Distress Noticed'
                      : 'Steady Reflective Baseline'}
                </span>
                <span className="text-[#78716C]">
                  {assessment.detectedCategories.length > 0
                    ? assessment.detectedCategories
                        .map((c) => RISK_CATEGORY_LABELS[c] || c)
                        .join(' · ')
                    : 'No acute crisis indicators detected'}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-[#292524]">
                {assessment.stabilizationGuidance}
              </p>
              <p className="text-xs leading-relaxed text-[#57534E] border-t border-[#1C1917]/10 pt-2">
                <span className="font-semibold text-[#1C1917]">Recommended Next Support: </span>
                {assessment.recommendedAction}
              </p>
            </div>
          )}
        </form>
      </section>

      <section className="border-t border-[#1C1917]/10 pt-6 flex items-center gap-3 text-sm text-[#57534E]">
        <MessageSquareHeart className="w-4 h-4 text-[#1E3A5F] shrink-0" />
        <p>
          If you are in immediate physical danger, please call your local emergency number (such as 911, 999, or 112) or go to the nearest emergency department.
        </p>
      </section>
    </div>
  );
}
