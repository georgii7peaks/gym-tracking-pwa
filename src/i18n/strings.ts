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
  'tab.progress': { ru: 'Прогресс', en: 'Progress' },
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

  // ── Workout (inline active session — design) ────────────────────────────────
  'workout.title': { ru: 'Тренировка', en: 'Workout' },
  'workout.activePrefix': { ru: 'Активна', en: 'Active' },
  'workout.finishedPrefix': { ru: 'Завершена', en: 'Finished' },
  'workout.finish': { ru: 'Завершить', en: 'Finish' },
  'workout.continue': { ru: 'Продолжить', en: 'Continue' },
  'workout.stat.time': { ru: 'Время', en: 'Time' },
  'workout.stat.volume': { ru: 'Объём, кг', en: 'Volume, kg' },
  'workout.stat.sets': { ru: 'Подходы', en: 'Sets done' },
  'workout.start': { ru: 'Начать тренировку', en: 'Start workout' },
  'workout.setDone': { ru: 'Отметить подход выполненным', en: 'Mark set done' },
  'workout.colWeight': { ru: 'Вес', en: 'Weight' },
  'workout.colReps': { ru: 'Повт.', en: 'Reps' },
  'workout.colTime': { ru: 'Время', en: 'Time' },
  'workout.addSet': { ru: 'Добавить подход', en: 'Add set' },
  'workout.addedExercise': { ru: 'Добавлено: {name}', en: 'Added {name}' },
  'workout.finishConfirm.title': { ru: 'Завершить тренировку?', en: 'Finish workout?' },
  'workout.finishConfirm.message': {
    ru: 'Тренировка сохранится в списке тренировок.',
    en: 'This workout will be saved to your list.',
  },

  // ── Rest timer (design) ──────────────────────────────────────────────────────
  'rest.title': { ru: 'Таймер отдыха', en: 'Rest timer' },
  'rest.skip': { ru: 'Пропустить →', en: 'Skip →' },

  // ── Inline workout screen — add-exercise sheet (§5.4 analog) ────────────────
  'session.addExercise': { ru: 'Добавить упражнение', en: 'Add exercise' },
  'session.addExerciseMessage': {
    ru: 'Будет добавлено только к этой тренировке.',
    en: 'Will be added to this workout only.',
  },
  'session.deleteWorkout': { ru: 'Удалить тренировку', en: 'Delete workout' },
  'session.addExercise.title': { ru: 'Добавить упражнение', en: 'Add exercise' },

  // ── Starter program prompt (§5.9, §10) ──────────────────────────────────────
  'starterPrompt.title': { ru: 'Готовая программа', en: 'Starter program' },
  'starterPrompt.body': {
    ru: 'Можно начать с одной из готовых программ или пропустить и собрать свою.',
    en: 'Pick one of the built-in programs to start with, or skip and build your own.',
  },
  'starterPrompt.skip': { ru: 'Пропустить', en: 'Skip' },
  'starterPrompt.daysCount': { ru: '{n} дня тренировок', en: '{n} training days' },

  // ── Settings (§5.8) ──────────────────────────────────────────────────────────
  'settings.title': { ru: 'Настройки', en: 'Settings' },
  'settings.weight': { ru: 'Вес', en: 'Weight' },
  'settings.weightUnit.footer': {
    ru: 'Используется по умолчанию для новых упражнений. У каждого упражнения можно выбрать свои единицы.',
    en: 'Used as the default for new exercises. Each exercise can still choose its own unit.',
  },
  'settings.language': { ru: 'Язык', en: 'Language' },
  'settings.languagePicker': { ru: 'Язык интерфейса', en: 'Interface language' },
  // Endonyms: a language's own name is invariant across the active UI language.
  'language.ru': { ru: 'Русский', en: 'Русский' },
  'language.en': { ru: 'English', en: 'English' },
  'settings.appearance': { ru: 'Внешний вид', en: 'Appearance' },
  'settings.theme': { ru: 'Тема', en: 'Theme' },
  'theme.system': { ru: 'Системная', en: 'System' },
  'theme.light': { ru: 'Светлая', en: 'Light' },
  'theme.dark': { ru: 'Тёмная', en: 'Dark' },
  'settings.workout': { ru: 'Тренировка', en: 'Workout' },
  'settings.restTimer': { ru: 'Таймер отдыха', en: 'Rest timer' },
  'settings.restTimer.footer': {
    ru: 'Длительность отдыха между подходами по умолчанию.',
    en: 'Default rest duration between sets.',
  },
  'settings.autoRest': { ru: 'Автозапуск таймера отдыха', en: 'Auto-start rest timer' },
  'settings.autoRest.footer': {
    ru: 'Запускать таймер отдыха после отметки подхода выполненным.',
    en: 'Start the rest timer when a set is checked done.',
  },
  'settings.haptics': { ru: 'Вибрация', en: 'Vibration' },
  'settings.haptics.footer': {
    ru: 'Виброотклик на действия (если поддерживается устройством).',
    en: 'Haptic feedback on actions (where the device supports it).',
  },

  // ── PWA: service-worker update banner (Phase 3) ─────────────────────────────
  'update.available': { ru: 'Доступна новая версия приложения', en: 'A new version is available' },
  'update.reload': { ru: 'Обновить', en: 'Reload' },

  // ── PWA: install affordance (Phase 3, Settings) ─────────────────────────────
  'settings.install': { ru: 'Установка', en: 'Install' },
  'settings.install.action': { ru: 'Установить приложение', en: 'Install app' },
  'settings.install.iosHint': {
    ru: 'На iPhone/iPad: нажмите «Поделиться», затем «На экран «Домой»».',
    en: 'On iPhone/iPad: tap Share, then "Add to Home Screen".',
  },

  // ── Settings: Sync (Phase 4 — Google sign-in + Firestore) ───────────────────
  'settings.sync': { ru: 'Синхронизация', en: 'Sync' },
  'settings.sync.signIn': { ru: 'Войти через Google', en: 'Sign in with Google' },
  'settings.sync.footer': {
    ru: 'Войдите через Google, чтобы синхронизировать тренировки и программу между устройствами. По умолчанию данные хранятся только на этом устройстве.',
    en: 'Sign in with Google to sync your workouts and routine across devices. Off by default — data stays on this device.',
  },
  'settings.sync.signOut': { ru: 'Выйти', en: 'Sign out' },
  'settings.sync.status.syncing': { ru: 'Синхронизация…', en: 'Syncing…' },
  'settings.sync.status.error': { ru: 'Ошибка синхронизации', en: 'Sync error' },
  'settings.sync.status.idle': {
    ru: 'Последняя синхронизация: {relativeTime}',
    en: 'Last sync: {relativeTime}',
  },
  'settings.sync.neverSynced': { ru: 'Ещё не синхронизировано', en: 'Not synced yet' },

  // ── Settings: Data (full backup export/import to a local file) ─────────────
  'settings.data': { ru: 'Данные', en: 'Data' },
  'settings.data.export': { ru: 'Экспортировать данные', en: 'Export data' },
  'settings.data.import': { ru: 'Импортировать данные', en: 'Import data' },
  'settings.data.footer': {
    ru: 'Экспорт сохраняет тренировки и программу в файл JSON. Импорт добавляет данные из файла к текущим — ничего не удаляется.',
    en: 'Export saves your workouts and routine to a JSON file. Import merges data from a file into the current data — nothing is deleted.',
  },
  'settings.data.imported': {
    ru: 'Импортировано записей: {n} · без изменений: {m}',
    en: 'Imported records: {n} · unchanged: {m}',
  },
  'settings.data.importError': {
    ru: 'Не удалось импортировать: это не файл резервной копии.',
    en: 'Import failed: this is not a backup file.',
  },

  // ── Progress tab (docs/plans/progress-charts.md) ────────────────────────────
  'progress.title': { ru: 'Прогресс', en: 'Progress' },
  'progress.empty.title': { ru: 'Пока нет истории', en: 'No history yet' },
  'progress.empty.hint': {
    ru: 'Отметьте выполненные подходы в тренировке, и здесь появится прогресс по упражнениям.',
    en: 'Mark sets done in a workout and exercise progress will show up here.',
  },
  'progress.range.1m': { ru: '1М', en: '1M' },
  'progress.range.3m': { ru: '3М', en: '3M' },
  'progress.range.6m': { ru: '6М', en: '6M' },
  'progress.range.all': { ru: 'Всё', en: 'All' },
  'progress.lastTrained': { ru: 'Последний раз: {date}', en: 'Last trained: {date}' },
  'progress.noData': {
    ru: 'Нет данных за выбранный период',
    en: 'No data in the selected range',
  },
  'progress.chartLabel': {
    ru: 'График прогресса: {name}',
    en: 'Progress chart: {name}',
  },
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
