/**
 * API Optimization Debug Panel
 *
 * Shows real-time statistics about API optimization performance
 * Helps developers and administrators monitor the effectiveness of optimizations
 */

import React, { useState, useEffect } from 'react'
import { optimizedApiService } from '@/services/optimizedApiService'
import { optimizedChatService } from '@/services/optimizedChatService'
import { BarChart3Icon, ActivityIcon, ZapIcon, RefreshCwIcon } from 'lucide-react'

interface DebugStats {
  api: {
    cache: { size: number; hitRate: number }
    requests: { pending: number; queued: number; active: number }
    rateLimit: { isThrottled: boolean; requestsInWindow: number; backoffMultiplier: number }
  }
  chat: {
    cache: { size: number; hitRate: number }
    requests: { pending: number; queued: number; active: number }
    changeTracker: { knownChats: number; lastPollTime: number; trackedHashes: number }
  }
}

interface APIOptimizationDebugPanelProps {
  isVisible?: boolean
  onToggle?: () => void
}

export const APIOptimizationDebugPanel: React.FC<APIOptimizationDebugPanelProps> = ({
  isVisible = false,
  onToggle
}) => {
  const [stats, setStats] = useState<DebugStats | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refreshStats = async () => {
    setIsRefreshing(true)
    try {
      const apiStats = optimizedApiService.getStats()
      const chatStats = optimizedChatService.getServiceStats()

      setStats({
        api: apiStats,
        chat: chatStats
      })
    } catch (error) {
      console.error('Failed to refresh debug stats:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    if (isVisible) {
      refreshStats()
      const interval = setInterval(refreshStats, 2000) // Refresh every 2 seconds
      return () => clearInterval(interval)
    }
  }, [isVisible])

  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-4 right-4 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors z-50"
        title="Show API Optimization Stats"
      >
        <BarChart3Icon className="w-5 h-5" />
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-xl p-4 max-w-md w-80 z-50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ActivityIcon className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">API Optimization Stats</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshStats}
            disabled={isRefreshing}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <RefreshCwIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            ×
          </button>
        </div>
      </div>

      {stats ? (
        <div className="space-y-4 text-sm">
          {/* API Service Stats */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-1">
              <ZapIcon className="w-4 h-4" />
              Optimized API Service
            </h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Cache Size:</span>
                <span className="font-mono">{stats.api.cache.size}</span>
              </div>
              <div className="flex justify-between">
                <span>Cache Hit Rate:</span>
                <span className="font-mono text-green-600">{(stats.api.cache.hitRate * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Active Requests:</span>
                <span className="font-mono">{stats.api.requests.active}</span>
              </div>
              <div className="flex justify-between">
                <span>Queued Requests:</span>
                <span className="font-mono">{stats.api.requests.queued}</span>
              </div>
              <div className="flex justify-between">
                <span>Rate Limited:</span>
                <span className={`font-mono ${stats.api.rateLimit.isThrottled ? 'text-red-600' : 'text-green-600'}`}>
                  {stats.api.rateLimit.isThrottled ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Requests/Window:</span>
                <span className="font-mono">{stats.api.rateLimit.requestsInWindow}</span>
              </div>
              <div className="flex justify-between">
                <span>Backoff Multiplier:</span>
                <span className="font-mono">{stats.api.rateLimit.backoffMultiplier.toFixed(1)}x</span>
              </div>
            </div>
          </div>

          {/* Chat Service Stats */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Chat Service</h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Known Chats:</span>
                <span className="font-mono">{stats.chat.changeTracker.knownChats}</span>
              </div>
              <div className="flex justify-between">
                <span>Tracked Hashes:</span>
                <span className="font-mono">{stats.chat.changeTracker.trackedHashes}</span>
              </div>
              <div className="flex justify-between">
                <span>Last Poll:</span>
                <span className="font-mono">
                  {stats.chat.changeTracker.lastPollTime > 0
                    ? `${Math.round((Date.now() - stats.chat.changeTracker.lastPollTime) / 1000)}s ago`
                    : 'Never'
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Performance Indicators */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Performance</h4>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>API Efficiency</span>
                  <span>{(stats.api.cache.hitRate * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      stats.api.cache.hitRate > 0.8 ? 'bg-green-500' :
                      stats.api.cache.hitRate > 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${stats.api.cache.hitRate * 100}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Request Load</span>
                  <span>{stats.api.requests.active + stats.api.requests.queued}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      (stats.api.requests.active + stats.api.requests.queued) < 5 ? 'bg-green-500' :
                      (stats.api.requests.active + stats.api.requests.queued) < 15 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{
                      width: `${Math.min(100, ((stats.api.requests.active + stats.api.requests.queued) / 20) * 100)}%`
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="pt-2 border-t border-gray-200">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  optimizedApiService.clearCache()
                  optimizedChatService.clearAllCaches()
                  refreshStats()
                }}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                Clear Caches
              </button>
              <button
                onClick={() => {
                  optimizedApiService.cancelAllRequests()
                  optimizedChatService.cancelAllOperations()
                  refreshStats()
                }}
                className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
              >
                Cancel All
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-gray-500">
          Loading stats...
        </div>
      )}
    </div>
  )
}