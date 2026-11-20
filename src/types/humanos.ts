export type ReflectionMode =
  | 'insight'
  | 'self-reflection'
  | 'relationship'
  | 'growth'
  | 'de-escalation'
  | 'digital-pause';

export type PatternDimension =
  | 'Values'
  | 'Strengths'
  | 'Triggers'
  | 'Challenges'
  | 'Relational & Communication';

export type HypothesisStatus = 'hypothesis' | 'resonates' | 'nuanced' | 'dismissed';

export type EventLabLens =
  | 'conflict-emotion'
  | 'behavioral-loop'
  | 'digital-check'
  | 'future-self';

export interface EventBreakdown {
  facts: string[];
  interpretations: string[];
  emotions: string[];
  needs: string[];
  requests: string[];
  actions: string[];
}

export interface StructuredGuidanceCard {
  observation: string;
  emotion: string;
  possibleNeed: string;
  reflection: string;
  practicalNextStep: string;
}

export interface EmergingHypothesis {
  dimension: PatternDimension;
  observation: string;
  rationale: string;
}

export interface DialogueMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  mode?: ReflectionMode;
  crisisDetected?: boolean;
  structuredCard?: StructuredGuidanceCard | null;
  eventBreakdown?: EventBreakdown | null;
  cognitivePatterns?: string[];
  emergingHypotheses?: EmergingHypothesis[];
  followUpQuestions?: string[];
}

export interface ReflectionSession {
  id: string;
  title: string;
  mode: ReflectionMode;
  updatedAt: string;
  messages: DialogueMessage[];
}

export interface AnalyzedEmotion {
  name: string;
  signal: string;
}

export interface BehavioralLoopAnalysis {
  trigger: string;
  thought: string;
  emotion: string;
  behavior: string;
  consequence: string;
  cognitivePatterns: string[];
  awarenessNote: string;
}

export interface DigitalBehaviorAnalysis {
  actualIssue: string;
  emotionalTrigger: string;
  likelyOutcome: string;
  healthierAlternative: string;
}

export interface FutureSelfSimulation {
  shortTermImpact: string;
  mediumTermImpact: string;
  longTermImpact: string;
  valuesAlignment: string;
  hiddenTradeoffs: string[];
}

export interface EventAnalysisRecord {
  id: string;
  createdAt: string;
  lens: EventLabLens;
  contextCategory:
    | 'Personal'
    | 'Relationship'
    | 'Work & Purpose'
    | 'Conflict & Anger'
    | 'Digital & Online';
  rawEvent: string;
  summaryTitle: string;
  facts: string[];
  interpretations: string[];
  emotions: AnalyzedEmotion[];
  needs: string[];
  requests: string[];
  actions: string[];
  behavioralLoop?: BehavioralLoopAnalysis | null;
  digitalCheck?: DigitalBehaviorAnalysis | null;
  futureSimulation?: FutureSelfSimulation | null;
  reflectiveQuestions: string[];
  crisisDetected: boolean;
}

export interface PatternHypothesis {
  id: string;
  dimension: PatternDimension;
  statement: string;
  rationale: string;
  status: HypothesisStatus;
  evidenceCount: number;
  updatedAt: string;
  source: 'dialogue' | 'event-lab' | 'synthesis' | 'user';
}

export interface WellbeingCheckIn {
  id: string;
  createdAt: string;
  mood: number;
  stress: number;
  anxiety: number;
  socialConnection: number;
  selfEsteem: number;
  motivation: number;
  energy: number;
  lifeSatisfaction: number;
  note: string;
}

export interface LifeTimelineEvent {
  id: string;
  timeframe: string;
  title: string;
  chapter: 'Childhood & Foundations' | 'Education & Early Career' | 'Relationships' | 'Turning Point' | 'Present Chapter';
  emotionalImpact: string;
  patternOrLesson: string;
  createdAt: string;
}

export interface GrowthJournalEntry {
  id: string;
  createdAt: string;
  prompt: string;
  entry: string;
  valueActivated: string;
}

export interface RelationshipNode {
  id: string;
  name: string;
  role: 'Partner' | 'Family' | 'Friend' | 'Colleague' | 'Mentor' | 'Community';
  closeness: number; // 1 to 5
  tension: number; // 1 to 5
  dynamicNote: string;
  sharedNeed: string;
  updatedAt: string;
}

export interface ExplainMePortrait {
  generatedAt: string;
  plainLanguagePortrait: string;
  coreValues: { value: string; evidence: string }[];
  potentialBlindSpots: { pattern: string; gentleReframe: string }[];
  resilienceStrengths: string[];
  purposeThread: string;
}
