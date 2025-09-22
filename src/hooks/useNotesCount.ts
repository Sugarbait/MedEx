/**
 * Custom hook for tracking notes count across records
 * Provides cross-device accessible note indicators for main pages
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { notesService } from '@/services/notesService'

// CRITICAL FIX: Disable console logging in production to prevent infinite loops
const isProduction = !import.meta.env.DEV
const safeLog = isProduction ? () => {} : console.log
const safeError = isProduction ? () => {} : console.error

interface UseNotesCountOptions {
  referenceType: 'call' | 'sms'
  referenceIds: string[]
  enabled?: boolean
}

interface NotesCountResult {
  notesCount: Record<string, number>
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useNotesCount({
  referenceType,
  referenceIds,
  enabled = true
}: UseNotesCountOptions): NotesCountResult {
  const [notesCount, setNotesCount] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // CRITICAL FIX: Use refs to track previous values and prevent infinite loops
  const lastFetchRef = useRef<string>('')
  const fetchTimeoutRef = useRef<NodeJS.Timeout>()

  // CRITICAL FIX: Memoize referenceIds to prevent recreation on every render
  const stableReferenceIds = useMemo(() => {
    // Create a stable array by sorting and stringifying
    return [...referenceIds].sort()
  }, [referenceIds.join(',')])

  // CRITICAL FIX: Create a unique key to track when we need to refetch
  const fetchKey = useMemo(() => {
    return `${referenceType}_${stableReferenceIds.join(',')}_${enabled}`
  }, [referenceType, stableReferenceIds, enabled])

  const fetchNotesCount = useCallback(async () => {
    if (!enabled || stableReferenceIds.length === 0) {
      return
    }

    // CRITICAL FIX: Prevent duplicate fetches with the same parameters
    if (lastFetchRef.current === fetchKey) {
      return
    }

    // CRITICAL FIX: Clear any pending timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current)
    }

    try {
      setLoading(true)
      setError(null)
      lastFetchRef.current = fetchKey

      safeLog(`🔍 Fetching notes count for ${stableReferenceIds.length} ${referenceType} records`)

      const counts = await notesService.getNotesCount(stableReferenceIds, referenceType)

      safeLog(`📊 Notes count result: ${Object.keys(counts).length} records with notes`)
      setNotesCount(counts)

    } catch (err) {
      safeError('Error fetching notes count:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch notes count')
      // Reset the fetch key on error so we can retry
      lastFetchRef.current = ''
    } finally {
      setLoading(false)
    }
  }, [referenceType, stableReferenceIds, enabled, fetchKey])

  // CRITICAL FIX: Debounce the effect to prevent rapid successive calls
  useEffect(() => {
    // Clear any existing timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current)
    }

    // Debounce the fetch call to prevent rapid successive calls
    fetchTimeoutRef.current = setTimeout(() => {
      fetchNotesCount()
    }, 100) // 100ms debounce

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current)
      }
    }
  }, [fetchKey]) // Only depend on the stable fetchKey

  // Helper function to check if a record has notes
  const hasNotes = useCallback((referenceId: string): boolean => {
    return (notesCount[referenceId] || 0) > 0
  }, [notesCount])

  // Helper function to get note count for a specific record
  const getNoteCount = useCallback((referenceId: string): number => {
    return notesCount[referenceId] || 0
  }, [notesCount])

  // CRITICAL FIX: Create a manual refetch that forces a new fetch
  const manualRefetch = useCallback(async () => {
    lastFetchRef.current = '' // Reset to force refetch
    await fetchNotesCount()
  }, [fetchNotesCount])

  return {
    notesCount,
    loading,
    error,
    refetch: manualRefetch,
    hasNotes,
    getNoteCount
  } as NotesCountResult & {
    hasNotes: (referenceId: string) => boolean
    getNoteCount: (referenceId: string) => number
  }
}