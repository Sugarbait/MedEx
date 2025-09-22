import React, { useState, useEffect, useRef, useCallback } from 'react'
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
  ClockIcon
} from 'lucide-react'
import { notesService, type Note } from '@/services/notesService'

interface CallNotesProps {
  callId: string
  isReadonly?: boolean
  onNotesChanged?: () => void
}

// Custom hook for debounced auto-save
const useDebounce = (callback: () => void, delay: number, deps: any[]) => {
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(callback, delay)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, deps)
}

export const CallNotes: React.FC<CallNotesProps> = ({ callId, isReadonly = false, onNotesChanged }) => {
  const [notes, setNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(false) // Start false for immediate UI
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [newNoteContent, setNewNoteContent] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [inlineEditId, setInlineEditId] = useState<string | null>(null)
  const [inlineContent, setInlineContent] = useState('')
  const [autoSaveDraft, setAutoSaveDraft] = useState('')
  const [showAutoSave, setShowAutoSave] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inlineTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Load notes with cross-device sync priority
  const loadNotes = useCallback(async () => {
    try {
      console.log('🚀 CallNotes: Starting cross-device load for callId:', callId)
      setError(null)

      // The enhanced notesService now handles:
      // 1. Immediate cache response
      // 2. localStorage fallback
      // 3. Background cross-device sync
      const result = await notesService.getNotes(callId, 'call')
      if (result.success && result.notes) {
        console.log('✅ CallNotes: Notes loaded (cross-device ready):', result.notes.length)
        setNotes(result.notes)
        setIsLoading(false)
      } else {
        setError(result.error || 'Failed to load notes')
        setIsLoading(false)
      }
    } catch (err) {
      console.error('❌ CallNotes: Error loading notes:', err)
      setError('Failed to load notes')
      setIsLoading(false)
    }
  }, [callId])

  // Auto-save draft functionality
  useDebounce(
    () => {
      if (newNoteContent.trim() && newNoteContent !== autoSaveDraft) {
        setAutoSaveDraft(newNoteContent)
        setShowAutoSave(true)
        localStorage.setItem(`draft_call_${callId}`, newNoteContent)
        setTimeout(() => setShowAutoSave(false), 2000)
      }
    },
    1000,
    [newNoteContent, callId, autoSaveDraft]
  )

  // Save new note with optimistic UI updates
  const handleAddNote = async () => {
    if (!newNoteContent.trim()) {
      setError('Note content cannot be empty')
      return
    }

    const tempNote = {
      id: `temp_${Date.now()}`,
      reference_id: callId,
      reference_type: 'call' as const,
      content: newNoteContent.trim(),
      content_type: 'plain' as const,
      created_by: 'current-user',
      created_by_name: 'You',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_edited: false
    }

    try {
      setIsSaving(true)
      setError(null)

      // Optimistic update - add note immediately
      setNotes(prevNotes => [...prevNotes, tempNote])
      setNewNoteContent('')
      setIsEditing(false)

      // Clear draft
      localStorage.removeItem(`draft_call_${callId}`)
      setAutoSaveDraft('')

      const result = await notesService.createNote({
        reference_id: callId,
        reference_type: 'call',
        content: tempNote.content,
        content_type: 'plain'
      })

      if (result.success && result.note) {
        // Replace temp note with real note
        setNotes(prevNotes =>
          prevNotes.map(note => note.id === tempNote.id ? result.note! : note)
        )
        setSuccessMessage('Note added successfully')
        setTimeout(() => setSuccessMessage(null), 3000)
        onNotesChanged?.()
      } else {
        // Remove temp note and show error
        setNotes(prevNotes => prevNotes.filter(note => note.id !== tempNote.id))
        setError(result.error || 'Failed to save note')
        setNewNoteContent(tempNote.content) // Restore content
        setIsEditing(true)
      }
    } catch (err) {
      console.error('Error saving note:', err)
      // Remove temp note and restore editing state
      setNotes(prevNotes => prevNotes.filter(note => note.id !== tempNote.id))
      setError('Failed to save note')
      setNewNoteContent(tempNote.content)
      setIsEditing(true)
    } finally {
      setIsSaving(false)
    }
  }

  // Update existing note with optimistic updates
  const handleUpdateNote = async (noteId: string, content: string) => {
    if (!content.trim()) {
      setError('Note content cannot be empty')
      return
    }

    const originalNote = notes.find(note => note.id === noteId)
    if (!originalNote) return

    try {
      setIsSaving(true)
      setError(null)

      // Optimistic update
      const updatedNote = {
        ...originalNote,
        content: content.trim(),
        last_edited_by_name: 'You',
        last_edited_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_edited: true
      }

      setNotes(prevNotes =>
        prevNotes.map(note => note.id === noteId ? updatedNote : note)
      )

      setEditingNoteId(null)
      setEditingContent('')
      setInlineEditId(null)
      setInlineContent('')

      const result = await notesService.updateNote(noteId, {
        content: content.trim(),
        content_type: 'plain'
      })

      if (result.success && result.note) {
        // Update with server response
        setNotes(prevNotes =>
          prevNotes.map(note => note.id === noteId ? result.note! : note)
        )
        setSuccessMessage('Note updated successfully')
        setTimeout(() => setSuccessMessage(null), 3000)
        onNotesChanged?.()
      } else {
        // Revert optimistic update
        setNotes(prevNotes =>
          prevNotes.map(note => note.id === noteId ? originalNote : note)
        )
        setError(result.error || 'Failed to update note')
      }
    } catch (err) {
      console.error('Error updating note:', err)
      // Revert optimistic update
      setNotes(prevNotes =>
        prevNotes.map(note => note.id === noteId ? originalNote : note)
      )
      setError('Failed to update note')
    } finally {
      setIsSaving(false)
    }
  }

  // Delete note with optimistic updates
  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
      return
    }

    const noteToDelete = notes.find(note => note.id === noteId)
    if (!noteToDelete) return

    try {
      setIsSaving(true)
      setError(null)

      // Optimistic update - remove immediately
      setNotes(prevNotes => prevNotes.filter(note => note.id !== noteId))

      const result = await notesService.deleteNote(noteId)

      if (result.success) {
        setSuccessMessage('Note deleted successfully')
        setTimeout(() => setSuccessMessage(null), 3000)
        onNotesChanged?.()
      } else {
        // Restore note if deletion failed
        setNotes(prevNotes => [...prevNotes, noteToDelete].sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ))
        setError(result.error || 'Failed to delete note')
      }
    } catch (err) {
      console.error('Error deleting note:', err)
      // Restore note on error
      setNotes(prevNotes => [...prevNotes, noteToDelete].sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ))
      setError('Failed to delete note')
    } finally {
      setIsSaving(false)
    }
  }

  // Start editing a note (full edit mode)
  const handleEditNote = (note: Note) => {
    setEditingNoteId(note.id)
    setEditingContent(note.content)
    setInlineEditId(null) // Close any inline editing
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 100)
  }

  // Start inline editing (quick edit)
  const handleInlineEdit = (note: Note) => {
    setInlineEditId(note.id)
    setInlineContent(note.content)
    setEditingNoteId(null) // Close any full editing
    setTimeout(() => {
      inlineTextareaRef.current?.focus()
    }, 100)
  }

  // Save inline edit
  const handleSaveInlineEdit = () => {
    if (inlineEditId && inlineContent.trim()) {
      handleUpdateNote(inlineEditId, inlineContent)
    }
  }

  // Cancel inline edit
  const handleCancelInlineEdit = () => {
    setInlineEditId(null)
    setInlineContent('')
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
    setIsEditing(false)
    setEditingNoteId(null)
    setNewNoteContent('')
    setEditingContent('')
    setError(null)
  }

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>, isEditing: boolean = false) => {
    const target = e.target
    if (isEditing) {
      setEditingContent(target.value)
    } else {
      setNewNoteContent(target.value)
    }

    // Auto-resize
    target.style.height = 'auto'
    target.style.height = `${target.scrollHeight}px`
  }

  // Set up cross-device notes loading and real-time subscription
  useEffect(() => {
    console.log('🔄 CallNotes: Setting up cross-device sync for callId:', callId)

    // Load any existing draft
    const existingDraft = localStorage.getItem(`draft_call_${callId}`)
    if (existingDraft) {
      setNewNoteContent(existingDraft)
      setAutoSaveDraft(existingDraft)
    }

    // Subscribe to cross-device real-time updates
    const subscribeToUpdates = async () => {
      try {
        await notesService.subscribeToNotes(callId, 'call', (updatedNotes) => {
          console.log('📱 CallNotes: Cross-device update received:', updatedNotes.length)
          setNotes(updatedNotes)
          setIsLoading(false)
        })
      } catch (error) {
        console.warn('⚠️ CallNotes: Cross-device subscription failed:', error)
        // Fallback to manual load
        loadNotes()
      }
    }

    subscribeToUpdates()

    return () => {
      console.log('🧹 CallNotes: Cleaning up cross-device sync for callId:', callId)
      notesService.unsubscribeFromNotes(callId, 'call')
    }
  }, [callId, loadNotes])

  // Clear error and success messages when user starts typing
  useEffect(() => {
    if (newNoteContent || editingContent) {
      setError(null)
      setSuccessMessage(null)
    }
  }, [newNoteContent, editingContent])

  // Show loading only when we have no notes and are actually loading
  const showLoadingSpinner = isLoading && notes.length === 0

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <StickyNoteIcon className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Call Notes</h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">({notes.length})</span>
          {isLoading && notes.length > 0 && (
            <LoaderIcon className="w-4 h-4 text-blue-600 animate-spin ml-1" />
          )}
          {showAutoSave && (
            <span className="text-xs text-green-600 ml-2">Draft saved</span>
          )}
        </div>

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

      {/* Notes List */}
      {notes.length > 0 && (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="bg-white dark:bg-gray-800 rounded-lg border p-4">
              {editingNoteId === note.id ? (
                // Full edit mode
                <div className="space-y-3">
                  <textarea
                    ref={textareaRef}
                    value={editingContent}
                    onChange={(e) => handleTextareaChange(e, true)}
                    className="w-full min-h-[80px] p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    disabled={isSaving}
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={handleCancel}
                      className="px-3 py-1 text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-600 rounded hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                      disabled={isSaving}
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleUpdateNote(note.id, editingContent)}
                      disabled={isSaving || !editingContent.trim()}
                      className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSaving ? (
                        <LoaderIcon className="w-4 h-4 animate-spin" />
                      ) : (
                        <SaveIcon className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ) : inlineEditId === note.id ? (
                // Inline edit mode
                <div className="space-y-3">
                  <textarea
                    ref={inlineTextareaRef}
                    value={inlineContent}
                    onChange={(e) => {
                      setInlineContent(e.target.value)
                      // Auto-resize
                      e.target.style.height = 'auto'
                      e.target.style.height = `${e.target.scrollHeight}px`
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        handleSaveInlineEdit()
                      } else if (e.key === 'Escape') {
                        handleCancelInlineEdit()
                      }
                    }}
                    className="w-full min-h-[60px] p-2 border border-blue-300 dark:border-blue-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    disabled={isSaving}
                    placeholder="Ctrl+Enter to save, Esc to cancel"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={handleCancelInlineEdit}
                      className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-600 rounded hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                      disabled={isSaving}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveInlineEdit}
                      disabled={isSaving || !inlineContent.trim()}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSaving ? (
                        <LoaderIcon className="w-3 h-3 animate-spin" />
                      ) : (
                        <SaveIcon className="w-3 h-3" />
                      )}
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                // Display mode
                <div>
                  <div
                    className="whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed mb-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded transition-colors"
                    onClick={() => !isReadonly && handleInlineEdit(note)}
                    title={!isReadonly ? "Click to edit quickly" : ""}
                  >
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
                          onClick={() => handleEditNote(note)}
                          className="p-1 text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                          title="Full edit mode"
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
          ))}
        </div>
      )}

      {/* Add New Note Editor */}
      {isEditing && (
        <div className="space-y-3">
          <textarea
            ref={textareaRef}
            value={newNoteContent}
            onChange={(e) => handleTextareaChange(e, false)}
            placeholder="Add your notes about this call..."
            className="w-full min-h-[120px] p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            disabled={isSaving}
          />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
              disabled={isSaving}
            >
              <XIcon className="w-4 h-4" />
            </button>
            <button
              onClick={handleAddNote}
              disabled={isSaving || !newNoteContent.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <LoaderIcon className="w-4 h-4 animate-spin" />
              ) : (
                <SaveIcon className="w-4 h-4" />
              )}
              {isSaving ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        </div>
      )}

      {/* Loading State for Initial Load */}
      {showLoadingSpinner && (
        <div className="flex items-center justify-center py-8">
          <LoaderIcon className="w-6 h-6 text-blue-600 animate-spin mr-2" />
          <span className="text-gray-600 dark:text-gray-400">Loading notes...</span>
        </div>
      )}

      {/* Empty State */}
      {notes.length === 0 && !isEditing && !showLoadingSpinner && (
        <div className="text-center py-8">
          <StickyNoteIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">No notes for this call yet.</p>
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