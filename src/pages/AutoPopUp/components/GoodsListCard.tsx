import { useMemoizedFn } from 'ahooks'
import { PlusIcon, TestTubeIcon } from 'lucide-react'
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

  const injectMockGoods = useMemoizedFn(() => {
    // 注入测试商品 ID（如果已存在则不重复添加）
    const existingIds = new Set(goodsIds)
    const newIds = [...goodsIds]
    for (const mockId of MOCK_GOODS_IDS) {
      if (!existingIds.has(mockId)) {
        newIds.push(mockId)
        existingIds.add(mockId)
      }
    }
    setGoodsIds(newIds)
    toast.success(`已注入 ${MOCK_GOODS_IDS.length} 个测试商品`)
  })

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label>商品列表</Label>
          <p className="text-sm text-muted-foreground">添加需要自动弹出的商品序号</p>
        </div>
        <div className="flex gap-2">
          {/* 【测试模式按钮】仅在测试平台或开发模式下显示 */}
          {/* 生产环境（MODE=production）时 isTestMode 为 false，此按钮不会渲染 */}
          {isTestMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={injectMockGoods}
              className="border-orange-300 text-orange-600 hover:bg-orange-50"
              title="仅测试模式：注入测试商品数据（生产环境不可用）"
            >
              <TestTubeIcon className="mr-2 h-4 w-4" />
              <span className="text-xs">[测试] 注入商品</span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={addGoodsId}>
            <PlusIcon className="mr-2 h-4 w-4" />
            添加商品
          </Button>
        </div>
      </div>

      <div className="space-y-4">
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
    <Card>
      <CardContent className="pt-6">
        <Tabs defaultValue="goods-list" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="goods-list">商品列表</TabsTrigger>
            <TabsTrigger value="shortcuts">快捷键配置</TabsTrigger>
          </TabsList>

          <TabsContent value="goods-list" className="space-y-6 mt-4">
            <CommonList />
          </TabsContent>

          <TabsContent value="shortcuts" className="mt-4">
            <ShortcutConfigTab />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
})

export default GoodsListCard
