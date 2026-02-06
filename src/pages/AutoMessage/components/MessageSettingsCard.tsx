import { useMemoizedFn } from 'ahooks'
import React, { useId } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAutoMessageActions, useCurrentAutoMessage } from '@/hooks/useAutoMessage'

const MessageSettingsCard = React.memo(() => {
  const { scheduler, random, extraSpaces } = useCurrentAutoMessage(context => context.config)
  const { setScheduler, setRandom, setExtraSpaces } = useAutoMessageActions()
  const randomId = useId()
  const extraSpacesId = useId()

  const handleIntervalChange = useMemoizedFn((index: 0 | 1, value: string) => {
    const numValue = Number(value) * 1000
    setScheduler({
      interval: index === 0 ? [numValue, scheduler.interval[1]] : [scheduler.interval[0], numValue],
    })
  })

  return (
    <Card>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-0.5 min-w-0">
              <Label className="text-sm">发送设置</Label>
              <p className="text-xs text-muted-foreground">配置消息发送的相关选项</p>
            </div>
            <div className="flex items-center space-x-1.5 shrink-0">
              <Switch id={randomId} checked={random} onCheckedChange={setRandom} />
              <Label htmlFor={randomId} className="cursor-pointer text-sm">
                随机发送
              </Label>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-sm">发送间隔（秒）</Label>
            <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
              <Input
                type="number"
                value={scheduler.interval[0] / 1000}
                onChange={e => handleIntervalChange(0, e.target.value)}
                className="w-20 h-8 text-sm"
                min="1"
                placeholder="最小"
              />
              <span className="text-xs text-muted-foreground">至</span>
              <Input
                type="number"
                value={scheduler.interval[1] / 1000}
                onChange={e => handleIntervalChange(1, e.target.value)}
                className="w-20 h-8 text-sm"
                min="1"
                placeholder="最大"
              />
              <span className="text-xs text-muted-foreground">秒</span>
            </div>
            <p className="text-xs text-muted-foreground">区间内随机选择发送时机</p>
          </div>

          <div className="flex items-center space-x-1.5 pt-0.5">
            <Switch id={extraSpacesId} checked={extraSpaces} onCheckedChange={setExtraSpaces} />
            <Label htmlFor={extraSpacesId} className="cursor-pointer text-sm">
              插入随机空格
            </Label>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

export default MessageSettingsCard
