import { useState } from 'react';
import { ArrowRight, Compass } from 'lucide-react';

interface PhilosophyViewProps {
  onStartDialogue: () => void;
  onOpenEventLab: () => void;
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
  { name: 'Cognitive Behavioral Therapy (CBT)', focus: 'Identifying cognitive distortions such as catastrophizing, mind reading, and all-or-nothing thinking.' },
  { name: 'Acceptance & Commitment (ACT)', focus: 'Psychological flexibility and choosing actions aligned with personal values rather than avoidance.' },
  { name: 'Dialectical Behavior (DBT)', focus: 'Emotional regulation, distress tolerance, and constructive interpersonal requests.' },
  { name: 'Positive Psychology', focus: 'Cultivating character strengths, resilience, meaning, and sustainable wellbeing.' },
  { name: 'Behavioral Science', focus: 'Mapping Trigger → Thought → Emotion → Behavior → Consequence cycles without blame.' },
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

export function PhilosophyView({ onStartDialogue, onOpenEventLab }: PhilosophyViewProps) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="max-w-[1160px] mx-auto px-4 sm:px-8 py-10 space-y-14">
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
  );
}
