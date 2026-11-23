import {
  AssessmentRecord,
  TimeSeriesMetricPoint,
  TimeSeriesSource,
  WellbeingCheckIn,
} from '../types/humanos';

function clampMetric(value: number): number {
  return Number(Math.min(5, Math.max(1, value)).toFixed(2));
}

export function buildWorkspaceTimeSeriesPoints(input: {
  wellbeingCheckIns: WellbeingCheckIn[];
  assessments: AssessmentRecord[];
}): TimeSeriesMetricPoint[] {
  const points: TimeSeriesMetricPoint[] = [];

  for (const w of input.wellbeingCheckIns) {
    const isWatch = (w.note || '').toLowerCase().includes('smart watch');
    const source: TimeSeriesSource = isWatch ? 'smart-watch' : 'wellbeing-checkin';
    const resilience = clampMetric(
      (w.mood + w.selfEsteem + w.socialConnection + w.energy) / 4
    );
    const burnoutLoad = clampMetric(
      (w.stress + (6 - w.energy) + (6 - w.motivation)) / 3
    );

    points.push({
      id: `wb_${w.id}`,
      timestamp: w.createdAt,
      source,
      measurement: 'humanos_wellbeing',
      mood: clampMetric(w.mood),
      stress: clampMetric(w.stress),
      anxiety: clampMetric(w.anxiety),
      energy: clampMetric(w.energy),
      resilience,
      burnoutLoad,
      sleepHours: Number(
        Math.min(14, Math.max(0, w.sleepHours ?? 7)).toFixed(1)
      ),
      sleepQuality: clampMetric(w.sleepQuality ?? 3),
    });
  }

  for (const a of input.assessments) {
    const normalized5 = clampMetric(1 + (a.compositeScore / 100) * 4);
    const inverted5 = clampMetric(5 - (a.compositeScore / 100) * 4);

    let mood = 3;
    let stress = 3;
    let anxiety = 3;
    let energy = 3;
    let resilience = 3;
    let burnoutLoad = 3;

    switch (a.instrument) {
      case 'Burnout Screen':
        burnoutLoad = normalized5;
        stress = normalized5;
        energy = inverted5;
        mood = inverted5;
        resilience = inverted5;
        break;
      case 'Anxiety Pattern':
        anxiety = normalized5;
        stress = normalized5;
        mood = clampMetric((3 + inverted5) / 2);
        resilience = clampMetric((3 + inverted5) / 2);
        break;
      case 'Mood & Depression Strain':
        mood = inverted5;
        energy = inverted5;
        burnoutLoad = normalized5;
        resilience = inverted5;
        break;
      case 'Resilience Check':
      case 'Self-Esteem Reflection':
      case 'Values Alignment':
        resilience = normalized5;
        mood = normalized5;
        energy = clampMetric((3 + normalized5) / 2);
        stress = inverted5;
        burnoutLoad = inverted5;
        break;
    }

    points.push({
      id: `as_${a.id}`,
      timestamp: a.createdAt,
      source: 'assessment',
      measurement: 'humanos_wellbeing',
      mood,
      stress,
      anxiety,
      energy,
      resilience,
      burnoutLoad,
      sleepHours: 7,
      sleepQuality: clampMetric((resilience + energy) / 2),
      assessmentScore: a.compositeScore,
    });
  }

  return points.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}
