import React, { useState, useEffect, useCallback } from 'react'
import {
  UsersIcon,
  SearchIcon,
  ChevronDownIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  Loader2Icon,
  AlertCircleIcon,
  MapPinIcon,
  BriefcaseIcon,
  CalendarIcon,
  UserCheckIcon,
  MapIcon,
  TimerIcon,
  ActivityIcon,
  TrendingUpIcon,
  RefreshCwIcon,
  ZapIcon
} from 'lucide-react'
import {
  getPSWUsersByCompany,
  searchPSWUsersByCompany,
  getPSWUserStatsByCompany,
  PSWUser,
  PSWUserStats
} from '@/services/pswUserService'
import { format, differenceInMinutes, differenceInHours, formatDistanceToNow } from 'date-fns'
import { supabase } from '@/config/supabase'

interface PSWAdminPageProps {
  user: any
}

// Extended PSW info with visit and location details
interface PSWExtendedInfo extends PSWUser {
  currentVisit?: {
    id: string
    patientName: string
    location: string
    startTime: string
    duration: number
    status: string
    address?: string
    city?: string
    province?: string
  }
  nextVisit?: {
    id: string
    patientName: string
    location: string
    startTime: string
    type: string
    address?: string
  }
  visitHistory?: Array<{
    id: string
    patientName: string
    date: string
    duration: number
    location: string
  }>
  totalVisitsThisMonth: number
  averageVisitDuration: number
  lastVisitDate?: string
  onsite: boolean
  timeOnLocationFormatted?: string
  minutesOnLocation?: number
  recentLocations?: string[]
  hoursWorkedThisWeek?: number
  patientCount?: number
}

export const PSWAdminPage: React.FC<PSWAdminPageProps> = ({ user }) => {
  const [pswUsers, setPswUsers] = useState<PSWUser[]>([])
  const [pswExtendedInfo, setPswExtendedInfo] = useState<Map<string, PSWExtendedInfo>>(new Map())
  const [filteredUsers, setFilteredUsers] = useState<PSWUser[]>([])
  const [stats, setStats] = useState<PSWUserStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'onsite'>('all')
  const [selectedUser, setSelectedUser] = useState<PSWExtendedInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // Load PSW users and stats
  useEffect(() => {
    loadPSWData()

    // Set up auto-refresh every 30 seconds
    const interval = setInterval(() => {
      if (autoRefreshEnabled) {
        loadPSWData()
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [user?.company_id, autoRefreshEnabled])

  // Filter users when search query or status filter changes
  useEffect(() => {
    applyFilters()
  }, [pswUsers, searchQuery, statusFilter, pswExtendedInfo])

  const loadPSWData = async () => {
    if (!user?.company_id) {
      setError('Company ID not found. Please contact support.')
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Fetch PSW users
      const usersResponse = await getPSWUsersByCompany(user.company_id)
      if (usersResponse.status === 'success') {
        const users = usersResponse.data || []
        setPswUsers(users)

        // Load extended info for each PSW
        await loadExtendedPSWInfo(users)
      } else {
        setError(usersResponse.error || 'Failed to load PSW users')
        console.error('Error loading PSW users:', usersResponse.error)
      }

      // Fetch stats
      const statsResponse = await getPSWUserStatsByCompany(user.company_id)
      if (statsResponse.status === 'success') {
        setStats(statsResponse.data)
      } else {
        console.error('Error loading PSW stats:', statsResponse.error)
      }

      setLastUpdated(new Date())
    } catch (error: any) {
      setError(error.message || 'Failed to load PSW data')
      console.error('Exception loading PSW data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadExtendedPSWInfo = async (users: PSWUser[]) => {
    const extendedMap = new Map<string, PSWExtendedInfo>()

    for (const pswUser of users) {
      try {
        // Load visit data from NexaSync via organization ID
        const { data: visits } = await supabase
          .from('visits') // This would be from NexaSync if data is synced
          .select('*')
          .eq('psw_id', pswUser.psw_id)
          .order('created_at', { ascending: false })
          .limit(10)
          .catch(() => ({ data: null }))

        const extendedInfo: PSWExtendedInfo = {
          ...pswUser,
          onsite: false,
          totalVisitsThisMonth: 0,
          averageVisitDuration: 0,
          timeOnLocationFormatted: 'Not on site',
          minutesOnLocation: 0,
          patientCount: 0,
          hoursWorkedThisWeek: 0,
          recentLocations: []
        }

        // Process visit data if available
        if (visits && visits.length > 0) {
          // Find current visit (active visit)
          const activeVisit = visits.find((v: any) => v.status === 'active' || v.status === 'started')
          if (activeVisit) {
            const startTime = new Date(activeVisit.created_at)
            const minutesElapsed = differenceInMinutes(new Date(), startTime)
            const hoursElapsed = differenceInHours(new Date(), startTime)

            extendedInfo.currentVisit = {
              id: activeVisit.id,
              patientName: activeVisit.patient_name || 'Unknown Patient',
              location: activeVisit.location || 'Unknown Location',
              startTime: format(startTime, 'HH:mm'),
              duration: minutesElapsed,
              status: activeVisit.status,
              address: activeVisit.address,
              city: activeVisit.city,
              province: activeVisit.province
            }
            extendedInfo.onsite = true

            // Format time on location
            if (hoursElapsed > 0) {
              extendedInfo.timeOnLocationFormatted = `${hoursElapsed}h ${minutesElapsed % 60}m`
            } else {
              extendedInfo.timeOnLocationFormatted = `${minutesElapsed}m`
            }
            extendedInfo.minutesOnLocation = minutesElapsed
          }

          // Get next visit
          const nextVisit = visits.find((v: any) => v.status === 'scheduled')
          if (nextVisit) {
            extendedInfo.nextVisit = {
              id: nextVisit.id,
              patientName: nextVisit.patient_name || 'Unknown Patient',
              location: nextVisit.location || 'Unknown Location',
              startTime: format(new Date(nextVisit.start_time), 'HH:mm'),
              type: nextVisit.type || 'Visit',
              address: nextVisit.address
            }
          }

          // Get recent locations
          const uniqueLocations = Array.from(
            new Set(visits.slice(0, 5).map((v: any) => v.location))
          ).filter(Boolean)
          extendedInfo.recentLocations = uniqueLocations

          // Count visits this month
          const thisMonth = new Date()
          const monthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1)
          extendedInfo.totalVisitsThisMonth = visits.filter(
            (v: any) => new Date(v.created_at) >= monthStart
          ).length

          // Calculate average visit duration
          const completedVisits = visits.filter((v: any) => v.status === 'completed')
          if (completedVisits.length > 0) {
            const totalMinutes = completedVisits.reduce((sum: number, v: any) => {
              return sum + (v.duration_minutes || 60)
            }, 0)
            extendedInfo.averageVisitDuration = Math.round(totalMinutes / completedVisits.length)
          }

          // Get last visit date
          const completedVisit = completedVisits[0]
          if (completedVisit) {
            extendedInfo.lastVisitDate = format(new Date(completedVisit.created_at), 'MMM dd, yyyy')
          }

          // Count unique patients
          extendedInfo.patientCount = Array.from(
            new Set(visits.map((v: any) => v.patient_id))
          ).length

          // Calculate hours worked this week
          const weekStart = new Date()
          weekStart.setDate(weekStart.getDate() - weekStart.getDay())
          const weekVisits = visits.filter((v: any) => new Date(v.created_at) >= weekStart)
          const weekMinutes = weekVisits.reduce((sum: number, v: any) => {
            return sum + (v.duration_minutes || 60)
          }, 0)
          extendedInfo.hoursWorkedThisWeek = Math.round(weekMinutes / 60)
        }

        extendedMap.set(pswUser.id, extendedInfo)
      } catch (error) {
        console.warn(`Failed to load extended info for PSW ${pswUser.id}:`, error)
        // Set basic extended info even if detailed data fails
        extendedMap.set(pswUser.id, {
          ...pswUser,
          onsite: false,
          totalVisitsThisMonth: 0,
          averageVisitDuration: 0,
          timeOnLocationFormatted: 'No data',
          minutesOnLocation: 0,
          patientCount: 0,
          hoursWorkedThisWeek: 0
        })
      }
    }

    setPswExtendedInfo(extendedMap)
  }

  const applyFilters = () => {
    let filtered = pswUsers

    // Apply status filter
    if (statusFilter === 'onsite') {
      filtered = filtered.filter(user => {
        const extended = pswExtendedInfo.get(user.id)
        return extended?.onsite === true
      })
    } else if (statusFilter !== 'all') {
      filtered = filtered.filter(user => user.status === statusFilter)
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        user =>
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query) ||
          pswExtendedInfo.get(user.id)?.currentVisit?.patientName.toLowerCase().includes(query) ||
          pswExtendedInfo.get(user.id)?.currentVisit?.location.toLowerCase().includes(query)
      )
    }

    setFilteredUsers(filtered)
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  const formatLastLogin = (lastLogin: string | null) => {
    if (!lastLogin) {
      return 'Never'
    }
    try {
      return formatDistanceToNow(new Date(lastLogin), { addSuffix: true })
    } catch {
      return lastLogin
    }
  }

  const onSiteCount = Array.from(pswExtendedInfo.values()).filter(info => info.onsite).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900">
            <UsersIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">PSW Administration</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Real-time PSW management and location tracking</p>
          </div>
        </div>
        <button
          onClick={loadPSWData}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCwIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Last Updated & Auto Refresh Toggle */}
      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
        <span>Last updated: {format(lastUpdated, 'HH:mm:ss')}</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoRefreshEnabled}
            onChange={e => setAutoRefreshEnabled(e.target.checked)}
            className="w-3 h-3"
          />
          Auto-refresh (30s)
        </label>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total PSWs</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats.total}</p>
              </div>
              <UsersIcon className="w-12 h-12 text-blue-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">{stats.active}</p>
              </div>
              <CheckCircleIcon className="w-12 h-12 text-green-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">On Site</p>
                <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-2">{onSiteCount}</p>
              </div>
              <MapPinIcon className="w-12 h-12 text-orange-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Inactive</p>
                <p className="text-3xl font-bold text-gray-600 dark:text-gray-400 mt-2">{stats.inactive}</p>
              </div>
              <XCircleIcon className="w-12 h-12 text-gray-500 opacity-20" />
            </div>
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, patient, or location..."
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="appearance-none px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
            >
              <option value="all">All Status</option>
              <option value="onsite">On Site</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
            <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-gray-600 dark:text-gray-400" />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircleIcon className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* PSWs List - Grid View with Details */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 flex items-center justify-center">
            <Loader2Icon className="w-6 h-6 text-gray-400 animate-spin mr-2" />
            <p className="text-gray-600 dark:text-gray-400">Loading PSW data...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 flex flex-col items-center justify-center text-center">
            <UsersIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-600 dark:text-gray-400">
              {searchQuery ? 'No PSWs match your search' : 'No PSWs found'}
            </p>
            {searchQuery && (
              <button
                onClick={() => handleSearch('')}
                className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredUsers.map(pswUser => {
              const extended = pswExtendedInfo.get(pswUser.id)
              if (!extended) return null

              return (
                <div
                  key={pswUser.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer transition-all overflow-hidden group"
                  onClick={() => setSelectedUser(extended)}
                >
                  {/* Header with Status */}
                  <div className={`p-4 ${extended.onsite ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-gray-50 dark:bg-gray-700'} border-b border-gray-200 dark:border-gray-700`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{extended.name}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{extended.email}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          {extended.status === 'active' ? (
                            <>
                              <CheckCircleIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
                              <span className="text-xs font-medium text-green-600 dark:text-green-400">Active</span>
                            </>
                          ) : (
                            <>
                              <XCircleIcon className="w-4 h-4 text-gray-400 dark:text-gray-600" />
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Inactive</span>
                            </>
                          )}
                        </div>
                        {extended.onsite && (
                          <div className="flex items-center gap-1 px-2 py-1 rounded bg-orange-100 dark:bg-orange-900">
                            <ZapIcon className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                            <span className="text-xs font-bold text-orange-600 dark:text-orange-400">ON SITE</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Current Location/Visit */}
                  {extended.currentVisit ? (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <MapPinIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-600 dark:text-gray-400">Current Location</p>
                            <p className="font-semibold text-gray-900 dark:text-white truncate">
                              {extended.currentVisit.location}
                            </p>
                            {extended.currentVisit.address && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                {extended.currentVisit.address}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <div className="flex items-center gap-1">
                            <UserCheckIcon className="w-3 h-3 text-gray-500" />
                            <span className="text-gray-700 dark:text-gray-300 font-medium">{extended.currentVisit.patientName}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <TimerIcon className="w-3 h-3 text-gray-500" />
                            <span className="text-gray-700 dark:text-gray-300 font-bold">{extended.timeOnLocationFormatted}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <ClockIcon className="w-3 h-3 text-gray-500" />
                            <span className="text-gray-700 dark:text-gray-300">Since {extended.currentVisit.startTime}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Not currently on site</p>
                    </div>
                  )}

                  {/* Stats Grid */}
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
                        <p className="text-xs text-gray-600 dark:text-gray-400">Visits This Month</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{extended.totalVisitsThisMonth}</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
                        <p className="text-xs text-gray-600 dark:text-gray-400">Hours This Week</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{extended.hoursWorkedThisWeek}h</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
                        <p className="text-xs text-gray-600 dark:text-gray-400">Patients Served</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{extended.patientCount}</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
                        <p className="text-xs text-gray-600 dark:text-gray-400">Avg Visit</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{extended.averageVisitDuration}m</p>
                      </div>
                    </div>

                    {/* Recent Locations */}
                    {extended.recentLocations && extended.recentLocations.length > 0 && (
                      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Recent Locations</p>
                        <div className="flex flex-wrap gap-1">
                          {extended.recentLocations.map((loc, idx) => (
                            <span key={idx} className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                              {loc}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Last Activity */}
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                      <div className="text-xs">
                        <p className="text-gray-600 dark:text-gray-400">Last Login</p>
                        <p className="font-medium text-gray-900 dark:text-white">{formatLastLogin(extended.last_login)}</p>
                      </div>
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          setSelectedUser(extended)
                        }}
                        className="px-3 py-1 rounded-md bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 font-medium transition-colors text-sm"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Detailed View Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className={`p-6 border-b border-gray-200 dark:border-gray-700 ${selectedUser.onsite ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-gray-50 dark:bg-gray-700'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedUser.name}</h2>
                    <p className="text-gray-600 dark:text-gray-400">{selectedUser.email}</p>
                  </div>
                  {selectedUser.onsite && (
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-900 border border-orange-300 dark:border-orange-700">
                      <div className="w-2 h-2 rounded-full bg-orange-600 animate-pulse" />
                      <span className="font-semibold text-orange-700 dark:text-orange-300">ON SITE</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Current Visit Section */}
              {selectedUser.currentVisit && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
                    <MapPinIcon className="w-4 h-4" />
                    Current Visit - Live
                  </h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">Location</label>
                        <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{selectedUser.currentVisit.location}</p>
                        {selectedUser.currentVisit.address && (
                          <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">{selectedUser.currentVisit.address}</p>
                        )}
                        {selectedUser.currentVisit.city && (
                          <p className="text-sm text-blue-700 dark:text-blue-300">{selectedUser.currentVisit.city}, {selectedUser.currentVisit.province}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">Patient</label>
                        <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{selectedUser.currentVisit.patientName}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 pt-2 border-t border-blue-200 dark:border-blue-800">
                      <div>
                        <label className="block text-xs text-blue-700 dark:text-blue-300 font-medium">Started</label>
                        <p className="text-sm font-bold text-blue-900 dark:text-blue-100">{selectedUser.currentVisit.startTime}</p>
                      </div>
                      <div>
                        <label className="block text-xs text-blue-700 dark:text-blue-300 font-medium">Time On Site</label>
                        <p className="text-sm font-bold text-blue-900 dark:text-blue-100">{selectedUser.timeOnLocationFormatted}</p>
                      </div>
                      <div>
                        <label className="block text-xs text-blue-700 dark:text-blue-300 font-medium">Status</label>
                        <p className="text-sm font-bold text-blue-900 dark:text-blue-100">{selectedUser.currentVisit.status}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Next Visit Section */}
              {selectedUser.nextVisit && (
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-4 flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    Next Scheduled Visit
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-purple-700 dark:text-purple-300 font-medium mb-1">Location</label>
                      <p className="font-semibold text-purple-900 dark:text-purple-100">{selectedUser.nextVisit.location}</p>
                      {selectedUser.nextVisit.address && (
                        <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">{selectedUser.nextVisit.address}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-purple-700 dark:text-purple-300 font-medium mb-1">Patient</label>
                      <p className="font-semibold text-purple-900 dark:text-purple-100">{selectedUser.nextVisit.patientName}</p>
                    </div>
                    <div>
                      <label className="block text-xs text-purple-700 dark:text-purple-300 font-medium mb-1">Scheduled Time</label>
                      <p className="font-semibold text-purple-900 dark:text-purple-100">{selectedUser.nextVisit.startTime}</p>
                    </div>
                    <div>
                      <label className="block text-xs text-purple-700 dark:text-purple-300 font-medium mb-1">Visit Type</label>
                      <p className="font-semibold text-purple-900 dark:text-purple-100">{selectedUser.nextVisit.type}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total Visits (Month)</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{selectedUser.totalVisitsThisMonth}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Hours This Week</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{selectedUser.hoursWorkedThisWeek}h</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Patients Served</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{selectedUser.patientCount}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Avg Visit Duration</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{selectedUser.averageVisitDuration}m</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Status</p>
                  <div className="flex items-center gap-2 mt-2">
                    {selectedUser.status === 'active' ? (
                      <>
                        <CheckCircleIcon className="w-5 h-5 text-green-600" />
                        <span className="font-bold text-green-600">Active</span>
                      </>
                    ) : (
                      <>
                        <XCircleIcon className="w-5 h-5 text-gray-400" />
                        <span className="font-bold text-gray-600">Inactive</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Last Login</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{formatLastLogin(selectedUser.last_login)}</p>
                </div>
              </div>

              {/* Recent Locations */}
              {selectedUser.recentLocations && selectedUser.recentLocations.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <MapIcon className="w-4 h-4" />
                    Recent Locations
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.recentLocations.map((loc, idx) => (
                      <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-medium">
                        <MapPinIcon className="w-3 h-3 mr-1" />
                        {loc}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Info */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Account Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400 font-medium">Email</label>
                    <p className="text-gray-900 dark:text-white break-all">{selectedUser.email}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400 font-medium">Role</label>
                    <p className="text-gray-900 dark:text-white">{selectedUser.role}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400 font-medium">Created</label>
                    <p className="text-gray-900 dark:text-white">{format(new Date(selectedUser.created_at), 'MMM dd, yyyy')}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400 font-medium">Last Updated</label>
                    <p className="text-gray-900 dark:text-white">{format(new Date(selectedUser.updated_at), 'MMM dd, yyyy HH:mm')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
