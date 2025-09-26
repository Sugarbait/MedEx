/**
 * Transmission Security Dashboard Component
 * HIPAA-compliant security monitoring dashboard
 *
 * Features:
 * - Real-time security status overview
 * - Certificate monitoring display
 * - Security header compliance
 * - Event management interface
 * - Configuration management
 */

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Settings,
  Refresh,
  Eye,
  EyeOff,
  TrendingUp,
  TrendingDown,
  Activity,
  Lock,
  Unlock,
  Certificate,
  Globe,
  Zap,
  Bell,
  BellOff
} from 'lucide-react'
import useTransmissionSecurity from '@/hooks/useTransmissionSecurity'
import {
  SecurityAssessment,
  TransmissionSecurityEvent,
  TransmissionSecurityMetrics
} from '@/types/transmissionSecurityTypes'

interface TransmissionSecurityDashboardProps {
  domain?: string
  className?: string
  showAdvanced?: boolean
}

interface SecurityGradeProps {
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Security grade display component
 */
const SecurityGrade: React.FC<SecurityGradeProps> = ({ grade, size = 'md' }) => {
  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A+':
      case 'A':
        return 'bg-green-500 text-white'
      case 'B':
        return 'bg-blue-500 text-white'
      case 'C':
        return 'bg-yellow-500 text-white'
      case 'D':
        return 'bg-orange-500 text-white'
      case 'F':
        return 'bg-red-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const getSizeClasses = (size: string) => {
    switch (size) {
      case 'sm':
        return 'w-8 h-8 text-sm'
      case 'lg':
        return 'w-16 h-16 text-2xl font-bold'
      default:
        return 'w-12 h-12 text-lg font-semibold'
    }
  }

  return (
    <div
      className={`
        rounded-full flex items-center justify-center
        ${getGradeColor(grade)}
        ${getSizeClasses(size)}
      `}
    >
      {grade}
    </div>
  )
}

/**
 * Security metrics card component
 */
const MetricsCard: React.FC<{
  title: string
  value: string | number
  icon: React.ReactNode
  trend?: 'up' | 'down' | 'stable'
  color?: 'green' | 'red' | 'yellow' | 'blue' | 'gray'
}> = ({ title, value, icon, trend, color = 'blue' }) => {
  const getColorClasses = (color: string) => {
    switch (color) {
      case 'green':
        return 'bg-green-50 border-green-200 text-green-800'
      case 'red':
        return 'bg-red-50 border-red-200 text-red-800'
      case 'yellow':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800'
      case 'gray':
        return 'bg-gray-50 border-gray-200 text-gray-800'
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        p-4 rounded-lg border-2 transition-all duration-200
        ${getColorClasses(color)}
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {icon}
          <div>
            <p className="text-sm font-medium">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
        {trend && (
          <div className="flex items-center">
            {trend === 'up' && <TrendingUp className="w-5 h-5 text-green-600" />}
            {trend === 'down' && <TrendingDown className="w-5 h-5 text-red-600" />}
            {trend === 'stable' && <Activity className="w-5 h-5 text-gray-600" />}
          </div>
        )}
      </div>
    </motion.div>
  )
}

/**
 * Security event item component
 */
const SecurityEventItem: React.FC<{
  event: TransmissionSecurityEvent
  onAcknowledge: (id: string) => void
  onResolve: (id: string, mitigation: string) => void
}> = ({ event, onAcknowledge, onResolve }) => {
  const [showMitigation, setShowMitigation] = useState(false)
  const [mitigationText, setMitigationText] = useState('')

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 border-red-300 text-red-800'
      case 'high':
        return 'bg-orange-100 border-orange-300 text-orange-800'
      case 'medium':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800'
      default:
        return 'bg-blue-100 border-blue-300 text-blue-800'
    }
  }

  const handleResolve = () => {
    if (mitigationText.trim()) {
      onResolve(event.id, mitigationText)
      setShowMitigation(false)
      setMitigationText('')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`
        p-4 rounded-lg border-2 mb-3
        ${getSeverityColor(event.severity)}
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-xs font-bold uppercase px-2 py-1 rounded bg-white bg-opacity-70">
              {event.severity}
            </span>
            <span className="text-xs text-gray-600">
              {event.timestamp.toLocaleString()}
            </span>
          </div>
          <h4 className="font-semibold mb-1">{event.description}</h4>
          <p className="text-sm opacity-80">{event.domain}</p>

          {event.details && (
            <details className="mt-2">
              <summary className="text-sm cursor-pointer hover:underline">
                Event Details
              </summary>
              <pre className="text-xs bg-white bg-opacity-50 p-2 rounded mt-1 overflow-auto">
                {JSON.stringify(event.details, null, 2)}
              </pre>
            </details>
          )}
        </div>

        <div className="flex space-x-2 ml-4">
          {!event.acknowledged && (
            <button
              onClick={() => onAcknowledge(event.id)}
              className="px-3 py-1 text-sm bg-white bg-opacity-70 rounded hover:bg-opacity-90 transition-all"
            >
              Acknowledge
            </button>
          )}

          {!event.resolved && (
            <button
              onClick={() => setShowMitigation(!showMitigation)}
              className="px-3 py-1 text-sm bg-white bg-opacity-70 rounded hover:bg-opacity-90 transition-all"
            >
              Resolve
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showMitigation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 pt-3 border-t border-white border-opacity-30"
          >
            <textarea
              value={mitigationText}
              onChange={(e) => setMitigationText(e.target.value)}
              placeholder="Describe the mitigation steps taken..."
              className="w-full p-2 text-sm rounded bg-white bg-opacity-70 border border-white border-opacity-50"
              rows={3}
            />
            <div className="flex space-x-2 mt-2">
              <button
                onClick={handleResolve}
                disabled={!mitigationText.trim()}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Resolve Event
              </button>
              <button
                onClick={() => setShowMitigation(false)}
                className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/**
 * Main transmission security dashboard component
 */
export const TransmissionSecurityDashboard: React.FC<TransmissionSecurityDashboardProps> = ({
  domain,
  className = '',
  showAdvanced = false
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'config'>('overview')
  const [showResolvedEvents, setShowResolvedEvents] = useState(false)

  const {
    isMonitoring,
    lastAssessment,
    metrics,
    events,
    loading,
    error,
    config,
    startMonitoring,
    stopMonitoring,
    performAssessment,
    acknowledgeEvent,
    resolveEvent,
    refreshMetrics,
    updateConfig
  } = useTransmissionSecurity(domain, true)

  const filteredEvents = useMemo(() => {
    return events.filter(event => showResolvedEvents || !event.resolved)
  }, [events, showResolvedEvents])

  const criticalEvents = useMemo(() => {
    return events.filter(event => event.severity === 'critical' && !event.resolved)
  }, [events])

  const handleToggleMonitoring = async () => {
    if (isMonitoring) {
      await stopMonitoring()
    } else {
      await startMonitoring()
    }
  }

  const handleRefresh = async () => {
    await Promise.all([
      refreshMetrics(),
      performAssessment()
    ])
  }

  if (loading && !metrics && !lastAssessment) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Shield className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Transmission Security</h2>
            <p className="text-gray-600">HIPAA-compliant monitoring dashboard</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Critical alerts */}
          {criticalEvents.length > 0 && (
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="flex items-center space-x-1 bg-red-100 text-red-800 px-3 py-1 rounded-full"
            >
              <Bell className="w-4 h-4" />
              <span className="text-sm font-semibold">{criticalEvents.length} Critical</span>
            </motion.div>
          )}

          {/* Monitoring status */}
          <div className="flex items-center space-x-2">
            <div
              className={`w-3 h-3 rounded-full ${
                isMonitoring ? 'bg-green-500' : 'bg-gray-400'
              }`}
            />
            <span className="text-sm">
              {isMonitoring ? 'Monitoring Active' : 'Monitoring Inactive'}
            </span>
          </div>

          {/* Controls */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
          >
            <Refresh className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleToggleMonitoring}
            className={`
              px-4 py-2 rounded font-semibold transition-all
              ${isMonitoring
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
              }
            `}
          >
            {isMonitoring ? (
              <>
                <EyeOff className="w-4 h-4 inline mr-2" />
                Stop Monitoring
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 inline mr-2" />
                Start Monitoring
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg mb-6"
        >
          <div className="flex items-center space-x-2">
            <XCircle className="w-5 h-5" />
            <span className="font-semibold">Error:</span>
            <span>{error}</span>
          </div>
        </motion.div>
      )}

      {/* Tab navigation */}
      <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
        {[
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'events', label: 'Events', icon: Bell },
          ...(showAdvanced ? [{ id: 'config', label: 'Configuration', icon: Settings }] : [])
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            className={`
              flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-all
              ${activeTab === id
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
              }
            `}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            {/* Overall security grade */}
            {lastAssessment && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Security Assessment
                    </h3>
                    <p className="text-gray-600">
                      Domain: {lastAssessment.domain}
                    </p>
                    <p className="text-sm text-gray-500">
                      Last assessed: {lastAssessment.timestamp.toLocaleString()}
                    </p>
                  </div>
                  <SecurityGrade grade={lastAssessment.overallGrade} size="lg" />
                </div>
              </div>
            )}

            {/* Metrics grid */}
            {metrics && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricsCard
                  title="Certificate Health"
                  value={`${metrics.certificateHealth.valid}/${metrics.certificateHealth.total}`}
                  icon={<Certificate className="w-6 h-6" />}
                  color={metrics.certificateHealth.expired > 0 ? 'red' : 'green'}
                />

                <MetricsCard
                  title="Header Compliance"
                  value={`${Math.round(metrics.headerCompliance.score * 100)}%`}
                  icon={<Shield className="w-6 h-6" />}
                  color={metrics.headerCompliance.score > 0.8 ? 'green' : 'yellow'}
                />

                <MetricsCard
                  title="TLS Grade"
                  value={metrics.tlsConfiguration.grade}
                  icon={<Lock className="w-6 h-6" />}
                  color={metrics.tlsConfiguration.grade.startsWith('A') ? 'green' : 'yellow'}
                />

                <MetricsCard
                  title="Active Incidents"
                  value={metrics.incidentStats.pending}
                  icon={<AlertTriangle className="w-6 h-6" />}
                  color={metrics.incidentStats.pending === 0 ? 'green' : 'red'}
                />
              </div>
            )}

            {/* Certificate details */}
            {lastAssessment?.certificates && lastAssessment.certificates.length > 0 && (
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Certificate Status
                </h3>
                <div className="space-y-3">
                  {lastAssessment.certificates.map((cert, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-white rounded border"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{cert.subject}</p>
                        <p className="text-sm text-gray-600">{cert.issuer}</p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center space-x-2">
                          {cert.isValid ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600" />
                          )}
                          <span className="text-sm">
                            {cert.daysUntilExpiry > 0
                              ? `${cert.daysUntilExpiry} days left`
                              : 'Expired'
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'events' && (
          <motion.div
            key="events"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            {/* Events header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Security Events ({filteredEvents.length})
              </h3>
              <div className="flex items-center space-x-3">
                <label className="flex items-center space-x-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showResolvedEvents}
                    onChange={(e) => setShowResolvedEvents(e.target.checked)}
                    className="rounded"
                  />
                  <span>Show resolved events</span>
                </label>
              </div>
            </div>

            {/* Events list */}
            <div className="max-h-96 overflow-y-auto">
              {filteredEvents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <p>No security events to display</p>
                </div>
              ) : (
                filteredEvents.map((event) => (
                  <SecurityEventItem
                    key={event.id}
                    event={event}
                    onAcknowledge={acknowledgeEvent}
                    onResolve={resolveEvent}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'config' && showAdvanced && config && (
          <motion.div
            key="config"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <h3 className="text-lg font-semibold text-gray-900">
              Monitoring Configuration
            </h3>

            <div className="bg-gray-50 p-6 rounded-lg">
              <h4 className="font-semibold mb-4">Monitored Domains</h4>
              <div className="space-y-2">
                {config.domains.map((domain, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Globe className="w-4 h-4 text-gray-600" />
                    <span className="text-sm">{domain}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-lg">
              <h4 className="font-semibold mb-4">Alert Settings</h4>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={config.alerting.email}
                    onChange={(e) => updateConfig({
                      alerting: { ...config.alerting, email: e.target.checked }
                    })}
                    className="rounded"
                  />
                  <span className="text-sm">Email alerts</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={config.alerting.dashboard}
                    onChange={(e) => updateConfig({
                      alerting: { ...config.alerting, dashboard: e.target.checked }
                    })}
                    className="rounded"
                  />
                  <span className="text-sm">Dashboard alerts</span>
                </label>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default TransmissionSecurityDashboard