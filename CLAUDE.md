# **CareXPS Healthcare CRM - Claude Development Guide**

## **Project Overview**

CareXPS is a HIPAA-compliant healthcare CRM built with React/TypeScript and Vite. It integrates with Retell AI for voice calls, Supabase for data persistence, Azure AD for authentication, and includes comprehensive security features for healthcare compliance.

**Key Features:**
- AI-powered voice calling via Retell AI
- SMS management with Twilio integration
- HIPAA-compliant audit logging and encryption
- Multi-factor authentication (MFA)
- Real-time cross-device synchronization
- Progressive Web App (PWA) capabilities
- Azure Static Web Apps deployment

---

## **Build System & Development Commands**

### **Core Scripts (package.json)**
```bash
# Development
npm run dev              # Start development server on port 3000

# Building
npm run build           # Production build (no type checking)
npm run build:check     # Production build with TypeScript checking

# Testing
npm run test            # Run Vitest tests
npm run test:coverage   # Run tests with coverage report

# Linting & Maintenance
npm run lint            # ESLint checking
npm run audit:fix       # Fix npm security issues
npm run update:deps     # Update dependencies
```

### **Vite Configuration**
- **Build Target**: ES2015 with Terser minification
- **Dev Server**: Port 3000 with security headers
- **PWA**: Enabled with workbox caching
- **Chunks**: Optimized splitting (vendor, html2canvas chunks)
- **Azure Support**: Auto-copies `staticwebapp.config.json` and `404.html`

---

## **Architecture Overview**

### **Frontend Stack**
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5.4.4
- **Routing**: React Router DOM v6
- **Styling**: Tailwind CSS with custom healthcare theme
- **State Management**: React Query (@tanstack/react-query)
- **Forms**: React Hook Form with Zod validation
- **UI Components**: Custom components with Lucide React icons

### **Authentication & Security**
- **Primary Auth**: Azure AD via MSAL (@azure/msal-browser)
- **MFA**: TOTP-based multi-factor authentication
- **Session Management**: Configurable timeout (default 15 min)
- **Encryption**: AES-256-GCM for PHI data
- **Audit Logging**: Comprehensive HIPAA-compliant logging

### **Data Layer**
- **Database**: Supabase (PostgreSQL)
- **Real-time**: Supabase realtime subscriptions
- **Local Storage**: Encrypted localStorage wrapper
- **Cross-device Sync**: Automatic synchronization
- **Fallback**: localStorage-only mode when Supabase unavailable

### **External Integrations**
- **Voice AI**: Retell AI for conversational AI calls
- **SMS**: Twilio for SMS messaging
- **PDF Generation**: jsPDF for report exports
- **Currency**: Exchange rate APIs for cost calculations
- **Help Chat**: OpenAI GPT for in-app assistance

---

## **Project Structure**

```
src/
├── components/           # Reusable UI components
│   ├── auth/            # Authentication components (MFA, login)
│   ├── common/          # Shared components (modals, forms)
│   ├── layout/          # Layout components (header, sidebar, nav)
│   ├── security/        # Security-related components
│   ├── settings/        # Settings management components
│   └── ui/              # Base UI components (buttons, inputs)
├── contexts/            # React contexts
│   ├── AuthContext.tsx      # Authentication state
│   ├── SupabaseContext.tsx  # Supabase client
│   └── SecurityContext.tsx  # Security settings
├── hooks/               # Custom React hooks
│   ├── useSupabaseAuth.ts   # Supabase authentication
│   ├── useUserSettings.ts   # User preferences
│   ├── useSessionTimeout.ts # Session management
│   └── useDebounce.ts       # Utility hooks
├── pages/               # Route components
│   ├── DashboardPage.tsx    # Analytics dashboard
│   ├── CallsPage.tsx        # Voice call management
│   ├── SMSPage.tsx          # SMS conversations
│   ├── SettingsPage.tsx     # User settings
│   └── UserManagementPage.tsx # Admin user management
├── services/            # Business logic and API services
│   ├── authService.ts       # Authentication logic
│   ├── supabaseService.ts   # Database operations
│   ├── retellService.ts     # Retell AI integration
│   ├── mfaService.ts        # Multi-factor auth
│   ├── auditLogger.ts       # HIPAA audit logging
│   ├── chatService.ts       # Chat/conversation management
│   ├── notesService.ts      # Notes with cross-device sync
│   └── userSettingsService.ts # Settings management
├── types/               # TypeScript type definitions
│   ├── index.ts            # Core types (User, Call, SMS, etc.)
│   └── supabase.ts         # Supabase database types
├── utils/               # Utility functions
│   ├── encryption.ts       # Encryption utilities
│   ├── themeManager.ts     # Dark/light theme
│   └── authenticationMaster.ts # Auth debugging
├── config/              # Configuration files
│   ├── supabase.ts         # Supabase client setup
│   └── msalConfig.ts       # Azure AD configuration
└── migrations/          # Database migration scripts
```

---

## **Key Patterns & Conventions**

### **Service Layer Pattern**
All business logic is encapsulated in services with consistent interfaces:
```typescript
// Example service structure
export const exampleService = {
  // Async operations with error handling
  async getData(): Promise<{ status: 'success' | 'error', data?: any, error?: string }>,

  // Synchronous operations for performance-critical paths
  getDataSync(): any,

  // Event-driven updates
  initialize(): void,

  // Cleanup
  destroy(): void
}
```

### **Error Handling**
- **Graceful Degradation**: App works offline with localStorage fallback
- **User-Friendly Messages**: No technical errors exposed to users
- **Comprehensive Logging**: All errors logged for debugging
- **Retry Logic**: Automatic retries with exponential backoff

### **Security Patterns**
- **PHI Protection**: All healthcare data encrypted at rest and in transit
- **Audit Trail**: Every action logged with user, timestamp, and details
- **Session Security**: Configurable timeouts, emergency logout (Ctrl+Shift+L)
- **CSP Compliance**: Strict Content Security Policy in production

### **State Management**
- **Local State**: React useState for component-specific data
- **Global State**: React Context for user, auth, and settings
- **Server State**: React Query for data fetching and caching
- **Persistence**: Custom hooks for localStorage with encryption

---

## **Configuration Files**

### **Environment Variables (.env.local)**
```bash
# Supabase (Required for full functionality)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Azure AD (Required for authentication)
VITE_AZURE_CLIENT_ID=your-azure-client-id
VITE_AZURE_TENANT_ID=your-azure-tenant-id

# Retell AI (Required for voice calls)
VITE_RETELL_API_KEY=your-retell-api-key

# Security (Required in production)
VITE_HIPAA_MODE=true
VITE_PHI_ENCRYPTION_KEY=your-phi-key
VITE_AUDIT_ENCRYPTION_KEY=your-audit-key

# Optional integrations
VITE_OPENAI_API_KEY=your-openai-key  # For help chatbot
```

### **TypeScript Configuration**
- **Strict Mode**: Enabled with all strict checks
- **Path Aliases**: `@/*` maps to `./src/*`
- **Target**: ES2020 with DOM libraries
- **Module Resolution**: Bundler (Vite-optimized)

### **Tailwind Theme**
Custom healthcare-focused design system:
- **Colors**: Primary (blue), success (green), warning (amber), danger (red)
- **Fonts**: Roboto (body), Inter (headings)
- **Animations**: Shimmer, pulse-soft for loading states
- **Shadows**: Healthcare-specific shadow utilities

---

## **Testing Setup**

### **Framework**: Vitest
- **Config**: Inherits from Vite configuration
- **Coverage**: v8 coverage provider
- **Location**: Tests in `src/test/` directory

### **Testing Patterns**
```typescript
// Service testing example
import { describe, it, expect, beforeEach } from 'vitest'
import { exampleService } from '@/services/exampleService'

describe('ExampleService', () => {
  beforeEach(() => {
    // Setup before each test
  })

  it('should handle success case', async () => {
    const result = await exampleService.getData()
    expect(result.status).toBe('success')
  })
})
```

---

## **Deployment & Environment**

### **Azure Static Web Apps**
- **Configuration**: `staticwebapp.config.json`
- **Routing**: SPA routing with fallback to `/index.html`
- **Headers**: Security headers including CSP
- **API Runtime**: Node.js 18

### **Security Headers**
```javascript
"Strict-Transport-Security": "max-age=31536000; includeSubDomains"
"X-Content-Type-Options": "nosniff"
"X-Frame-Options": "DENY"
"X-XSS-Protection": "1; mode=block"
"Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'..."
```

### **PWA Configuration**
- **Service Worker**: Auto-update with immediate activation
- **Caching**: NetworkFirst for Retell AI, cache for static assets
- **Manifest**: Standalone app with healthcare branding
- **Offline**: Graceful degradation to localStorage mode

---

## **Database Schema (Supabase)**

### **Key Tables**
- **`users`**: User profiles with Azure AD integration
- **`audit_logs`**: HIPAA-compliant audit trail
- **`notes`**: Cross-device synchronized notes
- **`calls`**: Voice call records and transcripts
- **`sms_messages`**: SMS conversation history
- **`patients`**: Encrypted patient information
- **`user_settings`**: User preferences and configuration

### **RLS (Row Level Security)**
All tables have RLS policies ensuring users can only access their own data or data they're authorized to see based on role.

---

## **Development Guidelines**

### **Before Making Changes**
1. **Check Documentation**: Review existing MD files for context
2. **Test Existing Functionality**: Ensure current features work
3. **Follow Security Patterns**: Never bypass encryption or audit logging
4. **Maintain HIPAA Compliance**: All PHI must be encrypted and audited

### **Common Development Tasks**

#### **Adding a New Service**
1. Create service in `src/services/`
2. Export from `src/services/index.ts`
3. Add TypeScript interfaces to `src/types/index.ts`
4. Create tests in `src/test/`
5. Document any new environment variables

#### **Adding a New Page**
1. Create component in `src/pages/`
2. Add route to `App.tsx`
3. Add navigation link in `src/components/layout/Navigation.tsx`
4. Update `getPageTitle()` function in `App.tsx`
5. Add any required permissions/MFA protection

#### **Database Changes**
1. Create migration script in `src/migrations/`
2. Update TypeScript types in `src/types/supabase.ts`
3. Update affected services
4. Test with both Supabase and localStorage fallback modes

### **Security Considerations**
- **Never log PHI**: Use `[REDACTED]` in logs for sensitive data
- **Encrypt at Rest**: All PHI stored in localStorage must be encrypted
- **Audit Everything**: User actions on PHI must be logged
- **Validate Inputs**: Use Zod schemas for all user inputs
- **CSP Compliance**: No inline scripts, use nonce for necessary inline styles

### **Performance Best Practices**
- **Lazy Loading**: Use React.lazy() for large components
- **Memoization**: Use useMemo/useCallback for expensive operations
- **Debouncing**: Use debounced inputs for search/filtering
- **Caching**: Leverage React Query for API data caching
- **Bundle Optimization**: Keep chunks under 2MB warning limit

---

## **Troubleshooting Common Issues**

### **Blank Screen on Load**
- Check browser console for errors
- Verify environment variables are set
- Try emergency logout: Ctrl+Shift+L
- Check if Supabase is accessible

### **Authentication Issues**
- Verify Azure AD configuration
- Check MSAL redirect URLs
- Clear localStorage and retry
- Verify user exists in Supabase users table

### **MFA Problems**
- Check if user has MFA enabled in settings
- Verify TOTP secret is properly stored
- Clear MFA sessions in localStorage
- Check audit logs for failed attempts

### **Sync Issues**
- Verify Supabase connection
- Check real-time subscription status
- Force refresh user data
- Check cross-device sync implementation

---

## **Important Notes for Claude**

1. **Never Bypass Security**: Always maintain encryption and audit logging
2. **HIPAA Compliance**: This is a healthcare application - treat all patient data as PHI
3. **Fallback Support**: Ensure features work even when Supabase is unavailable
4. **Emergency Features**: Respect the Ctrl+Shift+L emergency logout functionality
5. **Documentation**: Update this file when making architectural changes

---

*Last Updated: Generated by Claude Code*