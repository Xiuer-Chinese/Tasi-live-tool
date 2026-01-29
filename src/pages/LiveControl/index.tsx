import { Title } from '@/components/common/Title'
import InstructionsCard from './components/InstructionsCard'
import StatusCard from './components/StatusCard'

export default function BrowserControl() {
  return (
    <div className="container">
      <div className="mb-14 mt-4">
        <Title title="直播控制台" description="连接并管理您的直播控制台" />
      </div>

      <div className="space-y-6">
        <StatusCard />
        <InstructionsCard />
      </div>
    </div>
  )
}
