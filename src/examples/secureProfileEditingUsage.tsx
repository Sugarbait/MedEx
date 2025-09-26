/**
 * Usage Examples for Secure Profile Editing System
 *
 * This file demonstrates how to integrate and use the SecureProfileEditor
 * component and secureProfileEditingService in your application.
 */

import React, { useState, useEffect } from 'react'
import { SecureProfileEditor } from '@/components/profile/SecureProfileEditor'
import { secureProfileEditingService, ProfileData } from '@/services/secureProfileEditingService'

/**
 * Example 1: Basic Integration in Settings Page
 */
export const ProfileSettingsPage: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    // Load current user from localStorage
    const userData = localStorage.getItem('currentUser')
    if (userData) {
      setCurrentUser(JSON.parse(userData))
    }
  }, [])

  const handleProfileUpdate = (profile: ProfileData) => {
    console.log('Profile updated:', profile)

    // Update UI state if needed
    setCurrentUser(prev => ({
      ...prev,
      name: profile.name,
      display_name: profile.display_name
    }))

    // Optionally notify other components
    window.dispatchEvent(new CustomEvent('profileUpdated', {
      detail: profile
    }))
  }

  if (!currentUser) {
    return <div>Loading...</div>
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Profile Settings</h1>
      <SecureProfileEditor
        user={currentUser}
        onProfileUpdate={handleProfileUpdate}
        deviceId="user-device-123"
      />
    </div>
  )
}

/**
 * Example 2: Programmatic Profile Management
 */
export const ProgrammaticProfileExample = () => {
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load profile data
  const loadProfile = async (userId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const profile = await secureProfileEditingService.getCurrentProfile(userId)
      setProfileData(profile)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile')
    } finally {
      setIsLoading(false)
    }
  }

  // Update profile programmatically
  const updateProfile = async (userId: string, updates: Partial<ProfileData>) => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await secureProfileEditingService.editProfile({
        userId,
        updates,
        deviceId: 'api-client'
      })

      if (result.success && result.data) {
        setProfileData(result.data)
        console.log('✅ Profile updated successfully')
        console.log('📊 Sync status:', result.syncStatus)
      } else {
        setError(result.error || 'Failed to update profile')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setIsLoading(false)
    }
  }

  // Bulk update example
  const performBulkUpdate = async (userId: string) => {
    const updates = {
      department: 'Updated Department',
      location: 'New York, NY',
      timezone: 'America/New_York',
      bio: 'Updated bio with new information'
    }

    await updateProfile(userId, updates)
  }

  // Emergency rollback example
  const performEmergencyRollback = async (userId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await secureProfileEditingService.rollbackProfile(userId)

      if (result.success && result.data) {
        setProfileData(result.data)
        console.log('🚨 Emergency rollback completed')
      } else {
        setError(result.error || 'Rollback failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rollback failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Programmatic Profile Management</h2>

      {isLoading && <div>Loading...</div>}
      {error && <div className="text-red-600">{error}</div>}

      {profileData && (
        <div className="bg-gray-100 p-4 rounded-lg mb-4">
          <h3 className="font-medium mb-2">Current Profile:</h3>
          <pre className="text-sm">{JSON.stringify(profileData, null, 2)}</pre>
        </div>
      )}

      <div className="space-y-2">
        <button
          onClick={() => loadProfile('current-user-id')}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mr-2"
        >
          Load Profile
        </button>

        <button
          onClick={() => performBulkUpdate('current-user-id')}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 mr-2"
        >
          Bulk Update
        </button>

        <button
          onClick={() => performEmergencyRollback('current-user-id')}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Emergency Rollback
        </button>
      </div>
    </div>
  )
}

/**
 * Example 3: Conflict Resolution UI
 */
export const ConflictResolutionExample: React.FC = () => {
  const [conflicts, setConflicts] = useState<any[]>([])
  const [resolving, setResolving] = useState<string | null>(null)

  useEffect(() => {
    // Check for pending conflicts
    const userId = 'current-user-id'
    const pendingConflicts = secureProfileEditingService.getPendingConflicts(userId)
    setConflicts(pendingConflicts)
  }, [])

  const resolveConflict = async (conflictId: string, strategy: 'take_local' | 'take_remote' | 'merge') => {
    setResolving(conflictId)

    try {
      const conflict = conflicts.find(c => c.conflictId === conflictId)
      if (!conflict) return

      const result = await secureProfileEditingService.resolveConflict(
        'current-user-id',
        conflictId,
        {
          ...conflict,
          strategy
        }
      )

      if (result.success) {
        setConflicts(prev => prev.filter(c => c.conflictId !== conflictId))
        console.log('✅ Conflict resolved successfully')
      } else {
        console.error('❌ Failed to resolve conflict:', result.error)
      }
    } catch (error) {
      console.error('❌ Conflict resolution error:', error)
    } finally {
      setResolving(null)
    }
  }

  if (conflicts.length === 0) {
    return (
      <div className="p-4 text-gray-600">
        No profile conflicts detected
      </div>
    )
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Profile Conflicts</h2>

      {conflicts.map(conflict => (
        <div key={conflict.conflictId} className="border border-yellow-300 rounded-lg p-4 mb-4 bg-yellow-50">
          <h3 className="font-medium text-yellow-800 mb-2">
            Conflict in: {conflict.conflictingFields.join(', ')}
          </h3>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <h4 className="font-medium text-sm text-gray-700">Local Changes:</h4>
              <pre className="text-xs bg-white p-2 rounded border">
                {JSON.stringify(conflict.localData, null, 2)}
              </pre>
            </div>

            <div>
              <h4 className="font-medium text-sm text-gray-700">Remote Changes:</h4>
              <pre className="text-xs bg-white p-2 rounded border">
                {JSON.stringify(conflict.remoteData, null, 2)}
              </pre>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => resolveConflict(conflict.conflictId, 'take_local')}
              disabled={resolving === conflict.conflictId}
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              Keep Local
            </button>

            <button
              onClick={() => resolveConflict(conflict.conflictId, 'take_remote')}
              disabled={resolving === conflict.conflictId}
              className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50"
            >
              Keep Remote
            </button>

            <button
              onClick={() => resolveConflict(conflict.conflictId, 'merge')}
              disabled={resolving === conflict.conflictId}
              className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700 disabled:opacity-50"
            >
              Manual Merge
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Example 4: Custom Validation Rules
 */
export const CustomValidationExample = () => {
  const [validationResults, setValidationResults] = useState<any>(null)

  const testCustomValidation = async () => {
    // Test various validation scenarios
    const testCases = [
      {
        name: 'Valid Profile',
        data: {
          name: 'John Doe',
          phone: '+1-555-123-4567',
          bio: 'A valid bio',
          timezone: 'America/New_York'
        }
      },
      {
        name: 'Invalid Phone',
        data: {
          name: 'John Doe',
          phone: '123', // Too short
        }
      },
      {
        name: 'XSS Attempt',
        data: {
          name: 'John<script>alert("xss")</script>',
          bio: '<img src=x onerror=alert("xss")>'
        }
      },
      {
        name: 'Long Bio',
        data: {
          name: 'John Doe',
          bio: 'a'.repeat(501) // Too long
        }
      }
    ]

    const results = []
    for (const testCase of testCases) {
      const result = await secureProfileEditingService.editProfile({
        userId: 'validation-test-user',
        updates: testCase.data
      })

      results.push({
        testName: testCase.name,
        success: result.success,
        error: result.error,
        warnings: result.warnings,
        sanitizedData: result.data
      })
    }

    setValidationResults(results)
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Validation Testing</h2>

      <button
        onClick={testCustomValidation}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mb-4"
      >
        Run Validation Tests
      </button>

      {validationResults && (
        <div className="space-y-4">
          {validationResults.map((result: any, index: number) => (
            <div key={index} className={`border rounded-lg p-4 ${result.success ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
              <h3 className="font-medium mb-2">{result.testName}</h3>
              <div className="text-sm">
                <div className={`font-medium ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                  Result: {result.success ? 'PASS' : 'FAIL'}
                </div>
                {result.error && <div className="text-red-600">Error: {result.error}</div>}
                {result.warnings && result.warnings.length > 0 && (
                  <div className="text-yellow-600">Warnings: {result.warnings.join(', ')}</div>
                )}
                {result.sanitizedData && (
                  <details className="mt-2">
                    <summary className="cursor-pointer">Sanitized Data</summary>
                    <pre className="text-xs bg-white p-2 rounded border mt-1">
                      {JSON.stringify(result.sanitizedData, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Example 5: Integration with Existing Profile Component
 */
export const IntegratedProfileExample: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [useSecureEditor, setUseSecureEditor] = useState(true)

  useEffect(() => {
    const userData = localStorage.getItem('currentUser')
    if (userData) {
      setCurrentUser(JSON.parse(userData))
    }
  }, [])

  if (!currentUser) {
    return <div>Loading...</div>
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Profile Management</h1>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={useSecureEditor}
            onChange={(e) => setUseSecureEditor(e.target.checked)}
          />
          <span className="text-sm">Use Secure Editor</span>
        </label>
      </div>

      {useSecureEditor ? (
        <SecureProfileEditor
          user={currentUser}
          onProfileUpdate={(profile) => {
            console.log('Secure profile updated:', profile)
            // Update local state
            setCurrentUser(prev => ({
              ...prev,
              name: profile.name,
              display_name: profile.display_name
            }))
          }}
          deviceId="integrated-editor"
        />
      ) : (
        <div className="p-4 border border-gray-300 rounded-lg bg-gray-50">
          <p className="text-gray-600">Legacy profile editor would go here</p>
          <button
            onClick={() => setUseSecureEditor(true)}
            className="mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Switch to Secure Editor
          </button>
        </div>
      )}
    </div>
  )
}

// Export all examples
export default {
  ProfileSettingsPage,
  ProgrammaticProfileExample,
  ConflictResolutionExample,
  CustomValidationExample,
  IntegratedProfileExample
}