// Starter Program content (APP_SPECIFICATION.md §10, Appendix B), transcribed
// verbatim. Names are bilingual because §9 requires seeded names to be written
// in whichever language is active at apply time, then left untranslated.
import type { Metric } from './types'

interface Bilingual {
  ru: string
  en: string
}

export interface StarterExerciseSeed {
  name: Bilingual
  metric: Metric
}

export interface StarterDaySeed {
  name: Bilingual
  exercises: StarterExerciseSeed[]
}

export type StarterProgramIcon = 'flame' | 'dumbbell' | 'bolt'

export interface StarterProgram {
  id: 'fatLoss' | 'muscleGain' | 'strength'
  icon: StarterProgramIcon
  title: Bilingual
  subtitle: Bilingual
  days: StarterDaySeed[]
}

function w(ru: string, en: string): StarterExerciseSeed {
  return { name: { ru, en }, metric: 'weightReps' }
}

function d(ru: string, en: string): StarterExerciseSeed {
  return { name: { ru, en }, metric: 'duration' }
}

export const STARTER_PROGRAMS: readonly StarterProgram[] = [
  {
    id: 'fatLoss',
    icon: 'flame',
    title: { ru: 'Похудение', en: 'Fat loss' },
    subtitle: {
      ru: 'Полное тело · 2 дня · кардио + многосуставные',
      en: 'Full body · 2 days · cardio + compound lifts',
    },
    days: [
      {
        name: { ru: 'Полное тело', en: 'Full body' },
        exercises: [
          d('Велотренажёр', 'Bike'),
          w('Приседания с гантелями', 'Goblet squat'),
          w('Тяга верхнего блока', 'Lat pulldown'),
          w('Жим гантелей на наклонной', 'Incline dumbbell press'),
          w('Румынская тяга с гантелями', 'Dumbbell Romanian deadlift'),
          d('Планка', 'Plank'),
        ],
      },
      {
        name: { ru: 'Полное тело', en: 'Full body' },
        exercises: [
          d('Эллипс', 'Elliptical'),
          w('Жим ногами', 'Leg press'),
          w('Горизонтальная тяга', 'Seated cable row'),
          w('Жим гантелей сидя', 'Seated dumbbell press'),
          w('Выпады с гантелями', 'Dumbbell walking lunges'),
          w('Скручивания', 'Crunches'),
        ],
      },
    ],
  },
  {
    id: 'muscleGain',
    icon: 'dumbbell',
    title: { ru: 'Набор массы', en: 'Muscle gain' },
    subtitle: {
      ru: 'Сплит верх/низ · 2 дня · 8–12 повторений',
      en: 'Upper/lower split · 2 days · 8–12 reps',
    },
    days: [
      {
        name: { ru: 'Верх', en: 'Upper' },
        exercises: [
          w('Жим штанги лёжа', 'Barbell bench press'),
          w('Тяга верхнего блока', 'Lat pulldown'),
          w('Жим гантелей сидя', 'Seated dumbbell press'),
          w('Горизонтальная тяга', 'Seated cable row'),
          w('Подъём гантелей на бицепс', 'Dumbbell curl'),
          w('Разгибание на трицепс на блоке', 'Triceps pushdown'),
        ],
      },
      {
        name: { ru: 'Низ', en: 'Lower' },
        exercises: [
          w('Приседания со штангой', 'Barbell back squat'),
          w('Румынская тяга со штангой', 'Barbell Romanian deadlift'),
          w('Жим ногами', 'Leg press'),
          w('Сгибания ног лёжа', 'Lying leg curl'),
          w('Подъёмы на носки стоя', 'Standing calf raise'),
          w('Подъёмы ног в висе', 'Hanging leg raise'),
        ],
      },
    ],
  },
  {
    id: 'strength',
    icon: 'bolt',
    title: { ru: 'Сила', en: 'Strength' },
    subtitle: {
      ru: 'Базовые упражнения · 2 дня · 3–5 повторений',
      en: 'Compound lifts · 2 days · 3–5 reps',
    },
    days: [
      {
        name: { ru: 'Присед и жим', en: 'Squat & press' },
        exercises: [
          w('Приседания со штангой', 'Back squat'),
          w('Жим штанги лёжа', 'Bench press'),
          w('Тяга штанги в наклоне', 'Barbell row'),
          d('Планка', 'Plank'),
        ],
      },
      {
        name: { ru: 'Тяга и жим над головой', en: 'Deadlift & overhead' },
        exercises: [
          w('Становая тяга', 'Deadlift'),
          w('Жим штанги стоя', 'Standing overhead press'),
          w('Подтягивания', 'Pull-up'),
          d('Планка', 'Plank'),
        ],
      },
    ],
  },
]
