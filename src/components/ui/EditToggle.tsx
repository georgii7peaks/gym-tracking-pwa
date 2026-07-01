// Edit / Done toggle (APP_SPECIFICATION.md §12, string catalog "Edit toggle").
// Reveals delete + reorder affordances in the list it controls.
import { Button } from './Button'
import { useI18n } from '@/i18n/I18nProvider'
import { haptics } from '@/lib/haptics'

interface EditToggleProps {
  editing: boolean
  onToggle: (editing: boolean) => void
}

export function EditToggle({ editing, onToggle }: EditToggleProps) {
  const { t } = useI18n()
  return (
    <Button
      size="sm"
      variant={editing ? 'primary' : 'secondary'}
      aria-label={editing ? t('edit.hint.exit') : t('edit.hint.enter')}
      onClick={() => {
        haptics.selection()
        onToggle(!editing)
      }}
    >
      {editing ? t('edit.done') : t('edit.edit')}
    </Button>
  )
}
