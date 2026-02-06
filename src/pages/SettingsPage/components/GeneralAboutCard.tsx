import { FileTextIcon, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useDevMode } from '@/hooks/useDevMode'
import { useToast } from '@/hooks/useToast'
import { useUpdateConfigStore, useUpdateStore } from '@/hooks/useUpdate'
import { version } from '../../../../package.json'
import { SettingRow } from './SettingRow'

export function GeneralAboutCard() {
  const [hideToTrayTipEnabled, setHideToTrayTipEnabled] = useState(true)
  const { enableAutoCheckUpdate, setEnableAutoCheckUpdate } = useUpdateConfigStore()
  const updateStatus = useUpdateStore.use.status()
  const checkUpdateManually = useUpdateStore.use.checkUpdateManually()
  const [isUpToDate, setIsUpToDate] = useState(false)
  const { toast } = useToast()
  const { enabled: devMode, setEnabled: setDevMode } = useDevMode()

  useEffect(() => {
    const loadSetting = async () => {
      if (window.ipcRenderer) {
        const dismissed = await window.ipcRenderer.invoke(
          IPC_CHANNELS.app.getHideToTrayTipDismissed,
        )
        setHideToTrayTipEnabled(!dismissed)
      }
    }
    loadSetting()
  }, [])

  const handleToggleHideToTrayTip = async (enabled: boolean) => {
    setHideToTrayTipEnabled(enabled)
    if (window.ipcRenderer) {
      await window.ipcRenderer.invoke(IPC_CHANNELS.app.setHideToTrayTipDismissed, !enabled)
    }
  }

  const checkUpdate = async () => {
    const result = await checkUpdateManually()
    if (result) setIsUpToDate(result.upToDate)
  }

  const handleToggleDevMode = async (checked: boolean) => {
    try {
      setDevMode(checked)
      toast.success(checked ? '已开启开发者模式' : '已关闭开发者模式')
    } catch {
      toast.error('切换开发者模式失败')
    }
  }

  const handleOpenLogFolder = () => window.ipcRenderer.invoke(IPC_CHANNELS.app.openLogFolder)

  return (
    <Card id="update-section" className="p-4 pt-3">
      <CardHeader className="p-0 pb-2">
        <CardTitle className="text-sm">常规与关于</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 p-0 pt-0">
        {/* 通用选项：两两并排 */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-0">
          <SettingRow label="最小化到托盘提示" description="关闭窗口时提醒">
            <Switch checked={hideToTrayTipEnabled} onCheckedChange={handleToggleHideToTrayTip} />
          </SettingRow>
          <SettingRow label="有新版本时弹窗提示" description="弹窗显示更新内容">
            <Switch checked={enableAutoCheckUpdate} onCheckedChange={setEnableAutoCheckUpdate} />
          </SettingRow>
        </div>

        {/* 软件更新：版本 + 检查更新同一行 */}
        <div className="flex items-center justify-between gap-3 py-2">
          <div className="min-w-0">
            <div className="text-sm font-medium leading-tight">软件更新</div>
            <div className="text-xs text-muted-foreground mt-0.5">当前版本 {version}</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0"
            disabled={updateStatus === 'checking'}
            onClick={checkUpdate}
          >
            {updateStatus === 'checking' ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
                {isUpToDate ? '已是最新' : '检查更新'}
              </>
            )}
          </Button>
        </div>

        {/* 关于/支持：日志、官网、技术支持 */}
        <SettingRow label="运行日志" description="main.log">
          <Button variant="outline" size="sm" className="h-8" onClick={handleOpenLogFolder}>
            <FileTextIcon className="mr-1 h-3.5 w-3.5" />
            打开
          </Button>
        </SettingRow>

        <SettingRow label="开发者模式" description="右键打开开发者工具">
          <Switch checked={devMode} onCheckedChange={handleToggleDevMode} />
        </SettingRow>
      </CardContent>
    </Card>
  )
}
