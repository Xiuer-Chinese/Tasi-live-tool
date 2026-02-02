/**
 * 试用 7 天（本地持久化），不接支付与后端订阅
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

const TRIAL_DAYS = 7

interface TrialState {
  trialStartedAt: number | null
  trialEndsAt: number | null
  trialActivated: boolean
}

interface TrialStore extends TrialState {
  startTrial: () => void
  isInTrial: () => boolean
  isTrialExpired: () => boolean
}

export const useTrialStore = create<TrialStore>()(
  persist(
    (set, get) => ({
      trialStartedAt: null,
      trialEndsAt: null,
      trialActivated: false,

      startTrial: () => {
        const now = Date.now()
        const endsAt = now + TRIAL_DAYS * 24 * 60 * 60 * 1000
        set({
          trialStartedAt: now,
          trialEndsAt: endsAt,
          trialActivated: true,
        })
      },

      isInTrial: () => {
        const { trialActivated, trialEndsAt } = get()
        if (!trialActivated || !trialEndsAt) return false
        return Date.now() < trialEndsAt
      },

      isTrialExpired: () => {
        const { trialActivated, trialEndsAt } = get()
        if (!trialActivated || !trialEndsAt) return false
        return Date.now() >= trialEndsAt
      },
    }),
    {
      name: 'trial-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({
        trialStartedAt: state.trialStartedAt,
        trialEndsAt: state.trialEndsAt,
        trialActivated: state.trialActivated,
      }),
    },
  ),
)
