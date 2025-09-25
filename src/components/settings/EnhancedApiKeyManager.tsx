import React, { useState, useEffect } from 'react'
import {
  Key,
  Eye,
  EyeOff,
  Save,
  Check,
  X,
  AlertTriangle,
  Shield,
  Link,
  RefreshCw,
  Copy,
  Settings,
  TestTube,
  Phone
} from 'lucide-react'
import { enhancedUserService } from '@/services/enhancedUserService'
import { apiKeyFallbackService } from '@/services/apiKeyFallbackService'
import { retellService } from '@/services'

interface EnhancedApiKeyManagerProps {
  user: {
    id: string
    email: string
    name?: string
  }
}

interface ApiKeyState {
  retell_api_key: string
  call_agent_id: string
  sms_agent_id: string
  phone_number: string
}

export const EnhancedApiKeyManager: React.FC<EnhancedApiKeyManagerProps> = ({ user }) => {
  const [apiKeys, setApiKeys] = useState<ApiKeyState>({
    retell_api_key: '',
    call_agent_id: '',
    sms_agent_id: '',
    phone_number: ''
  })

  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const [storageMethod, setStorageMethod] = useState<string | null>(null)
  const [schemaStatus, setSchemaStatus] = useState<{
    hasAgentConfig: boolean
    hasRetellKey: boolean
  } | null>(null)

  // Visibility states for sensitive fields
  const [showApiKey, setShowApiKey] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Validation states
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  useEffect(() => {
    loadApiKeys()
    checkSchemaStatus()
  }, [user.id])

  const checkSchemaStatus = async () => {
    try {
      const testResult = await apiKeyFallbackService.testSchemaHandling(user.id)
      setSchemaStatus(testResult.schemaSupported)
      setStorageMethod(testResult.fallbackMethod)
    } catch (error) {
      console.warn('Could not check schema status:', error)
    }
  }

  // Track unsaved changes
  useEffect(() => {
    const hasChanges = apiKeys.retell_api_key !== '' ||
                      apiKeys.call_agent_id !== '' ||
                      apiKeys.sms_agent_id !== '' ||
                      apiKeys.phone_number !== ''
    setHasUnsavedChanges(hasChanges)
  }, [apiKeys])

  const loadApiKeys = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await enhancedUserService.getUserApiKeys(user.id)
      if (response.status === 'success' && response.data) {
        setApiKeys({
          retell_api_key: response.data.retell_api_key || '',
          call_agent_id: response.data.call_agent_id || '',
          sms_agent_id: response.data.sms_agent_id || '',
          phone_number: response.data.phone_number || ''
        })
      } else if (response.status === 'error') {
        // Handle specific error cases
        if (response.error?.includes('encrypted_agent_config') ||
            response.error?.includes('column') ||
            response.error?.includes('schema')) {

          // Try direct fallback service retrieval
          console.log('Schema issue detected, trying fallback service directly')
          const fallbackResponse = await apiKeyFallbackService.retrieveApiKeys(user.id)

          if (fallbackResponse.status === 'success' && fallbackResponse.data) {
            setApiKeys({
              retell_api_key: fallbackResponse.data.retell_api_key || '',
              call_agent_id: fallbackResponse.data.call_agent_id || '',
              sms_agent_id: fallbackResponse.data.sms_agent_id || '',
              phone_number: fallbackResponse.data.phone_number || ''
            })

            // Show informational message about fallback usage
            setSuccessMessage('API keys loaded using fallback method. Database schema may need updating.')
            setTimeout(() => setSuccessMessage(null), 5000)
          } else {
            setApiKeys({
              retell_api_key: '',
              call_agent_id: '',
              sms_agent_id: '',
              phone_number: ''
            })
          }
        } else {
          // Generic error - still provide empty state
          console.warn('Error loading API keys:', response.error)
          setApiKeys({
            retell_api_key: '',
            call_agent_id: '',
            sms_agent_id: '',
            phone_number: ''
          })
        }
      } else {
        // No data found - normal empty state
        console.warn('No API keys found, using empty state')
        setApiKeys({
          retell_api_key: '',
          call_agent_id: '',
          sms_agent_id: ''
        })
      }
    } catch (err: any) {
      console.error('Exception loading API keys:', err)

      // Try emergency fallback
      try {
        const fallbackResponse = await apiKeyFallbackService.retrieveApiKeys(user.id)
        if (fallbackResponse.status === 'success' && fallbackResponse.data) {
          setApiKeys({
            retell_api_key: fallbackResponse.data.retell_api_key || '',
            call_agent_id: fallbackResponse.data.call_agent_id || '',
            sms_agent_id: fallbackResponse.data.sms_agent_id || '',
            phone_number: fallbackResponse.data.phone_number || ''
          })
          setError('Loaded API keys using emergency fallback. Please check system status.')
        } else {
          setError(err.message || 'Failed to load API keys from all sources')
          setApiKeys({
            retell_api_key: '',
            call_agent_id: '',
            sms_agent_id: '',
            phone_number: ''
          })
        }
      } catch (fallbackErr) {
        setError(`Failed to load API keys: ${err.message}. Fallback also failed.`)
        setApiKeys({
          retell_api_key: '',
          call_agent_id: '',
          sms_agent_id: ''
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const validateApiKeys = () => {
    const errors: Record<string, string> = {}

    // Validate API Key - should be a non-empty string
    if (apiKeys.retell_api_key && apiKeys.retell_api_key.trim()) {
      if (apiKeys.retell_api_key.trim().length < 8) {
        errors.retell_api_key = 'API key appears too short. Please verify it\'s correct.'
      }
      // Check for common key patterns but don't enforce specific format
      if (!/^[a-zA-Z0-9_\-\.]+$/.test(apiKeys.retell_api_key.trim())) {
        errors.retell_api_key = 'API key contains invalid characters. Only letters, numbers, underscores, hyphens, and dots allowed.'
      }
    }

    // Validate Agent IDs - alphanumeric strings (NO agent_ prefix requirement)
    if (apiKeys.call_agent_id && apiKeys.call_agent_id.trim()) {
      const cleanCallAgentId = apiKeys.call_agent_id.trim()
      if (cleanCallAgentId.length < 8) {
        errors.call_agent_id = 'Call Agent ID appears too short. Should be at least 8 characters.'
      } else if (!/^[a-zA-Z0-9_-]+$/.test(cleanCallAgentId)) {
        errors.call_agent_id = 'Call Agent ID should only contain letters, numbers, underscores, or hyphens.'
      }
    }

    if (apiKeys.sms_agent_id && apiKeys.sms_agent_id.trim()) {
      const cleanSmsAgentId = apiKeys.sms_agent_id.trim()
      if (cleanSmsAgentId.length < 8) {
        errors.sms_agent_id = 'SMS Agent ID appears too short. Should be at least 8 characters.'
      } else if (!/^[a-zA-Z0-9_-]+$/.test(cleanSmsAgentId)) {
        errors.sms_agent_id = 'SMS Agent ID should only contain letters, numbers, underscores, or hyphens.'
      }
    }

    // Validate Phone Number - should be in E.164 format
    if (apiKeys.phone_number && apiKeys.phone_number.trim()) {
      const cleanPhone = apiKeys.phone_number.trim()
      // E.164 format: + followed by 1-15 digits
      if (!/^\+[1-9]\d{1,14}$/.test(cleanPhone)) {
        errors.phone_number = 'Phone number must be in E.164 format (e.g., +12345678901 for US numbers)'
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validateApiKeys()) {
      setError('Please fix validation errors before saving')
      return
    }

    // Trim all values before saving
    const trimmedApiKeys = {
      retell_api_key: apiKeys.retell_api_key.trim(),
      call_agent_id: apiKeys.call_agent_id.trim(),
      sms_agent_id: apiKeys.sms_agent_id.trim(),
      phone_number: apiKeys.phone_number.trim()
    }

    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)
    setTestResult(null)

    try {
      // Get the current storage method before saving
      const testResult = await apiKeyFallbackService.testSchemaHandling(user.id)
      const currentMethod = testResult.fallbackMethod

      const response = await enhancedUserService.updateUserApiKeys(user.id, trimmedApiKeys)

      if (response.status === 'success') {
        // Update local state with trimmed values
        setApiKeys(trimmedApiKeys)

        // Update schema status after successful save
        await checkSchemaStatus()

        // Create detailed success message based on storage method
        let successMsg = 'API keys saved successfully!'

        if (currentMethod === 'user_profiles_full') {
          successMsg += ' (Stored in primary database)'
        } else if (currentMethod === 'user_profiles_partial_plus_user_settings') {
          successMsg += ' (Stored using backup method due to database schema)'
        } else if (currentMethod === 'user_settings_or_localStorage') {
          successMsg += ' (Stored using fallback method - database schema needs updating)'
        } else if (currentMethod === 'localStorage_fallback') {
          successMsg += ' (Stored locally - database connection unavailable)'
        }

        setSuccessMessage(successMsg)
        setHasUnsavedChanges(false)

        // Update retell service with new credentials
        retellService.updateCredentials(
          trimmedApiKeys.retell_api_key,
          trimmedApiKeys.call_agent_id,
          trimmedApiKeys.sms_agent_id,
          trimmedApiKeys.phone_number
        )

        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('apiConfigurationReady', {
          detail: {
            retellApiKey: trimmedApiKeys.retell_api_key,
            callAgentId: trimmedApiKeys.call_agent_id,
            smsAgentId: trimmedApiKeys.sms_agent_id,
            phoneNumber: trimmedApiKeys.phone_number
          }
        }))

        setTimeout(() => setSuccessMessage(null), 7000) // Extended timeout for longer messages
      } else {
        // Enhanced error handling with storage method context
        let errorMsg = response.error || 'Failed to save API keys'

        if (response.error?.includes('encrypted_agent_config')) {
          errorMsg = 'Database schema issue detected. Using fallback storage method...'

          // Retry with explicit fallback awareness
          try {
            const fallbackResult = await apiKeyFallbackService.storeApiKeys(user.id, trimmedApiKeys)
            if (fallbackResult.status === 'success') {
              setApiKeys(trimmedApiKeys)
              setSuccessMessage('API keys saved using fallback method! Database schema needs updating.')
              setHasUnsavedChanges(false)
              await checkSchemaStatus()
              setTimeout(() => setSuccessMessage(null), 7000)
              return
            }
          } catch (fallbackError) {
            errorMsg += ` Fallback also failed: ${fallbackError.message}`
          }
        }

        setError(errorMsg)
      }
    } catch (err: any) {
      let errorMsg = err.message || 'Failed to save API keys'

      // Provide user-friendly error messages for common issues
      if (err.message?.includes('encrypted_agent_config')) {
        errorMsg = 'Database schema issue detected. Trying fallback storage...'

        // Attempt emergency fallback
        try {
          const fallbackResult = await apiKeyFallbackService.storeApiKeys(user.id, trimmedApiKeys)
          if (fallbackResult.status === 'success') {
            setApiKeys(trimmedApiKeys)
            setSuccessMessage('API keys saved using emergency fallback! Please contact administrator about database schema.')
            setHasUnsavedChanges(false)
            await checkSchemaStatus()
            setTimeout(() => setSuccessMessage(null), 8000)
            return
          }
        } catch (fallbackError) {
          errorMsg += ` Emergency fallback failed: ${fallbackError.message}`
        }
      } else if (err.message?.includes('connection') || err.message?.includes('network')) {
        errorMsg = 'Network connection issue. API keys will be stored locally until connection is restored.'
      }

      setError(errorMsg)
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestConnection = async () => {
    if (!apiKeys.retell_api_key) {
      setError('Please enter an API key before testing')
      return
    }

    setIsTesting(true)
    setTestResult(null)
    setError(null)

    try {
      // Update retell service with current credentials for testing
      retellService.updateCredentials(
        apiKeys.retell_api_key,
        apiKeys.call_agent_id,
        apiKeys.sms_agent_id,
        apiKeys.phone_number
      )

      const result = await retellService.testConnection()

      setTestResult({
        success: result.success,
        message: result.success
          ? 'API connection successful! Your credentials are working correctly.'
          : result.message || 'Connection test failed'
      })

    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection test failed'
      })
    } finally {
      setIsTesting(false)
    }
  }

  const handleSave = async () => {
    if (!validateApiKeys()) {
      setError('Please fix validation errors before saving')
      return
    }

    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)
    setTestResult(null)

    try {
      // Get the current storage method before saving
      const testResult = await apiKeyFallbackService.testSchemaHandling(user.id)
      const currentMethod = testResult.fallbackMethod

      const response = await enhancedUserService.updateUserApiKeys(user.id, apiKeys)

      if (response.status === 'success') {
        // Update schema status after successful save
        await checkSchemaStatus()

        // Create detailed success message based on storage method
        let successMsg = 'API keys saved successfully!'

        if (currentMethod === 'user_profiles_full') {
          successMsg += ' (Stored in primary database)'
        } else if (currentMethod === 'user_profiles_partial_plus_user_settings') {
          successMsg += ' (Stored using backup method due to database schema)'
        } else if (currentMethod === 'user_settings_or_localStorage') {
          successMsg += ' (Stored using fallback method - database schema needs updating)'
        } else if (currentMethod === 'localStorage_fallback') {
          successMsg += ' (Stored locally - database connection unavailable)'
        }

        setSuccessMessage(successMsg)
        setHasUnsavedChanges(false)

        // Update retell service with new credentials
        retellService.updateCredentials(
          apiKeys.retell_api_key,
          apiKeys.call_agent_id,
          apiKeys.sms_agent_id,
          apiKeys.phone_number
        )

        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('apiConfigurationReady', {
          detail: {
            retellApiKey: apiKeys.retell_api_key,
            callAgentId: apiKeys.call_agent_id,
            smsAgentId: apiKeys.sms_agent_id,
            phoneNumber: apiKeys.phone_number
          }
        }))

        setTimeout(() => setSuccessMessage(null), 7000) // Extended timeout for longer messages
      } else {
        // Enhanced error handling with storage method context
        let errorMsg = response.error || 'Failed to save API keys'

        if (response.error?.includes('encrypted_agent_config')) {
          errorMsg = 'Database schema issue detected. Using fallback storage method...'

          // Retry with explicit fallback awareness
          try {
            const fallbackResult = await apiKeyFallbackService.storeApiKeys(user.id, apiKeys)
            if (fallbackResult.status === 'success') {
              setSuccessMessage('API keys saved using fallback method! Database schema needs updating.')
              setHasUnsavedChanges(false)
              await checkSchemaStatus()
              setTimeout(() => setSuccessMessage(null), 7000)
              return
            }
          } catch (fallbackError) {
            errorMsg += ` Fallback also failed: ${fallbackError.message}`
          }
        }

        setError(errorMsg)
      }
    } catch (err: any) {
      let errorMsg = err.message || 'Failed to save API keys'

      // Provide user-friendly error messages for common issues
      if (err.message?.includes('encrypted_agent_config')) {
        errorMsg = 'Database schema issue detected. Trying fallback storage...'

        // Attempt emergency fallback
        try {
          const fallbackResult = await apiKeyFallbackService.storeApiKeys(user.id, apiKeys)
          if (fallbackResult.status === 'success') {
            setSuccessMessage('API keys saved using emergency fallback! Please contact administrator about database schema.')
            setHasUnsavedChanges(false)
            await checkSchemaStatus()
            setTimeout(() => setSuccessMessage(null), 8000)
            return
          }
        } catch (fallbackError) {
          errorMsg += ` Emergency fallback failed: ${fallbackError.message}`
        }
      } else if (err.message?.includes('connection') || err.message?.includes('network')) {
        errorMsg = 'Network connection issue. API keys will be stored locally until connection is restored.'
      }

      setError(errorMsg)
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestConnection = async () => {
    if (!apiKeys.retell_api_key) {
      setError('Please enter an API key before testing')
      return
    }

    setIsTesting(true)
    setTestResult(null)
    setError(null)

    try {
      // Update retell service with current credentials for testing
      retellService.updateCredentials(
        apiKeys.retell_api_key,
        apiKeys.call_agent_id,
        apiKeys.sms_agent_id,
        apiKeys.phone_number
      )

      const result = await retellService.testConnection()

      setTestResult({
        success: result.success,
        message: result.success
          ? 'API connection successful! Your credentials are working correctly.'
          : result.message || 'Connection test failed'
      })

    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection test failed'
      })
    } finally {
      setIsTesting(false)
    }
  }

  const handleCopyToClipboard = async (field: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }

  const maskApiKey = (apiKey: string) => {
    if (!apiKey) return ''
    if (apiKey.length <= 8) return '••••••••'
    return apiKey.substring(0, 4) + '••••••••' + apiKey.substring(apiKey.length - 4)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-600" />
            API Key Management
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Configure your API credentials for call and SMS services
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={checkSchemaStatus}
            disabled={isLoading}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Check database schema status"
          >
            <Settings className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={loadApiKeys}
            disabled={isLoading}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Refresh API keys"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 flex items-start gap-3 mb-6">
          <Check className="w-5 h-5 flex-shrink-0 mt-0.5 text-green-600 dark:text-green-400" />
          <div className="flex-1">
            <p className="text-sm text-green-800 dark:text-green-200">{successMessage}</p>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 flex items-start gap-3 mb-6">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
          <div className="flex-1">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Test Result */}
      {testResult && (
        <div className={`border rounded-lg p-4 flex items-start gap-3 mb-6 ${
          testResult.success
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
        }`}>
          <div className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
            testResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {testResult.success ? <Check /> : <AlertTriangle />}
          </div>
          <div className="flex-1">
            <h4 className={`text-sm font-medium ${
              testResult.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
            }`}>
              Connection Test {testResult.success ? 'Passed' : 'Failed'}
            </h4>
            <p className={`text-sm mt-1 ${
              testResult.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
            }`}>
              {testResult.message}
            </p>
          </div>
          <button
            onClick={() => setTestResult(null)}
            className={testResult.success
              ? 'text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200'
              : 'text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200'
            }
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading API keys...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* API Key Field */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                API Key *
              </label>
              <div className="flex items-center gap-2">
                {apiKeys.retell_api_key && (
                  <>
                    <button
                      onClick={() => handleCopyToClipboard('retell_api_key', apiKeys.retell_api_key)}
                      className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      title="Copy API key"
                    >
                      {copiedField === 'retell_api_key' ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      title={showApiKey ? 'Hide API key' : 'Show API key'}
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKeys.retell_api_key}
                onChange={(e) => setApiKeys({ ...apiKeys, retell_api_key: e.target.value })}
                placeholder="Enter your Retell API key"
                className={`w-full px-3 py-2 pr-12 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  validationErrors.retell_api_key ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <Key className="w-4 h-4 text-gray-400" />
              </div>
            </div>
            {validationErrors.retell_api_key && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.retell_api_key}</p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Your API key is encrypted and stored securely
            </p>
          </div>

          {/* Agent IDs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Call Agent ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={apiKeys.call_agent_id}
                  onChange={(e) => setApiKeys({ ...apiKeys, call_agent_id: e.target.value })}
                  placeholder="Enter Call Agent ID (e.g., oBeDLoLOeuAbiuaMFXRtDOLriTJ5tSxD)"
                  className={`w-full px-3 py-2 pr-12 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    validationErrors.call_agent_id ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <Settings className="w-4 h-4 text-gray-400" />
                </div>
                {apiKeys.call_agent_id && (
                  <button
                    onClick={() => handleCopyToClipboard('call_agent_id', apiKeys.call_agent_id)}
                    className="absolute inset-y-0 right-8 pr-1 flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    title="Copy Call Agent ID"
                  >
                    {copiedField === 'call_agent_id' ? (
                      <Check className="w-3 h-3 text-green-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>
              {validationErrors.call_agent_id && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.call_agent_id}</p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Agent used for outbound calls. No specific prefix required - just use your Agent ID from Retell dashboard.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                SMS/Chat Agent ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={apiKeys.sms_agent_id}
                  onChange={(e) => setApiKeys({ ...apiKeys, sms_agent_id: e.target.value })}
                  placeholder="Enter SMS Agent ID (e.g., pLmNoPqRsTuVwXyZ1234567890AbCdEf)"
                  className={`w-full px-3 py-2 pr-12 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    validationErrors.sms_agent_id ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <Settings className="w-4 h-4 text-gray-400" />
                </div>
                {apiKeys.sms_agent_id && (
                  <button
                    onClick={() => handleCopyToClipboard('sms_agent_id', apiKeys.sms_agent_id)}
                    className="absolute inset-y-0 right-8 pr-1 flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    title="Copy SMS Agent ID"
                  >
                    {copiedField === 'sms_agent_id' ? (
                      <Check className="w-3 h-3 text-green-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>
              {validationErrors.sms_agent_id && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.sms_agent_id}</p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Agent used for SMS and chat conversations. No specific prefix required - just use your Agent ID from Retell dashboard.
              </p>
            </div>
          </div>

          {/* Phone Number Field */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              Phone Number (E.164 Format)
            </label>
            <div className="relative">
              <input
                type="tel"
                value={apiKeys.phone_number}
                onChange={(e) => setApiKeys({ ...apiKeys, phone_number: e.target.value })}
                placeholder="Enter phone number (e.g., +12345678901)"
                className={`w-full px-3 py-2 pr-12 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  validationErrors.phone_number ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <Phone className="w-4 h-4 text-gray-400" />
              </div>
              {apiKeys.phone_number && (
                <button
                  onClick={() => handleCopyToClipboard('phone_number', apiKeys.phone_number)}
                  className="absolute inset-y-0 right-8 pr-1 flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  title="Copy Phone Number"
                >
                  {copiedField === 'phone_number' ? (
                    <Check className="w-3 h-3 text-green-600" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              )}
            </div>
            {validationErrors.phone_number && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.phone_number}</p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Phone number for outbound calls in E.164 format. Examples: +1234567890 (US), +442012345678 (UK), +61234567890 (AU)
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges || Object.keys(validationErrors).length > 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isSaving ? 'Saving...' : 'Save API Keys'}
            </button>

            <button
              onClick={handleTestConnection}
              disabled={isTesting || !apiKeys.retell_api_key}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isTesting ? (
                <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <TestTube className="w-4 h-4" />
              )}
              {isTesting ? 'Testing...' : 'Test Connection'}
            </button>
          </div>

          {/* Status Panel */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-medium text-blue-900 dark:text-blue-100">Configuration Status</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-700 dark:text-blue-300">API Key</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${apiKeys.retell_api_key ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    {apiKeys.retell_api_key ? 'Configured' : 'Not configured'}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-700 dark:text-blue-300">Call Agent</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${apiKeys.call_agent_id ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    {apiKeys.call_agent_id ? 'Configured' : 'Not configured'}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-700 dark:text-blue-300">SMS Agent</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${apiKeys.sms_agent_id ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    {apiKeys.sms_agent_id ? 'Configured' : 'Not configured'}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-700 dark:text-blue-300">Phone Number</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${apiKeys.phone_number ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    {apiKeys.phone_number ? 'Configured' : 'Not configured'}
                  </span>
                </div>
              </div>
            </div>
            {hasUnsavedChanges && (
              <div className="mt-3 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4" />
                <span>You have unsaved changes</span>
              </div>
            )}
          </div>

          {/* Storage Method Information Panel */}
          {(storageMethod || schemaStatus) && (
            <div className={`border rounded-lg p-4 ${
              storageMethod === 'user_profiles_full'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
                : storageMethod === 'user_profiles_partial_plus_user_settings'
                ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700'
                : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-5 h-5 ${
                  storageMethod === 'user_profiles_full'
                    ? 'text-green-600 dark:text-green-400'
                    : storageMethod === 'user_profiles_partial_plus_user_settings'
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-orange-600 dark:text-orange-400'
                }`}>
                  {storageMethod === 'user_profiles_full' ? (
                    <Check />
                  ) : (
                    <AlertTriangle />
                  )}
                </div>
                <h3 className={`font-medium ${
                  storageMethod === 'user_profiles_full'
                    ? 'text-green-900 dark:text-green-100'
                    : storageMethod === 'user_profiles_partial_plus_user_settings'
                    ? 'text-yellow-900 dark:text-yellow-100'
                    : 'text-orange-900 dark:text-orange-100'
                }`}>
                  Storage Method Status
                </h3>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${
                    storageMethod === 'user_profiles_full'
                      ? 'text-green-700 dark:text-green-300'
                      : storageMethod === 'user_profiles_partial_plus_user_settings'
                      ? 'text-yellow-700 dark:text-yellow-300'
                      : 'text-orange-700 dark:text-orange-300'
                  }`}>
                    Database Schema
                  </span>
                  <span className={`text-xs ${
                    storageMethod === 'user_profiles_full'
                      ? 'text-green-600 dark:text-green-400'
                      : storageMethod === 'user_profiles_partial_plus_user_settings'
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-orange-600 dark:text-orange-400'
                  }`}>
                    {storageMethod === 'user_profiles_full'
                      ? 'Complete (Optimal)'
                      : storageMethod === 'user_profiles_partial_plus_user_settings'
                      ? 'Partial (Backup method active)'
                      : 'Incomplete (Fallback method active)'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className={`text-sm ${
                    storageMethod === 'user_profiles_full'
                      ? 'text-green-700 dark:text-green-300'
                      : storageMethod === 'user_profiles_partial_plus_user_settings'
                      ? 'text-yellow-700 dark:text-yellow-300'
                      : 'text-orange-700 dark:text-orange-300'
                  }`}>
                    Storage Location
                  </span>
                  <span className={`text-xs ${
                    storageMethod === 'user_profiles_full'
                      ? 'text-green-600 dark:text-green-400'
                      : storageMethod === 'user_profiles_partial_plus_user_settings'
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-orange-600 dark:text-orange-400'
                  }`}>
                    {storageMethod === 'user_profiles_full'
                      ? 'Primary Database'
                      : storageMethod === 'user_profiles_partial_plus_user_settings'
                      ? 'Mixed (Profile + Settings)'
                      : storageMethod === 'user_settings_or_localStorage'
                      ? 'Settings Table'
                      : 'Local Storage'}
                  </span>
                </div>

                {schemaStatus && (
                  <div className="mt-3 p-2 bg-white dark:bg-gray-800 rounded text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span>Agent Config Column:</span>
                      <span className={schemaStatus.hasAgentConfig ? 'text-green-600' : 'text-red-600'}>
                        {schemaStatus.hasAgentConfig ? 'Available' : 'Missing'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Retell Key Column:</span>
                      <span className={schemaStatus.hasRetellKey ? 'text-green-600' : 'text-red-600'}>
                        {schemaStatus.hasRetellKey ? 'Available' : 'Missing'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className={`mt-3 text-xs ${
                storageMethod === 'user_profiles_full'
                  ? 'text-green-700 dark:text-green-300'
                  : storageMethod === 'user_profiles_partial_plus_user_settings'
                  ? 'text-yellow-700 dark:text-yellow-300'
                  : 'text-orange-700 dark:text-orange-300'
              }`}>
                {storageMethod === 'user_profiles_full' && (
                  'Your API keys are being stored using the optimal method in the primary database.'
                )}
                {storageMethod === 'user_profiles_partial_plus_user_settings' && (
                  'Your API keys are being stored using a backup method due to partial database schema. Performance may be slightly reduced.'
                )}
                {storageMethod === 'user_settings_or_localStorage' && (
                  'Your API keys are being stored using a fallback method. Please contact your administrator to update the database schema for optimal performance.'
                )}
                {storageMethod === 'localStorage_fallback' && (
                  'Your API keys are being stored locally due to database connection issues. They will sync when the connection is restored.'
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}