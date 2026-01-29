import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { EVENTS, eventEmitter } from '@/utils/events'

interface Account {
  id: string
  name: string
}

interface AccountsStore {
  accounts: Account[]
  currentAccountId: string
  defaultAccountId: string | null
  addAccount: (name: string) => void
  removeAccount: (id: string) => void
  switchAccount: (id: string) => void
  setDefaultAccount: (id: string) => void
  getCurrentAccount: () => Account | undefined
  updateAccountName: (id: string, name: string) => void
}

export const useAccounts = create<AccountsStore>()(
  persist(
    immer((set, get) => {
      const initialAccounts = [{ id: 'default', name: '默认账号' }]
      const initialCurrentAccountId = 'default'
      // 初始化 defaultAccountId：优先设为 currentAccountId，否则设为 accounts[0].id
      const initialDefaultAccountId = initialCurrentAccountId || initialAccounts[0]?.id || null

      return {
        accounts: initialAccounts,
        currentAccountId: initialCurrentAccountId,
        defaultAccountId: initialDefaultAccountId,

        addAccount: (name: string) => {
          set(state => {
            const newId = crypto.randomUUID()
            state.accounts.push({
              id: newId,
              name,
            })
            // 如果没有默认账号，将新账号设为默认
            if (!state.defaultAccountId && state.accounts.length > 0) {
              state.defaultAccountId = state.currentAccountId || state.accounts[0].id
            }
            eventEmitter.emit(EVENTS.ACCOUNT_ADDED, newId, name)
          })
        },

        removeAccount: (id: string) => {
          set(state => {
            // 如果删除的是默认账号，迁移 defaultAccountId
            if (state.defaultAccountId === id) {
              // 优先迁移到 currentAccountId（如果存在且不是被删除的账号）
              if (
                state.currentAccountId &&
                state.currentAccountId !== id &&
                state.accounts.some(acc => acc.id === state.currentAccountId)
              ) {
                state.defaultAccountId = state.currentAccountId
              } else {
                // 否则迁移到第一个非删除账号
                const remainingAccounts = state.accounts.filter(acc => acc.id !== id)
                if (remainingAccounts.length > 0) {
                  state.defaultAccountId = remainingAccounts[0].id
                } else {
                  state.defaultAccountId = null
                }
              }
            }

            state.accounts = state.accounts.filter(acc => acc.id !== id)

            // 如果删除的是当前账号，切换到默认账号或第一个账号
            if (state.currentAccountId === id) {
              if (
                state.defaultAccountId &&
                state.accounts.some(acc => acc.id === state.defaultAccountId)
              ) {
                state.currentAccountId = state.defaultAccountId
              } else if (state.accounts.length > 0) {
                state.currentAccountId = state.accounts[0].id
              }
            }
            eventEmitter.emit(EVENTS.ACCOUNT_REMOVED, id)
          })
        },

        switchAccount: (id: string) => {
          set(state => {
            state.currentAccountId = id
            eventEmitter.emit(EVENTS.ACCOUNT_SWITCHED, id)
          })
        },

        setDefaultAccount: (id: string) => {
          set(state => {
            // 验证账号是否存在
            if (state.accounts.some(acc => acc.id === id)) {
              state.defaultAccountId = id
            }
          })
        },

        getCurrentAccount: () => {
          return get().accounts.find(acc => acc.id === get().currentAccountId)
        },

        updateAccountName: (id: string, name: string) => {
          set(state => {
            const account = state.accounts.find(acc => acc.id === id)
            if (account) {
              account.name = name
              // eventEmitter.emit(EVENTS.ACCOUNT_UPDATED, id, name)
            }
          })
        },
      }
    }),
    {
      name: 'accounts-storage',
      // 迁移旧数据：如果 defaultAccountId 不存在，初始化它
      migrate: (persistedState: unknown) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return persistedState
        }
        const state = persistedState as {
          currentAccountId?: string
          accounts?: Array<{ id: string; name: string }>
          defaultAccountId?: string | null
        }
        if (!state.defaultAccountId) {
          if (state.currentAccountId) {
            state.defaultAccountId = state.currentAccountId
          } else if (state.accounts && state.accounts.length > 0) {
            state.defaultAccountId = state.accounts[0].id
          }
        }
        return state
      },
    },
  ),
)
