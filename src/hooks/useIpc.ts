import { useEffect, useRef } from 'react'

const api = typeof window !== 'undefined' ? window.ipcRenderer : undefined

export function useIpcListener<Channel extends string>(
  channel: Channel,
  callback: (...args: unknown[]) => void,
) {
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    if (!api?.on) return

    const listener = (...args: unknown[]) => {
      callbackRef.current(...args)
    }

    const removeListener = api.on(channel, listener)

    return () => {
      removeListener()
    }
  }, [channel])
}

// export function useIpcRenderer() {
//   const ipcInvoke = useMemoizedFn(
//     <Channel extends Parameters<typeof api.invoke>[0]>(
//       ...args: Parameters<typeof api.invoke<Channel>>
//     ) => {
//       const [channel, ...params] = args
//       return api.invoke(channel, ...params)
//     },
//   )

//   const ipcSend = useMemoizedFn(
//     <Channel extends Parameters<typeof api.send>[0]>(
//       ...args: Parameters<typeof api.send<Channel>>
//     ) => {
//       const [channel, ...params] = args
//       return api.send(channel, ...params)
//     },
//   )

//   return { ipcInvoke, ipcSend }
// }
