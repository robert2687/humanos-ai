/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { AppTab, Header } from './components/Header';
import { DialogueView } from './components/DialogueView';
import { EventLabView } from './components/EventLabView';
import { PatternAtlasView } from './components/PatternAtlasView';
import { CrisisSupportView } from './components/CrisisSupportView';
import { PhilosophyView } from './components/PhilosophyView';
import { useHumanosStore } from './hooks/useHumanosStore';
import { EventAnalysisRecord } from './types/humanos';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('dialogue');
  const [activeEventContext, setActiveEventContext] =
    useState<EventAnalysisRecord | null>(null);

  const {
    sessions,
    activeSession,
    eventAnalyses,
    hypotheses,
    wellbeingCheckIns,
    timelineEvents,
    journalEntries,
    relationships,
    explainMePortrait,
    startNewSession,
    selectSession,
    deleteSession,
    setSessionMode,
    appendMessages,
    addEventAnalysis,
    deleteEventAnalysis,
    addHypothesis,
    updateHypothesis,
    removeHypothesis,
    addWellbeingCheckIn,
    deleteWellbeingCheckIn,
    addTimelineEvent,
    deleteTimelineEvent,
    addJournalEntry,
    deleteJournalEntry,
    addRelationshipNode,
    deleteRelationshipNode,
    setExplainMePortrait,
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

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF9F5] text-[#1C1917]">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onNewReflection={handleNewReflection}
      />

      <main className="flex-1">
        {activeTab === 'dialogue' && (
          <DialogueView
            sessions={sessions}
            activeSession={activeSession}
            hypotheses={hypotheses}
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
            onOpenCrisisSupport={() => setActiveTab('crisis')}
            onOpenAtlas={() => setActiveTab('pattern-atlas')}
          />
        )}

        {activeTab === 'event-lab' && (
          <EventLabView
            records={eventAnalyses}
            onSaveRecord={addEventAnalysis}
            onDeleteRecord={deleteEventAnalysis}
            onDiscussInDialogue={handleDiscussEventInDialogue}
            onOpenCrisisSupport={() => setActiveTab('crisis')}
          />
        )}

        {activeTab === 'pattern-atlas' && (
          <PatternAtlasView
            hypotheses={hypotheses}
            sessions={sessions}
            eventAnalyses={eventAnalyses}
            wellbeingCheckIns={wellbeingCheckIns}
            timelineEvents={timelineEvents}
            journalEntries={journalEntries}
            relationships={relationships}
            explainMePortrait={explainMePortrait}
            onAddHypothesis={addHypothesis}
            onUpdateHypothesis={updateHypothesis}
            onRemoveHypothesis={removeHypothesis}
            onAddWellbeingCheckIn={addWellbeingCheckIn}
            onDeleteWellbeingCheckIn={deleteWellbeingCheckIn}
            onAddTimelineEvent={addTimelineEvent}
            onDeleteTimelineEvent={deleteTimelineEvent}
            onAddJournalEntry={addJournalEntry}
            onDeleteJournalEntry={deleteJournalEntry}
            onAddRelationshipNode={addRelationshipNode}
            onDeleteRelationshipNode={deleteRelationshipNode}
            onSetExplainMePortrait={setExplainMePortrait}
            onClearAllData={clearAllData}
          />
        )}

        {activeTab === 'crisis' && <CrisisSupportView />}

        {activeTab === 'philosophy' && (
          <PhilosophyView
            onStartDialogue={() => setActiveTab('dialogue')}
            onOpenEventLab={() => setActiveTab('event-lab')}
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
