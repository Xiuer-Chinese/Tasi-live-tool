/**
 * 订阅/试用弹窗：免费试用 7 天（服务端），不接支付。支持“试用已结束”模式。
 */
import { Gift, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/stores/authStore'
import { useGateStore } from '@/stores/gateStore'

interface SubscribeDialogProps {
  isOpen: boolean
  onClose: () => void
  actionName?: string
  /** 试用已结束（进入应用或切换平台时由服务端 userStatus 判定） */
  trialExpired?: boolean
}

export function SubscribeDialog({
  isOpen,
  onClose,
  actionName,
  trialExpired = false,
}: SubscribeDialogProps) {
  const { runPendingActionAndClear } = useGateStore()
  const startTrialAndRefresh = useAuthStore(s => s.startTrialAndRefresh)
  const [loading, setLoading] = useState(false)
  const [trialError, setTrialError] = useState<string | null>(null)

  const handleStartTrial = async () => {
    setTrialError(null)
    setLoading(true)
    try {
      const result = await startTrialAndRefresh()
      if (result.success) {
        onClose()
        runPendingActionAndClear()
        return
      }
      if (result.errorCode === 'trial_already_used') {
        setTrialError('试用已使用完毕，如需继续使用请升级。')
        return
      }
      setTrialError(result.message ?? '网络异常，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            {trialExpired ? '试用已结束' : '开通试用'}
          </DialogTitle>
          <DialogDescription>
            {trialExpired
              ? '您的 7 天试用已结束。可再次开通试用继续使用全部功能（不收费）。'
              : actionName
                ? `「${actionName}」需要开通试用后使用。可免费试用全部功能 7 天。`
                : '可免费试用全部功能 7 天，无需支付。'}
          </DialogDescription>
          {trialError && (
            <p className="text-sm text-destructive mt-2" role="alert">
              {trialError}
            </p>
          )}
        </DialogHeader>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={handleStartTrial} disabled={loading} className="w-full sm:w-auto">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '免费试用 7 天'}
          </Button>
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            {trialExpired ? '关闭' : '暂不开通'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
