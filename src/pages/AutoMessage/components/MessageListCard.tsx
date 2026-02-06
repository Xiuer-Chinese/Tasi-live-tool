import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useAutoMessageActions, useCurrentAutoMessage } from '@/hooks/useAutoMessage'
import MessageEditor from './MessageEditor'

const MessageListCard = React.memo(() => {
  const messages = useCurrentAutoMessage(context => context.config.messages)
  const { setMessages } = useAutoMessageActions()

  return (
    <Card className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <CardContent className="flex flex-col flex-1 min-h-0 p-3 pt-3">
        <div className="flex flex-col flex-1 min-h-0">
          <div className="shrink-0 space-y-0.5 mb-2">
            <Label className="text-sm">消息列表</Label>
            <p className="text-xs text-muted-foreground">添加需要自动发送的消息内容（一行一条）</p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <p className="text-xs text-muted-foreground mb-1">
              提示：可使用变量 <span className="bg-muted font-medium">{'{候选A/候选B}'}</span>
              ，如：欢迎<span className="bg-muted font-medium">{'{宝宝/家人/老铁}'}</span>
              进入直播间
            </p>
            <MessageEditor messages={messages} onChange={messages => setMessages(messages)} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

export default MessageListCard
