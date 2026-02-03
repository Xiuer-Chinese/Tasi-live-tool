import { ChevronDown, Copy, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  HELP_FAQ_ITEMS,
  SUPPORT_EMAIL,
  SUPPORT_PRODUCT_NAME,
  WECHAT_QR_IMAGE_PATH,
} from '@/constants/helpSupport'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'

const INTRO_TEXT = `如果你在使用过程中遇到问题，建议先查看下方的常见问题。
如果问题仍未解决，可以通过下方方式联系支持。`

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
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground whitespace-pre-line">{INTRO_TEXT}</p>

      <div>
        <h3 className="text-sm font-medium mb-2">常见问题</h3>
        <ul className="space-y-1">
          {HELP_FAQ_ITEMS.map((item, index) => {
            const id = `faq-${index}`
            const isOpen = openFaqId === id
            return (
              <li key={id}>
                <Collapsible open={isOpen} onOpenChange={open => setOpenFaqId(open ? id : null)}>
                  <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium hover:bg-muted/80 transition-colors">
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 transition-transform',
                        isOpen && 'rotate-180',
                      )}
                    />
                    <span>{item.question}</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <p className="pl-6 pr-2 py-1.5 text-sm text-muted-foreground">{item.answer}</p>
                  </CollapsibleContent>
                </Collapsible>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium">联系支持</h3>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{SUPPORT_EMAIL}</span>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopyEmail}>
            <Copy className="h-3.5 w-3.5" />
            一键复制邮箱
          </Button>
        </div>
        <div>
          <Collapsible open={wechatOpen} onOpenChange={setWechatOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <MessageCircle className="h-3.5 w-3.5" />
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
        </div>
      </div>

      <p className="text-xs text-muted-foreground border-l-2 border-muted pl-3 py-1">
        {CONTACT_TIP.replace('软件名', SUPPORT_PRODUCT_NAME)}
      </p>
    </div>
  )
}
