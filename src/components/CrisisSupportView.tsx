import { useEffect, useState } from 'react';
import { PhoneCall, MessageSquareHeart, Globe, HeartHandshake } from 'lucide-react';

interface CrisisBannerProps {
  onOpenResources?: () => void;
}

export function CrisisBanner({ onOpenResources }: CrisisBannerProps) {
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
          <p className="text-sm leading-relaxed text-[#292524]">
            If you are carrying intense pain, hopelessness, or thoughts of harming yourself, you do not have to navigate this alone. HUMANOS is a reflective tool and cannot provide crisis care—please connect with a trained person right now.
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

  return (
    <div className="max-w-[1160px] mx-auto px-4 sm:px-8 py-10 space-y-12">
      {/* Header */}
      <section className="max-w-3xl space-y-3">
        <p className="text-xs font-medium tracking-wider uppercase text-[#9A3412]">
          Safety & Stabilization
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
              Longer exhales gently signal safety to the nervous system. Follow the cadence at your own comfort.
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
            className="w-full py-2.5 px-4 text-sm font-medium rounded-md bg-[#1E3A5F] text-[#FBF9F5] hover:bg-[#162C49] transition-colors"
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

      <section className="border-t border-[#1C1917]/10 pt-6 flex items-center gap-3 text-sm text-[#57534E]">
        <MessageSquareHeart className="w-4 h-4 text-[#1E3A5F] shrink-0" />
        <p>
          If you are in immediate physical danger, please call your local emergency number (such as 911, 999, or 112) or go to the nearest emergency department.
        </p>
      </section>
    </div>
  );
}
