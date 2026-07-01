// Destructive-action confirmation (APP_SPECIFICATION.md §6.5). Fires a warning
// haptic when it appears; used for Workout deletion (the only confirmed delete).
import { useEffect } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'
import { useI18n } from '@/i18n/I18nProvider'
import { haptics } from '@/lib/haptics'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useI18n()

  useEffect(() => {
    if (open) haptics.warning()
  }, [open])

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
          <Button variant="destructive" className="flex-1" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-base">{message}</p>
    </Modal>
  )
}
