import {
  AssessmentRecord,
  DynamicUserModel,
  EventAnalysisRecord,
  GoalRecord,
  GrowthJournalEntry,
  ReflectionSession,
  VectorRecordDocument,
} from '../types/humanos';

export function buildWorkspaceVectorDocuments(params: {
  sessions: ReflectionSession[];
  journalEntries: GrowthJournalEntry[];
  goals: GoalRecord[];
  assessments: AssessmentRecord[];
  eventAnalyses: EventAnalysisRecord[];
  dynamicUserModel: DynamicUserModel;
}): VectorRecordDocument[] {
  const docs: VectorRecordDocument[] = [];

  for (const sess of params.sessions.slice(0, 12)) {
    const excerpt = sess.messages
      .slice(-6)
      .map((m) => `${m.role === 'user' ? 'User' : 'HUMANOS'}: ${m.content}`)
      .join('\n')
      .trim();
    if (excerpt) {
      docs.push({
        id: `session_${sess.id}`,
        title: sess.title || 'Reflection Session',
        category: 'Session',
        content: `[${sess.mode}] ${excerpt}`.slice(0, 2200),
        updatedAt: sess.updatedAt,
      });
    }
  }

  for (const j of params.journalEntries.slice(0, 15)) {
    docs.push({
      id: `journal_${j.id}`,
      title: `${j.area || 'Reflection'}${j.valueActivated ? ` · ${j.valueActivated}` : ''}`,
      category: 'Journal',
      content: `${j.prompt}\n${j.entry}`.slice(0, 2200),
      updatedAt: j.createdAt,
    });
  }

  for (const g of params.goals.slice(0, 15)) {
    docs.push({
      id: `goal_${g.id}`,
      title: g.title,
      category: 'Goal',
      content: `Area: ${g.area} | Horizon: ${g.horizon} | Status: ${g.status} (${g.progress}%) | Value Anchor: ${g.valuesAnchor} | Next Step: ${g.nextStep}`.slice(
        0,
        2200
      ),
      updatedAt: g.updatedAt,
    });
  }

  for (const a of params.assessments.slice(0, 10)) {
    docs.push({
      id: `assessment_${a.id}`,
      title: `${a.instrument} (${a.compositeScore}/100 · ${a.tier})`,
      category: 'Assessment',
      content: `${a.summaryNote}${a.reflectionNote ? `\nReflection: ${a.reflectionNote}` : ''}`.slice(
        0,
        2200
      ),
      updatedAt: a.createdAt,
    });
  }

  for (const evt of params.eventAnalyses.slice(0, 10)) {
    docs.push({
      id: `event_${evt.id}`,
      title: evt.summaryTitle,
      category: 'Event Analysis',
      content: `${evt.rawEvent}\nEmotions: ${evt.emotions.map((e) => e.name).join(', ')} | Needs: ${evt.needs.join(', ')}`.slice(
        0,
        2200
      ),
      updatedAt: evt.createdAt,
    });
  }

  for (const um of params.dynamicUserModel.entries.slice(0, 16)) {
    docs.push({
      id: `model_${um.id}`,
      title: `${um.domain} (${um.confidence})`,
      category: 'Dynamic User Model',
      content: `${um.observation}${um.evidence ? ` — Evidence: ${um.evidence}` : ''}`.slice(
        0,
        2200
      ),
      updatedAt: um.updatedAt,
    });
  }

  return docs.slice(0, 60);
}
