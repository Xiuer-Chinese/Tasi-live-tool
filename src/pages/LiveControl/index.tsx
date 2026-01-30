import { Title } from '@/components/common/Title'
import InstructionsCard from './components/InstructionsCard'
import StatusCard from './components/StatusCard'

export default function BrowserControl() {
  return (
    <div className="w-full">
      <div className="mb-10 mt-2">
        <Title title="直播控制台" description="连接并管理您的直播控制台" />
      </div>

      <div className="space-y-5">
        <StatusCard />
        <InstructionsCard />
      </div>
    </div>
  )
}
