/**
 * Notes Service for Cross-Device Note Management
 *
 * Handles CRUD operations for call and SMS notes with real-time synchronization,
 * user tracking, and edit history. Supports rich text content with fallback to plain text.
 */

import { supabase } from '@/config/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'
import { userIdTranslationService } from './userIdTranslationService'

export interface Note {
  id: string
  reference_id: string // call_id or chat_id from Retell AI
  reference_type: 'call' | 'sms'
  content: string
  content_type: 'plain' | 'html' | 'markdown'
  created_by: string | null
  created_by_name: string
  created_by_email?: string
  created_at: string
  updated_at: string
  is_edited: boolean
  last_edited_by?: string | null
  last_edited_by_name?: string
  last_edited_at?: string
  metadata?: Record<string, any>
}

export interface CreateNoteData {
  reference_id: string
  reference_type: 'call' | 'sms'
  content: string
  content_type?: 'plain' | 'html' | 'markdown'
  metadata?: Record<string, any>
}

export interface UpdateNoteData {
  content: string
  content_type?: 'plain' | 'html' | 'markdown'
  metadata?: Record<string, any>
}

export type NotesSubscriptionCallback = (notes: Note[]) => void

class NotesService {
  private subscriptions: Map<string, RealtimeChannel> = new Map()
  private callbacks: Map<string, NotesSubscriptionCallback> = new Map()
  private isSupabaseAvailable: boolean = true
  // Remove connection testing entirely for faster operation
  constructor() {
    // Start with Supabase available by default for fast path
    this.isSupabaseAvailable = true
  }

  /**
   * Fast connection check without blocking operations
   */
  private async quickConnectionCheck(): Promise<boolean> {
    if (!this.isSupabaseAvailable) {
      return false
    }

    try {
      // Quick test with very short timeout
      const testPromise = supabase.from('notes').select('id').limit(1).maybeSingle()
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Quick test timeout')), 1500)
      )

      const { error } = await Promise.race([testPromise, timeoutPromise]) as any

      if (error) {
        this.isSupabaseAvailable = false
        console.log('🔌 Supabase connection test failed, switching to localStorage mode')
        return false
      }

      return true
    } catch (error) {
      this.isSupabaseAvailable = false
      console.log('🔌 Supabase connection failed, switching to localStorage mode')
      return false
    }
  }

  /**
   * LocalStorage fallback methods for when Supabase is not available
   */
  private getLocalStorageKey(referenceId: string, referenceType: 'call' | 'sms'): string {
    return `notes_${referenceType}_${referenceId}`
  }

  private saveNotesToLocalStorage(referenceId: string, referenceType: 'call' | 'sms', notes: Note[]): void {
    try {
      const key = this.getLocalStorageKey(referenceId, referenceType)
      // Sort notes before saving for consistent ordering
      const sortedNotes = notes.sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      localStorage.setItem(key, JSON.stringify(sortedNotes))

      // Update the cache timestamp
      const cacheInfo = {
        timestamp: Date.now(),
        count: sortedNotes.length
      }
      localStorage.setItem(`${key}_cache_info`, JSON.stringify(cacheInfo))

      console.log(`💾 Saved ${sortedNotes.length} notes to localStorage for ${referenceType}:${referenceId}`)
    } catch (error) {
      console.error('Failed to save notes to localStorage:', error)
    }
  }

  private getNotesFromLocalStorage(referenceId: string, referenceType: 'call' | 'sms'): Note[] {
    try {
      const key = this.getLocalStorageKey(referenceId, referenceType)
      const stored = localStorage.getItem(key)
      const notes = stored ? JSON.parse(stored) : []

      // Sort notes by creation date for consistent ordering
      return notes.sort((a: Note, b: Note) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    } catch (error) {
      console.error('Failed to load notes from localStorage:', error)
      return []
    }
  }

  private generateLocalNoteId(): string {
    return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get current user information for note attribution
   */
  private async getCurrentUserInfo() {
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')

      let user = null
      try {
        // Try to get user from Supabase auth, but don't fail if it's not available
        const { data } = await supabase.auth.getUser()
        user = data?.user
      } catch (authError) {
        console.log('Supabase auth not available, using localStorage user info')
        // Gracefully continue with just localStorage info
      }

      // Get the string ID first
      const stringId = user?.id || currentUser.id

      // Convert to UUID for database storage, with fallback handling
      let uuid = null
      try {
        uuid = await userIdTranslationService.stringToUuid(stringId)
      } catch (translationError) {
        console.log('User ID translation failed, using fallback')
        // Use a deterministic fallback if translation service fails
        uuid = stringId || 'anonymous-user'
      }

      console.log('User ID translation:', { originalId: stringId, convertedUuid: uuid })

      return {
        id: uuid,
        name: currentUser.full_name || currentUser.name || user?.user_metadata?.full_name || 'Anonymous User',
        email: user?.email || currentUser.email
      }
    } catch (error) {
      console.error('Error getting current user info:', error)
      // Return a more robust fallback
      return {
        id: 'anonymous-user',
        name: 'Anonymous User',
        email: undefined
      }
    }
  }

  /**
   * Create a new note
   */
  async createNote(data: CreateNoteData): Promise<{ success: boolean; note?: Note; error?: string }> {
    try {
      const userInfo = await this.getCurrentUserInfo()

      const noteData = {
        reference_id: data.reference_id,
        reference_type: data.reference_type,
        content: data.content,
        content_type: data.content_type || 'plain',
        created_by: userInfo.id,
        created_by_name: userInfo.name,
        created_by_email: userInfo.email,
        metadata: data.metadata || {}
      }

      // Fast path: Try Supabase directly without connection test
      try {
        console.log('✨ Fast path: Creating note with Supabase:', noteData)

        // Optimistic UI approach: save to localStorage first, then sync to Supabase
        const localNote = await this.createNoteLocalStorage(data, userInfo)
        if (!localNote.success) {
          throw new Error(localNote.error || 'Failed to create local note')
        }

        // Background sync to Supabase (no timeout, no blocking)
        this.backgroundSyncNote(localNote.note!, 'create').catch(error => {
          console.log('Background sync failed, note remains in localStorage:', error)
        })

        console.log('Note created successfully with optimistic approach')
        return { success: true, note: localNote.note }
      } catch (error) {
        console.error('Supabase connection failed during note creation, falling back to localStorage:', error)
        this.isSupabaseAvailable = false
      }

      // Use localStorage fallback
      console.log('Using localStorage for note creation')
      return this.createNoteLocalStorage(data, userInfo)

    } catch (error) {
      console.error('Error creating note, falling back to localStorage:', error)
      const userInfo = await this.getCurrentUserInfo()
      return this.createNoteLocalStorage(data, userInfo)
    }
  }

  /**
   * Background sync a note to Supabase without blocking the UI
   */
  private async backgroundSyncNote(note: Note, operation: 'create' | 'update'): Promise<void> {
    try {
      if (operation === 'create') {
        // For local notes, try to sync to Supabase
        if (note.id.startsWith('local_')) {
          const { data: supabaseNote, error } = await supabase
            .from('notes')
            .insert({
              reference_id: note.reference_id,
              reference_type: note.reference_type,
              content: note.content,
              content_type: note.content_type,
              created_by: note.created_by,
              created_by_name: note.created_by_name,
              created_by_email: note.created_by_email,
              metadata: note.metadata
            })
            .select()
            .single()

          if (!error && supabaseNote) {
            // Replace local note with Supabase note in localStorage
            const localNotes = this.getNotesFromLocalStorage(note.reference_id, note.reference_type)
            const updatedNotes = localNotes.map(n => n.id === note.id ? supabaseNote : n)
            this.saveNotesToLocalStorage(note.reference_id, note.reference_type, updatedNotes)
            console.log('Background sync successful: local note synced to Supabase')
          }
        }
      } else if (operation === 'update') {
        // For existing notes, try to update in Supabase
        if (!note.id.startsWith('local_')) {
          await supabase
            .from('notes')
            .update({
              content: note.content,
              content_type: note.content_type,
              last_edited_by: note.last_edited_by,
              last_edited_by_name: note.last_edited_by_name,
              last_edited_at: note.last_edited_at,
              metadata: note.metadata
            })
            .eq('id', note.id)

          console.log('Background sync successful: note updated in Supabase')
        }
      }
    } catch (error) {
      console.log('Background sync failed (note remains local):', error)
    }
  }

  /**
   * Merge notes from Supabase and localStorage, preferring Supabase data
   */
  private mergeNotesPreferringSupabase(supabaseNotes: Note[], localNotes: Note[]): Note[] {
    const merged = [...supabaseNotes]
    const supabaseIds = new Set(supabaseNotes.map(n => n.id))

    // Add local-only notes (ones that haven't been synced yet)
    localNotes.forEach(localNote => {
      if (!supabaseIds.has(localNote.id)) {
        merged.push(localNote)
      }
    })

    // Sort by creation date
    return merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }

  /**
   * Create note using localStorage fallback
   */
  private async createNoteLocalStorage(data: CreateNoteData, userInfo: any): Promise<{ success: boolean; note?: Note; error?: string }> {
    try {
      const note: Note = {
        id: this.generateLocalNoteId(),
        reference_id: data.reference_id,
        reference_type: data.reference_type,
        content: data.content,
        content_type: data.content_type || 'plain',
        created_by: userInfo.id,
        created_by_name: userInfo.name,
        created_by_email: userInfo.email,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_edited: false,
        metadata: data.metadata || {}
      }

      // Get existing notes and add the new one
      const existingNotes = this.getNotesFromLocalStorage(data.reference_id, data.reference_type)
      const updatedNotes = [...existingNotes, note]
      this.saveNotesToLocalStorage(data.reference_id, data.reference_type, updatedNotes)

      console.log('Note created successfully in localStorage:', note)
      return { success: true, note }
    } catch (error) {
      console.error('Error creating note in localStorage:', error)
      return { success: false, error: 'Failed to save note locally' }
    }
  }

  /**
   * Update note using localStorage fallback
   */
  private async updateNoteLocalStorage(noteId: string, data: UpdateNoteData, userInfo: any): Promise<{ success: boolean; note?: Note; error?: string }> {
    try {
      // Find the note across all localStorage entries
      const localStorage = window.localStorage
      const keys = Object.keys(localStorage).filter(key => key.startsWith('notes_'))

      for (const key of keys) {
        try {
          const notes: Note[] = JSON.parse(localStorage.getItem(key) || '[]')
          const noteIndex = notes.findIndex(note => note.id === noteId)

          if (noteIndex !== -1) {
            // Update the note
            const updatedNote: Note = {
              ...notes[noteIndex],
              content: data.content,
              content_type: data.content_type || notes[noteIndex].content_type,
              last_edited_by: userInfo.id,
              last_edited_by_name: userInfo.name,
              last_edited_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              is_edited: true,
              metadata: { ...notes[noteIndex].metadata, ...data.metadata }
            }

            notes[noteIndex] = updatedNote
            localStorage.setItem(key, JSON.stringify(notes))

            console.log('Note updated successfully in localStorage:', updatedNote)
            return { success: true, note: updatedNote }
          }
        } catch (parseError) {
          console.error('Error parsing localStorage notes for key:', key, parseError)
        }
      }

      return { success: false, error: 'Note not found in localStorage' }
    } catch (error) {
      console.error('Error updating note in localStorage:', error)
      return { success: false, error: 'Failed to update note locally' }
    }
  }

  /**
   * Delete note using localStorage fallback
   */
  private deleteNoteLocalStorage(noteId: string): { success: boolean; error?: string } {
    try {
      // Find the note across all localStorage entries
      const localStorage = window.localStorage
      const keys = Object.keys(localStorage).filter(key => key.startsWith('notes_'))

      for (const key of keys) {
        try {
          const notes: Note[] = JSON.parse(localStorage.getItem(key) || '[]')
          const noteIndex = notes.findIndex(note => note.id === noteId)

          if (noteIndex !== -1) {
            // Remove the note
            notes.splice(noteIndex, 1)
            localStorage.setItem(key, JSON.stringify(notes))

            console.log('Note deleted successfully from localStorage:', noteId)
            return { success: true }
          }
        } catch (parseError) {
          console.error('Error parsing localStorage notes for key:', key, parseError)
        }
      }

      return { success: false, error: 'Note not found in localStorage' }
    } catch (error) {
      console.error('Error deleting note from localStorage:', error)
      return { success: false, error: 'Failed to delete note locally' }
    }
  }

  /**
   * Update an existing note
   */
  async updateNote(noteId: string, data: UpdateNoteData): Promise<{ success: boolean; note?: Note; error?: string }> {
    try {
      const userInfo = await this.getCurrentUserInfo()

      const updateData = {
        content: data.content,
        content_type: data.content_type,
        last_edited_by: userInfo.id, // This is already converted to UUID in getCurrentUserInfo
        last_edited_by_name: userInfo.name,
        last_edited_at: new Date().toISOString(),
        metadata: data.metadata
      }

      console.log('Updating note:', noteId, updateData)

      // Try Supabase first with timeout
      try {
        // Optimistic UI approach: update localStorage first, then sync to Supabase
        const localNote = await this.updateNoteLocalStorage(noteId, data, userInfo)
        if (!localNote.success) {
          throw new Error(localNote.error || 'Failed to update local note')
        }

        // Background sync to Supabase (no timeout, no blocking)
        this.backgroundSyncNote(localNote.note!, 'update').catch(error => {
          console.log('Background sync failed, note remains in localStorage:', error)
        })

        console.log('Note updated successfully with optimistic approach')
        return { success: true, note: localNote.note }
      } catch (error) {
        console.error('Supabase connection failed during note update, falling back to localStorage:', error)
        this.isSupabaseAvailable = false
      }

      // Use localStorage fallback
      console.log('Using localStorage for note update')
      return this.updateNoteLocalStorage(noteId, data, userInfo)
    } catch (error) {
      console.error('Error updating note, falling back to localStorage:', error)
      const userInfo = await this.getCurrentUserInfo()
      return this.updateNoteLocalStorage(noteId, data, userInfo)
    }
  }

  /**
   * Delete a note
   */
  async deleteNote(noteId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Deleting note:', noteId)

      // Try Supabase first (fast path - no connection test)
      try {
        const { error } = await supabase
          .from('notes')
          .delete()
          .eq('id', noteId)

        if (!error) {
          console.log('Note deleted successfully from Supabase')
          this.isSupabaseAvailable = true
          return { success: true }
        }

        // If Supabase fails, fall back to localStorage
        console.error('Supabase error deleting note, falling back to localStorage:', error)
        this.isSupabaseAvailable = false
      } catch (error) {
        console.error('Supabase connection failed, falling back to localStorage:', error)
        this.isSupabaseAvailable = false
      }

      // Use localStorage fallback
      console.log('Using localStorage for note deletion')
      return this.deleteNoteLocalStorage(noteId)
    } catch (error) {
      console.error('Error deleting note, falling back to localStorage:', error)
      return this.deleteNoteLocalStorage(noteId)
    }
  }

  /**
   * Get all notes for a specific call or SMS
   */
  async getNotes(referenceId: string, referenceType: 'call' | 'sms'): Promise<{ success: boolean; notes?: Note[]; error?: string }> {
    try {
      console.log('Fetching notes for:', referenceType, referenceId)

      // Try Supabase first with timeout
      try {
        // Try Supabase with reasonable timeout, but no user-facing errors
        const fetchPromise = supabase
          .from('notes')
          .select('*')
          .eq('reference_id', referenceId)
          .eq('reference_type', referenceType)
          .order('created_at', { ascending: true })

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Internal timeout')), 10000)
        )

        const { data: notes, error } = await Promise.race([fetchPromise, timeoutPromise]) as any

        if (!error && notes) {
          console.log('Notes fetched successfully from Supabase:', notes.length)
          this.isSupabaseAvailable = true
          // Merge with localStorage to ensure no data loss
          const localNotes = this.getNotesFromLocalStorage(referenceId, referenceType)
          const mergedNotes = this.mergeNotesPreferringSupabase(notes, localNotes)
          return { success: true, notes: mergedNotes }
        }

        // If Supabase fails, use localStorage without showing errors
        console.log('Supabase fetch failed, using localStorage data')
        this.isSupabaseAvailable = false
      } catch (error) {
        console.error('Supabase connection failed, falling back to localStorage:', error)
        this.isSupabaseAvailable = false
      }

      // Use localStorage fallback
      console.log('Using localStorage for notes retrieval')
      const localNotes = this.getNotesFromLocalStorage(referenceId, referenceType)
      console.log('Notes fetched successfully from localStorage:', localNotes.length)
      return { success: true, notes: localNotes }

    } catch (error) {
      console.error('Error fetching notes, falling back to localStorage:', error)
      // Gracefully handle all connection failures - return localStorage notes
      const localNotes = this.getNotesFromLocalStorage(referenceId, referenceType)
      console.log('Connection error, returning localStorage notes to prevent UI breakage')
      return { success: true, notes: localNotes }
    }
  }

  /**
   * Subscribe to real-time updates for notes of a specific reference
   */
  async subscribeToNotes(
    referenceId: string,
    referenceType: 'call' | 'sms',
    callback: NotesSubscriptionCallback
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const subscriptionKey = `${referenceType}_${referenceId}`

      // Clean up existing subscription if any
      await this.unsubscribeFromNotes(referenceId, referenceType)

      // Store callback for localStorage updates
      this.callbacks.set(subscriptionKey, callback)

      // Set up real-time subscription if Supabase is available
      if (await this.quickConnectionCheck()) {
        console.log('Setting up real-time subscription for notes:', subscriptionKey)

        const channel = supabase
          .channel(`notes_${subscriptionKey}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'notes',
              filter: `reference_id=eq.${referenceId},reference_type=eq.${referenceType}`
            },
            async (payload) => {
              console.log('Real-time note update received:', payload)

              // Fetch all notes for this reference to ensure consistency
              const result = await this.getNotes(referenceId, referenceType)
              if (result.success && result.notes) {
                callback(result.notes)
              }
            }
          )
          .subscribe((status) => {
            console.log('Notes subscription status:', status)
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.log('Notes realtime subscription failed - continuing with localStorage only')
            }
          })

        this.subscriptions.set(subscriptionKey, channel)
      } else {
        console.log('Supabase not available - using localStorage mode only for notes')
      }

      // Initial fetch (works with both Supabase and localStorage)
      const result = await this.getNotes(referenceId, referenceType)
      if (result.success && result.notes) {
        callback(result.notes)
      }

      return { success: true }
    } catch (error) {
      console.error('Error setting up notes subscription:', error)
      // Gracefully handle connection failures - still do initial fetch
      const result = await this.getNotes(referenceId, referenceType)
      if (result.success && result.notes) {
        callback(result.notes)
      }
      return { success: false, error: error instanceof Error ? error.message : 'Subscription unavailable' }
    }
  }

  /**
   * Unsubscribe from real-time updates
   */
  async unsubscribeFromNotes(referenceId: string, referenceType: 'call' | 'sms'): Promise<void> {
    const subscriptionKey = `${referenceType}_${referenceId}`

    const channel = this.subscriptions.get(subscriptionKey)
    if (channel) {
      console.log('Unsubscribing from notes:', subscriptionKey)
      await supabase.removeChannel(channel)
      this.subscriptions.delete(subscriptionKey)
      this.callbacks.delete(subscriptionKey)
    }
  }

  /**
   * Clean up all subscriptions (call on component unmount)
   */
  async cleanupAllSubscriptions(): Promise<void> {
    console.log('Cleaning up all notes subscriptions')

    for (const [key, channel] of this.subscriptions) {
      await supabase.removeChannel(channel)
    }

    this.subscriptions.clear()
    this.callbacks.clear()
  }

  /**
   * Format note content for display (handle rich text)
   */
  formatNoteContent(note: Note): string {
    switch (note.content_type) {
      case 'html':
        // For HTML content, you might want to sanitize it
        return note.content
      case 'markdown':
        // For markdown, you'd need a markdown parser
        return note.content
      case 'plain':
      default:
        return note.content
    }
  }

  /**
   * Get user display name with fallback
   */
  getUserDisplayName(note: Note, isCreator: boolean = true): string {
    if (isCreator) {
      return note.created_by_name || 'Anonymous User'
    } else {
      return note.last_edited_by_name || 'Anonymous User'
    }
  }

  /**
   * Format timestamp for display
   */
  formatTimestamp(timestamp: string): string {
    try {
      const date = new Date(timestamp)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffHours = diffMs / (1000 * 60 * 60)
      const diffDays = diffMs / (1000 * 60 * 60 * 24)

      if (diffHours < 1) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60))
        return diffMinutes < 1 ? 'Just now' : `${diffMinutes}m ago`
      } else if (diffHours < 24) {
        return `${Math.floor(diffHours)}h ago`
      } else if (diffDays < 7) {
        return `${Math.floor(diffDays)}d ago`
      } else {
        return date.toLocaleDateString()
      }
    } catch (error) {
      return 'Unknown time'
    }
  }

  /**
   * Check if a specific record has notes
   */
  async hasNotes(referenceId: string, referenceType: 'call' | 'sms'): Promise<boolean> {
    try {
      const { count, error } = await supabase
        .from('notes')
        .select('id', { count: 'exact', head: true })
        .eq('reference_id', referenceId)
        .eq('reference_type', referenceType)

      if (error) {
        console.error('Error checking for notes:', error)
        return false
      }

      return (count || 0) > 0
    } catch (error) {
      console.error('Error checking for notes:', error)
      return false
    }
  }

  /**
   * Sync localStorage notes to Supabase when connection becomes available
   */
  async syncLocalNotesToSupabase(): Promise<{ success: boolean; syncedCount: number; error?: string }> {
    try {
      if (!this.isSupabaseAvailable || !(await this.quickConnectionCheck())) {
        return { success: false, syncedCount: 0, error: 'Supabase not available' }
      }

      let syncedCount = 0
      const localStorage = window.localStorage
      const keys = Object.keys(localStorage).filter(key => key.startsWith('notes_'))

      for (const key of keys) {
        try {
          const notes: Note[] = JSON.parse(localStorage.getItem(key) || '[]')
          const localNotes = notes.filter(note => note.id.startsWith('local_'))

          for (const note of localNotes) {
            // Try to create the note in Supabase
            const { data: createdNote, error } = await supabase
              .from('notes')
              .insert({
                reference_id: note.reference_id,
                reference_type: note.reference_type,
                content: note.content,
                content_type: note.content_type,
                created_by: note.created_by,
                created_by_name: note.created_by_name,
                created_by_email: note.created_by_email,
                metadata: note.metadata
              })
              .select()
              .single()

            if (!error && createdNote) {
              // Remove the local note and replace with Supabase note
              const updatedNotes = notes.filter(n => n.id !== note.id).concat([createdNote])
              this.saveNotesToLocalStorage(note.reference_id, note.reference_type, updatedNotes)
              syncedCount++
              console.log('Synced local note to Supabase:', note.id, '->', createdNote.id)
            }
          }
        } catch (error) {
          console.error('Error syncing notes for key:', key, error)
        }
      }

      console.log(`Successfully synced ${syncedCount} local notes to Supabase`)
      return { success: true, syncedCount }
    } catch (error) {
      console.error('Error syncing local notes to Supabase:', error)
      return { success: false, syncedCount: 0, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Get notes count for multiple records (batch operation for lists)
   */
  async getNotesCount(referenceIds: string[], referenceType: 'call' | 'sms'): Promise<Record<string, number>> {
    try {
      if (referenceIds.length === 0) {
        return {}
      }

      console.log('Fetching notes count for:', referenceType, referenceIds.length, 'records')

      const { data, error } = await supabase
        .from('notes')
        .select('reference_id, id')
        .eq('reference_type', referenceType)
        .in('reference_id', referenceIds)

      if (error) {
        console.error('Error fetching notes count:', error)
        return {}
      }

      // Count notes per reference_id
      const counts: Record<string, number> = {}
      data?.forEach(note => {
        counts[note.reference_id] = (counts[note.reference_id] || 0) + 1
      })

      console.log('Notes count fetched:', Object.keys(counts).length, 'records with notes')
      return counts
    } catch (error) {
      console.error('Error fetching notes count:', error)
      return {}
    }
  }
}

// Export singleton instance
export const notesService = new NotesService()
export default notesService