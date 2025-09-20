import { useState, useEffect, useCallback } from 'react'

interface UseAutoRefreshOptions {
  enabled?: boolean
  interval?: number // in milliseconds
  onRefresh?: () => void
}

export const useAutoRefresh = (options: UseAutoRefreshOptions = {}) => {
  const {
    enabled = true,
    interval = 60000, // Default 1 minute
    onRefresh
  } = options

  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date())

  const refresh = useCallback(() => {
    const now = new Date()
    setLastRefreshTime(now)
    if (onRefresh) {
      onRefresh()
    }
  }, [onRefresh])

  useEffect(() => {
    if (!enabled) return

    const intervalId = setInterval(() => {
      refresh()
    }, interval)

    return () => clearInterval(intervalId)
  }, [enabled, interval, refresh])

  const formatLastRefreshTime = useCallback(() => {
    return lastRefreshTime.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }, [lastRefreshTime])

  return {
    lastRefreshTime,
    formatLastRefreshTime,
    refresh
  }
}