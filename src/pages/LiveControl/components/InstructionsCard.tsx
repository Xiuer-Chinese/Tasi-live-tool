import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const instructions = [
  '选择平台并点击"连接直播控制台"按钮，等待登录',
  '登录成功后，即可使用自动发言和自动弹窗功能',
  '自动回复功能目前仅对抖音小店和巨量百应开放',
]

const InstructionsCard = React.memo(() => (
  <Card className="flex flex-1 flex-col min-h-0">
    <CardHeader className="shrink-0">
      <CardTitle className="text-base">使用说明</CardTitle>
      <CardDescription>了解如何使用直播控制台</CardDescription>
    </CardHeader>
    <CardContent className="flex-1 flex items-center min-h-0 pt-2">
      <div className="relative w-full">
        {instructions.map((instruction, index) => {
          const isLast = index === instructions.length - 1
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: 步骤序号固定
            <div className={cn('relative flex gap-4', !isLast && 'pb-6')} key={index}>
              {!isLast && (
                <div
                  className="absolute left-[11px] top-6 bottom-0 w-px bg-primary/20"
                  aria-hidden
                />
              )}
              <div
                className={cn(
                  'relative z-10 h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold',
                  'bg-primary text-primary-foreground',
                )}
              >
                {index + 1}
              </div>
              <p className="text-xs text-muted-foreground leading-5 pt-0.5 flex-1 min-w-0">
                {instruction}
              </p>
            </div>
          )
        })}
      </div>
    </CardContent>
  </Card>
))

export default InstructionsCard
