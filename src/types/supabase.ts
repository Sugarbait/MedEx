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
      user_profiles: {
        Row: {
          id: string
          user_id: string
          display_name: string | null
          first_name: string | null
          last_name: string | null
          department: string | null
          phone: string | null
          bio: string | null
          location: string | null
          avatar_url: string | null
          preferences: Json
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          display_name?: string | null
          first_name?: string | null
          last_name?: string | null
          department?: string | null
          phone?: string | null
          bio?: string | null
          location?: string | null
          avatar_url?: string | null
          preferences?: Json
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          display_name?: string | null
          first_name?: string | null
          last_name?: string | null
          department?: string | null
          phone?: string | null
          bio?: string | null
          location?: string | null
          avatar_url?: string | null
          preferences?: Json
          metadata?: Json
          created_at?: string
          updated_at?: string
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
      user_mfa_configs: {
        Row: {
          id: string
          user_id: string
          encrypted_secret: string
          encrypted_backup_codes: Json
          is_active: boolean
          is_verified: boolean
          temporarily_disabled: boolean
          registered_devices: Json
          created_at: string
          updated_at: string
          verified_at: string | null
          disabled_at: string | null
          last_used_at: string | null
          created_by_device_fingerprint: string | null
          last_used_device_fingerprint: string | null
          metadata: Json
        }
        Insert: {
          id?: string
          user_id: string
          encrypted_secret: string
          encrypted_backup_codes?: Json
          is_active?: boolean
          is_verified?: boolean
          temporarily_disabled?: boolean
          registered_devices?: Json
          created_at?: string
          updated_at?: string
          verified_at?: string | null
          disabled_at?: string | null
          last_used_at?: string | null
          created_by_device_fingerprint?: string | null
          last_used_device_fingerprint?: string | null
          metadata?: Json
        }
        Update: {
          id?: string
          user_id?: string
          encrypted_secret?: string
          encrypted_backup_codes?: Json
          is_active?: boolean
          is_verified?: boolean
          temporarily_disabled?: boolean
          registered_devices?: Json
          created_at?: string
          updated_at?: string
          verified_at?: string | null
          disabled_at?: string | null
          last_used_at?: string | null
          created_by_device_fingerprint?: string | null
          last_used_device_fingerprint?: string | null
          metadata?: Json
        }
      }
      user_totp: {
        Row: {
          id: string
          user_id: string
          encrypted_secret: string
          backup_codes: Json
          enabled: boolean
          created_at: string
          last_used_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          encrypted_secret: string
          backup_codes?: Json
          enabled?: boolean
          created_at?: string
          last_used_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          encrypted_secret?: string
          backup_codes?: Json
          enabled?: boolean
          created_at?: string
          last_used_at?: string | null
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
      user_devices: {
        Row: {
          id: string
          user_id: string
          device_fingerprint: string
          device_name: string
          device_type: 'desktop' | 'mobile' | 'tablet'
          browser_info: Json
          os_info: Json
          is_trusted: boolean
          is_active: boolean
          last_seen: string
          registered_at: string
          last_sync: string
          encryption_key_hash: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          device_fingerprint: string
          device_name: string
          device_type: 'desktop' | 'mobile' | 'tablet'
          browser_info?: Json
          os_info?: Json
          is_trusted?: boolean
          is_active?: boolean
          last_seen?: string
          registered_at?: string
          last_sync?: string
          encryption_key_hash?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          device_fingerprint?: string
          device_name?: string
          device_type?: 'desktop' | 'mobile' | 'tablet'
          browser_info?: Json
          os_info?: Json
          is_trusted?: boolean
          is_active?: boolean
          last_seen?: string
          registered_at?: string
          last_sync?: string
          encryption_key_hash?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      device_sessions: {
        Row: {
          id: string
          user_id: string
          device_id: string
          session_token: string
          azure_session_id: string | null
          status: 'active' | 'expired' | 'revoked' | 'transferred'
          started_at: string
          last_activity: string
          expires_at: string
          transfer_token: string | null
          ip_address: string | null
          user_agent: string | null
          sync_enabled: boolean
          security_level: 'low' | 'standard' | 'high' | 'critical'
          mfa_verified: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          device_id: string
          session_token: string
          azure_session_id?: string | null
          status?: 'active' | 'expired' | 'revoked' | 'transferred'
          started_at?: string
          last_activity?: string
          expires_at: string
          transfer_token?: string | null
          ip_address?: string | null
          user_agent?: string | null
          sync_enabled?: boolean
          security_level?: 'low' | 'standard' | 'high' | 'critical'
          mfa_verified?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          device_id?: string
          session_token?: string
          azure_session_id?: string | null
          status?: 'active' | 'expired' | 'revoked' | 'transferred'
          started_at?: string
          last_activity?: string
          expires_at?: string
          transfer_token?: string | null
          ip_address?: string | null
          user_agent?: string | null
          sync_enabled?: boolean
          security_level?: 'low' | 'standard' | 'high' | 'critical'
          mfa_verified?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      sync_queue: {
        Row: {
          id: string
          user_id: string
          device_id: string
          operation_type: 'CREATE' | 'UPDATE' | 'DELETE' | 'BULK_UPDATE'
          table_name: string
          record_id: string | null
          data_payload: Json
          conflict_resolution_strategy: 'last_write_wins' | 'manual_merge' | 'user_prompt' | 'field_level_merge'
          priority: number
          status: 'pending' | 'processing' | 'completed' | 'failed' | 'conflict' | 'cancelled'
          retry_count: number
          max_retries: number
          created_at: string
          scheduled_for: string
          processed_at: string | null
          error_message: string | null
          conflict_data: Json | null
          checksum: string | null
          encryption_required: boolean
          phi_data: boolean
          metadata: Json
        }
        Insert: {
          id?: string
          user_id: string
          device_id: string
          operation_type: 'CREATE' | 'UPDATE' | 'DELETE' | 'BULK_UPDATE'
          table_name: string
          record_id?: string | null
          data_payload: Json
          conflict_resolution_strategy?: 'last_write_wins' | 'manual_merge' | 'user_prompt' | 'field_level_merge'
          priority?: number
          status?: 'pending' | 'processing' | 'completed' | 'failed' | 'conflict' | 'cancelled'
          retry_count?: number
          max_retries?: number
          created_at?: string
          scheduled_for?: string
          processed_at?: string | null
          error_message?: string | null
          conflict_data?: Json | null
          checksum?: string | null
          encryption_required?: boolean
          phi_data?: boolean
          metadata?: Json
        }
        Update: {
          id?: string
          user_id?: string
          device_id?: string
          operation_type?: 'CREATE' | 'UPDATE' | 'DELETE' | 'BULK_UPDATE'
          table_name?: string
          record_id?: string | null
          data_payload?: Json
          conflict_resolution_strategy?: 'last_write_wins' | 'manual_merge' | 'user_prompt' | 'field_level_merge'
          priority?: number
          status?: 'pending' | 'processing' | 'completed' | 'failed' | 'conflict' | 'cancelled'
          retry_count?: number
          max_retries?: number
          created_at?: string
          scheduled_for?: string
          processed_at?: string | null
          error_message?: string | null
          conflict_data?: Json | null
          checksum?: string | null
          encryption_required?: boolean
          phi_data?: boolean
          metadata?: Json
        }
      }
      cross_device_sync_events: {
        Row: {
          id: string
          user_id: string
          source_device_id: string | null
          target_device_id: string | null
          event_type: 'sync_start' | 'sync_complete' | 'conflict_detected' | 'conflict_resolved' | 'device_connected' | 'device_disconnected' | 'device_registered' | 'device_revoked' | 'session_transferred' | 'encryption_key_rotated' | 'security_violation'
          table_name: string | null
          record_count: number
          success: boolean
          error_message: string | null
          duration_ms: number | null
          security_context: Json
          ip_address: string | null
          user_agent: string | null
          session_id: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          source_device_id?: string | null
          target_device_id?: string | null
          event_type: 'sync_start' | 'sync_complete' | 'conflict_detected' | 'conflict_resolved' | 'device_connected' | 'device_disconnected' | 'device_registered' | 'device_revoked' | 'session_transferred' | 'encryption_key_rotated' | 'security_violation'
          table_name?: string | null
          record_count?: number
          success?: boolean
          error_message?: string | null
          duration_ms?: number | null
          security_context?: Json
          ip_address?: string | null
          user_agent?: string | null
          session_id?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          source_device_id?: string | null
          target_device_id?: string | null
          event_type?: 'sync_start' | 'sync_complete' | 'conflict_detected' | 'conflict_resolved' | 'device_connected' | 'device_disconnected' | 'device_registered' | 'device_revoked' | 'session_transferred' | 'encryption_key_rotated' | 'security_violation'
          table_name?: string | null
          record_count?: number
          success?: boolean
          error_message?: string | null
          duration_ms?: number | null
          security_context?: Json
          ip_address?: string | null
          user_agent?: string | null
          session_id?: string | null
          metadata?: Json
          created_at?: string
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
      device_type: 'desktop' | 'mobile' | 'tablet'
      session_status: 'active' | 'expired' | 'revoked' | 'transferred'
      security_level: 'low' | 'standard' | 'high' | 'critical'
      operation_type: 'CREATE' | 'UPDATE' | 'DELETE' | 'BULK_UPDATE'
      conflict_resolution_strategy: 'last_write_wins' | 'manual_merge' | 'user_prompt' | 'field_level_merge'
      sync_status: 'pending' | 'processing' | 'completed' | 'failed' | 'conflict' | 'cancelled'
      sync_event_type: 'sync_start' | 'sync_complete' | 'conflict_detected' | 'conflict_resolved' | 'device_connected' | 'device_disconnected' | 'device_registered' | 'device_revoked' | 'session_transferred' | 'encryption_key_rotated' | 'security_violation'
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

// Cross-device functionality types
export interface UserDevice extends Database['public']['Tables']['user_devices']['Row'] {
  // Extended with computed properties
  isOnline?: boolean
  lastSyncDuration?: number
  syncStatus?: 'up_to_date' | 'syncing' | 'behind' | 'conflict'
  deviceInfo?: {
    platform: string
    browser: string
    version: string
    capabilities: string[]
  }
}

export interface DeviceSession extends Database['public']['Tables']['device_sessions']['Row'] {
  // Extended with computed properties
  isCurrentSession?: boolean
  timeRemaining?: number
  canTransfer?: boolean
  device?: UserDevice
}

export interface SyncQueueItem extends Database['public']['Tables']['sync_queue']['Row'] {
  // Extended with computed properties
  estimatedProcessingTime?: number
  conflictDetails?: {
    conflictType: 'field_conflict' | 'timestamp_conflict' | 'version_conflict'
    conflictingFields: string[]
    localValue: any
    remoteValue: any
    suggestedResolution?: any
  }
  retrySchedule?: string
}

export interface CrossDeviceSyncEvent extends Database['public']['Tables']['cross_device_sync_events']['Row'] {
  // Extended with computed properties
  sourceDevice?: UserDevice
  targetDevice?: UserDevice
  humanReadableEvent?: string
  securityRisk?: 'none' | 'low' | 'medium' | 'high' | 'critical'
}

// Cross-device service response types
export interface DeviceRegistrationResult {
  device: UserDevice
  session: DeviceSession
  syncRequired: boolean
  trustLevel: 'untrusted' | 'basic' | 'trusted' | 'verified'
}

export interface SyncResult {
  success: boolean
  syncedTables: string[]
  conflictsDetected: number
  conflictsResolved: number
  errors: SyncError[]
  duration: number
  nextSyncScheduled?: string
}

export interface SyncError {
  table: string
  recordId?: string
  error: string
  severity: 'warning' | 'error' | 'critical'
  resolutionSuggestion?: string
}

export interface ConflictResolutionRequest {
  conflictId: string
  table: string
  recordId: string
  localData: any
  remoteData: any
  conflictType: 'field_conflict' | 'timestamp_conflict' | 'version_conflict'
  conflictingFields: string[]
  autoResolutionOptions: ConflictResolutionOption[]
}

export interface ConflictResolutionOption {
  strategy: 'take_local' | 'take_remote' | 'merge_fields' | 'manual_edit'
  description: string
  previewData?: any
  confidence: number
}

// Real-time subscription types for cross-device functionality
export type CrossDeviceRealtimeChannel =
  | 'user_devices'
  | 'device_sessions'
  | 'sync_queue'
  | 'cross_device_sync_events'
  | 'device_presence'
  | 'sync_conflicts'

export interface DevicePresenceState {
  deviceId: string
  userId: string
  status: 'online' | 'offline' | 'idle' | 'away'
  lastSeen: string
  currentActivity?: string
  syncEnabled: boolean
}

export interface SyncSubscriptionConfig {
  userId: string
  deviceId: string
  tables: string[]
  conflictResolution: 'auto' | 'prompt' | 'queue'
  priority: 'low' | 'normal' | 'high'
  encryptionRequired: boolean
}

// Device fingerprinting and security types
export interface DeviceFingerprint {
  hardware: {
    cpu: string
    memory: number
    screen: { width: number; height: number; colorDepth: number }
    timezone: string
    language: string
  }
  browser: {
    userAgent: string
    plugins: string[]
    features: string[]
    webgl: string
    canvas: string
  }
  network: {
    connection: string
    effectiveType?: string
    downlink?: number
  }
  behavioral?: {
    typingPattern?: number[]
    mouseMovement?: number[]
    interactionTiming?: number[]
  }
}

export interface DeviceSecurityContext {
  trustLevel: 'untrusted' | 'basic' | 'trusted' | 'verified'
  securityFeatures: {
    encryption: boolean
    biometrics: boolean
    secureStorage: boolean
    certificateValidation: boolean
  }
  riskFactors: {
    newDevice: boolean
    locationChange: boolean
    behaviorAnomaly: boolean
    securityViolations: number
  }
  lastSecurityCheck: string
}