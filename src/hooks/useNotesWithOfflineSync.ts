/**
 * Enhanced Notes Hook with Offline Support and Auto-Save
 *
 * Provides auto-save functionality, offline queue management, and seamless sync
 * for chat notes across devices. Handles network connectivity issues gracefully.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { notesService, type Note, type CreateNoteData, type UpdateNoteData } from '@/services/notesService'
import { useDebounce } from '@/hooks/useDebounce'

interface OfflineOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  data: any
  timestamp: number
  retryCount: number
}

interface UseNotesWithOfflineSyncOptions {
  chatId: string
  referenceType: 'call' | 'sms'
  autoSaveDelay?: number
  maxRetries?: number
  onError?: (error: string) => void
  onSuccess?: (message: string) => void
  onOfflineMode?: (isOffline: boolean) => void
}

export const useNotesWithOfflineSync = (options: UseNotesWithOfflineSyncOptions) => {
  const {
    chatId,
    referenceType,
    autoSaveDelay = 2000,
    maxRetries = 3,
    onError,
    onSuccess,
    onOfflineMode
  } = options

  // State management
  const [notes, setNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [pendingOperations, setPendingOperations] = useState<OfflineOperation[]>([])
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({})

  // Refs for cleanup and debouncing
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const offlineQueueKey = `notes_offline_queue_${chatId}_${referenceType}`

  // Debounced auto-save for drafts
  const { debouncedValue: debouncedDrafts } = useDebounce(draftNotes, autoSaveDelay)

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false)
      onOfflineMode?.(false)
      processPendingOperations()
    }

    const handleOffline = () => {
      setIsOffline(true)
      onOfflineMode?.(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Load offline queue from localStorage
  useEffect(() => {
    const savedQueue = localStorage.getItem(offlineQueueKey)
    if (savedQueue) {
      try {
        setPendingOperations(JSON.parse(savedQueue))
      } catch (error) {
        console.error('Failed to parse offline queue:', error)
        localStorage.removeItem(offlineQueueKey)
      }
    }
  }, [offlineQueueKey])

  // Save offline queue to localStorage
  useEffect(() => {
    if (pendingOperations.length > 0) {
      localStorage.setItem(offlineQueueKey, JSON.stringify(pendingOperations))
    } else {
      localStorage.removeItem(offlineQueueKey)
    }
  }, [pendingOperations, offlineQueueKey])

  // Auto-save drafts when they change
  useEffect(() => {
    if (Object.keys(debouncedDrafts).length > 0) {
      Object.entries(debouncedDrafts).forEach(([noteId, content]) => {
        if (content.trim() && noteId !== 'new') {
          autoSaveNote(noteId, content.trim())
        }
      })
    }
  }, [debouncedDrafts])

  // Load initial notes and set up real-time subscription
  useEffect(() => {
    loadNotes()
    setupRealtimeSubscription()

    return () => {
      notesService.unsubscribeFromNotes(chatId, referenceType)
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }
    }
  }, [chatId, referenceType])

  // Load notes from service
  const loadNotes = async () => {
    setIsLoading(true)
    try {
      const result = await notesService.getNotes(chatId, referenceType)
      if (result.success && result.notes) {
        setNotes(result.notes)
      } else {
        onError?.(result.error || 'Failed to load notes')
      }
    } catch (error) {
      console.error('Error loading notes:', error)
      onError?.('Failed to load notes')
    } finally {
      setIsLoading(false)
    }
  }

  // Set up real-time subscription
  const setupRealtimeSubscription = async () => {
    try {
      await notesService.subscribeToNotes(chatId, referenceType, (updatedNotes) => {
        setNotes(updatedNotes)
        // Clear any drafts that have been saved
        setDraftNotes(prev => {
          const filtered = { ...prev }
          updatedNotes.forEach(note => {
            if (filtered[note.id]) {
              delete filtered[note.id]
            }
          })
          return filtered
        })
      })
    } catch (error) {
      console.warn('Real-time subscription failed, using manual refresh only')
    }
  }

  // Add operation to offline queue
  const addToOfflineQueue = (operation: Omit<OfflineOperation, 'id' | 'timestamp' | 'retryCount'>) => {
    const offlineOp: OfflineOperation = {
      ...operation,
      id: `${operation.type}_${Date.now()}_${Math.random()}`,
      timestamp: Date.now(),
      retryCount: 0
    }

    setPendingOperations(prev => [...prev, offlineOp])
  }

  // Process pending offline operations
  const processPendingOperations = async () => {
    if (pendingOperations.length === 0 || isOffline) return

    setIsSyncing(true)

    const remainingOperations: OfflineOperation[] = []

    for (const operation of pendingOperations) {
      try {
        let success = false

        switch (operation.type) {
          case 'create':
            const createResult = await notesService.createNote(operation.data)
            success = createResult.success
            break
          case 'update':
            const updateResult = await notesService.updateNote(operation.data.id, operation.data.updateData)
            success = updateResult.success
            break
          case 'delete':
            const deleteResult = await notesService.deleteNote(operation.data.id)
            success = deleteResult.success
            break
        }

        if (!success) {
          throw new Error(`Failed to process ${operation.type} operation`)
        }

        onSuccess?.(`Synced ${operation.type} operation`)
      } catch (error) {
        console.error(`Failed to process operation:`, operation, error)

        // Retry logic
        if (operation.retryCount < maxRetries) {
          remainingOperations.push({
            ...operation,
            retryCount: operation.retryCount + 1
          })
        } else {
          onError?.(`Failed to sync ${operation.type} operation after ${maxRetries} retries`)
        }
      }
    }

    setPendingOperations(remainingOperations)
    setIsSyncing(false)

    // Refresh notes after sync
    if (remainingOperations.length < pendingOperations.length) {
      await loadNotes()
    }
  }

  // Auto-save note
  const autoSaveNote = async (noteId: string, content: string) => {
    try {
      if (isOffline) {
        addToOfflineQueue({
          type: 'update',
          data: { id: noteId, updateData: { content, content_type: 'plain' } }
        })
        return
      }

      const result = await notesService.updateNote(noteId, {
        content,
        content_type: 'plain'
      })

      if (result.success) {
        // Remove from drafts since it's saved
        setDraftNotes(prev => {
          const updated = { ...prev }
          delete updated[noteId]
          return updated
        })
      } else {
        throw new Error(result.error || 'Auto-save failed')
      }
    } catch (error) {
      console.error('Auto-save error:', error)
      if (isOffline) {
        addToOfflineQueue({
          type: 'update',
          data: { id: noteId, updateData: { content, content_type: 'plain' } }
        })
      } else {
        onError?.('Auto-save failed')
      }
    }
  }

  // Create new note
  const createNote = async (content: string): Promise<boolean> => {
    const createData: CreateNoteData = {
      reference_id: chatId,
      reference_type: referenceType,
      content: content.trim(),
      content_type: 'plain'
    }

    try {
      if (isOffline) {
        addToOfflineQueue({ type: 'create', data: createData })
        onSuccess?.('Note saved offline, will sync when online')
        return true
      }

      const result = await notesService.createNote(createData)
      if (result.success) {
        onSuccess?.('Note saved successfully')
        return true
      } else {
        throw new Error(result.error || 'Failed to create note')
      }
    } catch (error) {
      console.error('Create note error:', error)
      if (isOffline) {
        addToOfflineQueue({ type: 'create', data: createData })
        onSuccess?.('Note saved offline, will sync when online')
        return true
      } else {
        onError?.('Failed to create note')
        return false
      }
    }
  }

  // Update existing note
  const updateNote = async (noteId: string, content: string): Promise<boolean> => {
    const updateData: UpdateNoteData = {
      content: content.trim(),
      content_type: 'plain'
    }

    try {
      if (isOffline) {
        addToOfflineQueue({
          type: 'update',
          data: { id: noteId, updateData }
        })
        onSuccess?.('Note updated offline, will sync when online')
        return true
      }

      const result = await notesService.updateNote(noteId, updateData)
      if (result.success) {
        onSuccess?.('Note updated successfully')
        return true
      } else {
        throw new Error(result.error || 'Failed to update note')
      }
    } catch (error) {
      console.error('Update note error:', error)
      if (isOffline) {
        addToOfflineQueue({
          type: 'update',
          data: { id: noteId, updateData }
        })
        onSuccess?.('Note updated offline, will sync when online')
        return true
      } else {
        onError?.('Failed to update note')
        return false
      }
    }
  }

  // Delete note
  const deleteNote = async (noteId: string): Promise<boolean> => {
    try {
      if (isOffline) {
        // Optimistically remove from UI immediately for offline mode
        setNotes(prev => prev.filter(note => note.id !== noteId))
        addToOfflineQueue({ type: 'delete', data: { id: noteId } })
        onSuccess?.('Note deleted offline, will sync when online')
        return true
      }

      const result = await notesService.deleteNote(noteId)
      if (result.success) {
        // Immediately update the UI state to remove the deleted note
        setNotes(prev => prev.filter(note => note.id !== noteId))
        // Also clear any draft for this note
        setDraftNotes(prev => {
          const updated = { ...prev }
          delete updated[noteId]
          return updated
        })
        onSuccess?.('Note deleted successfully')
        return true
      } else {
        throw new Error(result.error || 'Failed to delete note')
      }
    } catch (error) {
      console.error('Delete note error:', error)
      if (isOffline) {
        // Optimistically remove from UI immediately for offline fallback
        setNotes(prev => prev.filter(note => note.id !== noteId))
        addToOfflineQueue({ type: 'delete', data: { id: noteId } })
        onSuccess?.('Note deleted offline, will sync when online')
        return true
      } else {
        onError?.('Failed to delete note')
        return false
      }
    }
  }

  // Update draft content
  const updateDraft = useCallback((noteId: string, content: string) => {
    setDraftNotes(prev => ({
      ...prev,
      [noteId]: content
    }))
  }, [])

  // Clear draft
  const clearDraft = useCallback((noteId: string) => {
    setDraftNotes(prev => {
      const updated = { ...prev }
      delete updated[noteId]
      return updated
    })
  }, [])

  // Force sync
  const forceSync = useCallback(async () => {
    if (!isOffline) {
      await processPendingOperations()
      await loadNotes()
    }
  }, [isOffline])

  return {
    // Data
    notes,
    draftNotes,

    // Status
    isLoading,
    isSyncing,
    isOffline,
    hasPendingOperations: pendingOperations.length > 0,
    pendingOperationsCount: pendingOperations.length,

    // Actions
    createNote,
    updateNote,
    deleteNote,
    updateDraft,
    clearDraft,
    forceSync,

    // Utility
    getDraft: (noteId: string) => draftNotes[noteId] || '',
    hasDraft: (noteId: string) => !!draftNotes[noteId]
  }
}

export default useNotesWithOfflineSync