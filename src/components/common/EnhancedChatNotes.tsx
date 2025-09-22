import React, { useState, useRef } from 'react'
import {
  StickyNoteIcon,
  PlusIcon,
  SaveIcon,
  XIcon,
  TrashIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  LoaderIcon,
  EditIcon,
  UserIcon,
  ClockIcon,
  WifiOffIcon,
  CloudIcon,
  RefreshCwIcon,
  AlertTriangleIcon
} from 'lucide-react'
import { useNotesWithOfflineSync } from '@/hooks/useNotesWithOfflineSync'
import { notesService } from '@/services/notesService'

interface EnhancedChatNotesProps {
  chatId: string
  referenceType?: 'call' | 'sms'
  isReadonly?: boolean
  onNotesChanged?: () => void
}

export const EnhancedChatNotes: React.FC<EnhancedChatNotesProps> = ({
  chatId,
  referenceType = 'sms',
  isReadonly = false,
  onNotesChanged
}) => {
  // Local state for UI
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [newNoteContent, setNewNoteContent] = useState('')

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Enhanced notes hook with offline support
  const {
    notes,
    draftNotes,
    isLoading,
    isSyncing,
    isOffline,
    hasPendingOperations,
    pendingOperationsCount,
    createNote,
    updateNote,
    deleteNote,
    updateDraft,
    clearDraft,
    forceSync,
    getDraft,
    hasDraft
  } = useNotesWithOfflineSync({
    chatId,
    referenceType,
    autoSaveDelay: 3000,
    maxRetries: 3,
    onError: (error) => {
      setError(error)
      setTimeout(() => setError(null), 5000)
    },
    onSuccess: (message) => {
      setSuccessMessage(message)
      setTimeout(() => setSuccessMessage(null), 4000)
      onNotesChanged?.()
    },
    onOfflineMode: (offline) => {
      if (offline) {
        setSuccessMessage('Working offline - changes will sync when online')
        setTimeout(() => setSuccessMessage(null), 5000)
      }
    }
  })

  // Handle adding new note
  const handleAddNote = async () => {
    if (!newNoteContent.trim()) {
      setError('Note content cannot be empty')
      return
    }

    const success = await createNote(newNoteContent.trim())
    if (success) {
      setNewNoteContent('')
      setIsEditing(false)
    }
  }

  // Handle updating existing note
  const handleUpdateNote = async (noteId: string) => {
    const content = getDraft(noteId)
    if (!content.trim()) {
      setError('Note content cannot be empty')
      return
    }

    const success = await updateNote(noteId, content.trim())
    if (success) {
      setEditingNoteId(null)
      clearDraft(noteId)
    }
  }

  // Handle deleting note
  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
      return
    }

    await deleteNote(noteId)
  }

  // Start editing note
  const handleEditNote = (noteId: string, currentContent: string) => {
    setEditingNoteId(noteId)
    updateDraft(noteId, currentContent)
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 100)
  }

  // Start adding new note
  const handleStartAddNote = () => {
    setIsEditing(true)
    setError(null)
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 100)
  }

  // Cancel editing/adding
  const handleCancel = () => {
    if (editingNoteId) {
      clearDraft(editingNoteId)
      setEditingNoteId(null)
    } else {
      setIsEditing(false)
      setNewNoteContent('')
    }
    setError(null)
  }

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target
    const value = target.value

    if (editingNoteId) {
      updateDraft(editingNoteId, value)
    } else {
      setNewNoteContent(value)
    }

    // Auto-resize
    target.style.height = 'auto'
    target.style.height = `${target.scrollHeight}px`
  }

  // Clear messages when user starts typing
  React.useEffect(() => {
    if (newNoteContent || Object.keys(draftNotes).length > 0) {
      setError(null)
      setSuccessMessage(null)
    }
  }, [newNoteContent, draftNotes])

  if (isLoading) {
    return (
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-center py-8">
          <LoaderIcon className="w-6 h-6 text-blue-600 animate-spin mr-2" />
          <span className="text-gray-600 dark:text-gray-400">Loading notes...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
      {/* Header with status indicators */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <StickyNoteIcon className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Chat Notes</h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">({notes.length})</span>

          {/* Status indicators */}
          <div className="flex items-center gap-2 ml-4">
            {isOffline && (
              <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                <WifiOffIcon className="w-3 h-3" />
                Offline
              </div>
            )}

            {isSyncing && (
              <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                <RefreshCwIcon className="w-3 h-3 animate-spin" />
                Syncing
              </div>
            )}

            {hasPendingOperations && (
              <div className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs">
                <CloudIcon className="w-3 h-3" />
                {pendingOperationsCount} pending
              </div>
            )}

            {!isOffline && !isSyncing && !hasPendingOperations && notes.length > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                <CheckCircleIcon className="w-3 h-3" />
                Synced
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Force sync button when offline operations pending */}
          {hasPendingOperations && !isOffline && (
            <button
              onClick={forceSync}
              disabled={isSyncing}
              className="flex items-center gap-1 px-2 py-1 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors text-sm"
              title="Force sync pending changes"
            >
              <RefreshCwIcon className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              Sync
            </button>
          )}

          {/* Add note button */}
          {!isReadonly && !isEditing && (
            <button
              onClick={handleStartAddNote}
              className="flex items-center gap-2 px-3 py-1 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Add Note
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircleIcon className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <CheckCircleIcon className="w-4 h-4 text-green-600 flex-shrink-0" />
          <span className="text-green-700 text-sm">{successMessage}</span>
        </div>
      )}

      {/* Offline Warning */}
      {isOffline && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
          <AlertTriangleIcon className="w-4 h-4 text-yellow-600 flex-shrink-0" />
          <span className="text-yellow-700 text-sm">
            You're working offline. Changes will be saved locally and synced when you're back online.
          </span>
        </div>
      )}

      {/* Notes List */}
      {notes.length > 0 && (
        <div className="space-y-3">
          {notes.map((note) => {
            const isEditing = editingNoteId === note.id
            const draftContent = getDraft(note.id)
            const hasDraftChanges = hasDraft(note.id)

            return (
              <div key={note.id} className="bg-white dark:bg-gray-800 rounded-lg border p-4">
                {isEditing ? (
                  <div className="space-y-3">
                    <textarea
                      ref={textareaRef}
                      value={draftContent}
                      onChange={handleTextareaChange}
                      className="w-full min-h-[80px] p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      disabled={isSyncing}
                    />
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        {hasDraftChanges && (
                          <span className="text-orange-600">Unsaved changes • Auto-saves in 3s</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleCancel}
                          className="px-3 py-1 text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-600 rounded hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                          disabled={isSyncing}
                        >
                          <XIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleUpdateNote(note.id)}
                          disabled={isSyncing || !draftContent.trim()}
                          className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isSyncing ? (
                            <LoaderIcon className="w-4 h-4 animate-spin" />
                          ) : (
                            <SaveIcon className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed mb-3">
                      {note.content}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <UserIcon className="w-3 h-3" />
                          <span>{notesService.getUserDisplayName(note)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ClockIcon className="w-3 h-3" />
                          <span>{notesService.formatTimestamp(note.created_at)}</span>
                        </div>
                        {note.is_edited && note.last_edited_at && (
                          <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                            <EditIcon className="w-3 h-3" />
                            <span>edited {notesService.formatTimestamp(note.last_edited_at)}</span>
                            {note.last_edited_by_name && (
                              <span>by {notesService.getUserDisplayName(note, false)}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {!isReadonly && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditNote(note.id, note.content)}
                            className="p-1 text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                            title="Edit note"
                          >
                            <EditIcon className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="p-1 text-red-600 bg-red-50 rounded hover:bg-red-100 transition-colors"
                            title="Delete note"
                          >
                            <TrashIcon className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add New Note Editor */}
      {isEditing && (
        <div className="space-y-3">
          <textarea
            ref={textareaRef}
            value={newNoteContent}
            onChange={handleTextareaChange}
            placeholder="Add your notes about this chat conversation..."
            className="w-full min-h-[120px] p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            disabled={isSyncing}
          />
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {isOffline && <span className="text-yellow-600">Will save offline and sync later</span>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                disabled={isSyncing}
              >
                <XIcon className="w-4 h-4" />
              </button>
              <button
                onClick={handleAddNote}
                disabled={isSyncing || !newNoteContent.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSyncing ? (
                  <LoaderIcon className="w-4 h-4 animate-spin" />
                ) : (
                  <SaveIcon className="w-4 h-4" />
                )}
                {isSyncing ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {notes.length === 0 && !isEditing && (
        <div className="text-center py-8">
          <StickyNoteIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">No notes for this chat yet.</p>
          {!isReadonly && (
            <button
              onClick={handleStartAddNote}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto"
            >
              <PlusIcon className="w-4 h-4" />
              Add Your First Note
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default EnhancedChatNotes