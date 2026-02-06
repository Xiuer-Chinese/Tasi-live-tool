import { useMemoizedFn } from 'ahooks'
import { PlusIcon } from 'lucide-react'
import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAutoPopUpActions, useCurrentAutoPopUp } from '@/hooks/useAutoPopUp'
import { useCurrentPlatform } from '@/hooks/useLiveControl'
import { useToast } from '@/hooks/useToast'
import { MOCK_GOODS_IDS, shouldUseMockGoods } from '@/utils/mockGoodsData'
import GoodsListItem from './GoodsListItem'
import ShortcutConfigTab from './ShortcutConfigTab'

const CommonList = () => {
  const goodsIds = useCurrentAutoPopUp(context => context.config.goodsIds)
  const { setGoodsIds } = useAutoPopUpActions()
  const { toast } = useToast()
  const platform = useCurrentPlatform()
  // 【测试模式检查】仅在测试平台或开发模式下启用 Mock 数据
  // 生产环境（MODE=production）时 isTestMode 始终为 false
  const isTestMode = shouldUseMockGoods(platform)

  // 【自动注入测试商品】仅在测试模式下执行
  // 条件：1) isTestMode === true（已通过环境/平台检查）
  //       2) 商品列表为空（避免覆盖用户数据）
  // 注意：生产环境不会执行此逻辑
  React.useEffect(() => {
    console.log(
      `[MockGoods] Check: platform=${platform}, isTestMode=${isTestMode}, goodsIds.length=${goodsIds.length}`,
    )
    if (isTestMode && goodsIds.length === 0) {
      console.log(`[MockGoods] Auto-injecting test goods for platform: ${platform}`)
      setGoodsIds([...MOCK_GOODS_IDS])
    }
  }, [isTestMode, goodsIds.length, setGoodsIds, platform])

  const handleGoodsIdChange = useMemoizedFn((index: number, value: string) => {
    const numValue = Number(value)
    if (Number.isNaN(numValue) || numValue < 1) {
      toast.error('请输入有效的商品序号')
      return
    }
    const newIds = [...goodsIds]
    if (newIds.includes(numValue)) {
      toast.error('商品序号不能重复！')
      return
    }
    newIds[index] = numValue

    setGoodsIds(newIds)
  })

  const addGoodsId = useMemoizedFn(() => {
    let id = 1
    while (goodsIds.includes(id)) id += 1
    setGoodsIds([...goodsIds, id])
  })

  return (
    <>
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="space-y-0.5 min-w-0">
          <Label className="text-sm">商品列表</Label>
          <p className="text-xs text-muted-foreground">添加需要自动弹出的商品序号</p>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs shrink-0" onClick={addGoodsId}>
          <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
          添加
        </Button>
      </div>

      <div className="space-y-2">
        {goodsIds.map((id, index) => (
          <GoodsListItem
            // biome-ignore lint/suspicious/noArrayIndexKey: 下标不影响
            key={index}
            id={id}
            index={index}
            onChange={handleGoodsIdChange}
            onDelete={() => {
              const newGoodsIds = goodsIds.filter((_, i) => i !== index)
              setGoodsIds(newGoodsIds)
            }}
          />
        ))}
      </div>
    </>
  )
}

// 商品列表卡片组件
const GoodsListCard = React.memo(() => {
  return (
    <Card className="flex flex-col min-h-0 overflow-hidden">
      <CardContent className="flex flex-col min-h-0 p-3 pt-3">
        <Tabs defaultValue="goods-list" className="w-full flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2 h-8 text-sm shrink-0">
            <TabsTrigger value="goods-list" className="text-xs sm:text-sm">
              商品列表
            </TabsTrigger>
            <TabsTrigger value="shortcuts" className="text-xs sm:text-sm">
              快捷键配置
            </TabsTrigger>
          </TabsList>

          <TabsContent value="goods-list" className="space-y-2 mt-2 flex-1 min-h-0 overflow-y-auto">
            <CommonList />
          </TabsContent>

          <TabsContent value="shortcuts" className="mt-2 flex-1 min-h-0 overflow-y-auto">
            <ShortcutConfigTab />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
})

export default GoodsListCard
