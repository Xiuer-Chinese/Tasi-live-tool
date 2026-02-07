import { useMemoizedFn } from 'ahooks'
import React from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCurrentLiveControl, useCurrentLiveControlActions } from '@/hooks/useLiveControl'

const basePlatforms: Record<string, string> = {
  douyin: '抖音小店',
  buyin: '巨量百应',
  eos: '抖音团购',
  xiaohongshu: '小红书千帆',
  pgy: '小红书蒲公英',
  wxchannel: '视频号',
  kuaishou: '快手小店',
  taobao: '淘宝',
  dev: '测试平台',
}

// 正式发行版也包含测试平台，便于用户试用体验
const platforms = basePlatforms

const PlatformSelect = React.memo((props: { fullWidth?: boolean } = {}) => {
  const { fullWidth } = props
  const connectState = useCurrentLiveControl(context => context.connectState)
  const { setPlatform } = useCurrentLiveControlActions()

  const handlePlatformChange = useMemoizedFn((newPlatform: string) => {
    console.log('[Platform Select] Platform changed:', connectState.platform, '→', newPlatform)
    setPlatform(newPlatform)
  })

  return (
    <Select
      value={connectState.platform}
      onValueChange={handlePlatformChange}
      disabled={connectState.status !== 'disconnected'}
    >
      <SelectTrigger
        className={
          fullWidth
            ? 'w-full border-border/30 bg-muted/30 text-muted-foreground text-sm'
            : 'w-[8.75rem] border-border/30 bg-muted/30 text-muted-foreground opacity-60 hover:opacity-80 transition-opacity text-sm'
        }
      >
        <SelectValue placeholder="选择平台" />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(platforms).map(([key, name]) => (
          <SelectItem key={key} value={key}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
})

export default PlatformSelect
