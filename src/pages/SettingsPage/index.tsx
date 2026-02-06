import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { Title } from '@/components/common/Title'
import { CoreConfigCard } from '@/pages/SettingsPage/components/CoreConfigCard'
import { GeneralAboutCard } from '@/pages/SettingsPage/components/GeneralAboutCard'

export default function Settings() {
  const location = useLocation()

  useEffect(() => {
    const hash = location.hash
    if (hash) {
      const el = document.querySelector(hash)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [location.hash])

  return (
    <div className="w-full py-0 flex flex-col gap-2 min-h-0 overflow-auto">
      <div className="shrink-0">
        <Title title="设置" description="管理应用程序设置和偏好" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0 flex-1 min-h-0">
        <div className="min-w-0 min-h-0">
          <CoreConfigCard />
        </div>
        <div className="min-w-0 min-h-0">
          <GeneralAboutCard />
        </div>
      </div>
    </div>
  )
}
