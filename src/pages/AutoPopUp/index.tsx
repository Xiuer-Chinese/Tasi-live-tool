import { useMemoizedFn } from 'ahooks'
import { Title } from '@/components/common/Title'
import { GateButton } from '@/components/GateButton'
import { CarbonPlayFilledAlt, CarbonStopFilledAlt } from '@/components/icons/carbon'
import { useAccounts } from '@/hooks/useAccounts'
import { useRequireAuthForAction } from '@/hooks/useAuth'
import { useAutoPopUpActions, useCurrentAutoPopUp, useShortcutListener } from '@/hooks/useAutoPopUp'
import { useAutoStopOnGateLoss } from '@/hooks/useAutoStopOnGateLoss'
import { useLiveFeatureGate } from '@/hooks/useLiveFeatureGate'
import { useTaskControl } from '@/hooks/useTaskControl'
import { stopAllLiveTasks } from '@/utils/stopAllLiveTasks'
import GoodsListCard from './components/GoodsListCard'
import PopUpSettingsCard from './components/PopUpSettingsCard'

const useAutoPopUpTaskControl = () => {
  const isRunning = useCurrentAutoPopUp(context => context.isRunning)
  const config = useCurrentAutoPopUp(context => context.config)
  const { setIsRunning } = useAutoPopUpActions()

  return useTaskControl({
    taskType: 'auto-popup',
    getIsRunning: () => isRunning,
    getConfig: () => config,
    setIsRunning,
    startSuccessMessage: '自动弹窗任务已启动',
    startFailureMessage: '自动弹窗任务启动失败',
  })
}

export default function AutoPopUp() {
  const { isRunning, onStartTask, onStopTask } = useAutoPopUpTaskControl()
  const gate = useLiveFeatureGate()
  const { currentAccountId } = useAccounts()

  // 自动停机：当 Gate 条件不满足时，自动停止任务
  useAutoStopOnGateLoss({
    gate,
    taskIsRunning: isRunning,
    stopAll: useMemoizedFn(async reason => {
      await stopAllLiveTasks(currentAccountId, reason, false)
    }),
  })

  // 引入登录检查 Hook
  const { requireAuthForAction } = useRequireAuthForAction('auto-popup')

  const handleTaskButtonClick = useMemoizedFn(async () => {
    if (!isRunning) {
      // 启动任务：先检查登录，然后执行启动逻辑
      await requireAuthForAction(async () => {
        onStartTask()
      })
    } else {
      // 停止任务（不需要登录检查）
      onStopTask()
    }
  })

  useShortcutListener()

  return (
    <div className="container py-8 space-y-4">
      <div className="flex items-center justify-between">
        <Title title="自动弹窗" description="配置自动弹出商品的规则" />
        <GateButton gate={gate} onClick={handleTaskButtonClick}>
          {isRunning ? (
            <>
              <CarbonStopFilledAlt className="mr-2 h-4 w-4" />
              停止任务
            </>
          ) : (
            <>
              <CarbonPlayFilledAlt className="mr-2 h-4 w-4" />
              开始任务
            </>
          )}
        </GateButton>
      </div>

      <div className="grid gap-6">
        <GoodsListCard />
        <PopUpSettingsCard />
      </div>
    </div>
  )
}
