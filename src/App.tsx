/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { AppTab, Header } from './components/Header';
import { TodayView } from './components/TodayView';
import { DialogueView } from './components/DialogueView';
import { RelationshipsView } from './components/RelationshipsView';
import { EventLabSection, EventLabView } from './components/EventLabView';
import { PatternAtlasView } from './components/PatternAtlasView';
import { WorkspaceRecordsView } from './components/WorkspaceRecordsView';
import { CrisisSupportView } from './components/CrisisSupportView';
import { PhilosophyView } from './components/PhilosophyView';
import { useHumanosStore } from './hooks/useHumanosStore';
import { buildWorkspaceVectorDocuments } from './lib/vectorDocuments';
import { buildWorkspaceTimeSeriesPoints } from './lib/timeSeriesPoints';
import {
  CognitiveDistortionReport,
  CommentReviewRecord,
  EventAnalysisRecord,
  GrowthJournalEntry,
} from './types/humanos';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('today');
  const [eventLabSection, setEventLabSection] =
    useState<EventLabSection>('events');
  const [activeEventContext, setActiveEventContext] =
    useState<EventAnalysisRecord | null>(null);

  const {
    users,
    activeUser,
    sessions,
    activeSession,
    eventAnalyses,
    distortionReports,
    hypotheses,
    wellbeingCheckIns,
    timelineEvents,
    journalEntries,
    growthPlans,
    goals,
    assessments,
    reports,
    relationships,
    relationshipInsights,
    explainMePortrait,
    personalityProfile,
    createUserProfile,
    selectUserProfile,
    updateUserProfile,
    deleteUserProfile,
    startNewSession,
    selectSession,
    renameSession,
    deleteSession,
    setSessionMode,
    appendMessages,
    addGoal,
    updateGoal,
    toggleGoalMilestone,
    deleteGoal,
    addAssessment,
    deleteAssessment,
    addReport,
    deleteReport,
    addEventAnalysis,
    deleteEventAnalysis,
    addDistortionReport,
    deleteDistortionReport,
    addHypothesis,
    updateHypothesis,
    removeHypothesis,
    addWellbeingCheckIn,
    deleteWellbeingCheckIn,
    addTimelineEvent,
    deleteTimelineEvent,
    addJournalEntry,
    deleteJournalEntry,
    addGrowthPlan,
    deleteGrowthPlan,
    addRelationshipNode,
    deleteRelationshipNode,
    addRelationshipInsight,
    deleteRelationshipInsight,
    setExplainMePortrait,
    setPersonalityProfile,
    dynamicUserModel,
    digitalTwinSnapshot,
    setDigitalTwinSnapshot,
    dailyInsights,
    addDailyInsight,
    deleteDailyInsight,
    conflictReports,
    addConflictReport,
    deleteConflictReport,
    commentReviews,
    addCommentReview,
    deleteCommentReview,
    retentionDays,
    setRetentionDays,
    applyRetentionSweep,
    setDynamicUserModel,
    upsertUserModelEntry,
    updateUserModelEntry,
    removeUserModelEntry,
    clearAllData,
  } = useHumanosStore();

  const handleNewReflection = () => {
    startNewSession('insight', 'New Reflection');
    setActiveEventContext(null);
    setActiveTab('dialogue');
  };

  const handleDiscussEventInDialogue = (record: EventAnalysisRecord) => {
    const mode =
      record.lens === 'digital-check'
        ? 'digital-pause'
        : record.lens === 'future-self'
          ? 'growth'
          : record.contextCategory === 'Relationship'
            ? 'relationship'
            : record.contextCategory === 'Conflict & Anger'
              ? 'de-escalation'
              : record.lens === 'behavioral-loop'
                ? 'self-reflection'
                : 'insight';

    startNewSession(mode, record.summaryTitle);
    setActiveEventContext(record);
    setActiveTab('dialogue');
  };

  const handleDiscussDistortionInDialogue = (report: CognitiveDistortionReport) => {
    const activeNames = report.distortions
      .filter((d) => d.present)
      .map((d) => d.name)
      .join(', ');
    const synthRecord: EventAnalysisRecord = {
      id: report.id,
      createdAt: report.createdAt,
      lens: 'behavioral-loop',
      contextCategory: 'Personal',
      rawEvent: report.rawThought,
      summaryTitle: report.thoughtSummary || 'Cognitive Pattern Reflection',
      facts: [],
      interpretations: activeNames ? [`Possible cognitive patterns noticed: ${activeNames}`] : [],
      emotions: report.emotionalUndercurrent
        ? [{ name: 'Undercurrent', signal: report.emotionalUndercurrent }]
        : [],
      needs: [],
      requests: [],
      actions: report.balancedPerspective ? [report.balancedPerspective] : [],
      reflectiveQuestions: [],
      crisisDetected: report.crisisDetected,
    };
    startNewSession('self-reflection', synthRecord.summaryTitle);
    setActiveEventContext(synthRecord);
    setActiveTab('dialogue');
  };

  const handleReflectJournalInDialogue = (entry: GrowthJournalEntry) => {
    const synthRecord: EventAnalysisRecord = {
      id: entry.id,
      createdAt: entry.createdAt,
      lens: 'future-self',
      contextCategory: 'Personal',
      rawEvent: entry.entry,
      summaryTitle: entry.area ? `Journal · ${entry.area}` : 'Journal Reflection',
      facts: [entry.prompt],
      interpretations: [],
      emotions: [],
      needs: entry.valueActivated ? [entry.valueActivated] : [],
      requests: [],
      actions: [],
      reflectiveQuestions: [],
      crisisDetected: false,
    };
    startNewSession('growth', synthRecord.summaryTitle);
    setActiveEventContext(synthRecord);
    setActiveTab('dialogue');
  };

  const handleReflectTodayInDialogue = (input: {
    todayMood: number;
    moodLabel: string;
    energyLevel: number;
    stressScore: number;
    todaysReflection: string;
    personalInsight?: string;
  }) => {
    const synthRecord: EventAnalysisRecord = {
      id: `today_${Date.now()}`,
      createdAt: new Date().toISOString(),
      lens: 'behavioral-loop',
      contextCategory: 'Personal',
      rawEvent:
        input.todaysReflection ||
        `Today check-in: Mood ${input.todayMood}/5 (${input.moodLabel}), Energy ${input.energyLevel}/5, Stress ${input.stressScore}/5.`,
      summaryTitle: `Today · Mood ${input.todayMood}/5 (${input.moodLabel})`,
      facts: [
        `Today Mood: ${input.todayMood}/5 (${input.moodLabel})`,
        `Energy Level: ${input.energyLevel}/5`,
        `Stress Score: ${input.stressScore}/5`,
      ],
      interpretations: input.personalInsight ? [input.personalInsight] : [],
      emotions: [{ name: input.moodLabel, signal: 'Daily emotional pulse' }],
      needs: [],
      requests: [],
      actions: [],
      reflectiveQuestions: [],
      crisisDetected: false,
    };
    startNewSession('insight', synthRecord.summaryTitle);
    setActiveEventContext(synthRecord);
    setActiveTab('dialogue');
  };

  const handleDiscussRelationshipInDialogue = (input: {
    mode: 'relationship' | 'de-escalation';
    title: string;
    summary: string;
    scriptOrNeed?: string;
  }) => {
    const synthRecord: EventAnalysisRecord = {
      id: `rel_${Date.now()}`,
      createdAt: new Date().toISOString(),
      lens: 'conflict-emotion',
      contextCategory: input.mode === 'de-escalation' ? 'Conflict & Anger' : 'Relationship',
      rawEvent: input.summary,
      summaryTitle: input.title,
      facts: [input.summary],
      interpretations: [],
      emotions: [],
      needs: input.scriptOrNeed ? [input.scriptOrNeed] : [],
      requests: input.scriptOrNeed ? [input.scriptOrNeed] : [],
      actions: input.scriptOrNeed ? [input.scriptOrNeed] : [],
      reflectiveQuestions: [],
      crisisDetected: false,
    };
    startNewSession(input.mode, input.title);
    setActiveEventContext(synthRecord);
    setActiveTab('dialogue');
  };

  const handleRehearseDigitalPause = (review: CommentReviewRecord) => {
    const synthRecord: EventAnalysisRecord = {
      id: review.id,
      createdAt: review.createdAt,
      lens: 'digital-check',
      contextCategory: 'Digital & Online',
      rawEvent: review.draftReply,
      summaryTitle: `${review.platform} · ${review.commentVerdict}`,
      facts: review.contextComment ? [review.contextComment] : [review.draftReply],
      interpretations: review.hostilitySignals,
      emotions: [{ name: review.toneAssessment, signal: review.emotionalTrigger }],
      needs: [],
      requests: review.healthierRewrite ? [review.healthierRewrite] : [],
      actions: review.healthierRewrite ? [review.healthierRewrite] : [],
      reflectiveQuestions: [],
      crisisDetected: review.crisisDetected,
    };
    startNewSession('digital-pause', synthRecord.summaryTitle);
    setActiveEventContext(synthRecord);
    setActiveTab('dialogue');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF9F5] text-[#1C1917]">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onNewReflection={handleNewReflection}
      />

      <main className="flex-1">
        {activeTab === 'today' && (
          <TodayView
            activeUser={activeUser}
            dailyInsights={dailyInsights}
            wellbeingCheckIns={wellbeingCheckIns}
            assessments={assessments}
            relationships={relationships}
            relationshipInsights={relationshipInsights}
            eventAnalyses={eventAnalyses}
            sessions={sessions}
            hypotheses={hypotheses}
            dynamicUserModel={dynamicUserModel}
            retentionDays={retentionDays}
            onAddWellbeingCheckIn={addWellbeingCheckIn}
            onAddJournalEntry={addJournalEntry}
            onAddDailyInsight={addDailyInsight}
            onDeleteDailyInsight={deleteDailyInsight}
            onReflectTodayInDialogue={handleReflectTodayInDialogue}
            onOpenWellbeingAtlas={() => setActiveTab('pattern-atlas')}
            onOpenCrisisSupport={() => setActiveTab('crisis')}
          />
        )}

        {activeTab === 'dialogue' && (
          <DialogueView
            sessions={sessions}
            activeSession={activeSession}
            hypotheses={hypotheses}
            dynamicUserModel={dynamicUserModel}
            wellbeingCheckIns={wellbeingCheckIns}
            activeEventContext={activeEventContext}
            onClearEventContext={() => setActiveEventContext(null)}
            onSelectSession={selectSession}
            onNewSession={(mode) => {
              startNewSession(mode ?? 'insight', 'New Reflection');
            }}
            onDeleteSession={deleteSession}
            onSetMode={setSessionMode}
            onAppendMessages={appendMessages}
            onAddHypothesis={addHypothesis}
            onUpdateHypothesisStatus={(id, status) =>
              updateHypothesis(id, { status })
            }
            onUpsertUserModelEntry={upsertUserModelEntry}
            onOpenCrisisSupport={() => setActiveTab('crisis')}
            onOpenAtlas={() => setActiveTab('pattern-atlas')}
          />
        )}

        {activeTab === 'relationships' && (
          <RelationshipsView
            relationships={relationships}
            relationshipInsights={relationshipInsights}
            conflictReports={conflictReports}
            eventAnalyses={eventAnalyses}
            wellbeingCheckIns={wellbeingCheckIns}
            assessments={assessments}
            sessions={sessions}
            retentionDays={retentionDays}
            onAddRelationshipNode={addRelationshipNode}
            onDeleteRelationshipNode={deleteRelationshipNode}
            onAddRelationshipInsight={addRelationshipInsight}
            onDeleteRelationshipInsight={deleteRelationshipInsight}
            onAddConflictReport={addConflictReport}
            onDeleteConflictReport={deleteConflictReport}
            onDiscussInDialogue={handleDiscussRelationshipInDialogue}
            onOpenSocialHealth={() => {
              setEventLabSection('social-health');
              setActiveTab('event-lab');
            }}
            onOpenCrisisSupport={() => setActiveTab('crisis')}
          />
        )}

        {activeTab === 'event-lab' && (
          <EventLabView
            records={eventAnalyses}
            distortionReports={distortionReports}
            commentReviews={commentReviews}
            relationships={relationships}
            relationshipInsights={relationshipInsights}
            wellbeingCheckIns={wellbeingCheckIns}
            assessments={assessments}
            sessions={sessions}
            retentionDays={retentionDays}
            defaultSection={eventLabSection}
            onSaveRecord={addEventAnalysis}
            onDeleteRecord={deleteEventAnalysis}
            onSaveDistortionReport={addDistortionReport}
            onDeleteDistortionReport={deleteDistortionReport}
            onAddCommentReview={addCommentReview}
            onDeleteCommentReview={deleteCommentReview}
            onRehearseDigitalPause={handleRehearseDigitalPause}
            onOpenConflictReports={() => setActiveTab('relationships')}
            onDiscussInDialogue={handleDiscussEventInDialogue}
            onDiscussDistortionInDialogue={handleDiscussDistortionInDialogue}
            onOpenCrisisSupport={() => setActiveTab('crisis')}
          />
        )}

        {activeTab === 'pattern-atlas' && (
          <PatternAtlasView
            hypotheses={hypotheses}
            sessions={sessions}
            eventAnalyses={eventAnalyses}
            wellbeingCheckIns={wellbeingCheckIns}
            assessments={assessments}
            timelineEvents={timelineEvents}
            journalEntries={journalEntries}
            growthPlans={growthPlans}
            relationships={relationships}
            relationshipInsights={relationshipInsights}
            explainMePortrait={explainMePortrait}
            personalityProfile={personalityProfile}
            timeSeriesPoints={buildWorkspaceTimeSeriesPoints({
              wellbeingCheckIns,
              assessments,
            })}
            retentionDays={retentionDays}
            onChangeRetentionDays={setRetentionDays}
            onApplyRetentionSweep={applyRetentionSweep}
            onAddHypothesis={addHypothesis}
            onUpdateHypothesis={updateHypothesis}
            onRemoveHypothesis={removeHypothesis}
            onAddWellbeingCheckIn={addWellbeingCheckIn}
            onDeleteWellbeingCheckIn={deleteWellbeingCheckIn}
            onAddTimelineEvent={addTimelineEvent}
            onDeleteTimelineEvent={deleteTimelineEvent}
            onAddJournalEntry={addJournalEntry}
            onDeleteJournalEntry={deleteJournalEntry}
            onAddGrowthPlan={addGrowthPlan}
            onDeleteGrowthPlan={deleteGrowthPlan}
            onAddRelationshipNode={addRelationshipNode}
            onDeleteRelationshipNode={deleteRelationshipNode}
            onAddRelationshipInsight={addRelationshipInsight}
            onDeleteRelationshipInsight={deleteRelationshipInsight}
            onSetExplainMePortrait={setExplainMePortrait}
            onSetPersonalityProfile={setPersonalityProfile}
            digitalTwinSnapshot={digitalTwinSnapshot}
            onSetDigitalTwinSnapshot={setDigitalTwinSnapshot}
            dynamicUserModel={dynamicUserModel}
            onSetDynamicUserModel={setDynamicUserModel}
            onUpsertUserModelEntry={upsertUserModelEntry}
            onUpdateUserModelEntry={updateUserModelEntry}
            onRemoveUserModelEntry={removeUserModelEntry}
            onOpenCrisisSupport={() => setActiveTab('crisis')}
            onClearAllData={clearAllData}
          />
        )}

        {activeTab === 'records' && (
          <WorkspaceRecordsView
            users={users}
            activeUser={activeUser}
            sessions={sessions}
            activeSession={activeSession}
            goals={goals}
            journalEntries={journalEntries}
            assessments={assessments}
            reports={reports}
            wellbeingCheckIns={wellbeingCheckIns}
            distortionReports={distortionReports}
            eventAnalyses={eventAnalyses}
            hypotheses={hypotheses}
            growthPlans={growthPlans}
            timelineEvents={timelineEvents}
            relationships={relationships}
            relationshipInsights={relationshipInsights}
            retentionDays={retentionDays}
            dynamicUserModel={dynamicUserModel}
            onCreateUser={createUserProfile}
            onSelectUser={selectUserProfile}
            onUpdateUser={updateUserProfile}
            onDeleteUser={deleteUserProfile}
            onStartNewSession={startNewSession}
            onSelectSessionAndOpenDialogue={(sessionId) => {
              selectSession(sessionId);
              setActiveTab('dialogue');
            }}
            onRenameSession={renameSession}
            onDeleteSession={deleteSession}
            onAddGoal={addGoal}
            onUpdateGoal={updateGoal}
            onToggleGoalMilestone={toggleGoalMilestone}
            onDeleteGoal={deleteGoal}
            onAddJournalEntry={addJournalEntry}
            onDeleteJournalEntry={deleteJournalEntry}
            onReflectJournalInDialogue={handleReflectJournalInDialogue}
            onAddAssessment={addAssessment}
            onDeleteAssessment={deleteAssessment}
            onAddReport={addReport}
            onDeleteReport={deleteReport}
            onOpenCrisisSupport={() => setActiveTab('crisis')}
          />
        )}

        {activeTab === 'crisis' && <CrisisSupportView />}

        {activeTab === 'philosophy' && (
          <PhilosophyView
            vectorDocuments={buildWorkspaceVectorDocuments({
              sessions,
              journalEntries,
              goals,
              assessments,
              eventAnalyses,
              dynamicUserModel,
            })}
            timeSeriesPoints={buildWorkspaceTimeSeriesPoints({
              wellbeingCheckIns,
              assessments,
            })}
            retentionDays={retentionDays}
            onChangeRetentionDays={setRetentionDays}
            onStartDialogue={() => setActiveTab('dialogue')}
            onOpenEventLab={() => setActiveTab('event-lab')}
            onSyncWatchPulse={addWellbeingCheckIn}
          />
        )}
      </main>

      <footer className="border-t border-[#1C1917]/10 mt-12 py-6">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#78716C]">
          <span>
            HUMANOS AI · Non-diagnostic human intelligence & wellbeing · Insight before advice
          </span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('crisis')}
              className="hover:text-[#1C1917] transition-colors"
            >
              Crisis Support (988)
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveTab('philosophy')}
              className="hover:text-[#1C1917] transition-colors"
            >
              Ethical Charter
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
