import React, { useState, useEffect, useRef } from 'react'
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

interface ChatNotesProps {
  chatId: string
  isReadonly?: boolean
  onNotesChanged?: () => void
}

export const ChatNotes: React.FC<ChatNotesProps> = ({ chatId, isReadonly = false, onNotesChanged }) => {
  const [notes, setNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [newNoteContent, setNewNoteContent] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load notes
  const loadNotes = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const result = await notesService.getNotes(chatId, 'sms')
      if (result.success && result.notes) {
        setNotes(result.notes)
      } else {
        setError(result.error || 'Failed to load notes')
      }
    } catch (err) {
      console.error('Error loading notes:', err)
      setError('Failed to load notes')
    } finally {
      setIsLoading(false)
    }
  }

  // Save new note
  const handleAddNote = async () => {
    if (!newNoteContent.trim()) {
      setError('Note content cannot be empty')
      return
    }

    try {
      setIsSaving(true)
      setError(null)

      const result = await notesService.createNote({
        reference_id: chatId,
        reference_type: 'sms',
        content: newNoteContent.trim(),
        content_type: 'plain'
      })

      if (result.success) {
        // Immediately add the new note to local state for instant UI update
        if (result.note) {
          setNotes(prevNotes => [...prevNotes, result.note!])
        }
        setNewNoteContent('')
        setIsEditing(false)
        setSuccessMessage('Note added successfully')
        setTimeout(() => setSuccessMessage(null), 3000)
        // Notify parent that notes changed
        console.log('ChatNotes: Note added - notifying parent for chatId:', chatId)
        onNotesChanged?.()
      } else {
        setError(result.error || 'Failed to save note')
      }
    } catch (err) {
      console.error('Error saving note:', err)
      setError('Failed to save note')
    } finally {
      setIsSaving(false)
    }
  }

  // Update existing note
  const handleUpdateNote = async () => {
    if (!editingNoteId || !editingContent.trim()) {
      setError('Note content cannot be empty')
      return
    }

    try {
      setIsSaving(true)
      setError(null)

      const result = await notesService.updateNote(editingNoteId, {
        content: editingContent.trim(),
        content_type: 'plain'
      })

      if (result.success) {
        // Immediately update the note in local state for instant UI update
        if (result.note) {
          setNotes(prevNotes =>
            prevNotes.map(note =>
              note.id === editingNoteId ? result.note! : note
            )
          )
        }
        setEditingNoteId(null)
        setEditingContent('')
        setSuccessMessage('Note updated successfully')
        setTimeout(() => setSuccessMessage(null), 3000)
        // Notify parent that notes changed
        onNotesChanged?.()
      } else {
        setError(result.error || 'Failed to update note')
      }
    } catch (err) {
      console.error('Error updating note:', err)
      setError('Failed to update note')
    } finally {
      setIsSaving(false)
    }
  }

  // Delete note
  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
      return
    }

    try {
      setIsSaving(true)
      setError(null)

      // Immediately remove the note from local state for instant UI update
      setNotes(prevNotes => prevNotes.filter(note => note.id !== noteId))

      const result = await notesService.deleteNote(noteId)

      if (result.success) {
        setSuccessMessage('Note deleted successfully')
        setTimeout(() => setSuccessMessage(null), 3000)
        // Notify parent that notes changed
        console.log('ChatNotes: Note deleted - notifying parent for chatId:', chatId)
        onNotesChanged?.()
      } else {
        // If deletion failed, restore the note to local state
        const noteToRestore = notes.find(note => note.id === noteId)
        if (noteToRestore) {
          setNotes(prevNotes => [...prevNotes, noteToRestore].sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          ))
        }
        setError(result.error || 'Failed to delete note')
      }
    } catch (err) {
      console.error('Error deleting note:', err)
      // If error occurred, restore the note to local state
      const noteToRestore = notes.find(note => note.id === noteId)
      if (noteToRestore) {
        setNotes(prevNotes => [...prevNotes, noteToRestore].sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ))
      }
      setError('Failed to delete note')
    } finally {
      setIsSaving(false)
    }
  }

  // Start editing a note
  const handleEditNote = (note: Note) => {
    setEditingNoteId(note.id)
    setEditingContent(note.content)
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

  // Set up notes loading and real-time subscription
  useEffect(() => {
    loadNotes()

    // Subscribe to real-time updates
    const subscribeToUpdates = async () => {
      await notesService.subscribeToNotes(chatId, 'sms', (updatedNotes) => {
        setNotes(updatedNotes)
      })
    }

    subscribeToUpdates()

    return () => {
      notesService.unsubscribeFromNotes(chatId, 'sms')
    }
  }, [chatId])

  // Clear error and success messages when user starts typing
  useEffect(() => {
    if (newNoteContent || editingContent) {
      setError(null)
      setSuccessMessage(null)
    }
  }, [newNoteContent, editingContent])

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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Chat Notes</h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">({notes.length})</span>
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
                      onClick={handleUpdateNote}
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
                          onClick={() => handleEditNote(note)}
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
            placeholder="Add your notes about this chat conversation..."
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