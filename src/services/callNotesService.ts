import { supabase } from '@/config/supabase'
import { Database, ServiceResponse, DecryptedCallNote } from '@/types/supabase'
import { encryptPHI, decryptPHI } from '@/utils/encryption'

// Local storage fallback types
interface LocalStorageCallNote {
  id: string
  call_id: string
  user_id: string
  content: string
  is_pinned: boolean
  tags: string[]
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

type CallNoteRow = Database['public']['Tables']['call_notes']['Row']
type CallNoteInsert = Database['public']['Tables']['call_notes']['Insert']
type CallNoteUpdate = Database['public']['Tables']['call_notes']['Update']

/**
 * Service for managing encrypted call notes with HIPAA compliance
 * Handles CRUD operations, real-time synchronization, and audit logging
 * Includes localStorage fallback when Supabase is unavailable
 */
export class CallNotesService {
  private static readonly STORAGE_KEY = 'carexps_call_notes'
  private static isSupabaseAvailable: boolean | null = null

  /**
   * Get notes from localStorage
   */
  private static getLocalStorageNotes(): LocalStorageCallNote[] {
    try {
      const notesJson = localStorage.getItem(this.STORAGE_KEY)
      return notesJson ? JSON.parse(notesJson) : []
    } catch (error) {
      console.error('Failed to parse notes from localStorage:', error)
      return []
    }
  }

  /**
   * Save notes to localStorage
   */
  private static saveLocalStorageNotes(notes: LocalStorageCallNote[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(notes))
    } catch (error) {
      console.error('Failed to save notes to localStorage:', error)
    }
  }

  /**
   * Generate a UUID for localStorage notes
   */
  private static generateId(): string {
    return 'note_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now()
  }
  /**
   * Handle errors and return a consistent response
   */
  private static handleError(error: any, action: string): ServiceResponse {
    console.error(`CallNotesService ${action} error:`, error)

    return {
      status: 'error',
      error: error.message || 'An unexpected error occurred'
    }
  }

  /**
   * Get current user ID from SupabaseContext
   * This method should be used in conjunction with the SupabaseContext
   */
  private static currentUserId: string | null = null

  /**
   * Set the current user ID (called from SupabaseContext)
   */
  static setCurrentUserId(userId: string | null): void {
    this.currentUserId = userId
  }

  /**
   * Check if Supabase is available
   */
  private static async checkSupabaseAvailability(): Promise<boolean> {
    if (this.isSupabaseAvailable !== null) {
      return this.isSupabaseAvailable
    }

    try {
      const { data, error } = await supabase.from('call_notes').select('count').limit(1)
      this.isSupabaseAvailable = !error
      return this.isSupabaseAvailable
    } catch (error) {
      console.warn('Supabase availability check failed:', error)
      this.isSupabaseAvailable = false
      return false
    }
  }

  /**
   * Get current user ID from context
   */
  private static async getCurrentUserId(): Promise<string | null> {
    try {
      if (this.currentUserId) {
        return this.currentUserId
      }

      // Try to get from localStorage first (matches app's auth system)
      const userData = localStorage.getItem('currentUser')
      if (userData) {
        const user = JSON.parse(userData)
        const userId = user?.id || user?.user_id || user?.email
        if (userId) {
          this.currentUserId = userId
          return userId
        }
      }

      // If no user in localStorage but service needs to work, use anonymous user
      if (!userData) {
        const anonymousUserId = 'anonymous_user'
        this.currentUserId = anonymousUserId
        console.log('Using anonymous user ID for notes service')
        return anonymousUserId
      }

      // Fallback: try to get from Supabase auth (legacy)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.warn('No authenticated user found. Make sure SupabaseContext is properly configured.')
        return null
      }

      // For demo/local mode with default Supabase tokens
      return user.id || 'default-user'
    } catch (error) {
      console.warn('Failed to get current user ID:', error)
      return null
    }
  }

  /**
   * Log security events
   */
  private static async logSecurityEvent(
    action: string,
    resource: string,
    success: boolean,
    details: Record<string, any> = {}
  ): Promise<void> {
    try {
      await supabase.from('security_events').insert({
        action,
        resource,
        success,
        details,
        ip_address: null,
        user_agent: navigator.userAgent
      })
    } catch (error) {
      // Gracefully handle connection failures - don't spam the console
      if (error instanceof Error && (error.message.includes('Failed to fetch') || error.message.includes('ERR_CONNECTION_REFUSED'))) {
        // Silent fail when database is not available
        return
      }
      console.log('Security event logging unavailable:', error instanceof Error ? error.message : 'Unknown error')
    }
  }

  /**
   * Wrapper for audit logging
   */
  private static async withAuditLog<T>(
    action: string,
    tableName: string,
    operation: () => Promise<T>,
    recordId?: string,
    oldData?: any,
    newData?: any
  ): Promise<T> {
    const userId = await this.getCurrentUserId()
    const startTime = Date.now()

    try {
      const result = await operation()

      // Try to log audit (don't fail if it doesn't work)
      if (userId) {
        try {
          await supabase.from('audit_logs').insert({
            user_id: userId,
            action,
            table_name: tableName,
            record_id: recordId,
            old_values: oldData,
            new_values: newData,
            ip_address: null,
            user_agent: navigator.userAgent,
            metadata: {
              duration_ms: Date.now() - startTime,
              success: true
            }
          })
        } catch (auditError) {
          console.warn('Audit logging failed:', auditError)
        }
      }

      return result
    } catch (error) {
      // Try to log failed operation
      if (userId) {
        try {
          await supabase.from('audit_logs').insert({
            user_id: userId,
            action,
            table_name: tableName,
            record_id: recordId,
            metadata: {
              duration_ms: Date.now() - startTime,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          })
        } catch (auditError) {
          console.warn('Audit logging failed:', auditError)
        }
      }

      throw error
    }
  }

  /**
   * Get all notes for a specific call and user (with localStorage fallback)
   */
  static async getCallNotes(callId: string): Promise<ServiceResponse<DecryptedCallNote[]>> {
    try {
      const userId = await this.getCurrentUserId()
      if (!userId) throw new Error('User not authenticated')

      const isSupabaseAvailable = await this.checkSupabaseAvailability()

      if (isSupabaseAvailable) {
        // Use Supabase
        const { data, error } = await supabase
          .from('call_notes')
          .select('*')
          .eq('call_id', callId)
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })

        if (error) throw error

        // Decrypt note content
        const decryptedNotes: DecryptedCallNote[] = data.map(note => {
          try {
            return {
              ...note,
              content: decryptPHI(note.encrypted_content),
              metadata: note.metadata || {}
            }
          } catch (decryptError) {
            console.error('Failed to decrypt note:', decryptError)
            return {
              ...note,
              content: '[Decryption Error]',
              metadata: note.metadata || {}
            }
          }
        })

        await this.logSecurityEvent('CALL_NOTES_ACCESSED', 'call_notes', true, {
          callId,
          noteCount: decryptedNotes.length
        })

        return { status: 'success', data: decryptedNotes }
      } else {
        // Use localStorage fallback
        const notes = this.getLocalStorageNotes()
        const userNotes = notes.filter(note => note.call_id === callId && note.user_id === userId)

        // Sort by updated_at descending
        userNotes.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

        // Convert to DecryptedCallNote format
        const decryptedNotes: DecryptedCallNote[] = userNotes.map(note => ({
          id: note.id,
          call_id: note.call_id,
          user_id: note.user_id,
          content: note.content,
          is_pinned: note.is_pinned,
          tags: note.tags,
          metadata: note.metadata,
          created_at: note.created_at,
          updated_at: note.updated_at,
          encrypted_content: '' // Not used in localStorage mode
        }))

        console.log('Retrieved call notes from localStorage:', decryptedNotes.length, 'notes')
        return { status: 'success', data: decryptedNotes }
      }
    } catch (error: any) {
      return this.handleError(error, 'getCallNotes')
    }
  }

  /**
   * Create or update a note for a call (upsert operation with localStorage fallback)
   */
  static async upsertCallNote(
    callId: string,
    content: string,
    options: {
      isPinned?: boolean
      tags?: string[]
      metadata?: Record<string, any>
    } = {}
  ): Promise<ServiceResponse<DecryptedCallNote>> {
    try {
      const userId = await this.getCurrentUserId()
      if (!userId) throw new Error('User not authenticated')

      if (!content.trim()) {
        throw new Error('Note content cannot be empty')
      }

      const isSupabaseAvailable = await this.checkSupabaseAvailability()

      if (isSupabaseAvailable) {
        // Use Supabase
        const encryptedContent = encryptPHI(content.trim())

        // Check if note already exists
        const { data: existingNote } = await supabase
          .from('call_notes')
          .select('id, encrypted_content')
          .eq('call_id', callId)
          .eq('user_id', userId)
          .single()

        let noteData: CallNoteRow
        let isUpdate = false

        if (existingNote) {
          // Update existing note
          isUpdate = true
          const { data, error } = await this.withAuditLog(
            'UPDATE',
            'call_notes',
            async () => {
              return await supabase
                .from('call_notes')
                .update({
                  encrypted_content: encryptedContent,
                  is_pinned: options.isPinned ?? false,
                  tags: options.tags ?? [],
                  metadata: options.metadata ?? {},
                  updated_at: new Date().toISOString()
                })
                .eq('call_id', callId)
                .eq('user_id', userId)
                .select('*')
                .single()
            },
            existingNote.id,
            { encrypted_content: existingNote.encrypted_content },
            { encrypted_content: encryptedContent }
          )

          if (error) throw error
          noteData = data
        } else {
          // Create new note
          const { data, error } = await this.withAuditLog(
            'INSERT',
            'call_notes',
            async () => {
              return await supabase
                .from('call_notes')
                .insert({
                  call_id: callId,
                  user_id: userId,
                  encrypted_content: encryptedContent,
                  is_pinned: options.isPinned ?? false,
                  tags: options.tags ?? [],
                  metadata: options.metadata ?? {}
                })
                .select('*')
                .single()
            }
          )

          if (error) throw error
          noteData = data
        }

        const decryptedNote: DecryptedCallNote = {
          ...noteData,
          content: decryptPHI(noteData.encrypted_content),
          metadata: noteData.metadata || {}
        }

        await this.logSecurityEvent(
          isUpdate ? 'CALL_NOTE_UPDATED' : 'CALL_NOTE_CREATED',
          'call_notes',
          true,
          {
            callId,
            noteId: noteData.id,
            contentLength: content.length,
            hasTags: (options.tags?.length ?? 0) > 0,
            isPinned: options.isPinned ?? false
          }
        )

        return { status: 'success', data: decryptedNote }
      } else {
        // Use localStorage fallback
        const notes = this.getLocalStorageNotes()
        const existingNoteIndex = notes.findIndex(note => note.call_id === callId && note.user_id === userId)

        const now = new Date().toISOString()
        let noteData: LocalStorageCallNote

        if (existingNoteIndex >= 0) {
          // Update existing note
          noteData = {
            ...notes[existingNoteIndex],
            content: content.trim(),
            is_pinned: options.isPinned ?? notes[existingNoteIndex].is_pinned,
            tags: options.tags ?? notes[existingNoteIndex].tags,
            metadata: options.metadata ?? notes[existingNoteIndex].metadata,
            updated_at: now
          }
          notes[existingNoteIndex] = noteData
          console.log('Updated note in localStorage for call:', callId)
        } else {
          // Create new note
          noteData = {
            id: this.generateId(),
            call_id: callId,
            user_id: userId,
            content: content.trim(),
            is_pinned: options.isPinned ?? false,
            tags: options.tags ?? [],
            metadata: options.metadata ?? {},
            created_at: now,
            updated_at: now
          }
          notes.push(noteData)
          console.log('Created new note in localStorage for call:', callId)
        }

        this.saveLocalStorageNotes(notes)

        const decryptedNote: DecryptedCallNote = {
          ...noteData,
          encrypted_content: '' // Not used in localStorage mode
        }

        return { status: 'success', data: decryptedNote }
      }
    } catch (error: any) {
      return this.handleError(error, 'upsertCallNote')
    }
  }

  /**
   * Delete a note (with localStorage fallback)
   */
  static async deleteCallNote(callId: string): Promise<ServiceResponse<void>> {
    try {
      const userId = await this.getCurrentUserId()
      if (!userId) throw new Error('User not authenticated')

      const isSupabaseAvailable = await this.checkSupabaseAvailability()

      if (isSupabaseAvailable) {
        // Use Supabase
        const { data: existingNote } = await supabase
          .from('call_notes')
          .select('id')
          .eq('call_id', callId)
          .eq('user_id', userId)
          .single()

        if (!existingNote) {
          return { status: 'error', error: 'Note not found' }
        }

        const { error } = await this.withAuditLog(
          'DELETE',
          'call_notes',
          async () => {
            return await supabase
              .from('call_notes')
              .delete()
              .eq('call_id', callId)
              .eq('user_id', userId)
          },
          existingNote.id
        )

        if (error) throw error

        await this.logSecurityEvent('CALL_NOTE_DELETED', 'call_notes', true, {
          callId,
          noteId: existingNote.id
        })

        return { status: 'success' }
      } else {
        // Use localStorage fallback
        const notes = this.getLocalStorageNotes()
        const noteIndex = notes.findIndex(note => note.call_id === callId && note.user_id === userId)

        if (noteIndex === -1) {
          return { status: 'error', error: 'Note not found' }
        }

        notes.splice(noteIndex, 1)
        this.saveLocalStorageNotes(notes)
        console.log('Deleted note from localStorage for call:', callId)

        return { status: 'success' }
      }
    } catch (error: any) {
      return this.handleError(error, 'deleteCallNote')
    }
  }

  /**
   * Toggle pin status of a note (with localStorage fallback)
   */
  static async togglePinNote(callId: string): Promise<ServiceResponse<DecryptedCallNote>> {
    try {
      const userId = await this.getCurrentUserId()
      if (!userId) throw new Error('User not authenticated')

      const isSupabaseAvailable = await this.checkSupabaseAvailability()

      if (isSupabaseAvailable) {
        // Use Supabase
        const { data: existingNote } = await supabase
          .from('call_notes')
          .select('*')
          .eq('call_id', callId)
          .eq('user_id', userId)
          .single()

        if (!existingNote) {
          return { status: 'error', error: 'Note not found' }
        }

        const newPinnedStatus = !existingNote.is_pinned

        const { data, error } = await this.withAuditLog(
          'UPDATE',
          'call_notes',
          async () => {
            return await supabase
              .from('call_notes')
              .update({
                is_pinned: newPinnedStatus,
                updated_at: new Date().toISOString()
              })
              .eq('call_id', callId)
              .eq('user_id', userId)
              .select('*')
              .single()
          },
          existingNote.id,
          { is_pinned: existingNote.is_pinned },
          { is_pinned: newPinnedStatus }
        )

        if (error) throw error

        const decryptedNote: DecryptedCallNote = {
          ...data,
          content: decryptPHI(data.encrypted_content),
          metadata: data.metadata || {}
        }

        await this.logSecurityEvent('CALL_NOTE_PIN_TOGGLED', 'call_notes', true, {
          callId,
          noteId: data.id,
          isPinned: newPinnedStatus
        })

        return { status: 'success', data: decryptedNote }
      } else {
        // Use localStorage fallback
        const notes = this.getLocalStorageNotes()
        const noteIndex = notes.findIndex(note => note.call_id === callId && note.user_id === userId)

        if (noteIndex === -1) {
          return { status: 'error', error: 'Note not found' }
        }

        const existingNote = notes[noteIndex]
        const newPinnedStatus = !existingNote.is_pinned
        const now = new Date().toISOString()

        const updatedNote: LocalStorageCallNote = {
          ...existingNote,
          is_pinned: newPinnedStatus,
          updated_at: now
        }

        notes[noteIndex] = updatedNote
        this.saveLocalStorageNotes(notes)
        console.log('Toggled pin status in localStorage for call:', callId, 'isPinned:', newPinnedStatus)

        const decryptedNote: DecryptedCallNote = {
          ...updatedNote,
          encrypted_content: '' // Not used in localStorage mode
        }

        return { status: 'success', data: decryptedNote }
      }
    } catch (error: any) {
      return this.handleError(error, 'togglePinNote')
    }
  }

  /**
   * Subscribe to real-time changes for call notes (only works with Supabase)
   */
  static subscribeToCallNotes(
    callId: string,
    onNoteChange: (note: DecryptedCallNote | null, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void
  ) {
    // Check if Supabase is available for real-time subscriptions
    this.checkSupabaseAvailability().then(isAvailable => {
      if (!isAvailable) {
        console.log('Supabase not available - real-time subscriptions disabled')
        return
      }

      const channelName = `call-notes-${callId}-${this.currentUserId || 'unknown'}`

      console.log(`Setting up real-time subscription for channel: ${channelName}`)

      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'call_notes',
            filter: `call_id=eq.${callId}`
          },
          async (payload) => {
            try {
              console.log('Real-time event received:', {
                eventType: payload.eventType,
                callId,
                hasNew: !!payload.new,
                hasOld: !!payload.old
              })

              const userId = await this.getCurrentUserId()
              if (!userId) {
                console.warn('No user ID available for real-time processing')
                return
              }

              // Only process changes for the current user
              if (payload.new && (payload.new as any).user_id !== userId) {
                console.log('Ignoring real-time event for different user')
                return
              }
              if (payload.old && (payload.old as any).user_id !== userId) {
                console.log('Ignoring real-time event for different user')
                return
              }

              let decryptedNote: DecryptedCallNote | null = null

              if (payload.new && payload.eventType !== 'DELETE') {
                const noteData = payload.new as CallNoteRow
                try {
                  decryptedNote = {
                    ...noteData,
                    content: decryptPHI(noteData.encrypted_content),
                    metadata: noteData.metadata || {}
                  }
                } catch (decryptError) {
                  console.error('Failed to decrypt note in real-time update:', decryptError)
                  decryptedNote = {
                    ...noteData,
                    content: '[Decryption Error]',
                    metadata: noteData.metadata || {}
                  }
                }
              }

              onNoteChange(decryptedNote, payload.eventType)
            } catch (error) {
              console.error('Error processing real-time call note change:', error)
            }
          }
        )
        .subscribe((status) => {
          console.log(`Real-time subscription status for ${channelName}:`, status)
          if (status === 'SUBSCRIBED') {
            console.log('Successfully subscribed to call notes real-time updates')
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Failed to subscribe to call notes real-time updates')
          }
        })

      return () => {
        console.log(`Cleaning up real-time subscription for ${channelName}`)
        supabase.removeChannel(channel)
      }
    })

    // Return a no-op cleanup function for localStorage mode
    return () => {
      console.log('No real-time subscription to cleanup (localStorage mode)')
    }
  }

  /**
   * Get notes statistics for a user (with localStorage fallback)
   */
  static async getNotesStats(): Promise<ServiceResponse<{
    totalNotes: number
    pinnedNotes: number
    recentNotesCount: number
  }>> {
    try {
      const userId = await this.getCurrentUserId()
      if (!userId) throw new Error('User not authenticated')

      const isSupabaseAvailable = await this.checkSupabaseAvailability()

      if (isSupabaseAvailable) {
        // Use Supabase
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        const [totalResult, pinnedResult, recentResult] = await Promise.all([
          supabase
            .from('call_notes')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId),
          supabase
            .from('call_notes')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_pinned', true),
          supabase
            .from('call_notes')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('created_at', sevenDaysAgo.toISOString())
        ])

        const stats = {
          totalNotes: totalResult.count || 0,
          pinnedNotes: pinnedResult.count || 0,
          recentNotesCount: recentResult.count || 0
        }

        return { status: 'success', data: stats }
      } else {
        // Use localStorage fallback
        const notes = this.getLocalStorageNotes()
        const userNotes = notes.filter(note => note.user_id === userId)

        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        const stats = {
          totalNotes: userNotes.length,
          pinnedNotes: userNotes.filter(note => note.is_pinned).length,
          recentNotesCount: userNotes.filter(note => new Date(note.created_at) >= sevenDaysAgo).length
        }

        return { status: 'success', data: stats }
      }
    } catch (error: any) {
      return this.handleError(error, 'getNotesStats')
    }
  }
}