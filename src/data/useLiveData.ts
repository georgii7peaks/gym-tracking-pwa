// React hook for live reads from the repository. Runs `read` on mount and again
// whenever the operations layer reports a data change (see changes.ts). The
// caller controls re-fetch identity via `deps` (e.g. an id from the route).
import { useEffect, useRef, useState } from 'react'
import { subscribeToDataChanges } from './changes'

export interface LiveData<T> {
  data: T | undefined
  loading: boolean
}

export function useLiveData<T>(read: () => Promise<T>, deps: readonly unknown[]): LiveData<T> {
  const [data, setData] = useState<T>()
  const [loading, setLoading] = useState(true)
  // Keep the latest `read` without making it a subscription dependency.
  const readRef = useRef(read)
  readRef.current = read

  useEffect(() => {
    let active = true
    const run = () => {
      readRef.current().then(
        (result) => {
          if (active) {
            setData(result)
            setLoading(false)
          }
        },
        (error) => {
          // Surface read failures instead of silently rendering an empty view.
          console.error('useLiveData read failed:', error)
          if (active) setLoading(false)
        }
      )
    }
    run()
    const unsubscribe = subscribeToDataChanges(run)
    return () => {
      active = false
      unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading }
}
