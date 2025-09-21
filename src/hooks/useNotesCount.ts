/**
 * Custom hook for tracking notes count across records
 * Provides cross-device accessible note indicators for main pages
 */

import { useState, useEffect, useCallback } from 'react'
import { notesService } from '@/services/notesService'

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

  const fetchNotesCount = useCallback(async () => {
    if (!enabled || referenceIds.length === 0) {
      return
    }

    try {
      setLoading(true)
      setError(null)

      console.log(`🔍 Fetching notes count for ${referenceIds.length} ${referenceType} records`)

      const counts = await notesService.getNotesCount(referenceIds, referenceType)

      console.log(`📊 Notes count result: ${Object.keys(counts).length} records with notes`)
      setNotesCount(counts)

    } catch (err) {
      console.error('Error fetching notes count:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch notes count')
      // Don't clear existing count data on error - maintain what we have
    } finally {
      setLoading(false)
    }
  }, [referenceType, referenceIds, enabled])

  // Fetch notes count when parameters change
  useEffect(() => {
    fetchNotesCount()
  }, [fetchNotesCount])

  // Helper function to check if a record has notes
  const hasNotes = useCallback((referenceId: string): boolean => {
    return (notesCount[referenceId] || 0) > 0
  }, [notesCount])

  // Helper function to get note count for a specific record
  const getNoteCount = useCallback((referenceId: string): number => {
    return notesCount[referenceId] || 0
  }, [notesCount])

  return {
    notesCount,
    loading,
    error,
    refetch: fetchNotesCount,
    hasNotes,
    getNoteCount
  } as NotesCountResult & {
    hasNotes: (referenceId: string) => boolean
    getNoteCount: (referenceId: string) => number
  }
}