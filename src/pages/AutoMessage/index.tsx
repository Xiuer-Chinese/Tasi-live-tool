import { useMemoizedFn } from 'ahooks'
import { Title } from '@/components/common/Title'
import { GateButton } from '@/components/GateButton'
import { CarbonPlayFilledAlt, CarbonStopFilledAlt } from '@/components/icons/carbon'
import { useRequireAuthForAction } from '@/hooks/useAuth'
import { useCurrentAutoMessage } from '@/hooks/useAutoMessage'
import { useLiveFeatureGate } from '@/hooks/useLiveFeatureGate'
import { useTaskManager } from '@/hooks/useTaskManager'
import MessageListCard from './components/MessageListCard'
import MessageSettingsCard from './components/MessageSettingsCard'
import { MessageOneKey } from './components/MessagesOneKey'

export default function AutoMessage() {
  const gate = useLiveFeatureGate()
  const { startTask, stopTask } = useTaskManager()
  // 状态源：使用 store 的 isRunning（与左侧绿点一致）
  const isRunning = useCurrentAutoMessage(context => context.isRunning)

  // 引入登录检查 Hook
  const { requireAuthForAction } = useRequireAuthForAction('auto-speak')

  const handleTaskButtonClick = useMemoizedFn(async () => {
    if (!isRunning) {
      // 启动任务：先检查登录，然后执行启动逻辑
      await requireAuthForAction(async () => {
        await startTask('autoSpeak')
      })
    } else {
      // 停止任务（不需要登录检查）
      await stopTask('autoSpeak', 'manual')
    }
  })

  return (
    <div className="container py-8 space-y-4">
      <div className="flex items-center justify-between">
        <Title title="自动发言" description="配置自动发送消息的规则" />
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
        <MessageListCard />
        <MessageSettingsCard />
        <MessageOneKey />
      </div>
    </div>
  )
}
