/**
 * SECURITY DASHBOARD PAGE
 *
 * Administrative dashboard for monitoring security incidents, user profiles,
 * and automated response systems. Provides comprehensive visibility into
 * security posture and incident management capabilities.
 *
 * Features:
 * - Real-time incident monitoring and management
 * - User security profile management
 * - Automated lockout system monitoring
 * - Notification and alert configuration
 * - Security metrics and analytics
 * - HIPAA-compliant audit trail viewing
 */

import React, { useState, useEffect } from 'react'
import {
  Shield, AlertTriangle, Users, Lock, Mail, Settings,
  Activity, TrendingUp, Clock, CheckCircle, XCircle,
  AlertCircle, Eye, Search, Filter, Download, RefreshCw
} from 'lucide-react'
import { useIncidentMonitoring } from '@/hooks/useIncidentMonitoring'
import { automatedLockoutService } from '@/services/automatedLockoutService'
import { notificationService } from '@/services/notificationService'
import { securityIntegrationService } from '@/services/securityIntegrationService'
import {
  SecurityIncident,
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
  UserSecurityProfile
} from '@/types/incidentTypes'

interface SecurityDashboardProps {
  className?: string
}

const SecurityDashboard: React.FC<SecurityDashboardProps> = ({ className = '' }) => {
  const { state, actions } = useIncidentMonitoring({
    autoRefresh: true,
    refreshInterval: 30000, // 30 seconds
    enableRealTime: true,
    loadOnMount: true
  })

  // Local state
  const [selectedTab, setSelectedTab] = useState<'overview' | 'incidents' | 'users' | 'lockouts' | 'notifications' | 'settings'>('overview')
  const [selectedIncident, setSelectedIncident] = useState<SecurityIncident | null>(null)
  const [lockoutStats, setLockoutStats] = useState<any>(null)
  const [notificationStats, setNotificationStats] = useState<any>(null)
  const [securityMetrics, setSecurityMetrics] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [filter, setFilter] = useState<{
    severity?: IncidentSeverity
    status?: IncidentStatus
    type?: IncidentType
    dateRange?: { start: Date; end: Date }
  }>({})

  // Load additional data
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoading(true)

        // Initialize services
        await automatedLockoutService.initialize()
        await securityIntegrationService.initialize()

        // Load stats
        const [lockoutData, notificationData, securityData] = await Promise.all([
          automatedLockoutService.getLockoutStats(),
          notificationService.getNotificationStats(),
          securityIntegrationService.getSecurityMetrics()
        ])

        setLockoutStats(lockoutData)
        setNotificationStats(notificationData)
        setSecurityMetrics(securityData)

      } catch (error) {
        console.error('Failed to load dashboard data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadDashboardData()
  }, [])

  // Filtered incidents
  const filteredIncidents = state.incidents.filter(incident => {
    if (filter.severity && incident.severity !== filter.severity) return false
    if (filter.status && incident.status !== filter.status) return false
    if (filter.type && incident.type !== filter.type) return false
    if (filter.dateRange) {
      const incidentDate = new Date(incident.timestamp)
      if (incidentDate < filter.dateRange.start || incidentDate > filter.dateRange.end) return false
    }
    return true
  })

  // Threat level color
  const getThreatLevelColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'text-red-600 bg-red-50'
      case 'HIGH': return 'text-orange-600 bg-orange-50'
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50'
      case 'LOW': return 'text-green-600 bg-green-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  // Severity color
  const getSeverityColor = (severity: IncidentSeverity) => {
    switch (severity) {
      case IncidentSeverity.CRITICAL: return 'text-red-600 bg-red-100'
      case IncidentSeverity.HIGH: return 'text-orange-600 bg-orange-100'
      case IncidentSeverity.MEDIUM: return 'text-yellow-600 bg-yellow-100'
      case IncidentSeverity.LOW: return 'text-blue-600 bg-blue-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  // Status color
  const getStatusColor = (status: IncidentStatus) => {
    switch (status) {
      case IncidentStatus.OPEN: return 'text-red-600 bg-red-100'
      case IncidentStatus.INVESTIGATING: return 'text-yellow-600 bg-yellow-100'
      case IncidentStatus.RESPONDED: return 'text-blue-600 bg-blue-100'
      case IncidentStatus.RESOLVED: return 'text-green-600 bg-green-100'
      case IncidentStatus.CLOSED: return 'text-gray-600 bg-gray-100'
      case IncidentStatus.FALSE_POSITIVE: return 'text-purple-600 bg-purple-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  // Handle incident action
  const handleIncidentAction = async (incident: SecurityIncident, action: 'resolve' | 'investigate' | 'false_positive') => {
    try {
      switch (action) {
        case 'resolve':
          await actions.resolveIncident(incident.id, 'Resolved from security dashboard')
          break
        case 'false_positive':
          await actions.markAsFalsePositive(incident.id, 'Marked as false positive from security dashboard')
          break
      }

      setSelectedIncident(null)
    } catch (error) {
      console.error('Failed to handle incident action:', error)
    }
  }

  // Handle user lockout
  const handleUserLockout = async (userId: string, action: 'unlock' | 'extend') => {
    try {
      if (action === 'unlock') {
        await automatedLockoutService.unlockUser(userId, 'manual_unlock', 'admin', 'Unlocked from security dashboard')
      }
    } catch (error) {
      console.error('Failed to handle user lockout:', error)
    }
  }

  // Test notifications
  const handleTestNotifications = async () => {
    try {
      const result = await actions.testNotifications()
      alert(result ? 'Test notification sent successfully' : 'Test notification failed')
    } catch (error) {
      console.error('Failed to test notifications:', error)
      alert('Test notification failed')
    }
  }

  // Create test incident
  const handleCreateTestIncident = async () => {
    try {
      await actions.triggerTestIncident(IncidentType.SUSPICIOUS_LOGIN_LOCATION, IncidentSeverity.MEDIUM)
      alert('Test incident created successfully')
    } catch (error) {
      console.error('Failed to create test incident:', error)
      alert('Failed to create test incident')
    }
  }

  // Export incidents
  const handleExportIncidents = async () => {
    try {
      const incidents = await actions.searchIncidents({
        ...filter,
        limit: 1000
      })

      const csvContent = incidents.incidents.map(incident => [
        incident.id,
        incident.type,
        incident.severity,
        incident.status,
        incident.title,
        incident.timestamp.toISOString(),
        incident.userId || '',
        incident.userEmail || '',
        incident.sourceIP || ''
      ].join(',')).join('\\n')

      const header = 'ID,Type,Severity,Status,Title,Timestamp,User ID,User Email,Source IP\\n'
      const csv = header + csvContent

      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `security-incidents-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)

    } catch (error) {
      console.error('Failed to export incidents:', error)
      alert('Failed to export incidents')
    }
  }

  if (state.isLoading || isLoading) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${className}`}>
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading security dashboard...</p>
        </div>
      </div>
    )
  }

  if (state.error) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${className}`}>
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-4">{state.error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Reload Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Security Dashboard</h1>
                <p className="text-gray-600">Monitor and manage security incidents and user profiles</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Threat Level Indicator */}
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${getThreatLevelColor(state.threatLevel)}`}>
                Threat Level: {state.threatLevel}
              </div>

              {/* Connection Status */}
              <div className={`flex items-center text-sm ${state.isConnected ? 'text-green-600' : 'text-red-600'}`}>
                <div className={`w-2 h-2 rounded-full mr-2 ${state.isConnected ? 'bg-green-600' : 'bg-red-600'}`} />
                {state.isConnected ? 'Connected' : 'Disconnected'}
              </div>

              {/* Last Updated */}
              {state.lastUpdated && (
                <div className="text-sm text-gray-500">
                  Last updated: {state.lastUpdated.toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: Activity },
              { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
              { id: 'users', label: 'Users', icon: Users },
              { id: 'lockouts', label: 'Lockouts', icon: Lock },
              { id: 'notifications', label: 'Notifications', icon: Mail },
              { id: 'settings', label: 'Settings', icon: Settings }
            ].map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id as any)}
                  className={`flex items-center px-1 py-4 border-b-2 font-medium text-sm ${
                    selectedTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-5 w-5 mr-2" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Tab */}
        {selectedTab === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Active Incidents</p>
                    <p className="text-2xl font-bold text-gray-900">{state.activeIncidents.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">High Risk Users</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {state.userProfiles.filter(u => u.riskLevel === 'HIGH' || u.riskLevel === 'CRITICAL').length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <Lock className="h-8 w-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Active Lockouts</p>
                    <p className="text-2xl font-bold text-gray-900">{lockoutStats?.activeLockouts || 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Notification Rate</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {state.notificationStats ? Math.round(state.notificationStats.deliveryRate) : 0}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Incidents */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Recent Incidents</h3>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {state.recentIncidents.slice(0, 5).map(incident => (
                      <div
                        key={incident.id}
                        className="flex items-center justify-between p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
                        onClick={() => setSelectedIncident(incident)}
                      >
                        <div className="flex items-center">
                          <div className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(incident.severity)}`}>
                            {incident.severity}
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900">{incident.title}</p>
                            <p className="text-xs text-gray-600">{incident.timestamp.toLocaleString()}</p>
                          </div>
                        </div>
                        <Eye className="h-4 w-4 text-gray-400" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* High Risk Users */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">High Risk Users</h3>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {state.userProfiles
                      .filter(u => u.riskLevel === 'HIGH' || u.riskLevel === 'CRITICAL')
                      .slice(0, 5)
                      .map(user => (
                        <div key={user.userId} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                          <div className="flex items-center">
                            <div className={`w-3 h-3 rounded-full mr-3 ${
                              user.riskLevel === 'CRITICAL' ? 'bg-red-500' : 'bg-orange-500'
                            }`} />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{user.userEmail}</p>
                              <p className="text-xs text-gray-600">Risk Score: {user.riskScore}/100</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {user.accountLocked && <Lock className="h-4 w-4 text-red-500" />}
                            {user.enhancedMonitoring && <Eye className="h-4 w-4 text-blue-500" />}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            {/* System Status */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">System Status</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="flex items-center justify-center">
                      <CheckCircle className="h-8 w-8 text-green-500 mr-2" />
                      <span className="text-lg font-medium text-gray-900">Incident Response</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">Active and monitoring</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center">
                      <CheckCircle className="h-8 w-8 text-green-500 mr-2" />
                      <span className="text-lg font-medium text-gray-900">Notifications</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">Delivery rate: {state.notificationStats ? Math.round(state.notificationStats.deliveryRate) : 0}%</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center">
                      <CheckCircle className="h-8 w-8 text-green-500 mr-2" />
                      <span className="text-lg font-medium text-gray-900">Audit Logging</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">HIPAA compliant</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Incidents Tab */}
        {selectedTab === 'incidents' && (
          <div className="space-y-6">
            {/* Filters and Actions */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  <select
                    value={filter.severity || ''}
                    onChange={(e) => setFilter(prev => ({ ...prev, severity: e.target.value as IncidentSeverity || undefined }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Severities</option>
                    <option value={IncidentSeverity.CRITICAL}>Critical</option>
                    <option value={IncidentSeverity.HIGH}>High</option>
                    <option value={IncidentSeverity.MEDIUM}>Medium</option>
                    <option value={IncidentSeverity.LOW}>Low</option>
                  </select>

                  <select
                    value={filter.status || ''}
                    onChange={(e) => setFilter(prev => ({ ...prev, status: e.target.value as IncidentStatus || undefined }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Statuses</option>
                    <option value={IncidentStatus.OPEN}>Open</option>
                    <option value={IncidentStatus.INVESTIGATING}>Investigating</option>
                    <option value={IncidentStatus.RESPONDED}>Responded</option>
                    <option value={IncidentStatus.RESOLVED}>Resolved</option>
                    <option value={IncidentStatus.CLOSED}>Closed</option>
                  </select>

                  <button
                    onClick={() => setFilter({})}
                    className="px-4 py-2 text-gray-600 hover:text-gray-900"
                  >
                    Clear Filters
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportIncidents}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </button>

                  <button
                    onClick={handleCreateTestIncident}
                    className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    Test Incident
                  </button>
                </div>
              </div>
            </div>

            {/* Incidents List */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  Security Incidents ({filteredIncidents.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Incident
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Severity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredIncidents.map(incident => (
                      <tr key={incident.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{incident.title}</p>
                            <p className="text-sm text-gray-600">{incident.type}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(incident.severity)}`}>
                            {incident.severity}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(incident.status)}`}>
                            {incident.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm text-gray-900">{incident.userEmail || 'Unknown'}</p>
                            <p className="text-xs text-gray-600">{incident.sourceIP}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm text-gray-900">{incident.timestamp.toLocaleDateString()}</p>
                            <p className="text-xs text-gray-600">{incident.timestamp.toLocaleTimeString()}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => setSelectedIncident(incident)}
                              className="text-blue-600 hover:text-blue-900"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {incident.status === IncidentStatus.OPEN && (
                              <>
                                <button
                                  onClick={() => handleIncidentAction(incident, 'resolve')}
                                  className="text-green-600 hover:text-green-900"
                                  title="Resolve"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleIncidentAction(incident, 'false_positive')}
                                  className="text-purple-600 hover:text-purple-900"
                                  title="Mark as False Positive"
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {selectedTab === 'users' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">User Security Profiles</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Risk Level
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Incidents
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Monitoring
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {state.userProfiles.map(user => (
                      <tr key={user.userId} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{user.userEmail}</p>
                            <p className="text-xs text-gray-600">ID: {user.userId}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className={`w-3 h-3 rounded-full mr-2 ${
                              user.riskLevel === 'CRITICAL' ? 'bg-red-500' :
                              user.riskLevel === 'HIGH' ? 'bg-orange-500' :
                              user.riskLevel === 'MEDIUM' ? 'bg-yellow-500' : 'bg-green-500'
                            }`} />
                            <span className="text-sm text-gray-900">{user.riskLevel}</span>
                            <span className="text-xs text-gray-600 ml-2">({user.riskScore}/100)</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-900">{user.totalIncidents}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            {user.accountLocked && (
                              <span className="flex items-center px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                                <Lock className="h-3 w-3 mr-1" />
                                Locked
                              </span>
                            )}
                            {user.mfaEnabled && (
                              <span className="flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                                MFA
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {user.enhancedMonitoring && (
                            <span className="flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                              <Eye className="h-3 w-3 mr-1" />
                              Enhanced
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Lockouts Tab */}
        {selectedTab === 'lockouts' && (
          <div className="space-y-6">
            {/* Lockout Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{lockoutStats?.activeLockouts || 0}</p>
                  <p className="text-sm text-gray-600">Active Lockouts</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{lockoutStats?.totalLockouts || 0}</p>
                  <p className="text-sm text-gray-600">Total Lockouts</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{lockoutStats?.usersAffected || 0}</p>
                  <p className="text-sm text-gray-600">Users Affected</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{lockoutStats?.repeatOffenders || 0}</p>
                  <p className="text-sm text-gray-600">Repeat Offenders</p>
                </div>
              </div>
            </div>

            {/* Recent Lockouts */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Recent Lockouts</h3>
              </div>
              <div className="p-6">
                {lockoutStats?.recentLockouts?.length > 0 ? (
                  <div className="space-y-4">
                    {lockoutStats.recentLockouts.map((lockout: any) => (
                      <div key={lockout.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center">
                          <Lock className="h-5 w-5 text-red-500 mr-3" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{lockout.userEmail}</p>
                            <p className="text-xs text-gray-600">{lockout.reason}</p>
                            <p className="text-xs text-gray-500">{new Date(lockout.lockedAt).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${
                            lockout.severity === 'disable' ? 'bg-red-100 text-red-800' :
                            lockout.severity === 'suspend' ? 'bg-orange-100 text-orange-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {lockout.severity}
                          </span>
                          {lockout.status === 'active' && (
                            <button
                              onClick={() => handleUserLockout(lockout.userId, 'unlock')}
                              className="text-blue-600 hover:text-blue-900 text-sm"
                            >
                              Unlock
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Lock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No recent lockouts</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {selectedTab === 'notifications' && (
          <div className="space-y-6">
            {/* Notification Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{state.notificationStats?.totalSent || 0}</p>
                  <p className="text-sm text-gray-600">Total Sent</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {state.notificationStats ? Math.round(state.notificationStats.deliveryRate) : 0}%
                  </p>
                  <p className="text-sm text-gray-600">Delivery Rate</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{state.notificationStats?.rateLimitedCount || 0}</p>
                  <p className="text-sm text-gray-600">Rate Limited</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{state.notificationStats?.escalationCount || 0}</p>
                  <p className="text-sm text-gray-600">Escalations</p>
                </div>
              </div>
            </div>

            {/* Notification Test */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Test Notifications</h3>
                  <p className="text-sm text-gray-600">Send test notifications to verify system functionality</p>
                </div>
                <button
                  onClick={handleTestNotifications}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Send Test
                </button>
              </div>
            </div>

            {/* Recent Notifications */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Recent Notifications</h3>
              </div>
              <div className="p-6">
                {state.notificationStats?.recentNotifications?.length > 0 ? (
                  <div className="space-y-4">
                    {state.notificationStats.recentNotifications.map((notification: any) => (
                      <div key={notification.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center">
                          <Mail className="h-5 w-5 text-blue-500 mr-3" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{notification.message}</p>
                            <p className="text-xs text-gray-600">
                              To: {notification.recipient} via {notification.channel}
                            </p>
                            <p className="text-xs text-gray-500">{new Date(notification.createdAt).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          {notification.status === 'delivered' ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : notification.status === 'failed' ? (
                            <XCircle className="h-5 w-5 text-red-500" />
                          ) : (
                            <Clock className="h-5 w-5 text-yellow-500" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No recent notifications</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {selectedTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Configuration Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">MFA Failure Threshold</label>
                  <input
                    type="number"
                    value={state.configuration?.mfaFailureThreshold || 3}
                    onChange={(e) => actions.updateConfiguration({ mfaFailureThreshold: parseInt(e.target.value) })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">PHI Access Threshold (per hour)</label>
                  <input
                    type="number"
                    value={state.configuration?.phiAccessThreshold || 20}
                    onChange={(e) => actions.updateConfiguration({ phiAccessThreshold: parseInt(e.target.value) })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={state.configuration?.emailAlerts || false}
                    onChange={(e) => actions.updateConfiguration({ emailAlerts: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-700">
                    Enable Email Alerts
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={state.configuration?.autoLockoutEnabled || false}
                    onChange={(e) => actions.updateConfiguration({ autoLockoutEnabled: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-700">
                    Enable Automatic Lockouts
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Incident Details</h3>
              <button
                onClick={() => setSelectedIncident(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Basic Information</h4>
                  <div className="space-y-2">
                    <p><span className="font-medium">ID:</span> {selectedIncident.id}</p>
                    <p><span className="font-medium">Title:</span> {selectedIncident.title}</p>
                    <p><span className="font-medium">Type:</span> {selectedIncident.type}</p>
                    <p><span className="font-medium">Severity:</span>
                      <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${getSeverityColor(selectedIncident.severity)}`}>
                        {selectedIncident.severity}
                      </span>
                    </p>
                    <p><span className="font-medium">Status:</span>
                      <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${getStatusColor(selectedIncident.status)}`}>
                        {selectedIncident.status}
                      </span>
                    </p>
                    <p><span className="font-medium">Time:</span> {selectedIncident.timestamp.toLocaleString()}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">User Information</h4>
                  <div className="space-y-2">
                    <p><span className="font-medium">User ID:</span> {selectedIncident.userId || 'Unknown'}</p>
                    <p><span className="font-medium">Email:</span> {selectedIncident.userEmail || 'Unknown'}</p>
                    <p><span className="font-medium">Source IP:</span> {selectedIncident.sourceIP || 'Unknown'}</p>
                    <p><span className="font-medium">User Agent:</span> {selectedIncident.userAgent || 'Unknown'}</p>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
                <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">{selectedIncident.description}</p>
              </div>

              {/* Evidence */}
              {selectedIncident.evidence.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Evidence ({selectedIncident.evidence.length})</h4>
                  <div className="space-y-3">
                    {selectedIncident.evidence.map((evidence, index) => (
                      <div key={index} className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-900">{evidence.type}</span>
                          <span className="text-xs text-gray-600">{evidence.source}</span>
                        </div>
                        <p className="text-sm text-gray-700">{evidence.description}</p>
                        <pre className="text-xs text-gray-600 mt-2 overflow-x-auto">
                          {JSON.stringify(evidence.data, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {selectedIncident.status === IncidentStatus.OPEN && (
                <div className="flex items-center space-x-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => handleIncidentAction(selectedIncident, 'resolve')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Resolve Incident
                  </button>
                  <button
                    onClick={() => handleIncidentAction(selectedIncident, 'false_positive')}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    Mark as False Positive
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SecurityDashboard