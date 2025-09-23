import React, { useState, useEffect } from 'react'
import {
  X,
  AlertTriangle,
  Clock,
  FileText,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  Merge,
  Download,
  Upload,
  Info
} from 'lucide-react'
import { useConflictResolution } from '@/hooks/useConflictResolution'
import type { ConflictData } from '@/services/conflictResolutionService'

interface ConflictResolutionModalProps {
  isOpen: boolean
  onClose: () => void
  conflictId?: string | null
  className?: string
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  isOpen,
  onClose,
  conflictId,
  className = ''
}) => {
  const {
    pendingConflicts,
    getConflictById,
    resolveConflict,
    resolveAllConflicts,
    ignoreConflict,
    getConflictStatistics
  } = useConflictResolution()

  const [selectedConflict, setSelectedConflict] = useState<ConflictData | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['local']))
  const [isResolving, setIsResolving] = useState(false)
  const [resolution, setResolution] = useState<'keep_local' | 'keep_remote' | 'merge' | null>(null)
  const [showAllConflicts, setShowAllConflicts] = useState(false)

  // Set selected conflict when modal opens
  useEffect(() => {
    if (isOpen) {
      if (conflictId) {
        const conflict = getConflictById(conflictId)
        setSelectedConflict(conflict)
        setShowAllConflicts(false)
      } else if (pendingConflicts.length > 0) {
        setSelectedConflict(pendingConflicts[0])
        setShowAllConflicts(pendingConflicts.length > 1)
      }
    } else {
      setSelectedConflict(null)
      setResolution(null)
      setIsResolving(false)
    }
  }, [isOpen, conflictId, pendingConflicts, getConflictById])

  if (!isOpen) return null

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  const handleResolve = async (conflictToResolve: ConflictData, resolutionType: 'keep_local' | 'keep_remote' | 'merge') => {
    setIsResolving(true)
    try {
      await resolveConflict(conflictToResolve.id, resolutionType)

      // If this was the selected conflict, move to next one or close
      if (selectedConflict?.id === conflictToResolve.id) {
        const remainingConflicts = pendingConflicts.filter(c => c.id !== conflictToResolve.id)
        if (remainingConflicts.length > 0) {
          setSelectedConflict(remainingConflicts[0])
        } else {
          onClose()
        }
      }
    } catch (error) {
      console.error('Failed to resolve conflict:', error)
    } finally {
      setIsResolving(false)
    }
  }

  const handleIgnore = async (conflictToIgnore: ConflictData) => {
    setIsResolving(true)
    try {
      await ignoreConflict(conflictToIgnore.id)

      // Move to next conflict or close
      if (selectedConflict?.id === conflictToIgnore.id) {
        const remainingConflicts = pendingConflicts.filter(c => c.id !== conflictToIgnore.id)
        if (remainingConflicts.length > 0) {
          setSelectedConflict(remainingConflicts[0])
        } else {
          onClose()
        }
      }
    } catch (error) {
      console.error('Failed to ignore conflict:', error)
    } finally {
      setIsResolving(false)
    }
  }

  const handleResolveAll = async (resolutionType: 'keep_local' | 'keep_remote' | 'merge') => {
    if (window.confirm(`Are you sure you want to resolve all ${pendingConflicts.length} conflicts by ${resolutionType.replace('_', ' ')}?`)) {
      setIsResolving(true)
      try {
        await resolveAllConflicts(resolutionType)
        onClose()
      } catch (error) {
        console.error('Failed to resolve all conflicts:', error)
      } finally {
        setIsResolving(false)
      }
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  const formatData = (data: any) => {
    if (typeof data === 'string') return data
    return JSON.stringify(data, null, 2)
  }

  const getConflictTypeDescription = (type: string) => {
    switch (type) {
      case 'timestamp_mismatch':
        return 'Data was modified on different devices at different times'
      case 'data_mismatch':
        return 'Different values exist for the same field on different devices'
      case 'concurrent_edit':
        return 'The same record was edited simultaneously on different devices'
      default:
        return 'A synchronization conflict occurred'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/50'
      case 'high':
        return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/50'
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/50'
      default:
        return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50'
    }
  }

  const statistics = getConflictStatistics()

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-w-4xl w-full max-h-[90vh] overflow-hidden ${className}`}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Resolve Data Conflicts
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {pendingConflicts.length} conflict{pendingConflicts.length === 1 ? '' : 's'} need{pendingConflicts.length === 1 ? 's' : ''} your attention
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex h-[calc(90vh-80px)]">
          {/* Sidebar - Conflict List */}
          <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
            <div className="p-4 space-y-3">
              {/* Statistics */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 space-y-2">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Conflict Summary
                </h3>
                <div className="text-xs space-y-1">
                  {Object.entries(statistics.byTable).map(([table, count]) => (
                    <div key={table} className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400 capitalize">
                        {table}:
                      </span>
                      <span className="text-gray-900 dark:text-gray-100">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bulk Actions */}
              {pendingConflicts.length > 1 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Resolve All
                  </h3>
                  <div className="grid grid-cols-1 gap-1">
                    <button
                      onClick={() => handleResolveAll('keep_local')}
                      disabled={isResolving}
                      className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/70 disabled:opacity-50"
                    >
                      Keep All Local
                    </button>
                    <button
                      onClick={() => handleResolveAll('keep_remote')}
                      disabled={isResolving}
                      className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/70 disabled:opacity-50"
                    >
                      Keep All Remote
                    </button>
                  </div>
                </div>
              )}

              {/* Conflict List */}
              <div className="space-y-2">
                {pendingConflicts.map((conflict, index) => (
                  <div
                    key={conflict.id}
                    onClick={() => setSelectedConflict(conflict)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedConflict?.id === conflict.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">
                        {conflict.tableName}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(conflict.priority)}`}>
                        {conflict.priority}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                      {getConflictTypeDescription(conflict.conflictType)}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimestamp(conflict.detectedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content - Conflict Details */}
          <div className="flex-1 overflow-y-auto">
            {selectedConflict ? (
              <div className="p-6 space-y-6">
                {/* Conflict Header */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 capitalize">
                      {selectedConflict.tableName} Conflict
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-sm ${getPriorityColor(selectedConflict.priority)}`}>
                      {selectedConflict.priority} priority
                    </span>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                    <div className="flex gap-2">
                      <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        {getConflictTypeDescription(selectedConflict.conflictType)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Data Comparison */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Local Data */}
                  <div className="space-y-3">
                    <button
                      onClick={() => toggleSection('local')}
                      className="flex items-center gap-2 w-full text-left p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
                    >
                      <Download className="w-4 h-4 text-green-600 dark:text-green-400" />
                      <span className="font-medium text-green-800 dark:text-green-200">
                        Local Version (This Device)
                      </span>
                      {expandedSections.has('local') ? (
                        <ChevronDown className="w-4 h-4 text-green-600 dark:text-green-400 ml-auto" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-green-600 dark:text-green-400 ml-auto" />
                      )}
                    </button>

                    {expandedSections.has('local') && (
                      <div className="space-y-2">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Modified: {formatTimestamp(selectedConflict.localTimestamp)}
                        </div>
                        <pre className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded border max-h-40 overflow-y-auto">
                          {formatData(selectedConflict.localData)}
                        </pre>
                        <button
                          onClick={() => handleResolve(selectedConflict, 'keep_local')}
                          disabled={isResolving}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors min-h-[44px]"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Keep Local Version
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Remote Data */}
                  <div className="space-y-3">
                    <button
                      onClick={() => toggleSection('remote')}
                      className="flex items-center gap-2 w-full text-left p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
                    >
                      <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="font-medium text-blue-800 dark:text-blue-200">
                        Remote Version (Other Device)
                      </span>
                      {expandedSections.has('remote') ? (
                        <ChevronDown className="w-4 h-4 text-blue-600 dark:text-blue-400 ml-auto" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-blue-600 dark:text-blue-400 ml-auto" />
                      )}
                    </button>

                    {expandedSections.has('remote') && (
                      <div className="space-y-2">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Modified: {formatTimestamp(selectedConflict.remoteTimestamp)}
                        </div>
                        <pre className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded border max-h-40 overflow-y-auto">
                          {formatData(selectedConflict.remoteData)}
                        </pre>
                        <button
                          onClick={() => handleResolve(selectedConflict, 'keep_remote')}
                          disabled={isResolving}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors min-h-[44px]"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Keep Remote Version
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => handleResolve(selectedConflict, 'merge')}
                    disabled={isResolving}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg transition-colors min-h-[44px]"
                  >
                    <Merge className="w-4 h-4" />
                    Attempt Merge
                  </button>
                  <button
                    onClick={() => handleIgnore(selectedConflict)}
                    disabled={isResolving}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors min-h-[44px]"
                  >
                    Ignore
                  </button>
                </div>

                {/* Conflict Metadata */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                    Conflict Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Record ID:</span>
                        <span className="text-gray-900 dark:text-gray-100 font-mono text-xs">
                          {selectedConflict.recordId.slice(0, 8)}...
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Type:</span>
                        <span className="text-gray-900 dark:text-gray-100">
                          {selectedConflict.conflictType.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Detected:</span>
                        <span className="text-gray-900 dark:text-gray-100">
                          {formatTimestamp(selectedConflict.detectedAt)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Priority:</span>
                        <span className="text-gray-900 dark:text-gray-100 capitalize">
                          {selectedConflict.priority}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <p>Select a conflict from the list to view details and resolve it.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}