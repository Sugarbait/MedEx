import React, { useState, useEffect } from 'react'
import {
  ShieldCheckIcon,
  DownloadIcon,
  SearchIcon,
  FilterIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  UserIcon,
  EyeIcon,
  CalendarIcon,
  RefreshCwIcon,
  BarChart3Icon,
  TrendingUpIcon,
  ActivityIcon
} from 'lucide-react'
import {
  auditLogger,
  AuditLogEntry,
  AuditAction,
  ResourceType,
  AuditOutcome,
  AuditSearchCriteria,
  AuditReport
} from '@/services/auditLogger'
import { enhanceAuditEntriesForDisplay, DecryptedAuditEntry } from '@/utils/auditDisplayHelper'
import { cleanUserDisplayName } from '@/utils/userDisplayFilter'

interface AuditDashboardProps {
  user: any
}

export const AuditDashboard: React.FC<AuditDashboardProps> = ({ user }) => {
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null)
  const [enhancedEntries, setEnhancedEntries] = useState<DecryptedAuditEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchCriteria, setSearchCriteria] = useState<AuditSearchCriteria>({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
    endDate: new Date(),
    limit: 50
  })
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json')

  useEffect(() => {
    if (hasAuditAccess()) {
      fetchAuditLogs()
    }
  }, [])

  const hasAuditAccess = (): boolean => {
    const allowedRoles = ['super_user', 'compliance_officer', 'system_admin']
    return allowedRoles.includes(user?.role || '')
  }

  const fetchAuditLogs = async () => {
    if (!hasAuditAccess()) {
      setError('Access denied: Insufficient permissions to view audit logs')
      return
    }

    setLoading(true)
    setError('')

    try {
      const report = await auditLogger.getAuditLogs(searchCriteria)
      setAuditReport(report)

      // Enhance entries for display with readable user names
      if (report.entries && report.entries.length > 0) {
        console.log('Enhancing audit entries for display...', report.entries.length, 'entries')
        console.log('Sample raw entry:', report.entries[0])
        const enhanced = await enhanceAuditEntriesForDisplay(report.entries)
        setEnhancedEntries(enhanced)
        console.log('Enhanced entries:', enhanced.length)
        console.log('Sample enhanced entry:', enhanced[0])
      } else {
        console.log('No entries to enhance')
        setEnhancedEntries([])
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch audit logs'
      setError(errorMessage)
      console.error('Audit log fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    if (!hasAuditAccess()) {
      setError('Access denied: Insufficient permissions to export audit logs')
      return
    }

    try {
      setLoading(true)
      const exportData = await auditLogger.exportAuditLogs(searchCriteria, exportFormat)

      // Create download
      const blob = new Blob([exportData], {
        type: exportFormat === 'csv' ? 'text/csv' : 'application/json'
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `hipaa_audit_logs_${new Date().toISOString().split('T')[0]}.${exportFormat}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export audit logs'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const getActionColor = (action: AuditAction): string => {
    switch (action) {
      case AuditAction.VIEW:
      case AuditAction.READ:
        return 'text-blue-600 bg-blue-50'
      case AuditAction.CREATE:
        return 'text-green-600 bg-green-50'
      case AuditAction.UPDATE:
        return 'text-yellow-600 bg-yellow-50'
      case AuditAction.DELETE:
        return 'text-red-600 bg-red-50'
      case AuditAction.LOGIN:
      case AuditAction.LOGOUT:
        return 'text-purple-600 bg-purple-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const getOutcomeColor = (outcome: AuditOutcome): string => {
    switch (outcome) {
      case AuditOutcome.SUCCESS:
        return 'text-green-600 bg-green-50'
      case AuditOutcome.FAILURE:
        return 'text-red-600 bg-red-50'
      case AuditOutcome.WARNING:
        return 'text-yellow-600 bg-yellow-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString()
  }

  if (!hasAuditAccess()) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangleIcon className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-900 mb-2">Access Denied</h2>
          <p className="text-red-700">
            You do not have sufficient permissions to access audit logs.
            Contact your system administrator for access.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-black text-gray-900">HIPAA Audit Dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchAuditLogs}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <RefreshCwIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as 'json' | 'csv')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
          <button
            onClick={handleExport}
            disabled={loading || !auditReport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <DownloadIcon className="w-4 h-4" />
            Export Audit Logs
          </button>
        </div>
      </div>

      {/* Compliance Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <ShieldCheckIcon className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="font-medium text-blue-900">HIPAA Compliance Notice</h3>
            <p className="text-sm text-blue-700 mt-1">
              This audit log complies with HIPAA Security Rule § 164.312(b).
              All PHI access is logged and encrypted. Logs are retained for minimum 6 years.
            </p>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span className="text-red-700">{error}</span>
          <button
            onClick={() => setError('')}
            className="ml-auto text-red-600 hover:text-red-800 text-xl"
          >
            ×
          </button>
        </div>
      )}

      {/* Summary Cards */}
      {auditReport && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Total Events</span>
              <ActivityIcon className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-3xl font-black text-blue-600 mb-1 numeric-data">
              {auditReport.summary.totalAccess}
            </div>
            <div className="text-xs text-gray-500">
              Last <span className="numeric-data">{Math.round((auditReport.summary.timeRange.end.getTime() - auditReport.summary.timeRange.start.getTime()) / (1000 * 60 * 60 * 24))}</span> days
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">PHI Access</span>
              <EyeIcon className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-3xl font-black text-green-600 mb-1 numeric-data">
              {auditReport.summary.phiAccess}
            </div>
            <div className="text-xs text-gray-500">
              <span className="numeric-data">{((auditReport.summary.phiAccess / auditReport.summary.totalAccess) * 100).toFixed(1)}</span>% of events
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Failures</span>
              <AlertTriangleIcon className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-3xl font-black text-red-600 mb-1 numeric-data">
              {auditReport.summary.failures}
            </div>
            <div className="text-xs text-gray-500">
              <span className="numeric-data">{((auditReport.summary.failures / auditReport.summary.totalAccess) * 100).toFixed(1)}</span>% failure rate
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Unique Users</span>
              <UserIcon className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-3xl font-black text-purple-600 mb-1 numeric-data">
              {auditReport.summary.uniqueUsers}
            </div>
            <div className="text-xs text-gray-500">
              Active users
            </div>
          </div>
        </div>
      )}

      {/* Search Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Search Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={searchCriteria.startDate?.toISOString().split('T')[0] || ''}
              onChange={(e) => setSearchCriteria(prev => ({
                ...prev,
                startDate: e.target.value ? new Date(e.target.value) : undefined
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              value={searchCriteria.endDate?.toISOString().split('T')[0] || ''}
              onChange={(e) => setSearchCriteria(prev => ({
                ...prev,
                endDate: e.target.value ? new Date(e.target.value) : undefined
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
            <select
              value={searchCriteria.action || ''}
              onChange={(e) => setSearchCriteria(prev => ({
                ...prev,
                action: e.target.value ? e.target.value as AuditAction : undefined
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Actions</option>
              {Object.values(AuditAction).map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Outcome</label>
            <select
              value={searchCriteria.outcome || ''}
              onChange={(e) => setSearchCriteria(prev => ({
                ...prev,
                outcome: e.target.value ? e.target.value as AuditOutcome : undefined
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Outcomes</option>
              {Object.values(AuditOutcome).map(outcome => (
                <option key={outcome} value={outcome}>{outcome}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={fetchAuditLogs}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Audit Log Entries */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Audit Log Entries</h3>
          <p className="text-sm text-gray-500 mt-1">
            {auditReport ? `${enhancedEntries.length} entries found (${enhancedEntries.filter(e => e.displayName).length} decrypted)` : 'Loading audit entries...'}
          </p>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading audit logs...</p>
            </div>
          ) : auditReport && enhancedEntries.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Resource
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    PHI
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Outcome
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {enhancedEntries.map((entry, index) => (
                  <tr key={entry.id || index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatTimestamp(entry.timestamp)}
                    </td>
                    <td className="px-3 py-4">
                      <div className="max-w-[150px]">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {entry.displayName || entry.user_id?.substring(0, 12) || 'Unknown User'}
                        </div>
                        <div className="text-xs text-gray-500">{entry.user_role || 'user'}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getActionColor(entry.action)}`}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm text-gray-900">{entry.resource_type}</div>
                        <div className="text-sm text-gray-500 truncate max-w-32">{entry.resource_id}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {entry.phi_accessed ? (
                        <CheckCircleIcon className="w-5 h-5 text-orange-500" />
                      ) : (
                        <div className="w-5 h-5" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getOutcomeColor(entry.outcome)}`}>
                        {entry.outcome}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {entry.failure_reason && (
                        <div className="text-red-600 text-xs">{entry.failure_reason}</div>
                      )}
                      {entry.source_ip && (
                        <div className="text-xs">IP: {entry.source_ip}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12">
              <BarChart3Icon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No audit entries found</h3>
              <p className="text-gray-600">Try adjusting your search criteria or date range.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}