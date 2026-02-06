import { HelpSupportContent } from '@/components/common/HelpSupportContent'
import { Title } from '@/components/common/Title'

export default function HelpSupport() {
  return (
    <div className="w-full py-0 flex flex-col gap-2 min-h-0">
      <div className="shrink-0">
        <Title title="帮助与支持" description="使用教程与常见问题" />
      </div>
      <div className="min-w-0">
        <HelpSupportContent />
      </div>
    </div>
  )
}
