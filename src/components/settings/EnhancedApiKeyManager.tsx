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
  TestTube
} from 'lucide-react'
import { enhancedUserService } from '@/services/enhancedUserService'
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
}

export const EnhancedApiKeyManager: React.FC<EnhancedApiKeyManagerProps> = ({ user }) => {
  const [apiKeys, setApiKeys] = useState<ApiKeyState>({
    retell_api_key: '',
    call_agent_id: '',
    sms_agent_id: ''
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

  // Visibility states for sensitive fields
  const [showApiKey, setShowApiKey] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Validation states
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  useEffect(() => {
    loadApiKeys()
  }, [user.id])

  // Track unsaved changes
  useEffect(() => {
    const hasChanges = apiKeys.retell_api_key !== '' ||
                      apiKeys.call_agent_id !== '' ||
                      apiKeys.sms_agent_id !== ''
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
          sms_agent_id: response.data.sms_agent_id || ''
        })
      } else {
        console.warn('No API keys found, using empty state')
        setApiKeys({
          retell_api_key: '',
          call_agent_id: '',
          sms_agent_id: ''
        })
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load API keys')
    } finally {
      setIsLoading(false)
    }
  }

  const validateApiKeys = () => {
    const errors: Record<string, string> = {}

    if (apiKeys.retell_api_key && !apiKeys.retell_api_key.startsWith('agent_')) {
      if (apiKeys.retell_api_key.length < 20) {
        errors.retell_api_key = 'API key appears too short. Please verify it\'s correct.'
      }
    }

    if (apiKeys.call_agent_id && !apiKeys.call_agent_id.startsWith('agent_')) {
      errors.call_agent_id = 'Call Agent ID should start with "agent_"'
    }

    if (apiKeys.sms_agent_id && !apiKeys.sms_agent_id.startsWith('agent_')) {
      errors.sms_agent_id = 'SMS Agent ID should start with "agent_"'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
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
      const response = await enhancedUserService.updateUserApiKeys(user.id, apiKeys)

      if (response.status === 'success') {
        setSuccessMessage('API keys saved successfully!')
        setHasUnsavedChanges(false)

        // Update retell service with new credentials
        retellService.updateCredentials(
          apiKeys.retell_api_key,
          apiKeys.call_agent_id,
          apiKeys.sms_agent_id
        )

        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('apiConfigurationReady', {
          detail: {
            retellApiKey: apiKeys.retell_api_key,
            callAgentId: apiKeys.call_agent_id,
            smsAgentId: apiKeys.sms_agent_id
          }
        }))

        setTimeout(() => setSuccessMessage(null), 5000)
      } else {
        setError(response.error || 'Failed to save API keys')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save API keys')
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
        apiKeys.sms_agent_id
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
        <button
          onClick={loadApiKeys}
          disabled={isLoading}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Refresh API keys"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
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
                  placeholder="agent_xxxxxxxxxx"
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
                Agent used for outbound calls
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
                  placeholder="agent_xxxxxxxxxx"
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
                Agent used for SMS and chat conversations
              </p>
            </div>
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
            </div>
            {hasUnsavedChanges && (
              <div className="mt-3 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4" />
                <span>You have unsaved changes</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}