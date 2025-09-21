/**
 * Test component for Notes Service functionality
 * Use this to verify that notes work with both Supabase and localStorage fallback
 */

import React, { useState, useEffect } from 'react'
import { notesService } from '@/services/notesService'
import type { Note } from '@/services/notesService'

const NotesServiceTest: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([])
  const [newNoteContent, setNewNoteContent] = useState('')
  const [testResults, setTestResults] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const testReferenceId = 'test-call-123'
  const testReferenceType = 'call' as const

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`])
  }

  useEffect(() => {
    // Subscribe to notes updates
    const setupSubscription = async () => {
      addTestResult('Setting up notes subscription...')

      const result = await notesService.subscribeToNotes(
        testReferenceId,
        testReferenceType,
        (updatedNotes) => {
          setNotes(updatedNotes)
          addTestResult(`Received ${updatedNotes.length} notes from subscription`)
        }
      )

      if (result.success) {
        addTestResult('✅ Notes subscription setup successful')
      } else {
        addTestResult(`❌ Notes subscription failed: ${result.error}`)
      }
    }

    setupSubscription()

    // Cleanup on unmount
    return () => {
      notesService.unsubscribeFromNotes(testReferenceId, testReferenceType)
    }
  }, [])

  const handleCreateNote = async () => {
    if (!newNoteContent.trim()) return

    setIsLoading(true)
    addTestResult(`Creating note: "${newNoteContent}"`)

    try {
      const result = await notesService.createNote({
        reference_id: testReferenceId,
        reference_type: testReferenceType,
        content: newNoteContent,
        content_type: 'plain'
      })

      if (result.success) {
        addTestResult(`✅ Note created successfully: ${result.note?.id}`)
        setNewNoteContent('')
      } else {
        addTestResult(`❌ Failed to create note: ${result.error}`)
      }
    } catch (error) {
      addTestResult(`❌ Error creating note: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSyncNotes = async () => {
    setIsLoading(true)
    addTestResult('Attempting to sync local notes to Supabase...')

    try {
      const result = await notesService.syncLocalNotesToSupabase()
      if (result.success) {
        addTestResult(`✅ Synced ${result.syncedCount} notes to Supabase`)
      } else {
        addTestResult(`❌ Sync failed: ${result.error}`)
      }
    } catch (error) {
      addTestResult(`❌ Sync error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearLocalStorage = () => {
    const key = `notes_${testReferenceType}_${testReferenceId}`
    localStorage.removeItem(key)
    addTestResult('🗑️ Cleared localStorage notes')
    setNotes([])
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Notes Service Test</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notes Section */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-4">Notes for {testReferenceId}</h2>

          <div className="mb-4">
            <textarea
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="Enter your note..."
              className="w-full p-2 border rounded"
              rows={3}
            />
            <button
              onClick={handleCreateNote}
              disabled={isLoading || !newNoteContent.trim()}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Add Note'}
            </button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {notes.length === 0 ? (
              <p className="text-gray-500">No notes yet</p>
            ) : (
              notes.map((note) => (
                <div key={note.id} className="p-2 border rounded bg-gray-50">
                  <p className="text-sm">{note.content}</p>
                  <div className="text-xs text-gray-500 mt-1">
                    By {note.created_by_name} • {new Date(note.created_at).toLocaleString()}
                    {note.id.startsWith('local_') && (
                      <span className="ml-2 px-1 py-0.5 bg-yellow-200 text-yellow-800 rounded text-xs">
                        LOCAL
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={handleSyncNotes}
              disabled={isLoading}
              className="px-3 py-1 bg-green-500 text-white rounded text-sm disabled:opacity-50"
            >
              Sync to Supabase
            </button>
            <button
              onClick={handleClearLocalStorage}
              className="px-3 py-1 bg-red-500 text-white rounded text-sm"
            >
              Clear Local
            </button>
          </div>
        </div>

        {/* Test Results Section */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-4">Test Results</h2>
          <div className="bg-gray-100 rounded p-3 max-h-80 overflow-y-auto">
            <div className="text-xs font-mono space-y-1">
              {testResults.length === 0 ? (
                <p className="text-gray-500">No test results yet</p>
              ) : (
                testResults.map((result, index) => (
                  <div key={index} className="text-sm">
                    {result}
                  </div>
                ))
              )}
            </div>
          </div>
          <button
            onClick={() => setTestResults([])}
            className="mt-2 px-3 py-1 bg-gray-500 text-white rounded text-sm"
          >
            Clear Results
          </button>
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Test Instructions:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>1. Open browser console to see Supabase configuration debug logs</li>
          <li>2. Add a note to test storage functionality</li>
          <li>3. Check if notes are stored in Supabase or localStorage (look for "LOCAL" tag)</li>
          <li>4. Try syncing local notes to Supabase if available</li>
          <li>5. Open in multiple tabs/devices to test cross-device sync</li>
        </ul>
      </div>
    </div>
  )
}

export default NotesServiceTest