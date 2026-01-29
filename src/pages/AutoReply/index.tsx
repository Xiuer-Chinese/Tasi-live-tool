import { useMemoizedFn } from 'ahooks'
import { Settings2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { autoReplyPlatforms } from '@/abilities'
import { Title } from '@/components/common/Title'
import { GateButton } from '@/components/GateButton'
import { CarbonPlayFilledAlt, CarbonStopFilledAlt } from '@/components/icons/carbon'
import { Button } from '@/components/ui/button'
import { useAccounts } from '@/hooks/useAccounts'
import { useRequireAuthForAction } from '@/hooks/useAuth'
import { useAutoReply } from '@/hooks/useAutoReply'
import { useAutoStopOnGateLoss } from '@/hooks/useAutoStopOnGateLoss'
import { useCurrentLiveControl } from '@/hooks/useLiveControl'
import { useLiveFeatureGate } from '@/hooks/useLiveFeatureGate'
import CommentList from '@/pages/AutoReply/components/CommentList'
import PreviewList from '@/pages/AutoReply/components/PreviewList'
import { stopAllLiveTasks } from '@/utils/stopAllLiveTasks'

export default function AutoReply() {
  const { isRunning, setIsRunning, isListening } = useAutoReply()
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null)
  const gate = useLiveFeatureGate()
  const { currentAccountId } = useAccounts()
  const navigate = useNavigate()

  // 自动停机：当 Gate 条件不满足时，自动停止任务
  // 注意：自动回复的实际运行状态是 isListening，不是 isRunning
  // isRunning 只是功能开关，isListening === 'listening' || 'waiting' 才是任务运行状态
  const taskIsRunning = isListening === 'listening' || isListening === 'waiting'

  useAutoStopOnGateLoss({
    gate,
    taskIsRunning,
    stopAll: useMemoizedFn(async reason => {
      console.log(
        `[autostop] Auto reply gate lost, reason: ${reason}, isListening: ${isListening}, isRunning: ${isRunning}`,
      )
      // stopAllLiveTasks 会显示 toast，useAutoStopOnGateLoss 也会显示 toast
      // 为了避免重复，这里传入 showToast=false，让 useAutoStopOnGateLoss 统一显示
      await stopAllLiveTasks(currentAccountId, reason, false)
    }),
  })

  // 引入登录检查 Hook
  const { requireAuthForAction } = useRequireAuthForAction('auto-reply')

  const handleAutoReplyToggle = useMemoizedFn(async () => {
    if (!isRunning) {
      // 启动任务：先检查登录，然后执行启动逻辑
      await requireAuthForAction(async () => {
        // 前置校验由 GateButton 处理
        // 注意：实际的监听启动在 CommentList 的 startListening 中
        setIsRunning(true)
      })
    } else {
      // 停止任务（不需要登录检查）
      setIsRunning(false)
    }
  })

  const connectState = useCurrentLiveControl(context => context.connectState)
  const platform = connectState.platform as any
  if (!autoReplyPlatforms.includes(platform)) {
    return null
  }

  return (
    <div className="container py-8 space-y-6">
      <div className="pb-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <Title title="自动回复" description="查看直播间的实时评论并自动回复" />
          </div>
          <div className="flex items-center gap-2">
            {/* 用户屏蔽列表 */}
            <Button variant="outline" onClick={() => navigate('settings')} title="设置">
              <Settings2 className="h-4 w-4" />
              <span>设置</span>
            </Button>
            <GateButton gate={gate} onClick={handleAutoReplyToggle}>
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
        </div>
      </div>

      {/* 评论和回复区域 */}
      <div className="grid grid-cols-2 gap-6">
        {/* 评论列表卡片 */}
        <CommentList highlight={highlightedCommentId} />

        {/* 回复预览卡片 */}
        <PreviewList setHighLight={setHighlightedCommentId} />
      </div>
    </div>
  )
}
