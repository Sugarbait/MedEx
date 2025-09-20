export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          azure_ad_id: string
          email: string
          name: string
          role: 'admin' | 'healthcare_provider' | 'staff'
          mfa_enabled: boolean
          avatar_url: string | null
          last_login: string | null
          created_at: string
          updated_at: string
          is_active: boolean
          metadata: Json
        }
        Insert: {
          id?: string
          azure_ad_id: string
          email: string
          name: string
          role?: 'admin' | 'healthcare_provider' | 'staff'
          mfa_enabled?: boolean
          avatar_url?: string | null
          last_login?: string | null
          created_at?: string
          updated_at?: string
          is_active?: boolean
          metadata?: Json
        }
        Update: {
          id?: string
          azure_ad_id?: string
          email?: string
          name?: string
          role?: 'admin' | 'healthcare_provider' | 'staff'
          mfa_enabled?: boolean
          avatar_url?: string | null
          last_login?: string | null
          created_at?: string
          updated_at?: string
          is_active?: boolean
          metadata?: Json
        }
      }
      user_permissions: {
        Row: {
          id: string
          user_id: string
          resource: string
          actions: string[]
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          user_id: string
          resource: string
          actions: string[]
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          resource?: string
          actions?: string[]
          created_at?: string
          created_by?: string | null
        }
      }
      user_settings: {
        Row: {
          id: string
          user_id: string
          theme: 'light' | 'dark' | 'auto'
          notifications: Json
          security_preferences: Json
          dashboard_layout: Json | null
          communication_preferences: Json
          accessibility_settings: Json
          retell_config: Json | null
          created_at: string
          updated_at: string
          device_sync_enabled: boolean
          last_synced: string | null
        }
        Insert: {
          id?: string
          user_id: string
          theme?: 'light' | 'dark' | 'auto'
          notifications?: Json
          security_preferences?: Json
          dashboard_layout?: Json | null
          communication_preferences?: Json
          accessibility_settings?: Json
          retell_config?: Json | null
          created_at?: string
          updated_at?: string
          device_sync_enabled?: boolean
          last_synced?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          theme?: 'light' | 'dark' | 'auto'
          notifications?: Json
          security_preferences?: Json
          dashboard_layout?: Json | null
          communication_preferences?: Json
          accessibility_settings?: Json
          retell_config?: Json | null
          created_at?: string
          updated_at?: string
          device_sync_enabled?: boolean
          last_synced?: string | null
        }
      }
      patients: {
        Row: {
          id: string
          encrypted_first_name: string
          encrypted_last_name: string
          encrypted_phone: string | null
          encrypted_email: string | null
          preferences: Json
          tags: string[]
          last_contact: string | null
          created_at: string
          updated_at: string
          created_by: string
          is_active: boolean
        }
        Insert: {
          id?: string
          encrypted_first_name: string
          encrypted_last_name: string
          encrypted_phone?: string | null
          encrypted_email?: string | null
          preferences?: Json
          tags?: string[]
          last_contact?: string | null
          created_at?: string
          updated_at?: string
          created_by: string
          is_active?: boolean
        }
        Update: {
          id?: string
          encrypted_first_name?: string
          encrypted_last_name?: string
          encrypted_phone?: string | null
          encrypted_email?: string | null
          preferences?: Json
          tags?: string[]
          last_contact?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string
          is_active?: boolean
        }
      }
      calls: {
        Row: {
          id: string
          patient_id: string | null
          user_id: string
          start_time: string
          end_time: string | null
          duration: number | null
          status: 'active' | 'completed' | 'failed'
          encrypted_transcription: string | null
          encrypted_summary: string | null
          sentiment: Json | null
          tags: string[]
          retell_ai_call_id: string | null
          recording_url: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_id?: string | null
          user_id: string
          start_time: string
          end_time?: string | null
          duration?: number | null
          status?: 'active' | 'completed' | 'failed'
          encrypted_transcription?: string | null
          encrypted_summary?: string | null
          sentiment?: Json | null
          tags?: string[]
          retell_ai_call_id?: string | null
          recording_url?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          patient_id?: string | null
          user_id?: string
          start_time?: string
          end_time?: string | null
          duration?: number | null
          status?: 'active' | 'completed' | 'failed'
          encrypted_transcription?: string | null
          encrypted_summary?: string | null
          sentiment?: Json | null
          tags?: string[]
          retell_ai_call_id?: string | null
          recording_url?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      sms_messages: {
        Row: {
          id: string
          patient_id: string | null
          user_id: string | null
          direction: 'inbound' | 'outbound'
          encrypted_content: string
          timestamp: string
          status: 'sent' | 'delivered' | 'read' | 'failed'
          thread_id: string
          template_id: string | null
          contains_phi: boolean
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          patient_id?: string | null
          user_id?: string | null
          direction: 'inbound' | 'outbound'
          encrypted_content: string
          timestamp?: string
          status?: 'sent' | 'delivered' | 'read' | 'failed'
          thread_id: string
          template_id?: string | null
          contains_phi?: boolean
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          patient_id?: string | null
          user_id?: string | null
          direction?: 'inbound' | 'outbound'
          encrypted_content?: string
          timestamp?: string
          status?: 'sent' | 'delivered' | 'read' | 'failed'
          thread_id?: string
          template_id?: string | null
          contains_phi?: boolean
          metadata?: Json
          created_at?: string
        }
      }
      sms_templates: {
        Row: {
          id: string
          name: string
          content: string
          category: string
          is_approved: boolean
          variables: string[]
          created_by: string
          created_at: string
          updated_at: string
          is_active: boolean
        }
        Insert: {
          id?: string
          name: string
          content: string
          category: string
          is_approved?: boolean
          variables?: string[]
          created_by: string
          created_at?: string
          updated_at?: string
          is_active?: boolean
        }
        Update: {
          id?: string
          name?: string
          content?: string
          category?: string
          is_approved?: boolean
          variables?: string[]
          created_by?: string
          created_at?: string
          updated_at?: string
          is_active?: boolean
        }
      }
      security_events: {
        Row: {
          id: string
          user_id: string | null
          action: string
          resource: string
          timestamp: string
          ip_address: string | null
          user_agent: string | null
          success: boolean
          details: Json
          severity: 'low' | 'medium' | 'high' | 'critical'
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          resource: string
          timestamp?: string
          ip_address?: string | null
          user_agent?: string | null
          success: boolean
          details?: Json
          severity?: 'low' | 'medium' | 'high' | 'critical'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          resource?: string
          timestamp?: string
          ip_address?: string | null
          user_agent?: string | null
          success?: boolean
          details?: Json
          severity?: 'low' | 'medium' | 'high' | 'critical'
          created_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          table_name: string
          record_id: string | null
          old_values: Json | null
          new_values: Json | null
          timestamp: string
          ip_address: string | null
          user_agent: string | null
          session_id: string | null
          metadata: Json
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          table_name: string
          record_id?: string | null
          old_values?: Json | null
          new_values?: Json | null
          timestamp?: string
          ip_address?: string | null
          user_agent?: string | null
          session_id?: string | null
          metadata?: Json
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          table_name?: string
          record_id?: string | null
          old_values?: Json | null
          new_values?: Json | null
          timestamp?: string
          ip_address?: string | null
          user_agent?: string | null
          session_id?: string | null
          metadata?: Json
        }
      }
      user_sessions: {
        Row: {
          id: string
          user_id: string
          session_token: string
          azure_session_id: string | null
          created_at: string
          expires_at: string
          ip_address: string | null
          user_agent: string | null
          is_active: boolean
          last_activity: string
          device_info: Json
        }
        Insert: {
          id?: string
          user_id: string
          session_token: string
          azure_session_id?: string | null
          created_at?: string
          expires_at: string
          ip_address?: string | null
          user_agent?: string | null
          is_active?: boolean
          last_activity?: string
          device_info?: Json
        }
        Update: {
          id?: string
          user_id?: string
          session_token?: string
          azure_session_id?: string | null
          created_at?: string
          expires_at?: string
          ip_address?: string | null
          user_agent?: string | null
          is_active?: boolean
          last_activity?: string
          device_info?: Json
        }
      }
      mfa_challenges: {
        Row: {
          id: string
          user_id: string
          challenge_code: string
          method: string
          created_at: string
          expires_at: string
          verified_at: string | null
          attempts: number
          max_attempts: number
        }
        Insert: {
          id?: string
          user_id: string
          challenge_code: string
          method: string
          created_at?: string
          expires_at: string
          verified_at?: string | null
          attempts?: number
          max_attempts?: number
        }
        Update: {
          id?: string
          user_id?: string
          challenge_code?: string
          method?: string
          created_at?: string
          expires_at?: string
          verified_at?: string | null
          attempts?: number
          max_attempts?: number
        }
      }
      failed_login_attempts: {
        Row: {
          id: string
          email: string
          ip_address: string
          attempted_at: string
          user_agent: string | null
          reason: string | null
        }
        Insert: {
          id?: string
          email: string
          ip_address: string
          attempted_at?: string
          user_agent?: string | null
          reason?: string | null
        }
        Update: {
          id?: string
          email?: string
          ip_address?: string
          attempted_at?: string
          user_agent?: string | null
          reason?: string | null
        }
      }
      data_retention_policies: {
        Row: {
          id: string
          table_name: string
          retention_days: number
          auto_delete: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          table_name: string
          retention_days: number
          auto_delete?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          table_name?: string
          retention_days?: number
          auto_delete?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      compliance_assessments: {
        Row: {
          id: string
          assessment_date: string
          data_retention_compliance: number
          mfa_adoption: number
          encryption_coverage: number
          audit_log_completeness: number
          findings: Json
          created_by: string
        }
        Insert: {
          id?: string
          assessment_date?: string
          data_retention_compliance: number
          mfa_adoption: number
          encryption_coverage: number
          audit_log_completeness: number
          findings?: Json
          created_by: string
        }
        Update: {
          id?: string
          assessment_date?: string
          data_retention_compliance?: number
          mfa_adoption?: number
          encryption_coverage?: number
          audit_log_completeness?: number
          findings?: Json
          created_by?: string
        }
      }
      call_notes: {
        Row: {
          id: string
          call_id: string
          user_id: string
          encrypted_content: string
          is_pinned: boolean
          tags: string[]
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          call_id: string
          user_id: string
          encrypted_content: string
          is_pinned?: boolean
          tags?: string[]
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          call_id?: string
          user_id?: string
          encrypted_content?: string
          is_pinned?: boolean
          tags?: string[]
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      notes: {
        Row: {
          id: string
          reference_id: string
          reference_type: 'call' | 'sms'
          content: string
          content_type: 'plain' | 'html' | 'markdown'
          created_by: string | null
          created_by_name: string
          created_by_email: string | null
          created_at: string
          updated_at: string
          is_edited: boolean
          last_edited_by: string | null
          last_edited_by_name: string | null
          last_edited_at: string | null
          metadata: Json | null
        }
        Insert: {
          id?: string
          reference_id: string
          reference_type: 'call' | 'sms'
          content: string
          content_type?: 'plain' | 'html' | 'markdown'
          created_by?: string | null
          created_by_name: string
          created_by_email?: string | null
          created_at?: string
          updated_at?: string
          is_edited?: boolean
          last_edited_by?: string | null
          last_edited_by_name?: string | null
          last_edited_at?: string | null
          metadata?: Json | null
        }
        Update: {
          id?: string
          reference_id?: string
          reference_type?: 'call' | 'sms'
          content?: string
          content_type?: 'plain' | 'html' | 'markdown'
          created_by?: string | null
          created_by_name?: string
          created_by_email?: string | null
          created_at?: string
          updated_at?: string
          is_edited?: boolean
          last_edited_by?: string | null
          last_edited_by_name?: string | null
          last_edited_at?: string | null
          metadata?: Json | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_current_user_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      user_has_role: {
        Args: {
          required_role: 'admin' | 'healthcare_provider' | 'staff'
        }
        Returns: boolean
      }
      user_has_permission: {
        Args: {
          resource_name: string
          action_name: string
        }
        Returns: boolean
      }
      cleanup_expired_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      user_role: 'admin' | 'healthcare_provider' | 'staff'
      call_status: 'active' | 'completed' | 'failed'
      sms_direction: 'inbound' | 'outbound'
      sms_status: 'sent' | 'delivered' | 'read' | 'failed'
      communication_method: 'phone' | 'sms' | 'email'
      security_event_severity: 'low' | 'medium' | 'high' | 'critical'
      theme_preference: 'light' | 'dark' | 'auto'
      notification_type: 'email' | 'sms' | 'push' | 'in_app'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Extended types with decrypted data for client use
export interface SupabaseUser extends Database['public']['Tables']['users']['Row'] {
  permissions?: Database['public']['Tables']['user_permissions']['Row'][]
  settings?: UserSettings
}

export interface UserSettings extends Database['public']['Tables']['user_settings']['Row'] {
  notifications: {
    email: boolean
    sms: boolean
    push: boolean
    in_app: boolean
    call_alerts: boolean
    sms_alerts: boolean
    security_alerts: boolean
  }
  security_preferences: {
    session_timeout: number
    require_mfa: boolean
    password_expiry_reminder: boolean
    login_notifications: boolean
  }
  dashboard_layout: {
    widgets?: Array<{
      id: string
      type: string
      position: { x: number; y: number }
      size: { width: number; height: number }
      config?: Record<string, any>
    }>
  }
  communication_preferences: {
    default_method: 'phone' | 'sms' | 'email'
    auto_reply_enabled: boolean
    business_hours: {
      enabled: boolean
      start: string
      end: string
      timezone: string
    }
  }
  accessibility_settings: {
    high_contrast: boolean
    large_text: boolean
    screen_reader: boolean
    keyboard_navigation: boolean
  }
  retell_config?: {
    api_key?: string // Encrypted in database
    call_agent_id?: string
    sms_agent_id?: string
  } | null
}

export interface DecryptedPatient extends Omit<Database['public']['Tables']['patients']['Row'], 'encrypted_first_name' | 'encrypted_last_name' | 'encrypted_phone' | 'encrypted_email'> {
  firstName: string
  lastName: string
  phone?: string
  email?: string
  preferences: {
    communication_method: 'phone' | 'sms' | 'email'
    timezone: string
  }
}

export interface DecryptedCall extends Omit<Database['public']['Tables']['calls']['Row'], 'encrypted_transcription' | 'encrypted_summary'> {
  transcription?: string
  summary?: string
  sentiment?: {
    score: number
    label: 'positive' | 'negative' | 'neutral'
    confidence: number
  }
}

export interface DecryptedSMSMessage extends Omit<Database['public']['Tables']['sms_messages']['Row'], 'encrypted_content'> {
  content: string
}

export interface DecryptedCallNote extends Omit<Database['public']['Tables']['call_notes']['Row'], 'encrypted_content'> {
  content: string
  metadata: {
    priority?: 'low' | 'medium' | 'high'
    category?: string
    follow_up_required?: boolean
    follow_up_date?: string
    [key: string]: any
  }
}

// Real-time subscription types
export type RealtimeChannel = 'user_settings' | 'calls' | 'sms_messages' | 'security_events' | 'call_notes' | 'notes'

export interface RealtimePayload<T = any> {
  schema: string
  table: string
  commit_timestamp: string
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: T | null
  old: T | null
}

// Service response types
export interface ServiceResponse<T = any> {
  data?: T
  error?: string
  status: 'success' | 'error'
}

export interface PaginatedResponse<T = any> extends ServiceResponse<T[]> {
  count?: number
  page?: number
  pageSize?: number
  hasMore?: boolean
}