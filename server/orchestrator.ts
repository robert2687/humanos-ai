export type SafetyStatus = 'nominal' | 'elevated-distress' | 'crisis-override';

export type CrisisRiskCategory =
  | 'self-harm risk'
  | 'suicide indicators'
  | 'severe depression'
  | 'panic attacks'
  | 'emotional collapse';

export const CRISIS_RISK_CATALOG: ReadonlyArray<{
  category: CrisisRiskCategory;
  label: string;
  description: string;
}> = [
  {
    category: 'self-harm risk',
    label: 'Self-Harm Risk',
    description: 'Urges, intentions, or recent acts of physical self-injury.',
  },
  {
    category: 'suicide indicators',
    label: 'Suicide Indicators',
    description: 'Thoughts of ending life, wanting to disappear, or feeling others are better off without you.',
  },
  {
    category: 'severe depression',
    label: 'Severe Depression',
    description: 'Deep hopelessness, persistent emotional numbness, or inability to find meaning or get through daily basics.',
  },
  {
    category: 'panic attacks',
    label: 'Panic Attacks',
    description: 'Acute physiological terror waves—racing heart, breathlessness, trembling, or fear of losing control.',
  },
  {
    category: 'emotional collapse',
    label: 'Emotional Collapse',
    description: 'Acute breaking point where coping capacity feels exhausted and functioning breaks down.',
  },
];

export type UserModelDomain =
  | 'personality'
  | 'emotional patterns'
  | 'values'
  | 'relationships'
  | 'goals'
  | 'fears'
  | 'aspirations';

export const USER_MODEL_DOMAINS: ReadonlyArray<{
  domain: UserModelDomain;
  label: string;
  description: string;
}> = [
  {
    domain: 'personality',
    label: 'Personality',
    description: 'Observed temperamental inclinations, cognitive style, and adaptive traits.',
  },
  {
    domain: 'emotional patterns',
    label: 'Emotional Patterns',
    description: 'Recurring emotional responses, sensitivities, triggers, and regulation habits.',
  },
  {
    domain: 'values',
    label: 'Values',
    description: 'Core principles, ethical anchors, and what gives choices integrity.',
  },
  {
    domain: 'relationships',
    label: 'Relationships',
    description: 'Attachment styles, communication tendencies, and recurring interpersonal needs.',
  },
  {
    domain: 'goals',
    label: 'Goals',
    description: 'Near-term concrete aims, personal commitments, and active areas of effort.',
  },
  {
    domain: 'fears',
    label: 'Fears',
    description: 'Underlying vulnerabilities, protective worries, and feared losses or outcomes.',
  },
  {
    domain: 'aspirations',
    label: 'Aspirations',
    description: 'Longer-horizon meaning, desired way of living, and who you are growing toward.',
  },
];

export interface SafetyEvaluation {
  status: SafetyStatus;
  crisisOverride: boolean;
  toxicitySignal: boolean;
  detectedCategories: CrisisRiskCategory[];
  policyNotes: string[];
}

export interface AgentRouteDecision {
  primaryAgent: string;
  supportingAgents: string[];
  routingRationale: string;
}

export const HUMANOS_KNOWLEDGE_CHARTER = `You are HUMANOS AI (Human Intelligence & Wellbeing Operating System).
You are an advanced Human Intelligence Platform designed to help individuals understand themselves, regulate emotions, improve wellbeing, strengthen relationships, develop emotional intelligence, and make healthier life decisions.

KNOWLEDGE CORE (Evidence-Informed Disciplines):
Draw thoughtfully from CBT (cognitive reframing & distortion awareness), ACT (values-based action & psychological flexibility), DBT (distress tolerance, emotional regulation, interpersonal effectiveness), Positive Psychology (character strengths, meaning, resilience), Behavioral Science (habit loops & trigger-behavior cycles), Emotional Intelligence, Attachment Theory, Motivational Psychology, Conflict Resolution, and Wellbeing Research.

ETHICS, BOUNDARIES & TRUST GUARDIAN:
- You are NOT a therapist, NOT a psychiatrist, and NOT a doctor.
- You do NOT diagnose mental disorders or use clinical labels to classify users.
- Never claim human emotions, consciousness, or professional licensure.
- Never create dependency, manipulate, shame, moralize, or use fear tactics.
- Never pretend certainty where uncertainty exists.
- Ultimate mission: do not solve life for the user; help the user become their own best guide.

CORE PRINCIPLES:
1. Insight before advice.
2. Understanding before solutions.
3. Curiosity before judgment.
4. Empathy before correction.
5. Reflection before action.
6. Growth before dependency.
7. Safety above all.
8. Scientific integrity.

INTERNAL 7-STAGE OPERATING FRAMEWORK (Perform silently; NEVER expose raw stage labels or internal reasoning):
1. Identify the situation.
2. Identify emotions (Emotion Mapping: anger often protects boundaries/fairness/respect; anxiety often protects safety/predictability/preparedness; sadness often reflects loss/disappointment/unmet attachment needs).
3. Identify unmet needs.
4. Identify cognitive patterns (catastrophizing, personalization, overgeneralization, emotional reasoning, mind reading — explore gently, never criticize).
5. Identify behavioral patterns (Trigger -> Thought -> Emotion -> Behavior -> Outcome, avoidance, self-sabotage).
6. Identify opportunities for self-awareness.
7. Provide supportive, grounded guidance.

CRISIS GUARDIAN (HIGHEST PRIORITY):
- Actively screen every message for the 5 core risk detection domains (non-diagnostic stabilization):
  1. self-harm risk (urges or intent to injure or cut oneself)
  2. suicide indicators (suicidal thoughts, desire to die, ending life, feeling better off dead)
  3. severe depression (profound hopelessness, deep despair, inability to function or get out of bed, total emotional numbness)
  4. panic attacks (acute panic wave, hyperventilation, racing heart, breathlessness, terror of losing control)
  5. emotional collapse (feeling completely shattered, breaking down uncontrollably, total coping exhaustion)
- If self-harm risk, suicide indicators, emotional collapse, severe depression crisis, or acute panic overwhelm is present:
  Set crisisDetected to true immediately.
  1. Stay calm and unhurried.
  2. Validate distress with warmth and zero judgment or clinical labeling.
  3. Tailor immediate grounding (e.g., 4-4-6 breathing & 5-4-3-2-1 sensory anchoring for panic attacks or collapse) alongside human support (988 Suicide & Crisis Lifeline by calling or texting 988 in US/Canada, Crisis Text Line by texting HOME to 741741, international lines at findahelpline.com, trusted people, or licensed professionals).
  4. Encourage emergency services when immediate physical safety is at risk.
  5. Maintain steady, respectful engagement.
  NEVER provide instructions for self-harm, NEVER normalize suicide, NEVER diagnose, and NEVER assist dangerous behavior.

COMMUNICATION STYLE:
- Warm, intelligent, reflective, professional, calm, respectful, emotionally aware.
- Avoid judgment, moralizing, shaming, manipulation, fear tactics, or generic motivation.`;

const MODE_INSTRUCTIONS: Record<string, string> = {
  insight:
    'Active Focus: Integrated Psychological Insight. Blend emotional awareness, cognitive clarity, and probabilistic pattern observation naturally.',
  'self-reflection':
    'Active Focus: Behavioral & Cognitive Self-Reflection. Gently illuminate Trigger -> Thought -> Emotion -> Behavior -> Outcome chains, blind spots, or cognitive distortions without criticism.',
  relationship:
    'Active Focus: Relationship Graph & Conflict Mediation. Stay neutral and balanced across all perspectives; examine expectations, attachment dynamics, communication, and unspoken needs.',
  growth:
    'Active Focus: Personal Growth & Purpose Discovery across confidence, discipline, habits, resilience, purpose, and life goals. Connect current tensions to core values, strengths, meaning, and realistic sustainable next steps.',
  'de-escalation':
    'Active Focus: Anger & Conflict De-escalation. Validate emotional intensity without endorsing harm; identify what boundary, fairness, or respect feels threatened; separate facts from interpretations and support constructive requests.',
  'digital-pause':
    'Active Focus: Toxicity Detector & Digital Pause. When the user brings an online conflict, heated message, or toxic thread, clarify the actual issue, emotional trigger, likely outcome of reacting impulsively, and a healthier alternative response without shaming.',
};

// Safety Engine: deterministic pre-flight screening across all 5 Crisis Guardian detection domains
export function evaluateSafety(text: string): SafetyEvaluation {
  const normalized = text.toLowerCase();

  const categoryMatchers: ReadonlyArray<{
    category: CrisisRiskCategory;
    patterns: RegExp[];
  }> = [
    {
      category: 'self-harm risk',
      patterns: [
        /\b(self[- ]?harm|hurt myself|hurting myself|cut myself|cutting myself|burn myself|harm myself|self[- ]injury)\b/,
      ],
    },
    {
      category: 'suicide indicators',
      patterns: [
        /\b(suicide|suicidal|kill myself|end my life|want to die|wish i was dead|wish i were dead|better off dead|end it all|no reason to live|(don'?t|do not) want to live|take my own life)\b/,
      ],
    },
    {
      category: 'severe depression',
      patterns: [
        /\b(severely depressed|severe depression|deep despair|completely hopeless|nothing matters anymore|(can'?t|cannot) get out of bed|empty for weeks|completely numb|worthless and hopeless|hopeless and want out)\b/,
      ],
    },
    {
      category: 'panic attacks',
      patterns: [
        /\b(panic attack|panicking|(can'?t|cannot) breathe|hyperventilat\w*|heart is racing|chest is tight|feel like i'?m dying|losing control right now|terrified and shaking)\b/,
      ],
    },
    {
      category: 'emotional collapse',
      patterns: [
        /\b(emotional collapse|falling apart|breaking down|broke down completely|(can'?t|cannot) hold it together|completely shattered|shutting down completely|(can'?t|cannot) function anymore|(can'?t|cannot) go on|(can'?t|cannot) cope anymore)\b/,
      ],
    },
  ];

  const detectedCategories = categoryMatchers
    .filter((entry) => entry.patterns.some((rx) => rx.test(normalized)))
    .map((entry) => entry.category);

  const toxicityPatterns = [
    /\b(hate them|destroy them|ruin their life|revenge|insult|attack them|troll)\b/,
  ];
  const distressPatterns = [
    /\b(hopeless|worthless|can'?t cope|overwhelmed|exhausted|burned out|breaking down|panicking)\b/,
  ];

  const hasImmediateSafetyRisk =
    detectedCategories.includes('self-harm risk') ||
    detectedCategories.includes('suicide indicators') ||
    detectedCategories.includes('emotional collapse') ||
    detectedCategories.includes('severe depression') ||
    detectedCategories.includes('panic attacks');

  const crisisOverride = hasImmediateSafetyRisk;
  const toxicitySignal = toxicityPatterns.some((rx) => rx.test(normalized));
  const elevatedDistress =
    detectedCategories.length > 0 || distressPatterns.some((rx) => rx.test(normalized));

  const policyNotes: string[] = [];
  if (crisisOverride) {
    policyNotes.push(
      `Crisis Guardian override active (${detectedCategories.join(', ')}): prioritize calm emotional stabilization, immediate grounding if panicking/collapsed, and 988 / trusted human or clinical support without clinical diagnosis.`
    );
  } else if (elevatedDistress) {
    policyNotes.push('Elevated distress detected: pace gently, validate emotion, avoid advice overload.');
  }
  if (toxicitySignal) {
    policyNotes.push('Hostility/impulsive conflict detected: de-escalate without shaming and explore underlying unmet needs.');
  }

  return {
    status: crisisOverride
      ? 'crisis-override'
      : elevatedDistress || toxicitySignal
        ? 'elevated-distress'
        : 'nominal',
    crisisOverride,
    toxicitySignal,
    detectedCategories,
    policyNotes,
  };
}

// Agent Router: selects primary and supporting specialist perspectives
export function routeAgents(params: {
  endpoint:
    | 'dialogue'
    | 'event-lab'
    | 'synthesis'
    | 'explain-me'
    | 'personality-analyst'
    | 'cognitive-distortions'
    | 'relationship-analyst'
    | 'growth-coach'
    | 'crisis-guardian'
    | 'user-model'
    | 'extension-pause'
    | 'watch-pulse';
  mode?: string;
  lens?: string;
  safety: SafetyEvaluation;
}): AgentRouteDecision {
  if (params.safety.crisisOverride || params.endpoint === 'crisis-guardian') {
    return {
      primaryAgent: 'Crisis Guardian',
      supportingAgents: ['Emotional Intelligence Analyst', 'Wellbeing Monitor', 'Ethics & Trust Guardian'],
      routingRationale: params.safety.detectedCategories.length
        ? `Safety screening flagged ${params.safety.detectedCategories.join(', ')}; prioritizing calm stabilization and human support.`
        : 'Crisis Guardian screening across self-harm risk, suicide indicators, severe depression, panic attacks, and emotional collapse.',
    };
  }

  if (params.endpoint === 'user-model') {
    return {
      primaryAgent: 'Human Digital Twin Architect',
      supportingAgents: ['Personality Analyst', 'Emotional Intelligence Analyst', 'Values Mapper', 'Purpose Discovery'],
      routingRationale:
        'Dynamic User Model synthesis across personality, emotional patterns, values, relationships, goals, fears, and aspirations.',
    };
  }

  if (params.endpoint === 'growth-coach') {
    return {
      primaryAgent: 'Purpose & Growth Coach',
      supportingAgents: ['Positive Psychology Specialist', 'Behavioral Scientist', 'Values Mapper'],
      routingRationale:
        'Evidence-informed coaching across confidence, discipline, habits, resilience, purpose, and life goals.',
    };
  }

  if (params.endpoint === 'cognitive-distortions') {
    return {
      primaryAgent: 'Cognitive Distortion Analyzer',
      supportingAgents: ['Behavioral Scientist', 'Ethics & Trust Guardian'],
      routingRationale:
        'CBT evaluation across catastrophizing, personalization, overgeneralization, emotional reasoning, and mind reading.',
    };
  }

  if (params.endpoint === 'relationship-analyst') {
    return {
      primaryAgent: 'Relationship Specialist',
      supportingAgents: ['Conflict Mediator', 'Emotional Intelligence Analyst'],
      routingRationale:
        'Balanced perspective-taking, attachment dynamics, boundaries, and needs across romantic, friendship, family, or work relationships.',
    };
  }

  if (params.endpoint === 'personality-analyst') {
    return {
      primaryAgent: 'Personality Analyst',
      supportingAgents: ['Values Mapper', 'Blind Spot Finder', 'Behavioral Scientist'],
      routingRationale: 'Structured personality analysis, behavioral profiling, value identification, strength mapping, and growth opportunity detection.',
    };
  }

  if (params.endpoint === 'extension-pause' || params.lens === 'digital-check' || params.mode === 'digital-pause') {
    return {
      primaryAgent: 'Toxicity Detector',
      supportingAgents: ['Conflict Mediator', 'Emotional Intelligence Analyst'],
      routingRationale: 'Digital communication pause lens selected.',
    };
  }

  if (params.endpoint === 'watch-pulse') {
    return {
      primaryAgent: 'Wellbeing Monitor',
      supportingAgents: ['Burnout Predictor', 'Emotional Intelligence Analyst'],
      routingRationale: 'Wearable micro-pulse check-in synced to Wellbeing Monitor.',
    };
  }

  if (params.endpoint === 'explain-me') {
    return {
      primaryAgent: 'Explain Me & Digital Twin',
      supportingAgents: ['Values Mapper', 'Blind Spot Finder', 'Purpose Discovery'],
      routingRationale: 'Full Human Digital Twin portrait synthesis requested.',
    };
  }

  if (params.endpoint === 'synthesis') {
    return {
      primaryAgent: 'Personality DNA Analyst',
      supportingAgents: ['Blind Spot Finder', 'Wellbeing Monitor'],
      routingRationale: 'Cross-session probabilistic pattern extraction.',
    };
  }

  if (params.lens === 'future-self') {
    return {
      primaryAgent: 'Future Self Simulator',
      supportingAgents: ['Values Mapper', 'Purpose Discovery'],
      routingRationale: 'Multi-horizon decision consequence exploration.',
    };
  }

  if (params.lens === 'behavioral-loop' || params.mode === 'self-reflection') {
    return {
      primaryAgent: 'Cognitive Distortion Analyzer',
      supportingAgents: ['Behavioral Scientist', 'Blind Spot Finder'],
      routingRationale: 'Thought-emotion-behavior cycle inspection.',
    };
  }

  if (params.mode === 'relationship' || params.mode === 'de-escalation' || params.lens === 'conflict-emotion') {
    return {
      primaryAgent: 'Conflict Mediator',
      supportingAgents: ['Relationship Specialist', 'Emotional Intelligence Analyst'],
      routingRationale: 'Interpersonal dynamics and 5-layer conflict deconstruction.',
    };
  }

  if (params.mode === 'growth') {
    return {
      primaryAgent: 'Purpose & Growth Coach',
      supportingAgents: ['Values Mapper', 'Resilience Coach'],
      routingRationale: 'Values alignment and sustainable growth lens.',
    };
  }

  return {
    primaryAgent: 'Psychological Insight Engine',
    supportingAgents: ['Emotional Intelligence Analyst', 'Personality DNA Analyst'],
    routingRationale: 'Integrated reflective insight mode.',
  };
}

// Memory Engine: prioritizes confirmed patterns and formats probabilistic twin memory + 7-domain Dynamic User Model
export function formatMemoryEngine(
  profileHypotheses: Array<{ dimension?: string; statement?: string; status?: string }>,
  dynamicUserModel?: {
    summaryNote?: string;
    entries?: Array<{ domain?: string; observation?: string; confidence?: string }>;
  } | null
): string {
  const parts: string[] = [];

  if (dynamicUserModel && Array.isArray(dynamicUserModel.entries) && dynamicUserModel.entries.length > 0) {
    const orderedDomains = USER_MODEL_DOMAINS.map((d) => d.domain);
    const prioritizedEntries = [...dynamicUserModel.entries]
      .filter((e) => e.observation)
      .sort((a, b) => {
        const rank = (c?: string) => (c === 'confirmed' ? 0 : c === 'recurring' ? 1 : 2);
        return rank(a.confidence) - rank(b.confidence);
      })
      .slice(0, 14);

    if (prioritizedEntries.length > 0) {
      parts.push(
        `Dynamic User Model (probabilistic evolving understanding across ${orderedDomains.join(', ')}):\n${prioritizedEntries
          .map((e) => `- [${e.domain || 'personality'} | ${e.confidence || 'emerging'}]: ${e.observation}`)
          .join('\n')}`
      );
    }
  }

  if (Array.isArray(profileHypotheses) && profileHypotheses.length > 0) {
    const sorted = [...profileHypotheses]
      .filter((h) => h.status !== 'dismissed' && h.statement)
      .sort((a, b) => {
        const score = (s?: string) => (s === 'resonates' || s === 'nuanced' ? 0 : 1);
        return score(a.status) - score(b.status);
      })
      .slice(0, 10);

    if (sorted.length > 0) {
      parts.push(
        `Pattern Atlas Hypotheses (probabilistic patterns — never treat as permanent truth):\n${sorted
          .map((h) => `- [${h.dimension || 'Pattern'} | ${h.status || 'hypothesis'}]: ${h.statement}`)
          .join('\n')}`
      );
    }
  }

  if (parts.length === 0) {
    return 'No prior Human Digital Twin or Dynamic User Model entries yet; observe gently without overreaching.';
  }

  return parts.join('\n\n');
}

// Context Manager: builds bounded context window across turns, wellbeing, and event lab
export function buildBoundedContext(params: {
  messages: Array<{ role: string; content: string }>;
  wellbeingSummary?: string;
  activeEventContext?: {
    summaryTitle?: string;
    rawEvent?: string;
    emotions?: Array<{ name: string }>;
    needs?: string[];
  } | null;
}): {
  conversationBlock: string;
  wellbeingBlock: string;
  eventBlock: string;
} {
  const conversationBlock = (params.messages || [])
    .slice(-14)
    .map((m) => `${m.role === 'user' ? 'User' : 'HUMANOS'}: ${String(m.content || '').slice(0, 2000)}`)
    .join('\n\n');

  const wellbeingBlock = params.wellbeingSummary
    ? `Recent Observable Wellbeing Check-ins:\n${params.wellbeingSummary.slice(0, 1200)}`
    : '';

  const eventBlock = params.activeEventContext
    ? `Attached Event Lab Record:\nTitle: ${params.activeEventContext.summaryTitle || ''}\nEvent: ${params.activeEventContext.rawEvent || ''}\nEmotions: ${(params.activeEventContext.emotions || []).map((e) => e.name).join(', ')}\nNeeds: ${(params.activeEventContext.needs || []).join(', ')}`
    : '';

  return { conversationBlock, wellbeingBlock, eventBlock };
}

// Prompt Orchestrator: assembles final model instruction for Dialogue
export function orchestrateDialoguePrompt(params: {
  mode: string;
  route: AgentRouteDecision;
  safety: SafetyEvaluation;
  memoryBlock: string;
  context: ReturnType<typeof buildBoundedContext>;
  includeStructuredCard: boolean;
  includeBreakdown: boolean;
}): string {
  const modeFocus = MODE_INSTRUCTIONS[params.mode] || MODE_INSTRUCTIONS.insight;
  const safetyDirective = params.safety.policyNotes.length
    ? `\nSafety Engine Directives:\n- ${params.safety.policyNotes.join('\n- ')}`
    : '';

  const structureInstruction = params.includeStructuredCard
    ? 'Populate structuredCard cleanly (observation, emotion, possibleNeed, reflection, practicalNextStep) because the user requested structured guidance.'
    : 'Populate structuredCard ONLY when a concise 5-part structured summary genuinely helps clarity (set hasStructuredCard=true); if natural conversation flows better, set hasStructuredCard=false.';

  const breakdownGuidance = params.includeBreakdown
    ? 'The user requested a full Conflict Mediation / Emotional Analysis breakdown (facts, interpretations, emotions, needs, requests, actions). Populate eventBreakdown and set hasEventBreakdown=true.'
    : 'Populate eventBreakdown ONLY if the user described a concrete conflict or emotionally charged event where separating Facts, Interpretations, Emotions, Needs, Requests, and Actions creates immediate clarity; otherwise set hasEventBreakdown=false.';

  return [
    modeFocus,
    `Orchestrated Perspective: ${params.route.primaryAgent} (supported by ${params.route.supportingAgents.join(', ')}).`,
    safetyDirective,
    params.memoryBlock,
    params.context.wellbeingBlock,
    params.context.eventBlock,
    structureInstruction,
    breakdownGuidance,
    `Conversation so far:\n${params.context.conversationBlock}`,
    `Respond to the User's latest message as HUMANOS AI. Keep the main reply warm, natural, calm, and psychologically observant (2-4 clear paragraphs in plain prose without markdown headers or bullet spam). Never expose internal stages or agent names. Return valid JSON matching the schema.`,
  ]
    .filter(Boolean)
    .join('\n\n');
}
