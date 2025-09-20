// =====================================================
// User Settings Client-Side Implementation
// HIPAA-Compliant Healthcare CRM Application
// =====================================================

import { createClient } from '@supabase/supabase-js';

// Types for user settings
interface UserSettings {
  user_id: string;
  theme: 'light' | 'dark' | 'system';
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
    appointment_reminders: boolean;
    security_alerts: boolean;
  };
  language: string;
  timezone: string;
  preferences: {
    sidebar_collapsed: boolean;
    default_view: string;
    items_per_page: number;
    auto_save: boolean;
    accessibility: {
      high_contrast: boolean;
      font_size: 'small' | 'medium' | 'large';
      reduced_motion: boolean;
    };
  };
  created_at: string;
  updated_at: string;
}

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// =====================================================
// User Settings Service
// =====================================================

export class UserSettingsService {
  /**
   * Get current user's settings
   */
  static async getUserSettings(): Promise<{ data: UserSettings | null; error: any }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return { data: null, error: 'User not authenticated' };
      }

      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      return { data, error };
    } catch (error) {
      console.error('Error fetching user settings:', error);
      return { data: null, error };
    }
  }

  /**
   * Create initial settings for a new user
   */
  static async createUserSettings(settings: Partial<UserSettings>): Promise<{ data: UserSettings | null; error: any }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return { data: null, error: 'User not authenticated' };
      }

      const defaultSettings: Omit<UserSettings, 'user_id' | 'created_at' | 'updated_at'> = {
        theme: 'system',
        notifications: {
          email: true,
          push: true,
          sms: false,
          appointment_reminders: true,
          security_alerts: true,
        },
        language: 'en',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        preferences: {
          sidebar_collapsed: false,
          default_view: 'dashboard',
          items_per_page: 25,
          auto_save: true,
          accessibility: {
            high_contrast: false,
            font_size: 'medium',
            reduced_motion: false,
          },
        },
      };

      const newSettings = {
        ...defaultSettings,
        ...settings,
        user_id: user.id,
      };

      const { data, error } = await supabase
        .from('user_settings')
        .insert(newSettings)
        .select()
        .single();

      return { data, error };
    } catch (error) {
      console.error('Error creating user settings:', error);
      return { data: null, error };
    }
  }

  /**
   * Update user settings (handles the dark mode switch case)
   */
  static async updateUserSettings(updates: Partial<UserSettings>): Promise<{ data: UserSettings | null; error: any }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return { data: null, error: 'User not authenticated' };
      }

      // Remove fields that shouldn't be updated directly
      const { user_id, created_at, updated_at, ...updateData } = updates;

      const { data, error } = await supabase
        .from('user_settings')
        .update(updateData)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating user settings:', error);

        // If the error is about RLS policy violation, try to create the record
        if (error.code === '42501' || error.message.includes('row-level security')) {
          console.log('Settings record does not exist, creating new one...');
          return await this.createUserSettings(updates);
        }
      }

      return { data, error };
    } catch (error) {
      console.error('Error updating user settings:', error);
      return { data: null, error };
    }
  }

  /**
   * Upsert user settings (insert or update)
   * This is the recommended method for most use cases
   */
  static async upsertUserSettings(settings: Partial<UserSettings>): Promise<{ data: UserSettings | null; error: any }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return { data: null, error: 'User not authenticated' };
      }

      // Remove fields that shouldn't be updated directly
      const { created_at, updated_at, ...settingsData } = settings;

      const dataToUpsert = {
        ...settingsData,
        user_id: user.id,
      };

      const { data, error } = await supabase
        .from('user_settings')
        .upsert(dataToUpsert, {
          onConflict: 'user_id',
          ignoreDuplicates: false,
        })
        .select()
        .single();

      return { data, error };
    } catch (error) {
      console.error('Error upserting user settings:', error);
      return { data: null, error };
    }
  }

  /**
   * Switch theme (specific method for the dark mode issue)
   */
  static async switchTheme(theme: 'light' | 'dark' | 'system'): Promise<{ success: boolean; error?: any }> {
    try {
      const { data, error } = await this.upsertUserSettings({ theme });

      if (error) {
        console.error('Failed to sync theme to cloud:', error);

        // Store locally as fallback
        localStorage.setItem('user_theme', theme);

        return {
          success: false,
          error: `Failed to sync to cloud: ${error.message}. Settings saved locally only.`
        };
      }

      // Also store locally for immediate access
      localStorage.setItem('user_theme', theme);

      return { success: true };
    } catch (error) {
      console.error('Error switching theme:', error);

      // Store locally as fallback
      localStorage.setItem('user_theme', theme);

      return {
        success: false,
        error: `Failed to sync to cloud: ${error}. Settings saved locally only.`
      };
    }
  }

  /**
   * Get theme with fallback to local storage
   */
  static async getTheme(): Promise<'light' | 'dark' | 'system'> {
    try {
      const { data } = await this.getUserSettings();

      if (data?.theme) {
        return data.theme;
      }

      // Fallback to local storage
      const localTheme = localStorage.getItem('user_theme') as 'light' | 'dark' | 'system';
      return localTheme || 'system';
    } catch (error) {
      console.error('Error getting theme:', error);

      // Fallback to local storage
      const localTheme = localStorage.getItem('user_theme') as 'light' | 'dark' | 'system';
      return localTheme || 'system';
    }
  }

  /**
   * Initialize settings for a new user (call this after successful registration/login)
   */
  static async initializeUserSettings(): Promise<{ success: boolean; error?: any }> {
    try {
      const { data: existingSettings } = await this.getUserSettings();

      if (existingSettings) {
        console.log('User settings already exist');
        return { success: true };
      }

      const { data, error } = await this.createUserSettings({});

      if (error) {
        console.error('Error initializing user settings:', error);
        return { success: false, error };
      }

      console.log('User settings initialized successfully');
      return { success: true };
    } catch (error) {
      console.error('Error initializing user settings:', error);
      return { success: false, error };
    }
  }
}

// =====================================================
// React Hook Example (Optional)
// =====================================================

import { useState, useEffect } from 'react';

export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const { data, error } = await UserSettingsService.getUserSettings();

    if (error) {
      setError(error);
    } else {
      setSettings(data);
    }

    setLoading(false);
  };

  const updateSettings = async (updates: Partial<UserSettings>) => {
    const { data, error } = await UserSettingsService.upsertUserSettings(updates);

    if (error) {
      setError(error);
      return { success: false, error };
    } else {
      setSettings(data);
      setError(null);
      return { success: true };
    }
  };

  const switchTheme = async (theme: 'light' | 'dark' | 'system') => {
    const result = await UserSettingsService.switchTheme(theme);

    if (result.success && settings) {
      setSettings({ ...settings, theme });
    }

    return result;
  };

  return {
    settings,
    loading,
    error,
    updateSettings,
    switchTheme,
    refetch: loadSettings,
  };
}

// =====================================================
// Usage Example
// =====================================================

/*
// In your component:
import { useUserSettings } from './user-settings-client-example';

export function ThemeToggle() {
  const { settings, switchTheme, loading } = useUserSettings();

  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'system') => {
    const result = await switchTheme(newTheme);

    if (!result.success) {
      console.error('Theme switch error:', result.error);
      // Show user-friendly error message
      toast.error(result.error || 'Failed to save theme preference');
    } else {
      toast.success('Theme updated successfully');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <select
        value={settings?.theme || 'system'}
        onChange={(e) => handleThemeChange(e.target.value as any)}
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
    </div>
  );
}
*/