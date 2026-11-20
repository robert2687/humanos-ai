import 'dotenv/config';
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  clearAuditLogsForSession,
  type GatewayRequest,
  getAuditLogsForSession,
  getSessionRecord,
  hashSessionId,
  inspectRateLimit,
  issueSessionToken,
  normalizeSurface,
  rateLimitAI,
  recordAudit,
  requireGatewaySession,
  revokeSession,
} from './server/gateway.ts';
import {
  buildBoundedContext,
  evaluateSafety,
  formatMemoryEngine,
  HUMANOS_KNOWLEDGE_CHARTER,
  orchestrateDialoguePrompt,
  routeAgents,
} from './server/orchestrator.ts';

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

  // =========================================================================
  // API GATEWAY LAYER: Authentication, Session Management, Rate Limit & Audit
  // =========================================================================

  app.post('/api/gateway/session', (req: Request, res: Response) => {
    const surface = normalizeSurface(req.body?.surface);
    const issued = issueSessionToken(surface);
    const rl = inspectRateLimit(issued.session.sid);

    recordAudit({
      sessionHash: hashSessionId(issued.session.sid),
      surface,
      endpoint: '/api/gateway/session',
      routedAgent: 'Gateway Session Issuer',
      safetyStatus: 'nominal',
      httpStatus: 201,
      latencyMs: 1,
    });

    return res.status(201).json({
      token: issued.token,
      session: {
        idHash: hashSessionId(issued.session.sid),
        surface: issued.session.surface,
        expiresAt: new Date(issued.session.exp).toISOString(),
        requestCount: issued.record.requestCount,
      },
      rateLimit: rl,
    });
  });

  app.get('/api/gateway/session', requireGatewaySession, (req: GatewayRequest, res: Response) => {
    const session = req.humanosSession!;
    const record = getSessionRecord(session.sid);
    const rl = inspectRateLimit(session.sid);

    return res.json({
      session: {
        idHash: hashSessionId(session.sid),
        surface: session.surface,
        expiresAt: new Date(session.exp).toISOString(),
        requestCount: record?.requestCount ?? 0,
      },
      rateLimit: rl,
    });
  });

  app.delete('/api/gateway/session', requireGatewaySession, (req: GatewayRequest, res: Response) => {
    const session = req.humanosSession!;
    revokeSession(session.sid);
    recordAudit({
      sessionHash: hashSessionId(session.sid),
      surface: session.surface,
      endpoint: '/api/gateway/session',
      routedAgent: 'Gateway Session Revoker',
      safetyStatus: 'nominal',
      httpStatus: 200,
      latencyMs: 1,
    });
    return res.json({ revoked: true });
  });

  app.get('/api/gateway/audit', requireGatewaySession, (req: GatewayRequest, res: Response) => {
    const session = req.humanosSession!;
    const rl = inspectRateLimit(session.sid);
    return res.json({
      sessionHash: hashSessionId(session.sid),
      surface: session.surface,
      rateLimit: rl,
      entries: getAuditLogsForSession(session.sid),
    });
  });

  app.delete('/api/gateway/audit', requireGatewaySession, (req: GatewayRequest, res: Response) => {
    const session = req.humanosSession!;
    clearAuditLogsForSession(session.sid);
    return res.json({ cleared: true });
  });

  // =========================================================================
  // AI ORCHESTRATION LAYER: Routed Endpoints
  // =========================================================================

  app.post('/api/dialogue', requireGatewaySession, rateLimitAI, async (req: GatewayRequest, res: Response) => {
    const startMs = Date.now();
    const session = req.humanosSession!;
    const surface = normalizeSurface(req.body?.surface || session.surface);
    let routedAgent = 'Psychological Insight Engine';
    let safetyStatus: 'nominal' | 'elevated-distress' | 'crisis-override' = 'nominal';

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

      const latestUserMessage = [...messages]
        .reverse()
        .find((m: { role?: string; content?: string }) => m.role === 'user')?.content || '';

      const safety = evaluateSafety(String(latestUserMessage));
      safetyStatus = safety.status;

      const route = routeAgents({
        endpoint: 'dialogue',
        mode,
        safety,
      });
      routedAgent = route.primaryAgent;

      const memoryBlock = formatMemoryEngine(profileHypotheses);
      const context = buildBoundedContext({
        messages,
        wellbeingSummary,
        activeEventContext,
      });
      const prompt = orchestrateDialoguePrompt({
        mode,
        route,
        safety,
        memoryBlock,
        context,
        includeStructuredCard,
        includeBreakdown,
      });

      const ai = getGeminiClient();
      const response = await callGeminiWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            systemInstruction: HUMANOS_KNOWLEDGE_CHARTER,
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
      const finalCrisis = Boolean(parsed.crisisDetected || safety.crisisOverride);
      if (finalCrisis) {
        safetyStatus = 'crisis-override';
        routedAgent = 'Crisis Guardian';
      }

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

      recordAudit({
        sessionHash: hashSessionId(session.sid),
        surface,
        endpoint: '/api/dialogue',
        routedAgent,
        safetyStatus,
        httpStatus: 200,
        latencyMs: Date.now() - startMs,
      });

      return res.json({
        reply: parsed.reply || '',
        crisisDetected: finalCrisis,
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
        orchestration: {
          primaryAgent: routedAgent,
          safetyStatus,
        },
      });
    } catch (err: unknown) {
      const formatted = formatApiError(err);
      recordAudit({
        sessionHash: hashSessionId(session.sid),
        surface,
        endpoint: '/api/dialogue',
        routedAgent,
        safetyStatus,
        httpStatus: formatted.status,
        latencyMs: Date.now() - startMs,
      });
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/analyze-event', requireGatewaySession, rateLimitAI, async (req: GatewayRequest, res: Response) => {
    const startMs = Date.now();
    const session = req.humanosSession!;
    const surface = normalizeSurface(req.body?.surface || session.surface);
    let routedAgent = 'Conflict Mediator';
    let safetyStatus: 'nominal' | 'elevated-distress' | 'crisis-override' = 'nominal';

    try {
      const {
        eventDescription,
        contextCategory = 'Personal',
        lens = 'conflict-emotion',
      } = req.body ?? {};

      if (!eventDescription || typeof eventDescription !== 'string' || eventDescription.trim().length < 8) {
        return res.status(400).json({ error: 'Please describe the situation in a few sentences so HUMANOS can analyze it.' });
      }

      const safety = evaluateSafety(eventDescription);
      safetyStatus = safety.status;
      const route = routeAgents({ endpoint: 'event-lab', lens, safety });
      routedAgent = route.primaryAgent;

      let lensGuidance = '';
      if (lens === 'behavioral-loop') {
        lensGuidance = `Primary Lens: Behavioral & Cognitive Distortion Analyzer (CBT + Behavioral Science).
Map the exact causal chain step-by-step:
Trigger -> Thought -> Emotion -> Behavior -> Outcome
- trigger: observable internal or external cue that sparked the chain
- thought: immediate automatic interpretation or story
- emotion: felt emotional & bodily signal
- behavior: observable action, withdrawal, or coping reaction
- outcome: immediate short-term relief vs. longer-term emotional or relational result
- interruptionPoint: one gentle, realistic pause point in this chain where noticing the thought or regulating the emotion shifts the outcome constructively
Evaluate the thought against the 5 core CBT cognitive distortions:
1. catastrophizing
2. personalization
3. overgeneralization
4. emotional reasoning
5. mind reading
Populate cognitivePatterns with concise detected labels, AND populate distortionChecks with entries for the detected/relevant distortions among those 5 (key, name, present, evidenceSignal, compassionateContext, groundedReframe), plus a non-blaming awarenessNote. Also provide brief facts, emotions, needs, and actions.`;
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

      const ai = getGeminiClient();
      const prompt = `${lensGuidance}

Orchestrated Agent: ${route.primaryAgent} (${route.supportingAgents.join(', ')}).
Context Category: ${contextCategory}
Situation described by the user:
"${eventDescription.trim()}"

Return valid JSON matching the schema. Keep language compassionate, probabilistic where appropriate, and check carefully for crisis safety indicators (crisisDetected).`;

      const response = await callGeminiWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            systemInstruction: HUMANOS_KNOWLEDGE_CHARTER,
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
                    outcome: { type: Type.STRING },
                    interruptionPoint: { type: Type.STRING },
                    cognitivePatterns: { type: Type.ARRAY, items: { type: Type.STRING } },
                    distortionChecks: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          key: { type: Type.STRING },
                          name: { type: Type.STRING },
                          present: { type: Type.BOOLEAN },
                          evidenceSignal: { type: Type.STRING },
                          compassionateContext: { type: Type.STRING },
                          groundedReframe: { type: Type.STRING },
                        },
                      },
                    },
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
      if (parsed.behavioralLoop && typeof parsed.behavioralLoop === 'object') {
        parsed.behavioralLoop = {
          ...parsed.behavioralLoop,
          outcome: String(
            parsed.behavioralLoop.outcome || parsed.behavioralLoop.consequence || ''
          ),
        };
      }
      const finalCrisis = Boolean(parsed.crisisDetected || safety.crisisOverride);
      if (finalCrisis) {
        safetyStatus = 'crisis-override';
        routedAgent = 'Crisis Guardian';
      }

      recordAudit({
        sessionHash: hashSessionId(session.sid),
        surface,
        endpoint: '/api/analyze-event',
        routedAgent,
        safetyStatus,
        httpStatus: 200,
        latencyMs: Date.now() - startMs,
      });

      return res.json({ ...parsed, crisisDetected: finalCrisis });
    } catch (err: unknown) {
      const formatted = formatApiError(err);
      recordAudit({
        sessionHash: hashSessionId(session.sid),
        surface,
        endpoint: '/api/analyze-event',
        routedAgent,
        safetyStatus,
        httpStatus: formatted.status,
        latencyMs: Date.now() - startMs,
      });
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/synthesize-patterns', requireGatewaySession, rateLimitAI, async (req: GatewayRequest, res: Response) => {
    const startMs = Date.now();
    const session = req.humanosSession!;
    const surface = normalizeSurface(req.body?.surface || session.surface);
    const safety = evaluateSafety(String(req.body?.reflectionsSummary || ''));
    const route = routeAgents({ endpoint: 'synthesis', safety });

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

${formatMemoryEngine(existingHypotheses)}

Recent Material:
${combinedInput.slice(0, 8500)}`;

      const response = await callGeminiWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            systemInstruction: HUMANOS_KNOWLEDGE_CHARTER,
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

      recordAudit({
        sessionHash: hashSessionId(session.sid),
        surface,
        endpoint: '/api/synthesize-patterns',
        routedAgent: route.primaryAgent,
        safetyStatus: safety.status,
        httpStatus: 200,
        latencyMs: Date.now() - startMs,
      });

      return res.json({ hypotheses });
    } catch (err: unknown) {
      const formatted = formatApiError(err);
      recordAudit({
        sessionHash: hashSessionId(session.sid),
        surface,
        endpoint: '/api/synthesize-patterns',
        routedAgent: route.primaryAgent,
        safetyStatus: safety.status,
        httpStatus: formatted.status,
        latencyMs: Date.now() - startMs,
      });
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/explain-me', requireGatewaySession, rateLimitAI, async (req: GatewayRequest, res: Response) => {
    const startMs = Date.now();
    const session = req.humanosSession!;
    const surface = normalizeSurface(req.body?.surface || session.surface);
    const safety = evaluateSafety(String(req.body?.contextBundle || ''));
    const route = routeAgents({ endpoint: 'explain-me', safety });

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
            systemInstruction: HUMANOS_KNOWLEDGE_CHARTER,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                plainLanguagePortrait: { type: Type.STRING },
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
                purposeThread: { type: Type.STRING },
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
      recordAudit({
        sessionHash: hashSessionId(session.sid),
        surface,
        endpoint: '/api/explain-me',
        routedAgent: route.primaryAgent,
        safetyStatus: safety.status,
        httpStatus: 200,
        latencyMs: Date.now() - startMs,
      });

      return res.json({
        ...parsed,
        generatedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const formatted = formatApiError(err);
      recordAudit({
        sessionHash: hashSessionId(session.sid),
        surface,
        endpoint: '/api/explain-me',
        routedAgent: route.primaryAgent,
        safetyStatus: safety.status,
        httpStatus: formatted.status,
        latencyMs: Date.now() - startMs,
      });
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/agents/personality-analyst', requireGatewaySession, rateLimitAI, async (req: GatewayRequest, res: Response) => {
    const startMs = Date.now();
    const session = req.humanosSession!;
    const surface = normalizeSurface(req.body?.surface || session.surface);
    const safety = evaluateSafety(String(req.body?.contextBundle || ''));
    const route = routeAgents({ endpoint: 'personality-analyst', safety });

    try {
      const { contextBundle = '' } = req.body ?? {};
      if (!contextBundle || typeof contextBundle !== 'string' || contextBundle.trim().length < 20) {
        return res.status(400).json({
          error: 'Share at least one reflection, event analysis, timeline milestone, or wellbeing entry before running Personality Analyst.',
        });
      }

      const ai = getGeminiClient();
      const prompt = `Act as the HUMANOS Personality Analyst Agent.
Responsibilities:
- personality analysis
- behavioral profiling
- value identification
- strength mapping
- growth opportunity detection

Rules:
- Ground every item in observable evidence from the user material below.
- Never label permanently or diagnose clinically; phrase traits and blind spots probabilistically and constructively (e.g., "Tendency to..." or "May overlook...").
- Keep each entry concise (4-14 words per array item) and populate 3 to 5 items per category.

User Material:
${contextBundle.slice(0, 10000)}`;

      const response = await callGeminiWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            systemInstruction: HUMANOS_KNOWLEDGE_CHARTER,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                dominant_traits: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Observed personality and behavioral tendencies.',
                },
                values: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Core personal values identified.',
                },
                motivators: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Intrinsic drivers and motivational patterns.',
                },
                blind_spots: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Potential recurring blind spots framed gently.',
                },
                strengths: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Mapped psychological and behavioral strengths.',
                },
                growth_opportunities: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Constructive growth opportunities.',
                },
              },
              required: [
                'dominant_traits',
                'values',
                'motivators',
                'blind_spots',
                'strengths',
                'growth_opportunities',
              ],
            },
          },
        })
      );

      const parsed = JSON.parse((response.text ?? '{}').trim());
      recordAudit({
        sessionHash: hashSessionId(session.sid),
        surface,
        endpoint: '/api/agents/personality-analyst',
        routedAgent: route.primaryAgent,
        safetyStatus: safety.status,
        httpStatus: 200,
        latencyMs: Date.now() - startMs,
      });

      return res.json({
        dominant_traits: Array.isArray(parsed.dominant_traits) ? parsed.dominant_traits : [],
        values: Array.isArray(parsed.values) ? parsed.values : [],
        motivators: Array.isArray(parsed.motivators) ? parsed.motivators : [],
        blind_spots: Array.isArray(parsed.blind_spots) ? parsed.blind_spots : [],
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        growth_opportunities: Array.isArray(parsed.growth_opportunities)
          ? parsed.growth_opportunities
          : [],
        generatedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const formatted = formatApiError(err);
      recordAudit({
        sessionHash: hashSessionId(session.sid),
        surface,
        endpoint: '/api/agents/personality-analyst',
        routedAgent: route.primaryAgent,
        safetyStatus: safety.status,
        httpStatus: formatted.status,
        latencyMs: Date.now() - startMs,
      });
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/agents/cognitive-distortions', requireGatewaySession, rateLimitAI, async (req: GatewayRequest, res: Response) => {
    const startMs = Date.now();
    const session = req.humanosSession!;
    const surface = normalizeSurface(req.body?.surface || session.surface);
    const rawText = String(req.body?.thoughtOrSituation || '');
    const safety = evaluateSafety(rawText);
    const route = routeAgents({ endpoint: 'cognitive-distortions', safety });
    let routedAgent = route.primaryAgent;
    let safetyStatus = safety.status;

    try {
      if (!rawText || rawText.trim().length < 8) {
        return res.status(400).json({
          error: 'Share an automatic thought, worry, or difficult moment (at least a sentence) so HUMANOS can evaluate cognitive patterns.',
        });
      }

      const ai = getGeminiClient();
      const prompt = `Act as the HUMANOS Cognitive Distortion Analyzer (evidence-informed CBT & ACT lens).
Analyze the user's thought or situation across these exact 5 cognitive distortions:
1. catastrophizing (key: "catastrophizing") — jumping to worst-case outcomes or treating an uncertain setback as an inevitable disaster
2. personalization (key: "personalization") — taking disproportionate personal blame or reading external events/moods as being caused by oneself
3. overgeneralization (key: "overgeneralization") — turning one painful moment into an absolute, permanent rule ("always", "never", "everything")
4. emotional reasoning (key: "emotional reasoning") — treating a strong feeling as objective proof of truth ("I feel inadequate, so I must be failing")
5. mind reading (key: "mind reading") — assuming others' negative motives, judgments, or unspoken thoughts without clear evidence

Rules:
- Return all 5 items in the "distortions" array in that exact order, using the exact lowercase "key" values above.
- Set "present": true ONLY when the user's words show a genuine tendency toward that distortion; otherwise set "present": false and explain briefly why it does not appear active.
- Never shame, scold, or diagnose. Frame "compassionateContext" around what fear or unmet need the mind may be trying to protect.
- Keep "groundedReframe" calm, realistic, and non-toxic-positivity.
- Check carefully for crisis markers ("crisisDetected").

User Thought or Situation:
"${rawText.trim().slice(0, 4000)}"`;

      const response = await callGeminiWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            systemInstruction: HUMANOS_KNOWLEDGE_CHARTER,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                thoughtSummary: { type: Type.STRING },
                emotionalUndercurrent: { type: Type.STRING },
                distortions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      key: { type: Type.STRING },
                      name: { type: Type.STRING },
                      present: { type: Type.BOOLEAN },
                      evidenceSignal: { type: Type.STRING },
                      compassionateContext: { type: Type.STRING },
                      groundedReframe: { type: Type.STRING },
                    },
                    required: [
                      'key',
                      'name',
                      'present',
                      'evidenceSignal',
                      'compassionateContext',
                      'groundedReframe',
                    ],
                  },
                },
                balancedPerspective: { type: Type.STRING },
                crisisDetected: { type: Type.BOOLEAN },
              },
              required: [
                'thoughtSummary',
                'emotionalUndercurrent',
                'distortions',
                'balancedPerspective',
                'crisisDetected',
              ],
            },
          },
        })
      );

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const finalCrisis = Boolean(parsed.crisisDetected || safety.crisisOverride);
      if (finalCrisis) {
        safetyStatus = 'crisis-override';
        routedAgent = 'Crisis Guardian';
      }

      const canonicalOrder = [
        { key: 'catastrophizing', name: 'Catastrophizing' },
        { key: 'personalization', name: 'Personalization' },
        { key: 'overgeneralization', name: 'Overgeneralization' },
        { key: 'emotional reasoning', name: 'Emotional Reasoning' },
        { key: 'mind reading', name: 'Mind Reading' },
      ] as const;

      const rawList = Array.isArray(parsed.distortions) ? parsed.distortions : [];
      const normalizedDistortions = canonicalOrder.map((spec) => {
        const match = rawList.find(
          (item: { key?: string; name?: string }) =>
            String(item?.key || '').toLowerCase().trim() === spec.key ||
            String(item?.name || '').toLowerCase().trim() === spec.key
        );
        return {
          key: spec.key,
          name: spec.name,
          present: Boolean(match?.present),
          evidenceSignal: String(
            match?.evidenceSignal ||
              (match?.present
                ? 'Subtle pattern noticed in framing.'
                : 'Not strongly signaled in this reflection.')
          ),
          compassionateContext: String(
            match?.compassionateContext ||
              'The mind often uses protective shortcuts under stress or uncertainty.'
          ),
          groundedReframe: String(
            match?.groundedReframe ||
              'Pause to separate observable facts from fast protective assumptions.'
          ),
        };
      });

      recordAudit({
        sessionHash: hashSessionId(session.sid),
        surface,
        endpoint: '/api/agents/cognitive-distortions',
        routedAgent,
        safetyStatus,
        httpStatus: 200,
        latencyMs: Date.now() - startMs,
      });

      return res.json({
        thoughtSummary: String(parsed.thoughtSummary || ''),
        emotionalUndercurrent: String(parsed.emotionalUndercurrent || ''),
        distortions: normalizedDistortions,
        balancedPerspective: String(parsed.balancedPerspective || ''),
        crisisDetected: finalCrisis,
        generatedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const formatted = formatApiError(err);
      recordAudit({
        sessionHash: hashSessionId(session.sid),
        surface,
        endpoint: '/api/agents/cognitive-distortions',
        routedAgent,
        safetyStatus,
        httpStatus: formatted.status,
        latencyMs: Date.now() - startMs,
      });
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/agents/relationship-analyst', requireGatewaySession, rateLimitAI, async (req: GatewayRequest, res: Response) => {
    const startMs = Date.now();
    const session = req.humanosSession!;
    const surface = normalizeSurface(req.body?.surface || session.surface);
    const {
      area = 'Romantic Relationships',
      situationOrDynamic = '',
      mappedNodesSummary = '',
    } = req.body ?? {};
    const safety = evaluateSafety(String(situationOrDynamic || ''));
    const route = routeAgents({ endpoint: 'relationship-analyst', safety });
    let routedAgent = route.primaryAgent;
    let safetyStatus = safety.status;

    try {
      if (!situationOrDynamic || typeof situationOrDynamic !== 'string' || situationOrDynamic.trim().length < 10) {
        return res.status(400).json({
          error: 'Describe the relationship dynamic, tension, or communication question in a sentence or two.',
        });
      }

      const validAreas = new Set([
        'Romantic Relationships',
        'Friendships',
        'Family',
        'Work Relationships',
      ]);
      const normalizedArea = validAreas.has(String(area))
        ? String(area)
        : 'Romantic Relationships';

      const areaLensMap: Record<string, string> = {
        'Romantic Relationships':
          'Focus on attachment dynamics, emotional safety, bids for connection, vulnerability, expectations, and reciprocal care.',
        Friendships:
          'Focus on mutual effort, unspoken expectations, social energy, honest boundaries, and trust repair.',
        Family:
          'Focus on inherited roles, individuation vs. obligation, generational triggers, and respectful emotional boundaries.',
        'Work Relationships':
          'Focus on psychological safety, role clarity, peer/authority communication, accountability, and sustainable work boundaries.',
      };

      const ai = getGeminiClient();
      const prompt = `Act as the HUMANOS Relationship Specialist & Conflict Mediator.
Relationship Area: ${normalizedArea}
Area Lens: ${areaLensMap[normalizedArea]}

Rules:
- Stay neutral, empathetic, and balanced toward both people without demonizing either side.
- Ground observations in Attachment Theory, Conflict Resolution, and Emotional Intelligence.
- Separate needs and communication patterns clearly, and offer one respectful boundary or constructive request.
- Check carefully for crisis or safety indicators ("crisisDetected").

${mappedNodesSummary ? `Context from User's Relationship Graph (${normalizedArea}):\n${String(mappedNodesSummary).slice(0, 1500)}\n` : ''}
Situation / Dynamic Described:
"${situationOrDynamic.trim().slice(0, 4000)}"`;

      const response = await callGeminiWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            systemInstruction: HUMANOS_KNOWLEDGE_CHARTER,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                dynamicSummary: { type: Type.STRING },
                yourPerspectiveAndNeeds: { type: Type.STRING },
                otherPerspectiveAndNeeds: { type: Type.STRING },
                communicationPattern: { type: Type.STRING },
                boundaryOrRequest: { type: Type.STRING },
                reflectionQuestion: { type: Type.STRING },
                crisisDetected: { type: Type.BOOLEAN },
              },
              required: [
                'dynamicSummary',
                'yourPerspectiveAndNeeds',
                'otherPerspectiveAndNeeds',
                'communicationPattern',
                'boundaryOrRequest',
                'reflectionQuestion',
                'crisisDetected',
              ],
            },
          },
        })
      );

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const finalCrisis = Boolean(parsed.crisisDetected || safety.crisisOverride);
      if (finalCrisis) {
        safetyStatus = 'crisis-override';
        routedAgent = 'Crisis Guardian';
      }

      recordAudit({
        sessionHash: hashSessionId(session.sid),
        surface,
        endpoint: '/api/agents/relationship-analyst',
        routedAgent,
        safetyStatus,
        httpStatus: 200,
        latencyMs: Date.now() - startMs,
      });

      return res.json({
        area: normalizedArea,
        dynamicSummary: String(parsed.dynamicSummary || ''),
        yourPerspectiveAndNeeds: String(parsed.yourPerspectiveAndNeeds || ''),
        otherPerspectiveAndNeeds: String(parsed.otherPerspectiveAndNeeds || ''),
        communicationPattern: String(parsed.communicationPattern || ''),
        boundaryOrRequest: String(parsed.boundaryOrRequest || ''),
        reflectionQuestion: String(parsed.reflectionQuestion || ''),
        crisisDetected: finalCrisis,
        generatedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const formatted = formatApiError(err);
      recordAudit({
        sessionHash: hashSessionId(session.sid),
        surface,
        endpoint: '/api/agents/relationship-analyst',
        routedAgent,
        safetyStatus,
        httpStatus: formatted.status,
        latencyMs: Date.now() - startMs,
      });
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // =========================================================================
  // COMPANION SURFACE ENDPOINTS: Browser Extension & Smart Watch Integration
  // =========================================================================

  app.post('/api/extension/pause-check', requireGatewaySession, rateLimitAI, async (req: GatewayRequest, res: Response) => {
    const startMs = Date.now();
    const session = req.humanosSession!;
    const surface: 'extension' = 'extension';
    const { draftReply = '', contextPost = '' } = req.body ?? {};
    const safety = evaluateSafety(`${contextPost}\n${draftReply}`);
    const route = routeAgents({ endpoint: 'extension-pause', safety });

    try {
      if (!draftReply || typeof draftReply !== 'string' || draftReply.trim().length < 4) {
        return res.status(400).json({ error: 'Provide a draft reply or message to run the Browser Extension pause check.' });
      }

      const ai = getGeminiClient();
      const prompt = `Browser Extension Digital Pause Check (Toxicity Detector).
Context post or thread: "${String(contextPost || 'Not provided').slice(0, 1000)}"
User's draft reply before sending: "${draftReply.trim().slice(0, 1500)}"

Without shaming or lecturing, identify:
1. actualIssue
2. emotionalTrigger
3. likelyOutcome
4. healthierAlternative (calm, clear, non-escalating alternative wording).`;

      const response = await callGeminiWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            systemInstruction: HUMANOS_KNOWLEDGE_CHARTER,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                actualIssue: { type: Type.STRING },
                emotionalTrigger: { type: Type.STRING },
                likelyOutcome: { type: Type.STRING },
                healthierAlternative: { type: Type.STRING },
                escalationRisk: { type: Type.STRING, description: 'Low, Moderate, or High' },
              },
              required: [
                'actualIssue',
                'emotionalTrigger',
                'likelyOutcome',
                'healthierAlternative',
                'escalationRisk',
              ],
            },
          },
        })
      );

      const parsed = JSON.parse((response.text ?? '{}').trim());
      recordAudit({
        sessionHash: hashSessionId(session.sid),
        surface,
        endpoint: '/api/extension/pause-check',
        routedAgent: route.primaryAgent,
        safetyStatus: safety.status,
        httpStatus: 200,
        latencyMs: Date.now() - startMs,
      });

      return res.json(parsed);
    } catch (err: unknown) {
      const formatted = formatApiError(err);
      recordAudit({
        sessionHash: hashSessionId(session.sid),
        surface,
        endpoint: '/api/extension/pause-check',
        routedAgent: route.primaryAgent,
        safetyStatus: safety.status,
        httpStatus: formatted.status,
        latencyMs: Date.now() - startMs,
      });
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/watch/pulse', requireGatewaySession, (req: GatewayRequest, res: Response) => {
    const startMs = Date.now();
    const session = req.humanosSession!;
    const {
      moodPulse = 3,
      restingStress = 3,
      energy = 3,
      breathingMinutes = 0,
    } = req.body ?? {};

    const clamp = (n: unknown) => Math.min(5, Math.max(1, Math.round(Number(n) || 3)));
    const normalized = {
      mood: clamp(moodPulse),
      stress: clamp(restingStress),
      energy: clamp(energy),
      breathingMinutes: Math.max(0, Math.min(60, Math.round(Number(breathingMinutes) || 0))),
      syncedAt: new Date().toISOString(),
    };

    const route = routeAgents({
      endpoint: 'watch-pulse',
      safety: { status: 'nominal', crisisOverride: false, toxicitySignal: false, policyNotes: [] },
    });

    recordAudit({
      sessionHash: hashSessionId(session.sid),
      surface: 'watch',
      endpoint: '/api/watch/pulse',
      routedAgent: route.primaryAgent,
      safetyStatus: 'nominal',
      httpStatus: 200,
      latencyMs: Date.now() - startMs,
    });

    return res.json({
      synced: true,
      pulse: normalized,
      guidance:
        normalized.stress >= 4 && normalized.energy <= 2
          ? 'Watch pulse shows elevated stress alongside lower energy—consider a brief 4-4-6 breathing pause before your next commitment.'
          : 'Watch pulse synced cleanly to your Wellbeing Monitor.',
    });
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
