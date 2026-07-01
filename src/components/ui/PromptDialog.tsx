// Single-field name prompt (APP_SPECIFICATION.md §5.6 Add Day, §5.7 Add
// Exercise). Add is disabled while the field is blank; Enter submits. The name
// is trimmed/validated downstream by the operations layer.
import { useEffect, useState } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'
import { TextField } from './TextField'
import { useI18n } from '@/i18n/I18nProvider'

interface PromptDialogProps {
  open: boolean
  title: string
  placeholder?: string
  confirmLabel: string
  onSubmit: (value: string) => void
  onCancel: () => void
}

export function PromptDialog({
  open,
  title,
  placeholder,
  confirmLabel,
  onSubmit,
  onCancel,
}: PromptDialogProps) {
  const { t } = useI18n()
  const [value, setValue] = useState('')

  // Reset the field each time the dialog opens.
  useEffect(() => {
    if (open) setValue('')
  }, [open])

  const canSubmit = value.trim().length > 0
  const submit = () => {
    if (canSubmit) onSubmit(value)
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button className="flex-1" disabled={!canSubmit} onClick={submit}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <TextField
        autoFocus
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
        }}
      />
    </Modal>
  )
}
