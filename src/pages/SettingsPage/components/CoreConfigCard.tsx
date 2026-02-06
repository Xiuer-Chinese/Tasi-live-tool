import { useMemoizedFn } from 'ahooks'
import { EraserIcon, FolderSearchIcon, SearchIcon, TrashIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { SimpleIconsGooglechrome, SimpleIconsMicrosoftedge } from '@/components/icons/simpleIcons'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  AUTH_LAST_IDENTIFIER_KEY,
  AUTH_REMEMBER_ME_KEY,
  AUTH_ZUSTAND_PERSIST_KEY,
} from '@/constants/authStorageKeys'
import { useAccounts } from '@/hooks/useAccounts'
import { useCurrentChromeConfig, useCurrentChromeConfigActions } from '@/hooks/useChromeConfig'
import { useCurrentLiveControl } from '@/hooks/useLiveControl'
import { useToast } from '@/hooks/useToast'
import { useAuthStore } from '@/stores/authStore'
import { SettingRow } from './SettingRow'

export function CoreConfigCard() {
  const path = useCurrentChromeConfig(context => context.path)
  const { setPath, setStorageState } = useCurrentChromeConfigActions()
  const [isDetecting, setIsDetecting] = useState(false)
  const [edgeFirst, setEdgeFirst] = useState(false)
  const { toast } = useToast()
  const edgeFirstId = useId()

  const handleSelectChrome = async () => {
    try {
      const p = await window.ipcRenderer.invoke(IPC_CHANNELS.chrome.selectPath)
      if (p) {
        setPath(p)
        toast.success('Chrome 路径设置成功')
      }
    } catch {
      toast.error('选择 Chrome 路径失败')
    }
  }

  const handleAutoDetect = async () => {
    try {
      setIsDetecting(true)
      const result = await window.ipcRenderer.invoke(IPC_CHANNELS.chrome.getPath, edgeFirst)
      if (result) {
        setPath(result)
        toast.success('已自动检测到路径')
      } else {
        toast.error('未检测到 Chrome，请确保 Chrome 已打开')
      }
    } catch {
      toast.error('检测 Chrome 路径失败')
    } finally {
      setIsDetecting(false)
    }
  }

  const handleCookiesReset = () => {
    setStorageState('')
    toast.success('登录状态已重置')
  }

  const { accounts, removeAccount, currentAccountId, defaultAccountId } = useAccounts()
  const connectState = useCurrentLiveControl(context => context.connectState)
  const isConnected = connectState.status === 'connected'
  const currentAccount = accounts.find(acc => acc.id === currentAccountId)
  const isDefaultAccount = defaultAccountId === currentAccountId
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const handleDeleteAccount = useMemoizedFn(async () => {
    if (isDefaultAccount) return
    if (isConnected) {
      await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.liveControl.disconnect, currentAccountId)
    }
    removeAccount(currentAccountId)
    setIsDeleteDialogOpen(false)
    toast.success('删除账号成功')
  })

  return (
    <Card className="p-4 pt-3">
      <CardHeader className="p-0 pb-2">
        <CardTitle className="text-sm">核心配置</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 p-0 pt-0">
        {/* 浏览器：检测 + Edge 同一行；路径 + 浏览同一行 */}
        <div className="space-y-2 py-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleAutoDetect}
                disabled={isDetecting}
                className="h-8"
              >
                <SearchIcon className={`mr-1.5 h-3.5 w-3.5 ${isDetecting ? 'animate-spin' : ''}`} />
                {isDetecting ? '检测中' : '开始检测'}
              </Button>
              <div className="flex items-center gap-1.5">
                <Switch id={edgeFirstId} checked={edgeFirst} onCheckedChange={setEdgeFirst} />
                <Label htmlFor={edgeFirstId} className="text-xs text-muted-foreground">
                  优先 Edge
                </Label>
              </div>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <Input
              value={path}
              onChange={e => setPath(e.target.value)}
              placeholder="浏览器路径"
              className="font-mono text-xs h-8 flex-1 min-w-0"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0"
              onClick={handleSelectChrome}
            >
              <FolderSearchIcon className="mr-1 h-3.5 w-3.5" />
              浏览
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            请选择 <SimpleIconsGooglechrome className="w-3 h-3 inline mx-0.5" /> chrome.exe
            <span className="mx-1">|</span>
            <SimpleIconsMicrosoftedge className="w-3 h-3 inline mx-0.5" /> msedge.exe
          </p>
        </div>

        <SettingRow label="重置登录状态" description="清除已保存登录信息，下次需重新登录">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="h-8">
                <EraserIcon className="mr-1 h-3.5 w-3.5" />
                重置
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认重置登录状态？</AlertDialogTitle>
                <AlertDialogDescription>
                  将清除已保存的登录信息，下次启动需重新登录。无法撤销。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCookiesReset}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  确认
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </SettingRow>

        <SettingRow label="清除本地登录数据" description="清除 token、记住登录等，登录框将为空">
          <ClearLocalLoginButton />
        </SettingRow>

        <SettingRow
          label="删除账号"
          description={currentAccount ? `当前：${currentAccount.name}` : undefined}
        >
          {!isDefaultAccount ? (
            isConnected ? (
              <Button variant="destructive" size="sm" className="h-8" disabled>
                请先断开中控台
              </Button>
            ) : (
              <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="h-8">
                    <TrashIcon className="mr-1 h-3.5 w-3.5" />
                    删除
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认删除该账号配置？</AlertDialogTitle>
                    <AlertDialogDescription>
                      请确保该账号任务已停止，以免造成未知错误。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAccount}>确认</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )
          ) : (
            <Button size="sm" className="h-8" disabled>
              默认账号不可删
            </Button>
          )}
        </SettingRow>
      </CardContent>
    </Card>
  )
}

function ClearLocalLoginButton() {
  const { toast } = useToast()
  const clearTokensAndUnauth = useAuthStore(s => s.clearTokensAndUnauth)
  const handleClear = async () => {
    try {
      if (window.ipcRenderer) {
        await window.ipcRenderer.invoke(IPC_CHANNELS.app.clearLocalLoginData)
      }
      localStorage.removeItem(AUTH_REMEMBER_ME_KEY)
      localStorage.removeItem(AUTH_LAST_IDENTIFIER_KEY)
      localStorage.removeItem(AUTH_ZUSTAND_PERSIST_KEY)
      clearTokensAndUnauth()
      toast.success('已清除本地登录数据')
    } catch (e) {
      console.error(e)
      toast.error('清除失败，请重试')
    }
  }
  return (
    <Button variant="outline" size="sm" className="h-8" onClick={handleClear}>
      清除
    </Button>
  )
}
