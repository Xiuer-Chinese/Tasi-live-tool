import { ExternalLinkIcon, FileTextIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useTheme } from '@/hooks/useTheme'

export function OtherSetting() {
  const [theme, setTheme] = useTheme()
  const [hideToTrayTipEnabled, setHideToTrayTipEnabled] = useState(true)

  // 加载设置
  useEffect(() => {
    const loadSetting = async () => {
      if (window.ipcRenderer) {
        const dismissed = await window.ipcRenderer.invoke(
          IPC_CHANNELS.app.getHideToTrayTipDismissed,
        )
        // dismissed=true 表示已关闭提示，所以 enabled = !dismissed
        setHideToTrayTipEnabled(!dismissed)
      }
    }
    loadSetting()
  }, [])

  // 保存设置
  const handleToggleHideToTrayTip = async (enabled: boolean) => {
    setHideToTrayTipEnabled(enabled)
    if (window.ipcRenderer) {
      // enabled=false 表示用户关闭了提示，所以 dismissed = !enabled
      await window.ipcRenderer.invoke(IPC_CHANNELS.app.setHideToTrayTipDismissed, !enabled)
    }
  }

  const handleOpenLogFolder = async () => {
    await window.ipcRenderer.invoke(IPC_CHANNELS.app.openLogFolder)
  }

  const handleOpenWebsite = async () => {
    await window.ipcRenderer.invoke(IPC_CHANNELS.app.openExternal, 'https://livestudio.example.com')
  }

  const handleOpenSupport = async () => {
    await window.ipcRenderer.invoke(
      IPC_CHANNELS.app.openExternal,
      'mailto:support@livestudio.example.com',
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>其他设置</CardTitle>
        <CardDescription>更多功能与信息</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>夜间模式</Label>
              <p className="text-sm text-muted-foreground">使用深色主题</p>
            </div>
            <Switch
              checked={theme === 'dark'}
              onCheckedChange={checked => setTheme(checked ? 'dark' : 'light')}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>关闭时最小化到托盘提示</Label>
              <p className="text-sm text-muted-foreground">
                关闭窗口时显示系统通知，提醒应用仍在后台运行
              </p>
            </div>
            <Switch checked={hideToTrayTipEnabled} onCheckedChange={handleToggleHideToTrayTip} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="text-sm font-medium leading-none">运行日志</h4>
              <p className="text-sm text-muted-foreground">查看程序运行日志文件 main.log</p>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleOpenLogFolder}>
              <FileTextIcon className="h-4 w-4" />
              打开日志文件夹
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="text-sm font-medium leading-none">产品信息</h4>
              <p className="text-sm text-muted-foreground">了解更多产品相关内容</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={handleOpenWebsite}>
                官方网站
                <ExternalLinkIcon className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleOpenSupport}>
                技术支持
                <ExternalLinkIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
