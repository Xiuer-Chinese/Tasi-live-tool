import { Title } from '@/components/common/Title'
import InstructionsCard from './components/InstructionsCard'
import StatusCard from './components/StatusCard'

export default function BrowserControl() {
  return (
    <div
      className="w-full flex flex-col flex-1 min-h-0"
      style={{ padding: 24, backgroundColor: 'hsl(var(--muted) / 0.4)' }}
    >
      <div className="w-full max-w-4xl mx-auto flex flex-col gap-6">
        <div>
          <Title title="直播控制台" description="连接并管理您的直播控制台" />
        </div>

        <StatusCard />
        <InstructionsCard />
      </div>
    </div>
  )
}
