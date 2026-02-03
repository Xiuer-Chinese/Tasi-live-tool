import { HelpSupportContent } from '@/components/common/HelpSupportContent'
import { Title } from '@/components/common/Title'

export default function HelpSupport() {
  return (
    <div className="w-full py-2">
      <div className="mb-6">
        <Title title="帮助与支持" description="" />
      </div>
      <div className="max-w-2xl">
        <HelpSupportContent />
      </div>
    </div>
  )
}
