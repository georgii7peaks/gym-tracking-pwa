// UI string catalog (RU / EN). Default language is Russian (APP_SPECIFICATION.md
// §9, Appendix A). Strings live in code so the in-app picker can switch them live
// with no reload. Phase 1 fills the strength-tracking loop; the Settings weight/
// sync sections and the starter-program prompt are completed in Phase 2.
import type { Language } from '@/prefs/preferences'

type Entry = { ru: string; en: string }

export const catalog = {
  // ── Common actions ─────────────────────────────────────────────────────────
  'common.add': { ru: 'Добавить', en: 'Add' },
  'common.cancel': { ru: 'Отмена', en: 'Cancel' },
  'common.delete': { ru: 'Удалить', en: 'Delete' },
  'common.save': { ru: 'Сохранить', en: 'Save' },
  'common.ok': { ru: 'ОК', en: 'OK' },
  'common.close': { ru: 'Закрыть', en: 'Close' },
  'common.back': { ru: 'Назад', en: 'Back' },

  // ── Edit toggle ──────────────────────────────────────────────────────────────
  'edit.edit': { ru: 'Изменить', en: 'Edit' },
  'edit.done': { ru: 'Готово', en: 'Done' },
  'edit.hint.enter': {
    ru: 'Войти в режим редактирования: можно удалять и менять порядок',
    en: 'Enter editing mode: delete or reorder items',
  },
  'edit.hint.exit': {
    ru: 'Выйти из режима редактирования списка',
    en: 'Exit list editing mode',
  },
  'edit.moveUp': { ru: 'Переместить вверх', en: 'Move up' },
  'edit.moveDown': { ru: 'Переместить вниз', en: 'Move down' },

  // ── Tabs ─────────────────────────────────────────────────────────────────────
  'tab.workouts': { ru: 'Тренировки', en: 'Workouts' },
  'tab.routines': { ru: 'Программа', en: 'Routines' },
  'tab.settings': { ru: 'Настройки', en: 'Settings' },

  // ── Metric labels ──────────────────────────────────────────────────────────
  'metric.weightReps': { ru: 'Вес и повторения', en: 'Weight & reps' },
  'metric.duration': { ru: 'Время выполнения', en: 'Duration' },
  'metric.weightReps.short': { ru: 'вес × повт.', en: 'weight × reps' },
  'metric.duration.short': { ru: 'время', en: 'time' },

  // ── Weight units ──────────────────────────────────────────────────────────
  'unit.kg': { ru: 'кг', en: 'kg' },
  'unit.lb': { ru: 'фунты', en: 'lb' },
  'weightUnit.label': { ru: 'Единицы веса', en: 'Weight unit' },

  // ── Workouts list (§5.1) ───────────────────────────────────────────────────
  'workouts.title': { ru: 'Тренировки', en: 'Workouts' },
  'workouts.empty.title': { ru: 'Пока нет тренировок', en: 'No workouts yet' },
  'workouts.empty.hint': {
    ru: 'Нажмите +, чтобы начать тренировку по одному из дней программы.',
    en: 'Tap + to start a workout from one of your program days.',
  },
  'workouts.new': { ru: 'Новая тренировка', en: 'New workout' },
  'workouts.summary': { ru: '{n} упр. · {m} подходов', en: '{n} ex. · {m} sets' },
  'workouts.delete.confirm': {
    ru: 'Удалить тренировку? Все записанные подходы будут потеряны.',
    en: 'Delete this workout? All recorded sets will be lost.',
  },

  // ── Start Workout sheet (§5.2) ───────────────────────────────────────────────
  'startWorkout.title': { ru: 'Начать тренировку', en: 'Start workout' },
  'startWorkout.dayHint': {
    ru: 'Начать тренировку по этому дню',
    en: 'Start a workout from this day',
  },
  'startWorkout.noDays': {
    ru: 'Дней программы пока нет. Добавьте в разделе «Программа».',
    en: 'No program days yet. Add some in the Routines tab.',
  },

  // ── Routines list (§5.6) ───────────────────────────────────────────────────
  'routines.title': { ru: 'Программа', en: 'Routines' },
  'routines.empty.title': { ru: 'Программа пуста', en: 'Routines is empty' },
  'routines.empty.hint': {
    ru: 'Добавьте первый день программы кнопкой + в правом верхнем углу.',
    en: 'Add your first program day using the + button in the top right.',
  },
  'routines.exercisesCount': { ru: '{n} упражнений', en: '{n} exercises' },
  'routines.footer': {
    ru: 'Нажмите на день, чтобы изменить упражнения. Смахните для удаления или нажмите «Изменить» для изменения порядка.',
    en: 'Tap a day to edit its exercises. Swipe to delete, or tap Edit to reorder.',
  },
  'routines.addDay': { ru: 'Добавить день', en: 'Add day' },
  'routines.newDay': { ru: 'Новый день программы', en: 'New routine day' },
  'routines.newDay.placeholder': { ru: 'напр. День C', en: 'e.g. Day C' },

  // ── Routine Day editor (§5.7) ────────────────────────────────────────────────
  'dayEditor.nameSection': { ru: 'Название дня', en: 'Day name' },
  'dayEditor.exercises': { ru: 'Упражнения', en: 'Exercises' },
  'dayEditor.addExercise': { ru: 'Добавить упражнение', en: 'Add exercise' },
  'dayEditor.newExercise': { ru: 'Новое упражнение', en: 'New exercise' },
  'dayEditor.exerciseName': { ru: 'Название упражнения', en: 'Exercise name' },
  'dayEditor.dataType': { ru: 'Тип данных', en: 'Data type' },
  'dayEditor.footer': {
    ru: 'Эти упражнения подставляются при старте тренировки по этому дню.',
    en: 'These exercises will pre-fill when you start a workout for this day.',
  },

  // ── Session detail (§5.3) ────────────────────────────────────────────────────
  'session.dateSection': { ru: 'Дата и время', en: 'Date & time' },
  'session.start': { ru: 'Начало тренировки', en: 'Workout start' },
  'session.exercisesFooter': {
    ru: 'Нажмите на упражнение, чтобы записать подходы.',
    en: 'Tap an exercise to record sets.',
  },
  'session.addExercise': { ru: 'Добавить упражнение', en: 'Add exercise' },
  'session.addExerciseFooter': {
    ru: 'Добавить упражнение только для этой тренировки.',
    en: 'Add an exercise just for this workout.',
  },
  'session.addExerciseMessage': {
    ru: 'Будет добавлено только к этой тренировке.',
    en: 'Will be added to this workout only.',
  },
  'session.deleteWorkout': { ru: 'Удалить тренировку', en: 'Delete workout' },
  'session.summary.weightReps': {
    ru: '{n} подходов · посл. {weight} × {reps}',
    en: '{n} sets · last {weight} × {reps}',
  },
  'session.summary.duration': {
    ru: '{n} подходов · посл. {duration}',
    en: '{n} sets · last {duration}',
  },
  'session.notStarted': { ru: 'Не начато · {metric}', en: 'Not started · {metric}' },
  'session.setsRecorded': { ru: 'Подходы записаны', en: 'Sets recorded' },

  // ── Add Session Exercise sheet (§5.4) ──────────────────────────────────────
  'session.addExercise.title': { ru: 'Добавить упражнение', en: 'Add exercise' },

  // ── Exercise tracking (§5.5) ─────────────────────────────────────────────────
  'exercise.newSet': { ru: 'Новый подход', en: 'New set' },
  'exercise.minutes': { ru: 'Минуты: {n}', en: 'Minutes: {n}' },
  'exercise.seconds': { ru: 'Секунды: {n}', en: 'Seconds: {n}' },
  'exercise.weight': { ru: 'Вес', en: 'Weight' },
  'exercise.adjustWeight': { ru: 'Изменить вес ({display})', en: 'Adjust weight ({display})' },
  'exercise.reps': { ru: 'Повторения: {n}', en: 'Reps: {n}' },
  'exercise.addSet': { ru: 'Добавить подход', en: 'Add set' },
  'exercise.setsSection': { ru: 'Подходы за тренировку', en: 'Sets this workout' },
  'exercise.noSets.title': { ru: 'Подходов нет', en: 'No sets' },
  'exercise.noSets.hint': {
    ru: 'Заполните вес и повторения выше и нажмите «Добавить подход».',
    en: 'Enter weight and reps above, then tap Add set.',
  },
  'exercise.setNumber': { ru: 'Подход {n}', en: 'Set {n}' },
  'exercise.lastTime.weightReps': {
    ru: 'Прошлый раз: {weight} × {reps} повт.',
    en: 'Last time: {weight} × {reps} reps',
  },
  'exercise.lastTime.duration': {
    ru: 'Прошлый раз: {duration}',
    en: 'Last time: {duration}',
  },

  // ── Settings (Phase 0 wired language + theme; §5.8 completed in Phase 2) ─────
  'settings.title': { ru: 'Настройки', en: 'Settings' },
  'settings.language': { ru: 'Язык', en: 'Language' },
  'settings.appearance': { ru: 'Внешний вид', en: 'Appearance' },
  'settings.theme': { ru: 'Тема', en: 'Theme' },
  'settings.morePhase2': {
    ru: 'Единицы веса и синхронизация появятся в следующих фазах.',
    en: 'Weight units and sync arrive in later phases.',
  },
  'theme.system': { ru: 'Системная', en: 'System' },
  'theme.light': { ru: 'Светлая', en: 'Light' },
  'theme.dark': { ru: 'Тёмная', en: 'Dark' },
} satisfies Record<string, Entry>

export type StringKey = keyof typeof catalog

export const LANGUAGES: readonly Language[] = ['ru', 'en'] as const

/**
 * Resolve a string for a language, with optional `{placeholder}` interpolation.
 * Falls back to the key itself if somehow missing.
 */
export function translate(
  lang: Language,
  key: StringKey,
  params?: Record<string, string | number>
): string {
  const entry = catalog[key]
  let text = entry ? entry[lang] : (key as string)
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value))
    }
  }
  return text
}
