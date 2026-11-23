export type ReflectionMode =
  | 'insight'
  | 'self-reflection'
  | 'relationship'
  | 'growth'
  | 'de-escalation'
  | 'digital-pause';

export type PatternDimension =
  | 'Values'
  | 'Triggers'
  | 'Strengths'
  | 'Recurring Concerns'
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

export type CrisisRiskCategory =
  | 'self-harm risk'
  | 'suicide indicators'
  | 'severe depression'
  | 'panic attacks'
  | 'emotional collapse';

export interface SafetySignalDetail {
  category: CrisisRiskCategory;
  label: string;
  detected: boolean;
  rationale: string;
}

export interface SafetyAssessment {
  crisisDetected: boolean;
  severity: 'nominal' | 'elevated-distress' | 'crisis-override';
  detectedCategories: CrisisRiskCategory[];
  signals: SafetySignalDetail[];
  stabilizationGuidance: string;
  recommendedAction: string;
  checkedAt: string;
}

export interface DialogueMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  mode?: ReflectionMode;
  crisisDetected?: boolean;
  safetyCategories?: CrisisRiskCategory[];
  structuredCard?: StructuredGuidanceCard | null;
  eventBreakdown?: EventBreakdown | null;
  cognitivePatterns?: string[];
  emergingHypotheses?: EmergingHypothesis[];
  userModelUpdates?: Array<{
    domain: UserModelDomain;
    observation: string;
    evidence: string;
  }>;
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

export type CognitiveDistortionKey =
  | 'catastrophizing'
  | 'personalization'
  | 'overgeneralization'
  | 'emotional reasoning'
  | 'mind reading';

export interface CognitiveDistortionCheck {
  key: CognitiveDistortionKey;
  name: string;
  present: boolean;
  evidenceSignal: string;
  compassionateContext: string;
  groundedReframe: string;
}

export interface CognitiveDistortionReport {
  id: string;
  createdAt: string;
  rawThought: string;
  thoughtSummary: string;
  emotionalUndercurrent: string;
  distortions: CognitiveDistortionCheck[];
  balancedPerspective: string;
  crisisDetected: boolean;
  safetyCategories?: CrisisRiskCategory[];
}

export interface BehavioralLoopAnalysis {
  trigger: string;
  thought: string;
  emotion: string;
  behavior: string;
  outcome: string;
  consequence?: string;
  interruptionPoint?: string;
  cognitivePatterns: string[];
  distortionChecks?: CognitiveDistortionCheck[];
  awarenessNote: string;
}

export type SocialPlatform =
  | 'Facebook'
  | 'Instagram'
  | 'Reddit'
  | 'Discord'
  | 'LinkedIn'
  | 'X/Twitter';

export interface DigitalBehaviorAnalysis {
  platform?: SocialPlatform;
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
  safetyCategories?: CrisisRiskCategory[];
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
  sleepHours?: number;
  sleepQuality?: number;
  note: string;
}

export type LifeHistoryDomain =
  | 'Career Changes'
  | 'Losses'
  | 'Relationships'
  | 'Achievements'
  | 'Traumatic Events';

export interface LifeTimelineEvent {
  id: string;
  timeframe: string;
  title: string;
  chapter: 'Childhood & Foundations' | 'Education & Early Career' | 'Relationships' | 'Turning Point' | 'Present Chapter';
  domain?: LifeHistoryDomain;
  emotionalImpact: string;
  patternOrLesson: string;
  createdAt: string;
}

export type GrowthArea =
  | 'Confidence'
  | 'Discipline'
  | 'Habits'
  | 'Resilience'
  | 'Purpose'
  | 'Life Goals';

export interface GrowthJournalEntry {
  id: string;
  createdAt: string;
  area?: GrowthArea;
  prompt: string;
  entry: string;
  valueActivated: string;
}

export interface GrowthAreaPlan {
  id: string;
  createdAt: string;
  area: GrowthArea;
  reflectionInput: string;
  currentPattern: string;
  psychologicalObstacle: string;
  valuesAnchor: string;
  smallSustainableStep: string;
  reflectionPrompt: string;
  crisisDetected: boolean;
  safetyCategories?: CrisisRiskCategory[];
}

export type RelationshipArea =
  | 'Romantic Relationships'
  | 'Friendships'
  | 'Family'
  | 'Work Relationships';

export interface RelationshipNode {
  id: string;
  name: string;
  area: RelationshipArea;
  role: 'Partner' | 'Family' | 'Friend' | 'Colleague' | 'Mentor' | 'Community';
  closeness: number; // 1 to 5
  tension: number; // 1 to 5
  dynamicNote: string;
  sharedNeed: string;
  updatedAt: string;
}

export interface RelationshipAreaInsight {
  id: string;
  createdAt: string;
  area: RelationshipArea;
  situation: string;
  dynamicSummary: string;
  yourPerspectiveAndNeeds: string;
  otherPerspectiveAndNeeds: string;
  communicationPattern: string;
  boundaryOrRequest: string;
  reflectionQuestion: string;
  crisisDetected: boolean;
  safetyCategories?: CrisisRiskCategory[];
}

export interface ExplainMePortrait {
  generatedAt: string;
  plainLanguagePortrait: string;
  coreValues: { value: string; evidence: string }[];
  potentialBlindSpots: { pattern: string; gentleReframe: string }[];
  resilienceStrengths: string[];
  purposeThread: string;
}

export interface PersonalityAnalystProfile {
  generatedAt: string;
  dominant_traits: string[];
  values: string[];
  motivators: string[];
  blind_spots: string[];
  strengths: string[];
  growth_opportunities: string[];
}

export type UserModelDomain =
  | 'personality'
  | 'emotional patterns'
  | 'values'
  | 'relationships'
  | 'goals'
  | 'fears'
  | 'aspirations';

export type UserModelConfidence = 'emerging' | 'recurring' | 'confirmed';

export interface DynamicUserModelEntry {
  id: string;
  domain: UserModelDomain;
  observation: string;
  evidence: string;
  confidence: UserModelConfidence;
  source: 'ai-synthesis' | 'dialogue' | 'user';
  updatedAt: string;
}

export interface DynamicUserModel {
  updatedAt: string;
  summaryNote: string;
  entries: DynamicUserModelEntry[];
}

export interface HumanDigitalTwinSnapshot {
  generatedAt: string;
  aggregatedSummary: string;
  identityThesis: string;
  decisionCompass: string;
  protectiveLoops: string[];
  resilienceLevers: string[];
  layer1Signals: string[];
  layer2Patterns: {
    values: string[];
    triggers: string[];
    strengths: string[];
    recurringConcerns: string[];
  };
  layer3Narrative: {
    domain: LifeHistoryDomain;
    count: number;
    synthesis: string;
  }[];
  suggestedNextInquiry: string;
  crisisDetected: boolean;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email?: string;
  focusIntention: string;
  primaryAreas: GrowthArea[];
  createdAt: string;
  updatedAt: string;
}

export type GoalStatus = 'active' | 'paused' | 'completed';
export type GoalHorizon = 'Near-term' | 'Medium-term' | 'Long-term';

export interface GoalMilestone {
  id: string;
  label: string;
  done: boolean;
}

export interface GoalRecord {
  id: string;
  title: string;
  area: GrowthArea;
  horizon: GoalHorizon;
  status: GoalStatus;
  valuesAnchor: string;
  nextStep: string;
  progress: number;
  milestones: GoalMilestone[];
  createdAt: string;
  updatedAt: string;
}

export type AssessmentInstrument =
  | 'Resilience Check'
  | 'Burnout Screen'
  | 'Anxiety Pattern'
  | 'Mood & Depression Strain'
  | 'Self-Esteem Reflection'
  | 'Values Alignment';

export type AssessmentTier = 'Steady' | 'Moderate Load' | 'Elevated Strain';

export interface AssessmentRecord {
  id: string;
  instrument: AssessmentInstrument;
  createdAt: string;
  responses: { question: string; score: number }[];
  compositeScore: number;
  tier: AssessmentTier;
  summaryNote: string;
  reflectionNote: string;
  crisisDetected: boolean;
  safetyCategories?: CrisisRiskCategory[];
}

export type ReportKind =
  | 'Holistic Wellbeing & Growth Report'
  | 'Behavioral & Cognitive Summary'
  | 'Relational & Values Brief'
  | 'Session & Goal Progress Digest';

export interface HumanosReport {
  id: string;
  kind: ReportKind;
  title: string;
  generatedAt: string;
  executiveSummary: string;
  keyPatterns: string[];
  wellbeingTrajectory: string;
  goalsAndValuesAlignment: string;
  recommendedNextSteps: string[];
  ethicalNote: string;
}

export type VectorProviderId = 'azure-ai-search' | 'weaviate' | 'qdrant' | 'pinecone';

export type VectorRecordCategory =
  | 'Session'
  | 'Journal'
  | 'Goal'
  | 'Assessment'
  | 'Event Analysis'
  | 'Dynamic User Model';

export interface VectorRecordDocument {
  id: string;
  title: string;
  category: VectorRecordCategory;
  content: string;
  updatedAt: string;
}

export interface VectorProviderStatus {
  id: VectorProviderId;
  name: string;
  subtitle: string;
  queryMode: string;
  capabilities: string[];
  indexOrCollection: string;
  cloudConfigured: boolean;
  executionMode: 'external-cloud-cluster' | 'local-gemini-vector-runtime';
  indexedCount: number;
}

export interface VectorSearchHit {
  id: string;
  title: string;
  category: VectorRecordCategory;
  content: string;
  score: number;
  vectorScore: number;
  lexicalScore: number;
  updatedAt: string;
}

export interface VectorSearchResponse {
  provider: VectorProviderId;
  providerName: string;
  executionMode: 'external-cloud-cluster' | 'local-gemini-vector-runtime';
  embeddingModel: string;
  query: string;
  latencyMs: number;
  totalIndexed: number;
  hits: VectorSearchHit[];
}

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

export interface TimeSeriesProviderStatus {
  id: TimeSeriesProviderId;
  name: string;
  subtitle: string;
  queryLanguage: string;
  capabilities: string[];
  targetContainer: string;
  cloudConfigured: boolean;
  executionMode: 'external-cloud-cluster' | 'local-timeseries-runtime';
  pointCount: number;
  retentionDays: number;
  retentionPolicyPreview: string;
  oldestPointAt?: string | null;
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

export interface TimeSeriesQueryResponse {
  provider: TimeSeriesProviderId;
  providerName: string;
  executionMode: 'external-cloud-cluster' | 'local-timeseries-runtime';
  bucketWindow: TimeSeriesBucketWindow;
  retentionDays: number;
  prunedCount: number;
  totalPoints: number;
  latencyMs: number;
  queryPreview: string;
  retentionPolicyPreview: string;
  buckets: TimeSeriesBucketSummary[];
  recentPoints: TimeSeriesMetricPoint[];
}

export type PsychologicalIndexKey =
  | 'mood'
  | 'anxiety'
  | 'burnout'
  | 'resilience'
  | 'social-connection'
  | 'self-esteem'
  | 'life-satisfaction'
  | 'emotional-stability';

export interface PsychologicalIndexPoint {
  id: string;
  label: string;
  score: number;
}

export interface PsychologicalIndexMetric {
  key: PsychologicalIndexKey;
  label: string;
  polarity: 'protective' | 'strain';
  score: number;
  scale5: number;
  status: string;
  deltaText: string;
  formulaNote: string;
  interpretation: string;
  series: PsychologicalIndexPoint[];
  hasData: boolean;
}

export interface PsychologicalIndexSuite {
  indices: PsychologicalIndexMetric[];
  sampleCount: number;
  assessmentCount: number;
  relationshipCount: number;
  overallEquilibrium: number;
  retentionDays: number;
}

export type RiskSignalKey =
  | 'burnout-risk'
  | 'relationship-risk'
  | 'stress-escalation'
  | 'isolation-risk'
  | 'conflict-probability'
  | 'emotional-decline';

export type RiskTier = 'Low' | 'Watchful' | 'Elevated';

export type RiskTrend = 'Rising' | 'Steady' | 'Easing' | 'Baseline';

export interface RiskForecastMetric {
  key: RiskSignalKey;
  label: string;
  category: 'stress-burnout' | 'relational-conflict';
  probability: number;
  tier: RiskTier;
  trend: RiskTrend;
  drivers: string[];
  preventiveStep: string;
  hasData: boolean;
}

export interface RiskForecastSuite {
  signals: RiskForecastMetric[];
  aggregateRisk: number;
  elevatedCount: number;
  watchfulCount: number;
  retentionDays: number;
}

export interface PersonalInsightBrief {
  id: string;
  createdAt: string;
  dateKey: string;
  todayMood: number;
  moodLabel: string;
  energyLevel: number;
  stressScore: number;
  todaysReflection: string;
  headline: string;
  personalInsight: string;
  energyStressNote: string;
  patternConnection: string;
  reflectiveQuestion: string;
  gentleStep: string;
  crisisDetected: boolean;
  safetyCategories: CrisisRiskCategory[];
}

export type ConflictReportScope =
  | 'Partner Dynamics'
  | 'Family Insights'
  | 'Work Relationship Analysis'
  | 'Cross-System Conflict';

export interface ConflictReport {
  id: string;
  createdAt: string;
  scope: ConflictReportScope;
  title: string;
  deEscalationUrgency: 'Low' | 'Moderate' | 'Elevated';
  conflictSummary: string;
  coreTriggers: string[];
  selfNeeds: string[];
  otherNeeds: string[];
  communicationBreakdown: string;
  repairOptions: string[];
  constructiveScript: string;
  reflectionQuestion: string;
  crisisDetected: boolean;
  safetyCategories: CrisisRiskCategory[];
}

export interface CommentReviewRecord {
  id: string;
  createdAt: string;
  platform: SocialPlatform | 'Direct Message / Email';
  contextComment: string;
  draftReply: string;
  toxicityScore: number;
  toxicityTier: 'Low' | 'Moderate' | 'High';
  commentVerdict: 'Safe to Post' | 'Pause & Soften' | 'Reframe Recommended';
  toneAssessment: string;
  hostilitySignals: string[];
  emotionalTrigger: string;
  likelyOutcome: string;
  healthierRewrite: string;
  crisisDetected: boolean;
  safetyCategories: CrisisRiskCategory[];
}


