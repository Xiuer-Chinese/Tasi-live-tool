import { useMemoizedFn } from 'ahooks'
import { Pencil, Plus, Star } from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useAccounts } from '@/hooks/useAccounts'
import { useCurrentLiveControl } from '@/hooks/useLiveControl'
import { useToast } from '@/hooks/useToast'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'

export const AccountSwitcher = React.memo(() => {
  const {
    accounts,
    currentAccountId,
    defaultAccountId,
    addAccount,
    switchAccount,
    updateAccountName,
    setDefaultAccount,
  } = useAccounts()
  const connectState = useCurrentLiveControl(context => context.connectState)

  // 【4】清理不必要的 render 期 ref 缓存，改用 useMemo
  const accountItems = useMemo(() => accounts.map(a => ({ id: a.id, name: a.name })), [accounts])

  // 【1】增加"合法选中值"归一化 - 确保 Select 的 value 永远合法
  const hasCurrent = accounts.some(a => a.id === currentAccountId)
  const normalizedAccountId = hasCurrent ? currentAccountId : (accounts[0]?.id ?? undefined)

  // 【2】增加一次性纠正 store（避免其它模块拿到非法 currentAccountId）
  const didFixInvalidSelectionRef = useRef(false)
  // 使用 useMemo 稳定 accounts 的 ID 列表和第一个账号 ID
  const accountIds = useMemo(() => accounts.map(a => a.id), [accounts])
  const firstAccountId = useMemo(() => accounts[0]?.id, [accounts])
  const hasCurrentAccount = useMemo(
    () => accountIds.includes(currentAccountId),
    [accountIds, currentAccountId],
  )

  useEffect(() => {
    if (didFixInvalidSelectionRef.current) return
    if (!accounts.length) return
    if (currentAccountId && hasCurrentAccount) {
      // 当前选中值合法，重置标志（可选，允许后续再次纠正）
      // didFixInvalidSelectionRef.current = false
      return
    }
    // 当前选中值不合法，纠正为第一个账号
    if (firstAccountId) {
      didFixInvalidSelectionRef.current = true
      switchAccount(firstAccountId)
    }
  }, [accounts.length, currentAccountId, hasCurrentAccount, firstAccountId, switchAccount])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [newAccountName, setNewAccountName] = useState('')
  const [editingAccount, setEditingAccount] = useState<{
    id: string
    name: string
  } | null>(null)
  const { toast } = useToast()

  // 用于跟踪星星按钮的点击，防止触发账号切换
  const starButtonClickRef = useRef<{ accountId: string; timestamp: number } | null>(null)

  // 【3】onValueChange 增加 guard - 避免重复触发
  const handleAccountSwitch = useMemoizedFn(async (accountId: string) => {
    // 特殊值：添加账号
    if (accountId === '__add_account__') {
      setIsAddDialogOpen(true)
      return
    }

    // 特殊值：重命名当前账号
    if (accountId === '__rename_account__') {
      const account = accountItems.find(acc => acc.id === normalizedAccountId)
      if (account) {
        openEditDialog({ id: account.id, name: account.name })
      }
      return
    }

    // 检查是否是从星星按钮触发的（通过检查 ref）
    // 如果最近 100ms 内点击的是星星按钮，则不执行切换
    const starClick = starButtonClickRef.current
    if (starClick && starClick.accountId === accountId && Date.now() - starClick.timestamp < 100) {
      // 这是从星星按钮触发的，不执行切换
      starButtonClickRef.current = null // 清除标记
      return
    }

    // Guard: 如果已经是当前选中值，不执行切换
    if (accountId === currentAccountId) return

    // 执行切换
    switchAccount(accountId)
    toast.success('切换账号成功')
  })

  const handleAddAccount = useMemoizedFn(() => {
    if (!newAccountName.trim()) {
      toast.error('请输入账号名称')
      return
    }

    // 使用稳定的 accountItems 检查，避免 accounts 数组引用变化
    if (accountItems.some(account => account.name === newAccountName)) {
      toast.error('账号名称已存在')
      return
    }

    addAccount(newAccountName)
    setIsAddDialogOpen(false)
    setNewAccountName('')
    toast.success('添加账号成功')
  })

  const handleEditAccount = useMemoizedFn(() => {
    if (!editingAccount) return
    if (!editingAccount.name.trim()) {
      toast.error('请输入账号名称')
      return
    }

    // 使用稳定的 accountItems 检查，避免 accounts 数组引用变化
    if (
      accountItems.some(
        account => account.name === editingAccount.name && account.id !== editingAccount.id,
      )
    ) {
      toast.error('账号名称已存在')
      return
    }

    updateAccountName(editingAccount.id, editingAccount.name)
    setIsEditDialogOpen(false)
    setEditingAccount(null)
    toast.success('修改账号名称成功')
  })

  const openEditDialog = useMemoizedFn((account: { id: string; name: string }) => {
    setEditingAccount(account)
    setIsEditDialogOpen(true)
  })

  const handleSetDefault = useMemoizedFn(
    (accountId: string, e: React.MouseEvent | React.PointerEvent) => {
      e.stopPropagation()
      e.preventDefault()
      // 记录星星按钮点击，用于 handleAccountSwitch 检查
      starButtonClickRef.current = { accountId, timestamp: Date.now() }
      // 阻止事件继续传播到 SelectItem
      if ('nativeEvent' in e) {
        e.nativeEvent.stopImmediatePropagation()
      }
      setDefaultAccount(accountId)
      toast.success('已设为默认账号')
    },
  )

  // useWhyDidYouUpdate('AccountSwitcher', {
  //   accounts,
  //   currentAccountId,
  //   isConnected,
  //   isAddDialogOpen,
  //   isEditDialogOpen,
  //   newAccountName,
  //   editingAccount,
  //   toast,
  //   handleAccountSwitch,
  //   handleAddAccount,
  //   handleEditAccount,
  //   openEditDialog,
  //   setIsAddDialogOpen,
  //   setIsEditDialogOpen,
  //   setNewAccountName,
  //   setEditingAccount,
  // })

  return (
    <div className="flex items-center gap-2">
      <Select
        disabled={connectState.status === 'connecting'}
        value={normalizedAccountId}
        onValueChange={handleAccountSwitch}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="选择账号" />
        </SelectTrigger>
        <SelectContent>
          <TooltipProvider>
            {accountItems.map(account => {
              const isDefault = defaultAccountId === account.id
              return (
                <SelectItem
                  key={account.id}
                  value={account.id}
                  className="flex items-center justify-between group"
                  onPointerUp={e => {
                    // Radix Select 使用 onPointerUp 来处理选择
                    // 检查点击目标是否是星星按钮或其子元素
                    const target = e.target as HTMLElement
                    const isStarButton = target.closest('button[aria-label="设为默认账号"]')
                    if (isStarButton) {
                      // 如果点击的是星星按钮，阻止 SelectItem 的默认行为
                      e.preventDefault()
                      e.stopPropagation()
                      // 阻止事件继续传播
                      if (e.nativeEvent) {
                        e.nativeEvent.stopImmediatePropagation()
                      }
                    }
                  }}
                >
                  <span className="flex-1 truncate">{account.name}</span>
                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                    {isDefault ? (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0">
                        默认
                      </Badge>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            data-star-button="true"
                            onPointerDown={e => {
                              e.preventDefault()
                              e.stopPropagation()
                              // 记录星星按钮点击，用于 handleAccountSwitch 检查
                              starButtonClickRef.current = {
                                accountId: account.id,
                                timestamp: Date.now(),
                              }
                              // 阻止事件继续传播到 SelectItem
                              if (e.nativeEvent) {
                                e.nativeEvent.stopImmediatePropagation()
                              }
                            }}
                            onPointerUp={e => {
                              e.preventDefault()
                              e.stopPropagation()
                              // 记录星星按钮点击，用于 handleAccountSwitch 检查
                              starButtonClickRef.current = {
                                accountId: account.id,
                                timestamp: Date.now(),
                              }
                              // 阻止事件继续传播到 SelectItem
                              if (e.nativeEvent) {
                                e.nativeEvent.stopImmediatePropagation()
                              }
                            }}
                            onClick={e => handleSetDefault(account.id, e)}
                            onMouseDown={e => {
                              e.preventDefault()
                              e.stopPropagation()
                              // 记录星星按钮点击，用于 handleAccountSwitch 检查
                              starButtonClickRef.current = {
                                accountId: account.id,
                                timestamp: Date.now(),
                              }
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded-sm"
                            aria-label="设为默认账号"
                          >
                            <Star className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>设为默认账号</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </SelectItem>
              )
            })}
          </TooltipProvider>
          <SelectSeparator />
          <SelectItem value="__rename_account__" className="flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            <span>重命名当前账号…</span>
          </SelectItem>
          <SelectItem value="__add_account__" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <span>添加账号…</span>
          </SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加新账号</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="账号名称"
              value={newAccountName}
              onChange={e => setNewAccountName(e.target.value)}
            />
            <Button onClick={handleAddAccount}>确定</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改账号名称</DialogTitle>
            <DialogDescription>账号名称不能重复</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="账号名称"
              value={editingAccount?.name ?? ''}
              onChange={e =>
                setEditingAccount(prev => (prev ? { ...prev, name: e.target.value } : null))
              }
            />
            <Button onClick={handleEditAccount}>确定</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
})

AccountSwitcher.whyDidYouRender = true
