/**
 * 订阅/试用弹窗：免费试用 7 天（本地），不接支付
 */
import { Gift } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useGateStore } from '@/stores/gateStore'
import { useTrialStore } from '@/stores/trialStore'

interface SubscribeDialogProps {
  isOpen: boolean
  onClose: () => void
  actionName?: string
}

export function SubscribeDialog({ isOpen, onClose, actionName }: SubscribeDialogProps) {
  const { runPendingActionAndClear } = useGateStore()
  const { startTrial } = useTrialStore()

  const handleStartTrial = () => {
    startTrial()
    onClose()
    runPendingActionAndClear()
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            开通能力
          </DialogTitle>
          <DialogDescription>
            {actionName
              ? `「${actionName}」需要开通试用或订阅。`
              : '该功能需要开通试用或订阅后使用。'}
            当前仅支持本地免费试用 7 天，无需支付。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={handleStartTrial} className="w-full sm:w-auto">
            免费试用 7 天
          </Button>
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            暂不开通
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
