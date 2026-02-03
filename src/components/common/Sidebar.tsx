import { HelpCircle } from 'lucide-react'
import { NavLink } from 'react-router'
import { autoReplyPlatforms } from '@/abilities'
import { useCurrentAutoMessage } from '@/hooks/useAutoMessage'
import { useCurrentAutoPopUp } from '@/hooks/useAutoPopUp'
import { useAutoReply } from '@/hooks/useAutoReply'
import { useCurrentLiveControl } from '@/hooks/useLiveControl'
import { cn } from '@/lib/utils'
import {
  CarbonBlockStorage,
  CarbonChat,
  CarbonContentDeliveryNetwork,
  CarbonIbmEventAutomation,
  CarbonIbmWatsonTextToSpeech,
  CarbonSettings,
} from '../icons/carbon'

interface SidebarTab {
  id: string
  name: string
  isRunning?: boolean
  icon: React.ReactNode
  platform?: LiveControlPlatform[]
}

export default function Sidebar() {
  const isAutoMessageRunning = useCurrentAutoMessage(context => context.isRunning)
  const isAutoPopupRunning = useCurrentAutoPopUp(context => context.isRunning)
  const { isRunning: isAutoReplyRunning } = useAutoReply()
  const platform = useCurrentLiveControl(context => context.connectState.platform) as
    | LiveControlPlatform
    | undefined

  const tabs: SidebarTab[] = [
    {
      id: '/',
      name: '打开中控台',
      icon: <CarbonContentDeliveryNetwork className="w-5 h-5" />,
    },
    {
      id: '/auto-message',
      name: '自动发言',
      isRunning: isAutoMessageRunning,
      icon: <CarbonChat className="w-5 h-5" />,
    },
    {
      id: '/auto-popup',
      name: '自动弹窗',
      isRunning: isAutoPopupRunning,
      icon: <CarbonBlockStorage className="w-5 h-5" />,
    },
    {
      id: '/auto-reply',
      name: '自动回复',
      isRunning: isAutoReplyRunning,
      icon: <CarbonIbmEventAutomation className="w-5 h-5" />,
      platform: autoReplyPlatforms,
    },
    {
      id: '/ai-chat',
      name: 'AI 助手',
      icon: <CarbonIbmWatsonTextToSpeech className="w-5 h-5" />,
    },
    {
      id: '/settings',
      name: '应用设置',
      icon: <CarbonSettings className="w-5 h-5" />,
    },
    {
      id: '/help-support',
      name: '帮助与支持',
      icon: <HelpCircle className="w-5 h-5" />,
    },
  ]

  const filteredTabs = tabs.filter(tab => {
    if (tab.platform) {
      return platform != null && tab.platform.includes(platform)
    }
    return true
  })

  return (
    <aside
      className="w-56 min-w-[224px] relative z-[1]"
      style={{
        backgroundColor: 'var(--sidebar-bg)',
        boxShadow: 'var(--sidebar-edge-shadow)',
      }}
    >
      <div className="py-5 px-4">
        <nav className="space-y-1">
          {filteredTabs.map(tab => (
            <NavLink
              key={tab.id}
              to={tab.id}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors duration-150 relative',
                  isActive
                    ? 'bg-[var(--sidebar-active-bg)] text-primary'
                    : 'text-muted-foreground hover:bg-[color:var(--sidebar-item-hover)] hover:text-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
                  )}
                  <span className="shrink-0 [&>svg]:size-5">{tab.icon}</span>
                  <span className="truncate">{tab.name}</span>
                  {tab.isRunning && (
                    <span className="absolute right-2.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  )
}
