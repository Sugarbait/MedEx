import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  StickyNoteIcon,
  PlusIcon,
  SaveIcon,
  XIcon,
  PinIcon,
  TrashIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  LoaderIcon,
  EditIcon,
  TagIcon,
  WifiOffIcon
} from 'lucide-react'
import { CallNotesService } from '@/services/callNotesService'
import { DecryptedCallNote } from '@/types/supabase'
// Note: Removed useSupabaseAuth import as it requires AuthContext provider which isn't set up

interface CallNotesProps {
  callId: string
  isReadonly?: boolean
}

interface NoteFormData {
  content: string
  isPinned: boolean
  tags: string[]
  metadata: {
    priority?: 'low' | 'medium' | 'high'
    category?: string
    follow_up_required?: boolean
    follow_up_date?: string
  }
}

export const CallNotes: React.FC<CallNotesProps> = ({ callId, isReadonly = false }) => {
  // Get current user from localStorage (matches the app's current auth system)
  const getCurrentUser = () => {
    try {
      const userData = localStorage.getItem('currentUser')
      if (userData) {
        const user = JSON.parse(userData)
        console.log('CallNotes: Current user from localStorage:', user)
        return user
      }
      return null
    } catch (error) {
      console.error('Failed to get current user:', error)
      return null
    }
  }

  const currentUser = getCurrentUser()
  // Try different possible user ID fields for compatibility
  const supabaseUserId = currentUser?.id || currentUser?.user_id || currentUser?.email || 'anonymous_user'
  const isSupabaseAuthenticated = !!currentUser && (!!currentUser.id || !!currentUser.user_id || !!currentUser.email)
  // Service availability state (Supabase or localStorage fallback)
  const [serviceAvailable, setServiceAvailable] = useState(true)
  const [usingLocalStorage, setUsingLocalStorage] = useState(false)

  // Test service availability on mount
  useEffect(() => {
    const testService = async () => {
      try {
        // Test if the service works (either Supabase or localStorage fallback)
        const response = await CallNotesService.getNotesStats()
        setServiceAvailable(response.status === 'success')

        // Check if we're using localStorage mode by looking at console or testing Supabase directly
        const testSupabase = await fetch('http://localhost:54321/rest/v1/call_notes', {
          method: 'HEAD',
          headers: { 'apikey': 'dummy' }
        }).catch(() => null)

        setUsingLocalStorage(!testSupabase)
        console.log('CallNotes service mode:', testSupabase ? 'Supabase' : 'localStorage fallback')
      } catch (error) {
        console.warn('Service availability test failed:', error)
        setServiceAvailable(false)
        setUsingLocalStorage(true)
      }
    }
    testService()
  }, [])
  const isAzureAuthenticated = isSupabaseAuthenticated

  console.log('CallNotes Authentication Debug:', {
    currentUser,
    isSupabaseAuthenticated,
    supabaseUserId,
    hasId: !!currentUser?.id,
    userKeys: currentUser ? Object.keys(currentUser) : 'no user'
  })

  // Set current user ID in CallNotesService (replaces what useSupabaseAuth used to do)
  useEffect(() => {
    if (supabaseUserId) {
      CallNotesService.setCurrentUserId(supabaseUserId)
      console.log('CallNotes: Set current user ID in service:', supabaseUserId)
    }
  }, [supabaseUserId])

  const [note, setNote] = useState<DecryptedCallNote | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [formData, setFormData] = useState<NoteFormData>({
    content: '',
    isPinned: false,
    tags: [],
    metadata: {}
  })

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  // Load existing notes
  const loadNotes = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Check if service is available and user is available
      if (!serviceAvailable) {
        console.warn('Notes service not available')
        setError('Notes service is currently unavailable')
        setIsLoading(false)
        return
      }

      if (!isSupabaseAuthenticated || !supabaseUserId) {
        console.warn('No user ID available for loading notes', {
          isSupabaseAuthenticated,
          supabaseUserId,
          currentUser,
          hasCurrentUser: !!currentUser,
          currentUserKeys: currentUser ? Object.keys(currentUser) : 'no user'
        })
        setError('User not authenticated - please log in')
        setIsLoading(false)
        return
      }

      console.log('CallNotes: Proceeding with authenticated user:', {
        supabaseUserId,
        callId,
        isSupabaseAuthenticated
      })

      console.log('🔍 CALLING CallNotesService.getCallNotes with:', { callId, supabaseUserId })
      const response = await CallNotesService.getCallNotes(callId)
      console.log('📞 CallNotesService.getCallNotes response:', response)

      if (response.status === 'error') {
        throw new Error(response.error || 'Failed to load notes')
      }

      // Get the first note (assuming one note per call per user)
      const existingNote = response.data?.[0] || null
      setNote(existingNote)

      if (existingNote) {
        setFormData({
          content: existingNote.content,
          isPinned: existingNote.is_pinned,
          tags: existingNote.tags,
          metadata: existingNote.metadata
        })
      }
    } catch (err) {
      let errorMessage = err instanceof Error ? err.message : 'Failed to load notes'

      // Check for specific connection errors and provide user-friendly messages
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('ERR_CONNECTION_REFUSED')) {
        errorMessage = 'Notes service unavailable - database connection failed'
      } else if (errorMessage.includes('TypeError: Failed to fetch')) {
        errorMessage = 'Notes service temporarily unavailable'
      }

      console.error('❌ DETAILED CallNotes Error:', {
        error: err,
        errorMessage,
        originalError: err instanceof Error ? err.message : 'unknown',
        errorType: typeof err,
        errorConstructor: err?.constructor?.name,
        stack: err instanceof Error ? err.stack : 'no stack',
        callId,
        supabaseUserId
      })
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [callId, serviceAvailable, supabaseUserId])

  // Save note
  const handleSave = async () => {
    if (!formData.content.trim()) {
      setError('Note content cannot be empty')
      return
    }

    if (!serviceAvailable) {
      setError('Notes service not available - cannot save note')
      return
    }

    if (!isSupabaseAuthenticated || !supabaseUserId) {
      setError('User not authenticated - cannot save note')
      return
    }

    try {
      setIsSaving(true)
      setError(null)

      const response = await CallNotesService.upsertCallNote(
        callId,
        formData.content,
        {
          isPinned: formData.isPinned,
          tags: formData.tags,
          metadata: formData.metadata
        }
      )

      if (response.status === 'error') {
        throw new Error(response.error || 'Failed to save note')
      }

      setNote(response.data)
      setIsEditing(false)
      setSuccessMessage('Note saved successfully')

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      let errorMessage = err instanceof Error ? err.message : 'Failed to save note'

      // Check for specific connection errors
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('ERR_CONNECTION_REFUSED')) {
        errorMessage = 'Cannot save note - database connection failed'
      } else if (errorMessage.includes('TypeError: Failed to fetch')) {
        errorMessage = 'Cannot save note - service temporarily unavailable'
      }

      setError(errorMessage)
      console.error('Error saving note:', err)
    } finally {
      setIsSaving(false)
    }
  }

  // Delete note
  const handleDelete = async () => {
    if (!note || !window.confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
      return
    }

    try {
      setIsSaving(true)
      setError(null)

      const response = await CallNotesService.deleteCallNote(callId)

      if (response.status === 'error') {
        throw new Error(response.error || 'Failed to delete note')
      }

      setNote(null)
      setFormData({
        content: '',
        isPinned: false,
        tags: [],
        metadata: {}
      })
      setIsEditing(false)
      setSuccessMessage('Note deleted successfully')

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete note'
      setError(errorMessage)
      console.error('Error deleting note:', err)
    } finally {
      setIsSaving(false)
    }
  }

  // Toggle pin status
  const handleTogglePin = async () => {
    if (!note) return

    try {
      setError(null)

      const response = await CallNotesService.togglePinNote(callId)

      if (response.status === 'error') {
        throw new Error(response.error || 'Failed to toggle pin status')
      }

      setNote(response.data)
      setFormData(prev => ({ ...prev, isPinned: response.data.is_pinned }))
      setSuccessMessage(`Note ${response.data.is_pinned ? 'pinned' : 'unpinned'} successfully`)

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle pin status'
      setError(errorMessage)
      console.error('Error toggling pin:', err)
    }
  }

  // Start editing
  const handleStartEdit = () => {
    setIsEditing(true)
    setError(null)
    // Focus textarea after state update
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 100)
  }

  // Cancel editing
  const handleCancelEdit = () => {
    if (note) {
      setFormData({
        content: note.content,
        isPinned: note.is_pinned,
        tags: note.tags,
        metadata: note.metadata
      })
    } else {
      setFormData({
        content: '',
        isPinned: false,
        tags: [],
        metadata: {}
      })
    }
    setIsEditing(false)
    setError(null)
  }

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target
    setFormData(prev => ({ ...prev, content: target.value }))

    // Auto-resize
    target.style.height = 'auto'
    target.style.height = `${target.scrollHeight}px`
  }

  // Set up real-time subscription
  useEffect(() => {
    loadNotes()

    // Subscribe to real-time changes only if using Supabase and have user ID
    if (serviceAvailable && !usingLocalStorage && isSupabaseAuthenticated) {
      unsubscribeRef.current = CallNotesService.subscribeToCallNotes(
        callId,
        (updatedNote, eventType) => {
          if (eventType === 'DELETE') {
            setNote(null)
            setFormData({
              content: '',
              isPinned: false,
              tags: [],
              metadata: {}
            })
            setIsEditing(false)
          } else if (updatedNote) {
            setNote(updatedNote)
            if (!isEditing) {
              setFormData({
                content: updatedNote.content,
                isPinned: updatedNote.is_pinned,
                tags: updatedNote.tags,
                metadata: updatedNote.metadata
              })
            }
          }
        }
      )
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
    }
  }, [callId, loadNotes, isEditing, serviceAvailable, usingLocalStorage, isSupabaseAuthenticated])

  // Clear error and success messages when user starts typing
  useEffect(() => {
    if (formData.content !== note?.content) {
      setError(null)
      setSuccessMessage(null)
    }
  }, [formData.content, note?.content])

  if (isLoading) {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-center py-8">
          <LoaderIcon className="w-6 h-6 text-blue-600 animate-spin mr-2" />
          <span className="text-gray-600">Loading notes...</span>
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

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200'
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'low': return 'text-green-600 bg-green-50 border-green-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <StickyNoteIcon className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Call Notes</h3>
          {note?.is_pinned && (
            <PinIcon className="w-4 h-4 text-orange-500 fill-current" />
          )}
          {usingLocalStorage && (
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded-full">
              <WifiOffIcon className="w-3 h-3 text-blue-600" />
              <span className="text-xs text-blue-700">Local Mode</span>
            </div>
          )}
          {!isAzureAuthenticated && (
            <div className="flex items-center gap-1 px-2 py-1 bg-red-50 border border-red-200 rounded-full">
              <AlertCircleIcon className="w-3 h-3 text-red-600" />
              <span className="text-xs text-red-700">Not Logged In</span>
            </div>
          )}
        </div>

        {!isReadonly && (
          <div className="flex items-center gap-2">
            {note && !isEditing && (
              <>
                <button
                  onClick={handleTogglePin}
                  className={`p-2 rounded-lg transition-colors ${
                    note.is_pinned
                      ? 'text-orange-600 bg-orange-50 hover:bg-orange-100'
                      : 'text-gray-500 bg-gray-100 hover:bg-gray-200'
                  }`}
                  title={note.is_pinned ? 'Unpin note' : 'Pin note'}
                >
                  <PinIcon className={`w-4 h-4 ${note.is_pinned ? 'fill-current' : ''}`} />
                </button>
                <button
                  onClick={handleStartEdit}
                  className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  title="Edit note"
                >
                  <EditIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDelete}
                  className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                  title="Delete note"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </>
            )}

            {!note && !isEditing && (
              <button
                onClick={handleStartEdit}
                className="flex items-center gap-2 px-3 py-1 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Add Note
              </button>
            )}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircleIcon className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      {/* Service Mode Message */}
      {usingLocalStorage && !error && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
          <WifiOffIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span className="text-blue-700 text-sm">Notes are stored locally. Data will be available only on this device.</span>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <CheckCircleIcon className="w-4 h-4 text-green-600 flex-shrink-0" />
          <span className="text-green-700 text-sm">{successMessage}</span>
        </div>
      )}

      {/* Note Display */}
      {note && !isEditing && (
        <div className="space-y-3">
          <div className="bg-white rounded-lg border p-4">
            <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
              {note.content}
            </div>

            {/* Tags */}
            {note.tags.length > 0 && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                <TagIcon className="w-4 h-4 text-gray-400" />
                <div className="flex flex-wrap gap-1">
                  {note.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Priority */}
            {note.metadata.priority && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-500">Priority:</span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(note.metadata.priority)}`}>
                  {note.metadata.priority}
                </span>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="text-xs text-gray-500 space-y-1">
            <div>Created: {formatDateTime(note.created_at).date} at {formatDateTime(note.created_at).time}</div>
            {note.updated_at !== note.created_at && (
              <div>Updated: {formatDateTime(note.updated_at).date} at {formatDateTime(note.updated_at).time}</div>
            )}
          </div>
        </div>
      )}

      {/* Note Editor */}
      {isEditing && (
        <div className="space-y-4">
          <div>
            <textarea
              ref={textareaRef}
              value={formData.content}
              onChange={handleTextareaChange}
              placeholder="Add your notes about this call..."
              className="w-full min-h-[120px] p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              disabled={isSaving}
            />
          </div>

          {/* Priority Selection */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Priority:</label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as const).map((priority) => (
                <button
                  key={priority}
                  onClick={() => setFormData(prev => ({
                    ...prev,
                    metadata: { ...prev.metadata, priority }
                  }))}
                  className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                    formData.metadata.priority === priority
                      ? getPriorityColor(priority)
                      : 'text-gray-600 bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                  disabled={isSaving}
                >
                  {priority}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFormData(prev => ({ ...prev, isPinned: !prev.isPinned }))}
                className={`flex items-center gap-2 px-3 py-1 text-sm rounded-lg transition-colors ${
                  formData.isPinned
                    ? 'text-orange-600 bg-orange-50 border border-orange-200'
                    : 'text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100'
                }`}
                disabled={isSaving}
              >
                <PinIcon className={`w-4 h-4 ${formData.isPinned ? 'fill-current' : ''}`} />
                {formData.isPinned ? 'Pinned' : 'Pin note'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={isSaving}
              >
                <XIcon className="w-4 h-4" />
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !formData.content.trim()}
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
        </div>
      )}

      {/* Empty State */}
      {!note && !isEditing && (
        <div className="text-center py-8">
          <StickyNoteIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">No notes for this call yet.</p>
          {!isReadonly && (
            <button
              onClick={handleStartEdit}
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