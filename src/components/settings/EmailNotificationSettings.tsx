import React, { useState, useEffect } from 'react'
import { Mail, Plus, Trash2, TestTube, Bell, BellOff, Shield, AlertTriangle, MessageSquare, Phone, ShieldCheck } from 'lucide-react'
import { emailNotificationService, type EmailNotificationConfig } from '@/services/emailNotificationService'

interface EmailNotificationSettingsProps {
  user: any
}

export const EmailNotificationSettings: React.FC<EmailNotificationSettingsProps> = ({ user }) => {
  const [config, setConfig] = useState<EmailNotificationConfig | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)

  // Check if user is Super User
  const isSuperUser = user?.role === 'super_user'

  useEffect(() => {
    loadSettings()

    // Listen for real-time email config updates from other devices
    const handleEmailConfigUpdate = (event: CustomEvent) => {
      console.log('📧 Email settings updated from another device, refreshing UI')
      setConfig(event.detail.config)
      setMessage({ type: 'info', text: 'Email settings updated from another device' })
    }

    window.addEventListener('emailConfigUpdated', handleEmailConfigUpdate as EventListener)

    return () => {
      window.removeEventListener('emailConfigUpdated', handleEmailConfigUpdate as EventListener)
    }
  }, [])

  const loadSettings = async () => {
    try {
      setIsLoading(true)

      // Wait for service to initialize
      await emailNotificationService.initialize()

      const currentConfig = emailNotificationService.getConfiguration()
      setConfig(currentConfig || getDefaultConfig())

      console.log('📧 Email notification settings loaded:', currentConfig)
    } catch (error) {
      console.error('Failed to load email notification settings:', error)
      setMessage({ type: 'error', text: 'Failed to load notification settings' })
      setConfig(getDefaultConfig())
    } finally {
      setIsLoading(false)
    }
  }

  const getDefaultConfig = (): EmailNotificationConfig => ({
    enabled: false,
    recipientEmails: [],
    notificationTypes: {
      newSMS: true,
      newCall: true,
      securityAlerts: true,
      systemAlerts: true
    }
  })

  const handleSaveSettings = async () => {
    if (!config) return

    try {
      setIsSaving(true)
      setMessage(null)

      await emailNotificationService.updateConfiguration(config)

      setMessage({ type: 'success', text: 'Email notification settings saved successfully!' })
      console.log('✅ Email notification settings saved')
    } catch (error) {
      console.error('Failed to save email notification settings:', error)
      setMessage({ type: 'error', text: 'Failed to save notification settings' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddEmail = () => {
    if (!newEmail.trim() || !config) return

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' })
      return
    }

    if (config.recipientEmails.includes(newEmail)) {
      setMessage({ type: 'error', text: 'Email address already added' })
      return
    }

    setConfig({
      ...config,
      recipientEmails: [...config.recipientEmails, newEmail]
    })
    setNewEmail('')
    setMessage({ type: 'success', text: 'Email address added' })
  }

  const handleRemoveEmail = async (emailToRemove: string) => {
    if (!config) return

    const updatedConfig = {
      ...config,
      recipientEmails: config.recipientEmails.filter(email => email !== emailToRemove)
    }

    setConfig(updatedConfig)

    try {
      await emailNotificationService.updateConfiguration(updatedConfig)
      setMessage({ type: 'success', text: 'Email address removed and saved' })
    } catch (error) {
      console.error('Failed to save after removing email:', error)
      setMessage({ type: 'error', text: 'Email removed but failed to save. Click Save Settings.' })
    }
  }

  const handleTestEmail = async () => {
    if (!config || config.recipientEmails.length === 0) {
      setMessage({ type: 'error', text: 'Please add at least one email address first' })
      return
    }

    try {
      setIsTesting(true)
      setMessage({ type: 'info', text: 'Sending test email via Supabase...' })

      // Debug: Log environment variable availability
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      console.log('🔍 Environment Debug:', {
        hasAnonKey: !!anonKey,
        keyLength: anonKey?.length || 0,
        keyPreview: anonKey ? `${anonKey.substring(0, 20)}...` : 'undefined',
        environment: import.meta.env.MODE
      })

      if (!anonKey) {
        throw new Error('VITE_SUPABASE_ANON_KEY is not defined. Check build configuration.')
      }

      // Add 30-second timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      try {
        // Call Supabase Edge Function directly
        const response = await fetch('https://cpkslvmydfdevdftieck.supabase.co/functions/v1/send-email-notification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`
          },
          body: JSON.stringify({
            type: 'system_alert',
            record: {
              id: 'test-email',
              created_at: new Date().toISOString()
            },
            recipients: config.recipientEmails
          }),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HTTP ${response.status}: ${errorText}`)
        }

        const result = await response.json()
        console.log('📧 Supabase Edge Function result:', result)

        if (result.success) {
          const successCount = result.results?.filter((r: any) => r.success).length || config.recipientEmails.length
          setMessage({ type: 'success', text: `Test email sent successfully to ${successCount} recipient(s)! Check your inbox.` })
        } else {
          setMessage({ type: 'error', text: `Email failed: ${result.results?.[0]?.error || 'Unknown error'}` })
        }
      } catch (fetchError) {
        clearTimeout(timeoutId)
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('Request timed out after 30 seconds. Check Supabase logs for details.')
        }
        throw fetchError
      }
    } catch (error) {
      console.error('Test email failed:', error)
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to send test email. Please check your configuration.'
      })
    } finally {
      setIsTesting(false)
    }
  }

  const handleToggleNotificationType = (type: keyof EmailNotificationConfig['notificationTypes']) => {
    if (!config) return

    setConfig({
      ...config,
      notificationTypes: {
        ...config.notificationTypes,
        [type]: !config.notificationTypes[type]
      }
    })
  }

  // Show access denied for non-super users
  if (!isSuperUser) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-6 h-6 text-red-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Email Notification Settings
          </h3>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <p className="text-red-800 dark:text-red-200 font-medium">Access Restricted</p>
          </div>
          <p className="text-red-700 dark:text-red-300 mt-2">
            Email notification settings can only be configured by Super Users for security purposes.
          </p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 opacity-50 pointer-events-none">
      <div className="flex items-center gap-3 mb-6">
        <Mail className="w-6 h-6 text-gray-400" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Email Notification Settings
            <span className="ml-3 text-sm font-normal text-blue-600 dark:text-blue-400">Coming Soon</span>
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Configure Hostinger email notifications for system events (PHI-free)
          </p>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg border ${
          message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          message.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Enable/Disable Toggle */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config?.enabled || false}
              onChange={(e) => config && setConfig({ ...config, enabled: e.target.checked })}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Enable Email Notifications
            </span>
          </label>
          {config?.enabled ? (
            <Bell className="w-5 h-5 text-green-600" />
          ) : (
            <BellOff className="w-5 h-5 text-gray-400" />
          )}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 ml-6">
          When enabled, notifications will be sent via Hostinger SMTP (aibot@phaetonai.com)
        </p>
      </div>

      {/* Notification Types */}
      <div className="mb-6">
        <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3">
          Notification Types
        </h4>
        <div className="space-y-2">
          {[
            { key: 'newSMS' as const, label: 'New SMS Messages', icon: MessageSquare },
            { key: 'newCall' as const, label: 'New Voice Calls', icon: Phone },
            { key: 'securityAlerts' as const, label: 'Security Alerts', icon: ShieldCheck },
            { key: 'systemAlerts' as const, label: 'System Alerts', icon: AlertTriangle }
          ].map(({ key, label, icon: IconComponent }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config?.notificationTypes[key] || false}
                onChange={() => handleToggleNotificationType(key)}
                disabled={!config?.enabled}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
              />
              <span className="flex items-center gap-2">
                <IconComponent className={`w-4 h-4 ${
                  config?.enabled
                    ? key === 'newSMS' ? 'text-purple-600'
                      : key === 'newCall' ? 'text-blue-600'
                      : key === 'securityAlerts' ? 'text-green-600'
                      : 'text-orange-600'
                    : 'text-gray-400'
                }`} />
                <span className={`text-sm ${config?.enabled ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500'}`}>
                  {label}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Recipient Emails */}
      <div className="mb-6">
        <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3">
          Recipient Email Addresses
        </h4>

        {/* Add Email Input */}
        <div className="flex gap-2 mb-4">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddEmail()}
            placeholder="Enter email address"
            disabled={!config?.enabled}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
          />
          <button
            onClick={handleAddEmail}
            disabled={!config?.enabled || !newEmail.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>

        {/* Email List */}
        {config && config.recipientEmails.length > 0 ? (
          <div className="space-y-2">
            {config.recipientEmails.map((email, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <span className="text-sm text-gray-900 dark:text-gray-100">{email}</span>
                <button
                  onClick={() => handleRemoveEmail(email)}
                  disabled={!config.enabled}
                  className="text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Remove email"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            No email addresses configured
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleSaveSettings}
          disabled={isSaving || !config}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Mail className="w-4 h-4" />
          )}
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>

        <button
          onClick={handleTestEmail}
          disabled={isTesting || !config?.enabled || config.recipientEmails.length === 0}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isTesting ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <TestTube className="w-4 h-4" />
          )}
          {isTesting ? 'Sending...' : 'Send Test Email'}
        </button>
      </div>

      {/* HIPAA Compliance Notice */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              HIPAA Compliance Notice
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
              Email notifications contain NO Protected Health Information (PHI). Only general activity
              alerts are sent (e.g., "1 New SMS message received") to maintain HIPAA compliance.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}