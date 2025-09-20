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

  /**
   * Get current user information for note attribution
   */
  private async getCurrentUserInfo() {
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
      const { data: { user } } = await supabase.auth.getUser()

      // Get the string ID first
      const stringId = user?.id || currentUser.id

      // Convert to UUID for database storage
      const uuid = await userIdTranslationService.stringToUuid(stringId)

      console.log('User ID translation:', { originalId: stringId, convertedUuid: uuid })

      return {
        id: uuid,
        name: currentUser.full_name || currentUser.name || user?.user_metadata?.full_name || 'Anonymous User',
        email: user?.email || currentUser.email
      }
    } catch (error) {
      console.error('Error getting current user info:', error)
      return {
        id: null,
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

      console.log('Creating note with UUID user_id:', noteData)

      const { data: note, error } = await supabase
        .from('notes')
        .insert(noteData)
        .select()
        .single()

      if (error) {
        console.error('Supabase error creating note:', error)
        return { success: false, error: error.message }
      }

      console.log('Note created successfully:', note)
      return { success: true, note }
    } catch (error) {
      console.error('Error creating note:', error)
      // Gracefully handle connection failures
      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        return { success: false, error: 'Notes service unavailable - Supabase not connected' }
      }
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
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

      const { data: note, error } = await supabase
        .from('notes')
        .update(updateData)
        .eq('id', noteId)
        .select()
        .single()

      if (error) {
        console.error('Supabase error updating note:', error)
        return { success: false, error: error.message }
      }

      console.log('Note updated successfully:', note)
      return { success: true, note }
    } catch (error) {
      console.error('Error updating note:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Delete a note
   */
  async deleteNote(noteId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Deleting note:', noteId)

      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId)

      if (error) {
        console.error('Supabase error deleting note:', error)
        return { success: false, error: error.message }
      }

      console.log('Note deleted successfully')
      return { success: true }
    } catch (error) {
      console.error('Error deleting note:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Get all notes for a specific call or SMS
   */
  async getNotes(referenceId: string, referenceType: 'call' | 'sms'): Promise<{ success: boolean; notes?: Note[]; error?: string }> {
    try {
      console.log('Fetching notes for:', referenceType, referenceId)

      const { data: notes, error } = await supabase
        .from('notes')
        .select('*')
        .eq('reference_id', referenceId)
        .eq('reference_type', referenceType)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Supabase error fetching notes:', error)
        return { success: false, error: error.message }
      }

      console.log('Notes fetched successfully:', notes?.length || 0)
      return { success: true, notes: notes || [] }
    } catch (error) {
      console.error('Error fetching notes:', error)
      // Gracefully handle connection failures - return empty notes array
      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        console.log('Supabase not available, returning empty notes')
        return { success: true, notes: [] }
      }
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
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
        })

      this.subscriptions.set(subscriptionKey, channel)
      this.callbacks.set(subscriptionKey, callback)

      // Initial fetch
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