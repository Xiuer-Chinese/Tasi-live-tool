import { useMemoizedFn } from 'ahooks'
import { Title } from '@/components/common/Title'
import { GateButton } from '@/components/GateButton'
import { CarbonPlayFilledAlt, CarbonStopFilledAlt } from '@/components/icons/carbon'
import { useCurrentAutoMessage } from '@/hooks/useAutoMessage'
import { useLiveFeatureGate } from '@/hooks/useLiveFeatureGate'
import { useTaskManager } from '@/hooks/useTaskManager'
import { useGateStore } from '@/stores/gateStore'
import MessageListCard from './components/MessageListCard'
import MessageSettingsCard from './components/MessageSettingsCard'
import { MessageOneKey } from './components/MessagesOneKey'

export default function AutoMessage() {
  const gate = useLiveFeatureGate()
  const { startTask, stopTask } = useTaskManager()
  // 状态源：使用 store 的 isRunning（与左侧绿点一致）
  const isRunning = useCurrentAutoMessage(context => context.isRunning)

  const guardAction = useGateStore(s => s.guardAction)

  const handleTaskButtonClick = useMemoizedFn(async () => {
    if (!isRunning) {
      await guardAction('auto-speak', {
        requireSubscription: true,
        action: async () => {
          await startTask('autoSpeak')
        },
      })
    } else {
      // 停止任务（不需要登录检查）
      await stopTask('autoSpeak', 'manual')
    }
  })

  return (
    <div className="h-full min-h-0 w-full flex flex-col overflow-hidden py-0">
      <div className="flex shrink-0 items-center justify-between mb-2">
        <Title title="自动发言" description="配置自动发送消息的规则" />
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
          <MessageListCard />
        </div>
        <div className="min-w-0 flex flex-col gap-2 shrink-0 lg:shrink-0">
          <MessageSettingsCard />
          <MessageOneKey />
        </div>
      </div>
    </div>
  )
}
