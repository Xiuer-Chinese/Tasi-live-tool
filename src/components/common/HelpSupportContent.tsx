import { BookOpen, ChevronDown, Copy, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  HELP_FAQ_ITEMS,
  SUPPORT_EMAIL,
  SUPPORT_PRODUCT_NAME,
  WECHAT_QR_IMAGE_PATH,
} from '@/constants/helpSupport'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import { UserGuideDialog } from './UserGuideDialog'

const INTRO_TEXT = `如果你在使用过程中遇到问题，建议先查看使用教程或下方的常见问题。
如果问题仍未解决，可通过下方方式联系支持。`

const CONTACT_TIP = '添加微信时，请备注【软件名 + 问题简述】，以便更快处理。'

export function HelpSupportContent() {
  const { toast } = useToast()
  const [wechatOpen, setWechatOpen] = useState(false)
  const [openFaqId, setOpenFaqId] = useState<string | null>(null)

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL)
      toast.success('邮箱已复制到剪贴板')
    } catch {
      toast.error('复制失败，请手动复制')
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
      {/* 左栏：简介 + 使用教程 + 联系支持 */}
      <div className="min-w-0 space-y-3">
        <p className="text-sm text-muted-foreground whitespace-pre-line leading-snug">
          {INTRO_TEXT}
        </p>

        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 p-3">
          <CardHeader className="p-0 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              使用教程
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              详细了解各功能模块的使用方法，快速上手直播工具
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <UserGuideDialog
              trigger={
                <Button size="sm" className="gap-1.5 h-8">
                  <BookOpen className="h-3.5 w-3.5" />
                  查看完整教程
                </Button>
              }
            />
          </CardContent>
        </Card>

        {/* 联系支持：紧凑排版，避免滚屏 */}
        <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
          <h3 className="text-sm font-medium leading-tight">联系支持</h3>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{SUPPORT_EMAIL}</span>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 h-7 text-xs"
              onClick={handleCopyEmail}
            >
              <Copy className="h-3 w-3" />
              一键复制邮箱
            </Button>
          </div>
          <Collapsible open={wechatOpen} onOpenChange={setWechatOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
                <MessageCircle className="h-3 w-3" />
                联系微信支持
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 p-2 border rounded-md bg-muted/30 inline-block">
                <img
                  src={WECHAT_QR_IMAGE_PATH}
                  alt="微信支持二维码"
                  className="w-40 h-40 object-contain"
                  onError={e => {
                    const target = e.currentTarget
                    target.style.display = 'none'
                    const fallback = target.nextElementSibling as HTMLElement | null
                    if (fallback) fallback.hidden = false
                  }}
                />
                <p
                  className="w-40 h-40 flex items-center justify-center text-xs text-muted-foreground text-center"
                  hidden
                >
                  二维码图片未找到，请确保 public/support-wechat-qr.png 存在
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
          <p className="text-xs text-muted-foreground leading-snug">
            {CONTACT_TIP.replace('软件名', SUPPORT_PRODUCT_NAME)}
          </p>
        </div>
      </div>

      {/* 右栏：常见问题 */}
      <div className="min-w-0 space-y-2">
        <h3 className="text-sm font-medium">常见问题</h3>
        <ul className="space-y-0.5">
          {HELP_FAQ_ITEMS.map((item, index) => {
            const id = `faq-${index}`
            const isOpen = openFaqId === id
            return (
              <li key={id}>
                <Collapsible open={isOpen} onOpenChange={open => setOpenFaqId(open ? id : null)}>
                  <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm font-medium hover:bg-muted/80 transition-colors">
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 shrink-0 transition-transform',
                        isOpen && 'rotate-180',
                      )}
                    />
                    <span>{item.question}</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <p className="pl-5 pr-2 py-1 text-xs text-muted-foreground">{item.answer}</p>
                  </CollapsibleContent>
                </Collapsible>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
