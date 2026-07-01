// Routines tab (APP_SPECIFICATION.md §5.6): the editable list of Routine Days.
// + adds a day (name prompt); Edit mode reveals delete (no confirm, §6.5) and
// reorder controls. Tapping a day opens the Routine Day editor.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Plus } from 'lucide-react'
import { Screen } from '@/components/Screen'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/Button'
import { EditToggle } from '@/components/ui/EditToggle'
import { PromptDialog } from '@/components/ui/PromptDialog'
import { RowEditControls } from '@/components/RowEditControls'
import { useI18n } from '@/i18n/I18nProvider'
import { useLiveData } from '@/data/useLiveData'
import { listRoutineDaySummaries } from '@/data/queries'
import { createRoutineDay, deleteRoutineDay, reorderRoutineDays } from '@/data/operations'
import { moveItem } from '@/domain/ordering'
import { haptics } from '@/lib/haptics'

export function RoutinesPage() {
  const { t } = useI18n()
  const { data } = useLiveData(() => listRoutineDaySummaries(), [])
  const days = data ?? []

  const [editing, setEditing] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  const move = async (from: number, to: number) => {
    await reorderRoutineDays(
      moveItem(
        days.map((d) => d.day.id),
        from,
        to
      )
    )
  }

  return (
    <Screen
      title={t('routines.title')}
      headerRight={
        <div className="flex items-center gap-2">
          {days.length > 0 && <EditToggle editing={editing} onToggle={setEditing} />}
          <Button
            size="icon"
            aria-label={t('routines.addDay')}
            onClick={() => {
              haptics.selection()
              setAddOpen(true)
            }}
          >
            <Plus aria-hidden className="h-5 w-5" strokeWidth={2.5} />
          </Button>
        </div>
      }
    >
      {days.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t('routines.empty.title')}
          hint={t('routines.empty.hint')}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-3">
            {days.map(({ day, exerciseCount }, index) => (
              <li key={day.id} className="flex items-stretch gap-2">
                <Link
                  to={`/routines/${day.id}`}
                  className="flex flex-1 flex-col gap-1 border-2 border-border bg-card p-3 shadow-retro active:translate-x-[3px] active:translate-y-[3px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="display text-lg">{day.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {t('routines.exercisesCount', { n: exerciseCount })}
                  </span>
                </Link>
                {editing && (
                  <RowEditControls
                    index={index}
                    count={days.length}
                    onMoveUp={() => move(index, index - 1)}
                    onMoveDown={() => move(index, index + 1)}
                    onDelete={() => deleteRoutineDay(day.id)}
                    deleteLabel={`${t('common.delete')}: ${day.name}`}
                  />
                )}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">{t('routines.footer')}</p>
        </div>
      )}

      <PromptDialog
        open={addOpen}
        title={t('routines.newDay')}
        placeholder={t('routines.newDay.placeholder')}
        confirmLabel={t('common.add')}
        onSubmit={async (value) => {
          await createRoutineDay(value)
          setAddOpen(false)
        }}
        onCancel={() => setAddOpen(false)}
      />
    </Screen>
  )
}
