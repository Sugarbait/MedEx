/**
 * Demo Authentication Service for MedEx CRM
 * Provides simple username/password login for demo/testing purposes
 */

export interface DemoUser {
  id: string
  email: string
  password: string
  name: string
  role: 'super_user' | 'admin' | 'user'
  mfaEnabled: boolean
  mfaCode: string // Simple demo MFA code
}

// Demo users for testing
const DEMO_USERS: DemoUser[] = [
  {
    id: 'demo-admin-001',
    email: 'admin@medex.com',
    password: 'admin123',
    name: 'Demo Admin',
    role: 'super_user',
    mfaEnabled: true,
    mfaCode: '123456' // Simple fixed MFA code for demo
  },
  {
    id: 'demo-user-001',
    email: 'user@medex.com',
    password: 'user123',
    name: 'Demo User',
    role: 'user',
    mfaEnabled: false,
    mfaCode: ''
  }
]

export const demoAuthService = {
  /**
   * Authenticate user with email and password
   */
  login(email: string, password: string): { success: boolean; user?: DemoUser; error?: string } {
    const user = DEMO_USERS.find(u => u.email === email)

    if (!user) {
      return { success: false, error: 'User not found' }
    }

    if (user.password !== password) {
      return { success: false, error: 'Invalid password' }
    }

    return { success: true, user }
  },

  /**
   * Verify MFA code for demo user
   */
  verifyMFA(userId: string, code: string): { success: boolean; error?: string } {
    const user = DEMO_USERS.find(u => u.id === userId)

    if (!user) {
      return { success: false, error: 'User not found' }
    }

    if (!user.mfaEnabled) {
      return { success: true } // No MFA required
    }

    if (user.mfaCode === code) {
      return { success: true }
    }

    return { success: false, error: 'Invalid MFA code' }
  },

  /**
   * Get all demo users (for display on login page)
   */
  getDemoUsers(): Array<{ email: string; password: string; mfaCode: string; role: string }> {
    return DEMO_USERS.map(u => ({
      email: u.email,
      password: u.password,
      mfaCode: u.mfaEnabled ? u.mfaCode : 'Not required',
      role: u.role
    }))
  },

  /**
   * Check if email exists in demo users
   */
  isDemo(email: string): boolean {
    return DEMO_USERS.some(u => u.email === email)
  }
}
