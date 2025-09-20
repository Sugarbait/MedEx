/**
 * Test Component for Persistent Chat Notes Implementation
 *
 * This component can be used to test the notes functionality
 * independently from the main SMS system.
 */

import React, { useState } from 'react'
import { EnhancedChatNotes } from '@/components/common/EnhancedChatNotes'
import { notesService } from '@/services/notesService'
import {
  TestTubeIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  PlayIcon,
  StopIcon,
  RefreshCwIcon
} from 'lucide-react'

export const NotesImplementationTest: React.FC = () => {
  const [testChatId, setTestChatId] = useState('test-chat-' + Date.now())
  const [isTestMode, setIsTestMode] = useState(false)
  const [testResults, setTestResults] = useState<string[]>([])
  const [isRunningTests, setIsRunningTests] = useState(false)

  const addTestResult = (result: string, success: boolean = true) => {
    const timestamp = new Date().toLocaleTimeString()
    const status = success ? '✅' : '❌'
    setTestResults(prev => [...prev, `${timestamp} ${status} ${result}`])
  }

  const runAutomatedTests = async () => {
    setIsRunningTests(true)
    setTestResults([])
    addTestResult('Starting automated tests...')

    try {
      // Test 1: Create a note
      addTestResult('Test 1: Creating a test note...')
      const createResult = await notesService.createNote({
        reference_id: testChatId,
        reference_type: 'sms',
        content: 'This is a test note created at ' + new Date().toISOString(),
        content_type: 'plain'
      })

      if (createResult.success) {
        addTestResult('✓ Note created successfully')
      } else {
        throw new Error('Failed to create note: ' + createResult.error)
      }

      // Test 2: Retrieve notes
      addTestResult('Test 2: Retrieving notes...')
      const getResult = await notesService.getNotes(testChatId, 'sms')

      if (getResult.success && getResult.notes && getResult.notes.length > 0) {
        addTestResult(`✓ Retrieved ${getResult.notes.length} note(s)`)
      } else {
        throw new Error('Failed to retrieve notes')
      }

      // Test 3: Update the note
      if (createResult.note) {
        addTestResult('Test 3: Updating the note...')
        const updateResult = await notesService.updateNote(createResult.note.id, {
          content: 'Updated test note at ' + new Date().toISOString(),
          content_type: 'plain'
        })

        if (updateResult.success) {
          addTestResult('✓ Note updated successfully')
        } else {
          throw new Error('Failed to update note: ' + updateResult.error)
        }
      }

      // Test 4: Check if notes exist
      addTestResult('Test 4: Checking note existence...')
      const hasNotes = await notesService.hasNotes(testChatId, 'sms')

      if (hasNotes) {
        addTestResult('✓ Note existence check passed')
      } else {
        throw new Error('Note existence check failed')
      }

      // Test 5: Delete the note (cleanup)
      if (createResult.note) {
        addTestResult('Test 5: Cleaning up test note...')
        const deleteResult = await notesService.deleteNote(createResult.note.id)

        if (deleteResult.success) {
          addTestResult('✓ Test note deleted successfully')
        } else {
          addTestResult('⚠️ Warning: Failed to cleanup test note', false)
        }
      }

      addTestResult('🎉 All tests completed successfully!')

    } catch (error) {
      addTestResult('❌ Test failed: ' + (error instanceof Error ? error.message : 'Unknown error'), false)
    } finally {
      setIsRunningTests(false)
    }
  }

  const startTestMode = () => {
    setIsTestMode(true)
    setTestChatId('test-chat-' + Date.now())
    addTestResult('Test mode activated with chat ID: ' + testChatId)
  }

  const stopTestMode = () => {
    setIsTestMode(false)
    setTestResults([])
    addTestResult('Test mode deactivated')
  }

  const generateNewChatId = () => {
    const newId = 'test-chat-' + Date.now()
    setTestChatId(newId)
    addTestResult('Generated new test chat ID: ' + newId)
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <TestTubeIcon className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Persistent Chat Notes Test</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Test Chat ID
            </label>
            <input
              type="text"
              value={testChatId}
              onChange={(e) => setTestChatId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter a test chat ID"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={generateNewChatId}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <RefreshCwIcon className="w-4 h-4" />
              New ID
            </button>

            {!isTestMode ? (
              <button
                onClick={startTestMode}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <PlayIcon className="w-4 h-4" />
                Start Test
              </button>
            ) : (
              <button
                onClick={stopTestMode}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <StopIcon className="w-4 h-4" />
                Stop Test
              </button>
            )}

            <button
              onClick={runAutomatedTests}
              disabled={isRunningTests || !testChatId}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <TestTubeIcon className="w-4 h-4" />
              {isRunningTests ? 'Running...' : 'Auto Test'}
            </button>
          </div>
        </div>
      </div>

      {/* Test Results */}
      {testResults.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Test Results</h2>
          <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-sm max-h-64 overflow-y-auto">
            {testResults.map((result, index) => (
              <div key={index} className="mb-1">
                {result}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Test */}
      {isTestMode && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Interactive Test - Chat ID: {testChatId}
          </h2>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircleIcon className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-900">Test Instructions</span>
            </div>
            <ul className="text-blue-800 text-sm space-y-1">
              <li>• Add notes using the interface below</li>
              <li>• Edit existing notes to test auto-save</li>
              <li>• Try going offline (disable network) to test offline mode</li>
              <li>• Open this page in another tab/device to test real-time sync</li>
              <li>• Check browser console for detailed logging</li>
            </ul>
          </div>

          <EnhancedChatNotes
            chatId={testChatId}
            referenceType="sms"
            isReadonly={false}
            onNotesChanged={() => {
              addTestResult('Notes changed event triggered')
            }}
          />
        </div>
      )}

      {/* Implementation Status */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Implementation Status</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="font-medium text-gray-900">✅ Completed Features</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Database schema with RLS policies</li>
              <li>• Real-time synchronization</li>
              <li>• Offline support with local queue</li>
              <li>• Auto-save functionality</li>
              <li>• Cross-device persistence</li>
              <li>• Edit history and user attribution</li>
              <li>• Status indicators and error handling</li>
              <li>• HIPAA compliance features</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium text-gray-900">📋 Setup Checklist</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Run SQL migration in Supabase</li>
              <li>• Configure environment variables</li>
              <li>• Test database connectivity</li>
              <li>• Verify RLS policies</li>
              <li>• Enable realtime for notes table</li>
              <li>• Test cross-device synchronization</li>
              <li>• Validate offline functionality</li>
              <li>• Review audit logging</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Troubleshooting */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircleIcon className="w-5 h-5 text-yellow-600" />
          <h3 className="font-medium text-yellow-900">Troubleshooting</h3>
        </div>

        <div className="text-yellow-800 text-sm space-y-2">
          <p><strong>If notes aren't saving:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Check Supabase connection in browser console</li>
            <li>Verify the notes table exists and has proper RLS policies</li>
            <li>Ensure user authentication is working</li>
            <li>Check network connectivity</li>
          </ul>

          <p className="mt-3"><strong>If real-time sync isn't working:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Verify realtime is enabled for the notes table</li>
            <li>Check WebSocket connection in browser dev tools</li>
            <li>Ensure Supabase realtime is properly configured</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default NotesImplementationTest