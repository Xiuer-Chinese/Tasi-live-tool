/**
 * 统一门控：guardAction(actionName, options)
 * - 未登录 → 打开登录弹窗，登录成功后执行 pendingAction
 * - 已登录但需订阅且未在试用 → 打开订阅/试用弹窗，点试用后执行 pendingAction
 * - 已登录且在试用/已订阅 → 直接执行 action
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { useAuthStore } from '@/stores/authStore'
import { useTrialStore } from '@/stores/trialStore'

export type GuardActionOptions = {
  /** 通过门控后要执行的回调（可选，登录/试用后会自动执行或用户再次点击） */
  action?: () => void | Promise<void>
  /** 是否需要订阅/试用（非 test 平台、连接控制台等为 true） */
  requireSubscription?: boolean
}

interface GateStore {
  /** 登录/试用后待执行的回调 */
  pendingAction: (() => void | Promise<void>) | null
  /** 当前门控触发的 action 名称（用于弹窗文案） */
  pendingActionName: string
  /** 首次登录后是否已设置默认平台为 test（persist） */
  defaultPlatformSetAfterLogin: boolean
  setPendingAction: (fn: (() => void | Promise<void>) | null, name?: string) => void
  setDefaultPlatformSetAfterLogin: (v: boolean) => void
  /** 执行并清空 pendingAction（由 AuthProvider/SubscribeDialog 在登录/试用成功后调用） */
  runPendingActionAndClear: () => Promise<void>
  /**
   * 统一门控：未登录弹登录；需订阅且未在试用弹订阅；否则执行 action
   */
  guardAction: (actionName: string, options: GuardActionOptions) => Promise<void>
}

export const useGateStore = create<GateStore>()(
  persist(
    (set, get) => ({
      pendingAction: null,
      pendingActionName: '',
      defaultPlatformSetAfterLogin: false,

      setPendingAction: (fn, name = '') => {
        set({ pendingAction: fn, pendingActionName: name })
      },

      setDefaultPlatformSetAfterLogin: (v: boolean) => {
        set({ defaultPlatformSetAfterLogin: v })
      },

      runPendingActionAndClear: async () => {
        const { pendingAction } = get()
        set({ pendingAction: null, pendingActionName: '' })
        if (pendingAction) {
          try {
            await Promise.resolve(pendingAction())
          } catch (e) {
            console.error('[GateStore] pendingAction error:', e)
          }
        }
      },

      guardAction: async (actionName: string, options: GuardActionOptions) => {
        const { requireSubscription = false } = options
        const pendingFn = options.action != null ? options.action : null
        const isAuthenticated = useAuthStore.getState().isAuthenticated
        const isInTrial = useTrialStore.getState().isInTrial()

        if (!isAuthenticated) {
          get().setPendingAction(pendingFn, actionName)
          window.dispatchEvent(
            new CustomEvent('auth:required', { detail: { feature: actionName } }),
          )
          return
        }

        if (requireSubscription && !isInTrial) {
          get().setPendingAction(pendingFn, actionName)
          window.dispatchEvent(
            new CustomEvent('gate:subscribe-required', { detail: { actionName } }),
          )
          return
        }

        if (pendingFn) {
          try {
            await Promise.resolve(pendingFn())
          } catch (e) {
            console.error('[GateStore] guardAction error:', e)
          }
        }
      },
    }),
    {
      name: 'gate-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({ defaultPlatformSetAfterLogin: state.defaultPlatformSetAfterLogin }),
    },
  ),
)
