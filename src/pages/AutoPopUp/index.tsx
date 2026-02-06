import { useMemoizedFn } from 'ahooks'
import { Title } from '@/components/common/Title'
import { GateButton } from '@/components/GateButton'
import { CarbonPlayFilledAlt, CarbonStopFilledAlt } from '@/components/icons/carbon'
import { useAccounts } from '@/hooks/useAccounts'
import { useAutoPopUpActions, useCurrentAutoPopUp, useShortcutListener } from '@/hooks/useAutoPopUp'
import { useAutoStopOnGateLoss } from '@/hooks/useAutoStopOnGateLoss'
import { useLiveFeatureGate } from '@/hooks/useLiveFeatureGate'
import { useTaskControl } from '@/hooks/useTaskControl'
import { useGateStore } from '@/stores/gateStore'
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

  const guardAction = useGateStore(s => s.guardAction)

  const handleTaskButtonClick = useMemoizedFn(async () => {
    if (!isRunning) {
      await guardAction('auto-popup', {
        requireSubscription: true,
        action: () => {
          onStartTask()
        },
      })
    } else {
      // 停止任务（不需要登录检查）
      onStopTask()
    }
  })

  useShortcutListener()

  return (
    <div className="h-full min-h-0 w-full flex flex-col overflow-hidden py-0">
      <div className="flex shrink-0 items-center justify-between mb-2">
        <Title title="自动弹窗" description="配置自动弹出商品的规则" />
        <GateButton gate={gate} onClick={handleTaskButtonClick} size="sm">
          {isRunning ? (
            <>
              <CarbonStopFilledAlt className="mr-1.5 h-3.5 w-3.5" />
              停止任务
            </>
          ) : (
            <>
              <CarbonPlayFilledAlt className="mr-1.5 h-3.5 w-3.5" />
              开始任务
            </>
          )}
        </GateButton>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0 min-w-0">
        <div className="min-h-0 min-w-0 flex flex-col overflow-y-auto">
          <GoodsListCard />
        </div>
        <div className="min-w-0 flex flex-col shrink-0 lg:shrink-0">
          <PopUpSettingsCard />
        </div>
      </div>
    </div>
  )
}
