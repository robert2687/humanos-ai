import 'dotenv/config';
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const MODEL_NAME = 'gemini-4-hydrogen';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const HUMANOS_V3_CHARTER = `You are HUMANOS AI (Human Intelligence & Wellbeing Operating System).
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
4. Identify cognitive patterns (catastrophizing, mind reading, overgeneralization, black-and-white thinking, personalization, emotional reasoning — explore gently, never criticize).
5. Identify behavioral patterns (Trigger -> Thought -> Emotion -> Behavior -> Consequence, avoidance, self-sabotage).
6. Identify opportunities for self-awareness.
7. Provide supportive, grounded guidance.

INTERNAL MULTI-AGENT PERSPECTIVES (Synthesize seamlessly):
- Personality DNA & Human Digital Twin: use probabilistic language ("may", "might", "appears", "possibly", "I notice a tendency...", "There may be a recurring pattern..."). Never assume permanence.
- Emotional Intelligence & Cognitive Distortion Analyzer: connect emotion -> need -> behavior, explain emotional signals gently, and invite alternative perspectives on rigid thoughts.
- Relationship Graph & Conflict Mediator: remain neutral, never take sides, make both perspectives visible, separate FACTS, INTERPRETATIONS, EMOTIONS, NEEDS, and REQUESTS.
- Toxicity Detector / Digital Behavior Monitor: if the user shares toxic comments, hateful messages, social media arguments, or online conflicts, never shame them; identify the actual issue, emotional trigger, likely outcome, and a healthier alternative response.
- Purpose Discovery, Growth & Wellbeing Monitor: encourage sustainable, realistic progress anchored in values, strengths, resilience, and observable wellbeing trends without unrealistic optimism.

CRISIS GUARDIAN (HIGHEST PRIORITY):
- If the user expresses suicidal thoughts, self-harm intentions, desire to die, hopelessness, or immediate danger:
  Set crisisDetected to true immediately.
  1. Stay calm.
  2. Validate distress with compassion.
  3. Encourage immediate human support (988 Suicide & Crisis Lifeline by calling or texting 988 in US/Canada, Crisis Text Line by texting HOME to 741741, or international lines at findahelpline.com, or trusted people).
  4. Encourage emergency services when necessary.
  5. Maintain warm supportive engagement.
  NEVER provide instructions for self-harm, NEVER normalize suicide, NEVER assist dangerous behavior.

COMMUNICATION STYLE:
- Warm, intelligent, reflective, professional, calm, respectful, emotionally aware.
- Avoid judgment, moralizing, shaming, manipulation, fear tactics, or generic motivation.`;

const MODE_LENS_INSTRUCTIONS: Record<string, string> = {
  insight:
    'Active Focus: Integrated Psychological Insight. Blend emotional awareness, cognitive clarity, and probabilistic pattern observation naturally.',
  'self-reflection':
    'Active Focus: Behavioral & Cognitive Self-Reflection. Gently illuminate Trigger -> Thought -> Emotion -> Behavior loops, blind spots, or cognitive distortions without criticism.',
  relationship:
    'Active Focus: Relationship Graph & Conflict Mediation. Stay neutral and balanced across all perspectives; examine expectations, attachment dynamics, communication, and unspoken needs.',
  growth:
    'Active Focus: Purpose Discovery, Values & Resilience. Connect current tensions to core values, strengths, meaning, and realistic sustainable next steps.',
  'de-escalation':
    'Active Focus: Anger & Conflict De-escalation. Validate emotional intensity without endorsing harm; identify what boundary, fairness, or respect feels threatened; separate facts from interpretations and support constructive requests.',
  'digital-pause':
    'Active Focus: Toxicity Detector & Digital Pause. When the user brings an online conflict, heated message, or toxic thread, clarify the actual issue, emotional trigger, likely outcome of reacting impulsively, and a healthier alternative response without shaming.',
};

const VALID_DIMENSIONS = [
  'Values',
  'Strengths',
  'Triggers',
  'Challenges',
  'Relational & Communication',
] as const;

async function callGeminiWithRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (retries > 0 && (status === 500 || status === 503)) {
      await new Promise((r) => setTimeout(r, 800));
      return callGeminiWithRetry(fn, retries - 1);
    }
    throw err;
  }
}

function formatApiError(err: unknown): { status: number; message: string } {
  const errorObj = err as { status?: number; message?: string };
  const msg = errorObj?.message || 'An unexpected error occurred while contacting HUMANOS intelligence.';
  const status = errorObj?.status && errorObj.status >= 400 && errorObj.status < 600 ? errorObj.status : 500;

  if (status === 403 || msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED')) {
    return {
      status: 403,
      message: 'Gemini API access was declined. Please verify your GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (status === 429 || msg.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'Rate or quota limit reached. Please pause briefly and try again, or review your key quota in Settings > Secrets.',
    };
  }
  if (msg.includes('GEMINI_API_KEY is not configured')) {
    return {
      status: 503,
      message: 'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets to enable AI reflections.',
    };
  }
  return { status, message: msg };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', version: '3.0', model: MODEL_NAME });
  });

  app.post('/api/dialogue', async (req: Request, res: Response) => {
    try {
      const {
        messages = [],
        mode = 'insight',
        profileHypotheses = [],
        wellbeingSummary = '',
        includeBreakdown = false,
        includeStructuredCard = false,
        activeEventContext = null,
      } = req.body ?? {};

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'At least one message is required for dialogue.' });
      }

      const ai = getGeminiClient();
      const lensInstruction = MODE_LENS_INSTRUCTIONS[mode] || MODE_LENS_INSTRUCTIONS.insight;

      const workingModelContext =
        Array.isArray(profileHypotheses) && profileHypotheses.length > 0
          ? `\nHuman Digital Twin (probabilistic patterns — never treat as permanent truth):\n${profileHypotheses
              .slice(0, 12)
              .map(
                (h: { dimension: string; statement: string; status: string }) =>
                  `- [${h.dimension} | ${h.status}]: ${h.statement}`
              )
              .join('\n')}`
          : '\nNo prior Human Digital Twin entries yet; observe gently without overreaching.';

      const wellbeingNote = wellbeingSummary
        ? `\nRecent Observable Wellbeing Check-ins:\n${wellbeingSummary}`
        : '';

      const eventContextNote = activeEventContext
        ? `\nAttached Event Lab Record:\nTitle: ${activeEventContext.summaryTitle}\nEvent: ${activeEventContext.rawEvent}\nEmotions: ${(activeEventContext.emotions || []).map((e: { name: string }) => e.name).join(', ')}\nNeeds: ${(activeEventContext.needs || []).join(', ')}`
        : '';

      const structureInstruction = includeStructuredCard
        ? 'Populate structuredCard cleanly (observation, emotion, possibleNeed, reflection, practicalNextStep) because the user requested structured guidance.'
        : 'Populate structuredCard ONLY when a concise 5-part structured summary genuinely helps clarity (set hasStructuredCard=true); if natural conversation flows better, set hasStructuredCard=false.';

      const breakdownGuidance = includeBreakdown
        ? 'The user requested a full Conflict Mediation / Emotional Analysis breakdown (facts, interpretations, emotions, needs, requests, actions). Populate eventBreakdown and set hasEventBreakdown=true.'
        : 'Populate eventBreakdown ONLY if the user described a concrete conflict or emotionally charged event where separating Facts, Interpretations, Emotions, Needs, Requests, and Actions creates immediate clarity; otherwise set hasEventBreakdown=false.';

      const conversationHistory = messages
        .slice(-14)
        .map((m: { role: string; content: string }) => `${m.role === 'user' ? 'User' : 'HUMANOS'}: ${m.content}`)
        .join('\n\n');

      const prompt = `${lensInstruction}${workingModelContext}${wellbeingNote}${eventContextNote}

${structureInstruction}
${breakdownGuidance}

Conversation so far:
${conversationHistory}

Respond to the User's latest message as HUMANOS AI. Keep the main reply warm, natural, calm, and psychologically observant (2-4 clear paragraphs in plain prose without markdown headers or bullet spam). Never expose your internal stages or agent names. Return valid JSON matching the schema.`;

      const response = await callGeminiWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            systemInstruction: HUMANOS_V3_CHARTER,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                reply: { type: Type.STRING },
                crisisDetected: { type: Type.BOOLEAN },
                suggestedMode: { type: Type.STRING },
                hasStructuredCard: { type: Type.BOOLEAN },
                structuredCard: {
                  type: Type.OBJECT,
                  properties: {
                    observation: { type: Type.STRING },
                    emotion: { type: Type.STRING },
                    possibleNeed: { type: Type.STRING },
                    reflection: { type: Type.STRING },
                    practicalNextStep: { type: Type.STRING },
                  },
                },
                hasEventBreakdown: { type: Type.BOOLEAN },
                eventBreakdown: {
                  type: Type.OBJECT,
                  properties: {
                    facts: { type: Type.ARRAY, items: { type: Type.STRING } },
                    interpretations: { type: Type.ARRAY, items: { type: Type.STRING } },
                    emotions: { type: Type.ARRAY, items: { type: Type.STRING } },
                    needs: { type: Type.ARRAY, items: { type: Type.STRING } },
                    requests: { type: Type.ARRAY, items: { type: Type.STRING } },
                    actions: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                },
                cognitivePatterns: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                emergingHypotheses: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      dimension: { type: Type.STRING },
                      observation: { type: Type.STRING },
                      rationale: { type: Type.STRING },
                    },
                  },
                },
                followUpQuestions: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: [
                'reply',
                'crisisDetected',
                'suggestedMode',
                'hasStructuredCard',
                'hasEventBreakdown',
                'cognitivePatterns',
                'emergingHypotheses',
                'followUpQuestions',
              ],
            },
          },
        })
      );

      const parsed = JSON.parse((response.text ?? '{}').trim());

      const sanitizedHypotheses = Array.isArray(parsed.emergingHypotheses)
        ? parsed.emergingHypotheses
            .slice(0, 2)
            .map((h: { dimension?: string; observation?: string; rationale?: string }) => ({
              dimension: VALID_DIMENSIONS.includes(h.dimension as (typeof VALID_DIMENSIONS)[number])
                ? h.dimension
                : 'Challenges',
              observation: String(h.observation || '').trim(),
              rationale: String(h.rationale || '').trim(),
            }))
            .filter((h: { observation: string }) => h.observation.length > 0)
        : [];

      const eventBreakdown =
        parsed.hasEventBreakdown && parsed.eventBreakdown
          ? {
              facts: Array.isArray(parsed.eventBreakdown.facts) ? parsed.eventBreakdown.facts : [],
              interpretations: Array.isArray(parsed.eventBreakdown.interpretations)
                ? parsed.eventBreakdown.interpretations
                : [],
              emotions: Array.isArray(parsed.eventBreakdown.emotions) ? parsed.eventBreakdown.emotions : [],
              needs: Array.isArray(parsed.eventBreakdown.needs) ? parsed.eventBreakdown.needs : [],
              requests: Array.isArray(parsed.eventBreakdown.requests) ? parsed.eventBreakdown.requests : [],
              actions: Array.isArray(parsed.eventBreakdown.actions) ? parsed.eventBreakdown.actions : [],
            }
          : null;

      const structuredCard =
        parsed.hasStructuredCard && parsed.structuredCard && parsed.structuredCard.observation
          ? {
              observation: String(parsed.structuredCard.observation || ''),
              emotion: String(parsed.structuredCard.emotion || ''),
              possibleNeed: String(parsed.structuredCard.possibleNeed || ''),
              reflection: String(parsed.structuredCard.reflection || ''),
              practicalNextStep: String(parsed.structuredCard.practicalNextStep || ''),
            }
          : null;

      return res.json({
        reply: parsed.reply || '',
        crisisDetected: Boolean(parsed.crisisDetected),
        suggestedMode: parsed.suggestedMode || mode,
        structuredCard,
        eventBreakdown,
        cognitivePatterns: Array.isArray(parsed.cognitivePatterns)
          ? parsed.cognitivePatterns.slice(0, 2)
          : [],
        emergingHypotheses: sanitizedHypotheses,
        followUpQuestions: Array.isArray(parsed.followUpQuestions)
          ? parsed.followUpQuestions.slice(0, 2)
          : [],
      });
    } catch (err: unknown) {
      const formatted = formatApiError(err);
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/analyze-event', async (req: Request, res: Response) => {
    try {
      const {
        eventDescription,
        contextCategory = 'Personal',
        lens = 'conflict-emotion',
      } = req.body ?? {};

      if (!eventDescription || typeof eventDescription !== 'string' || eventDescription.trim().length < 8) {
        return res.status(400).json({ error: 'Please describe the situation in a few sentences so HUMANOS can analyze it.' });
      }

      const ai = getGeminiClient();

      let lensGuidance = '';
      if (lens === 'behavioral-loop') {
        lensGuidance = `Primary Lens: Behavioral & Cognitive Distortion Analyzer (CBT + Behavioral Science).
Map the exact sequence: Trigger -> Thought -> Emotion -> Behavior -> Consequence.
Identify any gentle cognitive pattern tendencies (catastrophizing, mind reading, overgeneralization, black-and-white thinking, personalization, emotional reasoning) without criticism, plus a non-blaming awarenessNote. Also provide brief facts, emotions, needs, and actions.`;
      } else if (lens === 'digital-check') {
        lensGuidance = `Primary Lens: Toxicity Detector & Digital Behavior Monitor.
The user is sharing an online conflict, heated message, toxic comment, or draft reply they feel tempted to send.
Never shame the user. Populate digitalCheck thoroughly with:
1. actualIssue (what is actually at stake beneath the noise)
2. emotionalTrigger (what feeling or boundary was activated)
3. likelyOutcome (realistic likely consequence if responding impulsively)
4. healthierAlternative (a calm, constructive, dignified alternative response or choice).
Also note key emotions, needs, and facts.`;
      } else if (lens === 'future-self') {
        lensGuidance = `Primary Lens: Future Self Simulator (Decision & Consequence Exploration via ACT + Motivational Psychology).
The user is weighing a choice, boundary, or life decision. Populate futureSimulation thoroughly with:
- shortTermImpact (Next 1-2 weeks: emotional relief vs. friction)
- mediumTermImpact (6-12 months: habits, relationships, burnout/stress trajectory)
- longTermImpact (3-5 years: identity, self-respect, fulfillment)
- valuesAlignment (which personal values this choice honors or strains)
- hiddenTradeoffs (2-3 second-order consequences or blind spots to consider).
Also note key facts, emotions, needs, and practical next actions.`;
      } else {
        lensGuidance = `Primary Lens: Conflict Mediator & Emotional Mapping (DBT + Conflict Resolution).
Strictly separate:
- FACTS (observable camera-level reality)
- INTERPRETATIONS (stories, assumptions, or beliefs applied)
- EMOTIONS (with Emotion Mapping: explain what boundary, safety, fairness, or attachment signal the emotion may carry)
- NEEDS (underlying human needs)
- REQUESTS (respectful, clear interpersonal requests)
- ACTIONS (constructive personal next steps).`;
      }

      const prompt = `${lensGuidance}

Context Category: ${contextCategory}
Situation described by the user:
"${eventDescription.trim()}"

Return valid JSON matching the schema. Keep language compassionate, probabilistic where appropriate, and check carefully for crisis safety indicators (crisisDetected).`;

      const response = await callGeminiWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            systemInstruction: HUMANOS_V3_CHARTER,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summaryTitle: { type: Type.STRING },
                facts: { type: Type.ARRAY, items: { type: Type.STRING } },
                interpretations: { type: Type.ARRAY, items: { type: Type.STRING } },
                emotions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      signal: { type: Type.STRING },
                    },
                  },
                },
                needs: { type: Type.ARRAY, items: { type: Type.STRING } },
                requests: { type: Type.ARRAY, items: { type: Type.STRING } },
                actions: { type: Type.ARRAY, items: { type: Type.STRING } },
                behavioralLoop: {
                  type: Type.OBJECT,
                  properties: {
                    trigger: { type: Type.STRING },
                    thought: { type: Type.STRING },
                    emotion: { type: Type.STRING },
                    behavior: { type: Type.STRING },
                    consequence: { type: Type.STRING },
                    cognitivePatterns: { type: Type.ARRAY, items: { type: Type.STRING } },
                    awarenessNote: { type: Type.STRING },
                  },
                },
                digitalCheck: {
                  type: Type.OBJECT,
                  properties: {
                    actualIssue: { type: Type.STRING },
                    emotionalTrigger: { type: Type.STRING },
                    likelyOutcome: { type: Type.STRING },
                    healthierAlternative: { type: Type.STRING },
                  },
                },
                futureSimulation: {
                  type: Type.OBJECT,
                  properties: {
                    shortTermImpact: { type: Type.STRING },
                    mediumTermImpact: { type: Type.STRING },
                    longTermImpact: { type: Type.STRING },
                    valuesAlignment: { type: Type.STRING },
                    hiddenTradeoffs: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                },
                reflectiveQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
                crisisDetected: { type: Type.BOOLEAN },
              },
              required: [
                'summaryTitle',
                'facts',
                'interpretations',
                'emotions',
                'needs',
                'requests',
                'actions',
                'reflectiveQuestions',
                'crisisDetected',
              ],
            },
          },
        })
      );

      const parsed = JSON.parse((response.text ?? '{}').trim());
      return res.json(parsed);
    } catch (err: unknown) {
      const formatted = formatApiError(err);
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/synthesize-patterns', async (req: Request, res: Response) => {
    try {
      const {
        reflectionsSummary = '',
        wellbeingSummary = '',
        existingHypotheses = [],
      } = req.body ?? {};

      const combinedInput = [reflectionsSummary, wellbeingSummary].filter(Boolean).join('\n\n');
      if (combinedInput.trim().length < 20) {
        return res.status(400).json({
          error: 'Share at least one dialogue reflection, event analysis, or wellbeing check-in before synthesizing patterns.',
        });
      }

      const ai = getGeminiClient();
      const prompt = `Review the user's recent reflections, event analyses, wellbeing check-ins, and existing Human Digital Twin entries below.
Synthesize up to 4 fresh, non-redundant probabilistic observations across:
- Values (Values Mapper)
- Strengths (Positive Psychology strengths & resilience)
- Triggers (Emotional Memory & sensitivities)
- Challenges (Blind Spot Finder & recurring friction)
- Relational & Communication (Attachment & Conflict dynamics)

Rules:
- Every statement MUST use probabilistic wording ("may", "might", "appears", "possibly", "I notice a tendency...").
- Store only patterns. Never assume permanence or diagnose.

Existing Model Entries:
${JSON.stringify(existingHypotheses.slice(0, 15))}

Recent Material:
${combinedInput.slice(0, 8500)}`;

      const response = await callGeminiWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            systemInstruction: HUMANOS_V3_CHARTER,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                hypotheses: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      dimension: { type: Type.STRING },
                      statement: { type: Type.STRING },
                      rationale: { type: Type.STRING },
                    },
                  },
                },
              },
              required: ['hypotheses'],
            },
          },
        })
      );

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const hypotheses = Array.isArray(parsed.hypotheses)
        ? parsed.hypotheses
            .slice(0, 4)
            .map((h: { dimension?: string; statement?: string; rationale?: string }) => ({
              dimension: VALID_DIMENSIONS.includes(h.dimension as (typeof VALID_DIMENSIONS)[number])
                ? h.dimension
                : 'Challenges',
              statement: String(h.statement || '').trim(),
              rationale: String(h.rationale || '').trim(),
            }))
            .filter((h: { statement: string }) => h.statement.length > 0)
        : [];

      return res.json({ hypotheses });
    } catch (err: unknown) {
      const formatted = formatApiError(err);
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/explain-me', async (req: Request, res: Response) => {
    try {
      const { contextBundle = '' } = req.body ?? {};
      if (!contextBundle || typeof contextBundle !== 'string' || contextBundle.trim().length < 25) {
        return res.status(400).json({
          error: 'Share a few reflections, event analyses, timeline entries, or wellbeing check-ins before generating an Explain Me portrait.',
        });
      }

      const ai = getGeminiClient();
      const prompt = `Activate Explain Me Mode + Blind Spot Finder + Values Mapper + Purpose Discovery.
Using the user's Human Digital Twin material below, write a warm, plain-language portrait of how they appear to navigate emotions, decisions, relationships, and meaning.

Rules:
- Write in clear, accessible everyday English—avoid clinical jargon.
- Keep all observations probabilistic ("appears", "may", "tends to", "possibly").
- Highlight genuine strengths alongside gentle, non-judgmental blind spots.
- Identify core values evidenced in their stories and one realistic purpose/direction thread.

User Material:
${contextBundle.slice(0, 10000)}`;

      const response = await callGeminiWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            systemInstruction: HUMANOS_V3_CHARTER,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                plainLanguagePortrait: {
                  type: Type.STRING,
                  description: '2-3 warm, clear paragraphs explaining their personality tendencies and emotional style in plain language.',
                },
                coreValues: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      value: { type: Type.STRING },
                      evidence: { type: Type.STRING },
                    },
                  },
                },
                potentialBlindSpots: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      pattern: { type: Type.STRING },
                      gentleReframe: { type: Type.STRING },
                    },
                  },
                },
                resilienceStrengths: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                purposeThread: {
                  type: Type.STRING,
                },
              },
              required: [
                'plainLanguagePortrait',
                'coreValues',
                'potentialBlindSpots',
                'resilienceStrengths',
                'purposeThread',
              ],
            },
          },
        })
      );

      const parsed = JSON.parse((response.text ?? '{}').trim());
      return res.json({
        ...parsed,
        generatedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const formatted = formatApiError(err);
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HUMANOS AI v3.0 server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start HUMANOS AI server:', err);
  process.exit(1);
});
