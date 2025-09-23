# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# **CareXPS Healthcare CRM - Claude Development Guide**

## **Project Overview**

CareXPS is a HIPAA-compliant healthcare CRM built with React/TypeScript and Vite. It integrates with Retell AI for voice calls, Supabase for data persistence, Azure AD for authentication, and includes comprehensive security features for healthcare compliance.

**Key Features:**
- AI-powered voice calling via Retell AI
- SMS management with Twilio integration and cost optimization
- HIPAA-compliant audit logging and encryption (NIST 800-53 compliant)
- Multi-factor authentication (MFA) with TOTP
- Real-time cross-device synchronization
- Progressive Web App (PWA) capabilities
- Azure Static Web Apps deployment
- Demo mode fallback when services unavailable
- Emergency logout functionality (Ctrl+Shift+L)
- Advanced fuzzy search and filtering capabilities

---

## **Build System & Development Commands**

### **Core Scripts (package.json)**
```bash
# Development
npm run dev              # Start development server on port 3000

# Building
npm run build           # Production build (no type checking)
npm run build:check     # Production build with TypeScript checking
npm run preview         # Preview production build locally

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
- **PWA**: Enabled with workbox caching strategies
- **Chunks**: Optimized splitting (vendor, html2canvas chunks)
- **Azure Support**: Auto-copies `staticwebapp.config.json` and `404.html`
- **Custom Azure Plugin**: Handles static web app deployment files

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
- **Animations**: Framer Motion for smooth interactions

### **Authentication & Security**
- **Primary Auth**: Azure AD via MSAL (@azure/msal-browser)
- **MFA**: TOTP-based multi-factor authentication with OTPAuth
- **Session Management**: Configurable timeout (default 15 min)
- **Encryption**: AES-256-GCM for PHI data (NIST compliant)
- **Audit Logging**: Comprehensive HIPAA-compliant logging per Security Rule § 164.312(b)
- **Emergency Features**: Ctrl+Shift+L emergency logout

### **Data Layer**
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS)
- **Real-time**: Supabase realtime subscriptions with fallback
- **Local Storage**: Encrypted localStorage wrapper with migration support
- **Cross-device Sync**: Automatic synchronization with conflict resolution
- **Fallback**: localStorage-only mode when Supabase unavailable
- **Demo Mode**: Offline functionality for development and testing

### **External Integrations**
- **Voice AI**: Retell AI for conversational AI calls
- **SMS**: Twilio for SMS messaging with cost tracking
- **PDF Generation**: jsPDF for report exports with comprehensive chat analysis
- **Currency**: Exchange rate APIs for cost calculations
- **Help Chat**: OpenAI GPT for in-app assistance
- **QR Codes**: QRCode generation for MFA setup

---

## **Service Architecture**

The codebase features an extensive service layer with 40+ specialized services organized by functionality:

### **Core Services**
- **authService**: Azure AD and local authentication
- **supabaseService**: Database operations and real-time sync
- **retellService**: AI voice call management

### **Security Services**
- **auditLogger / auditService**: HIPAA-compliant audit trail
- **encryption / secureEncryption**: AES-256-GCM encryption
- **secureStorage**: Encrypted localStorage management
- **secureMfaService**: Multi-factor authentication
- **secureUserDataService**: Protected user data handling
- **storageSecurityMigration**: Security upgrade migrations

### **Communication Services**
- **chatService / optimizedChatService / simpleChatService**: Chat management variants
- **retellSMSService**: SMS integration with Retell AI
- **notesService**: Cross-device synchronized notes
- **toastNotificationService**: Real-time toast notifications for new records

### **Cost & Analytics Services**
- **twilioCostService**: SMS cost tracking and optimization
- **smsCostCacheService**: Cost data caching
- **analyticsService**: Usage analytics and reporting
- **fuzzySearchService**: Advanced search capabilities

### **User Management Services**
- **userProfileService**: User profile management
- **userManagementService**: Admin user operations
- **userSettingsService**: User preferences (multiple variants)
- **userSyncService**: Cross-device user synchronization
- **avatarStorageService**: Profile image management

### **Utility Services**
- **patientIdService**: Consistent patient ID generation
- **toastNotificationService**: In-app notifications
- **pdfExportService**: Document generation
- **optimizedApiService**: API performance optimization

### **Service Pattern**
All services follow consistent interfaces:
```typescript
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

---

## **Project Structure**

```
src/
├── components/           # Reusable UI components
│   ├── auth/            # MFA, login, authentication gates
│   ├── common/          # Modals, forms, shared components
│   ├── layout/          # Header, sidebar, navigation
│   ├── security/        # Security-related components
│   ├── settings/        # Settings management
│   └── ui/              # Base UI (buttons, inputs, error boundary)
├── contexts/            # React contexts
│   ├── AuthContext.tsx      # Authentication state
│   ├── SupabaseContext.tsx  # Supabase client
│   └── SecurityContext.tsx  # Security settings
├── hooks/               # Custom React hooks (15+ hooks)
│   ├── useSupabaseAuth.ts   # Supabase authentication
│   ├── useUserSettings.ts   # User preferences
│   ├── useSessionTimeout.ts # Session management
│   ├── useDebounce.ts       # Performance optimization
│   ├── useAutoRefresh.ts    # Automatic data refresh
│   ├── useNotesCount.ts     # Notes management
│   └── useOptimizedSMSCosts.ts # Cost optimization
├── pages/               # Route components
│   ├── DashboardPage.tsx    # Analytics dashboard with animated charts
│   ├── CallsPage.tsx        # Voice call management with toast notifications
│   ├── SMSPage.tsx          # SMS conversations with PDF export functionality
│   ├── SettingsPage.tsx     # User settings
│   ├── UserManagementPage.tsx # Admin user management
│   ├── AuditDashboard.tsx   # HIPAA audit viewing
│   └── MFAPage.tsx          # Multi-factor authentication
├── services/            # Business logic (40+ services)
├── types/               # TypeScript type definitions
├── utils/               # Utility functions (25+ utilities)
│   ├── encryption.ts       # Encryption utilities
│   ├── themeManager.ts     # Dark/light theme
│   ├── authenticationMaster.ts # Auth debugging
│   └── fixUserIssues.ts    # User data repair utilities
├── config/              # Configuration files
├── migrations/          # Database migration scripts
├── test/                # Vitest test files (8+ tests)
└── tests/               # Additional test directory
```

---

## **Key Patterns & Conventions**

### **Error Handling**
- **Graceful Degradation**: App works offline with localStorage fallback
- **User-Friendly Messages**: No technical errors exposed to users
- **Comprehensive Logging**: All errors logged with PHI redaction
- **Retry Logic**: Automatic retries with exponential backoff
- **Demo Mode**: Offline functionality when services unavailable

### **Security Patterns (HIPAA Compliance)**
- **PHI Protection**: All healthcare data encrypted at rest and in transit
- **Audit Trail**: Every action logged per HIPAA Security Rule § 164.312(b)
- **Session Security**: Configurable timeouts, emergency logout (Ctrl+Shift+L)
- **CSP Compliance**: Strict Content Security Policy in production
- **Data Redaction**: `[REDACTED]` for PHI in all console logs
- **Encryption Standards**: AES-256-GCM following NIST 800-53

### **State Management**
- **Local State**: React useState for component-specific data
- **Global State**: React Context for user, auth, and settings
- **Server State**: React Query for data fetching and caching
- **Persistence**: Custom hooks for localStorage with encryption
- **Real-time Sync**: Supabase subscriptions with fallback handling

### **React Hooks Stability Patterns**
**Critical for preventing infinite loops and excessive re-renders:**

```typescript
// ✅ CORRECT: Stable callback with useCallback and empty deps
const onProgress = useCallback((loaded: number, total: number) => {
  safeLog(`Progress: ${loaded}/${total}`)
}, []) // Empty dependency array for logging callbacks

// ✅ CORRECT: Ref-based callback management for unstable props
const callbackRef = useRef(options.onCallback)
useEffect(() => {
  callbackRef.current = options.onCallback
}, [options.onCallback])

const stableWrapper = useCallback((data) => {
  callbackRef.current?.(data)
}, []) // Stable wrapper with empty deps

// ❌ INCORRECT: Recreating callback on every render
const manager = useService({
  onProgress: (loaded, total) => log(`${loaded}/${total}`) // New function each render
})

// ❌ INCORRECT: Object in dependency array without memoization
useEffect(() => {
  loadData()
}, [chats, manager]) // manager is recreated each render
```

**Key principles:**
- Always use `useCallback` with empty `[]` deps for logging/progress callbacks
- Use refs to store unstable callbacks, access via stable wrapper
- Memoize objects passed to custom hooks with `useMemo`
- Prefer stable function references in dependency arrays

---

## **Testing Setup**

### **Framework**: Vitest
- **Config**: Inherits from Vite configuration
- **Coverage**: v8 coverage provider
- **Location**: Tests in `src/test/` and `src/tests/` directories
- **Playwright**: E2E testing support available

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

### **Test Categories**
- **Service Tests**: Business logic validation
- **Security Tests**: Encryption and audit logging
- **Integration Tests**: API and database operations
- **Component Tests**: React component behavior

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
- Force refresh user data using `fixUserIssues.forceRefreshAllUserData()`
- Check cross-device sync implementation

### **Supabase WebSocket Connection Errors**
**Console warnings about failed WebSocket connections are expected during development:**
- Error: `WebSocket connection to 'wss://...supabase.co/realtime/v1/websocket?apikey=dummy-key...' failed`
- Warning: `Real-time sync error, falling back to localStorage`

**This is normal behavior when:**
- Using development environment with placeholder/dummy API keys
- Supabase service is temporarily unavailable
- Network connectivity issues

**The app gracefully handles this by:**
- Automatically falling back to localStorage-only mode
- Maintaining full functionality without real-time sync
- Retrying connections when service becomes available

**To reduce console noise in development:**
- Set proper Supabase environment variables in `.env.local`
- Use actual Supabase project credentials (not dummy keys)

---

## **Demo Mode & Development Features**

### **Demo Mode Operation**
The application includes comprehensive demo mode functionality that activates when external services are unavailable:
- **Automatic Fallback**: Switches to localStorage-only operation
- **Full Feature Set**: All functionality available offline
- **Cost Simulation**: Mock SMS costs and analytics
- **User Management**: Local user creation and management

### **Emergency Features**
- **Emergency Logout**: Ctrl+Shift+L for immediate logout and data clearing
- **Debug Utilities**: Available via `window.fixUserIssues` in browser console
- **Security Migration**: Automatic upgrade of storage security

### **Development Utilities**
- **User Issue Fixer**: `fixUserIssues.fixAllUserIssues()` for data repair
- **Force Refresh**: `fixUserIssues.forceRefreshAllUserData()` for sync issues
- **Diagnostic Tools**: `fixUserIssues.diagnosePotentialIssues()` for health checks

---

## **Advanced Features & Recent Additions**

### **SMS Management & Analytics**
The SMS page includes sophisticated segment calculation and cost management:

```typescript
// Core function for SMS segment calculation
calculateChatSMSSegments(chat: Chat, shouldCache: boolean = true): number

// Use this function for PDF exports and cost calculations
const segments = calculateChatSMSSegments(chat, false) // Don't cache during export
const { cost, loading } = smsCostManager.getChatCost(chat.chat_id)
```

**Key SMS Features:**
- **Persistent Segment Cache**: SMS segments cached in localStorage with 12-hour expiry
- **Cost Optimization**: Real-time cost tracking with Canadian currency conversion
- **Bulk Processing**: Async segment loading with progress tracking for large datasets
- **PDF Export**: Comprehensive chat export with detailed analysis and message threads
- **Smart Filtering**: Excludes tools, timestamps, and titles from segment calculations

### **Dashboard Analytics**
Interactive chart system using Recharts with PHI-free data visualization:

```typescript
// DashboardCharts component in src/components/dashboard/
- Bar Charts: Call & SMS volume comparison with business hour weighting
- Pie Charts: Cost distribution between calls and SMS
- Line Charts: Performance trends with smooth animations
- Radial Charts: Success rates with proper orientation
- Area Charts: Cumulative activity overview
```

**Chart Features:**
- **Auto-refresh**: Charts update when date range changes
- **Responsive Design**: Adapts to different screen sizes
- **Performance Optimized**: Efficient data processing for large datasets
- **Accessibility**: Proper ARIA labels and keyboard navigation

### **Toast Notification System**
Real-time notifications for new records with cross-device support:

```typescript
// Service: toastNotificationService
- Real-time monitoring via Supabase subscriptions
- Cross-device synchronization
- Do Not Disturb mode with configurable hours
- Deduplication to prevent spam
- Graceful fallback when offline
```

**Notification Features:**
- **Smart Detection**: Monitors calls and SMS tables for new records
- **User Preferences**: Configurable sound and timing settings
- **Tab Visibility**: Queues notifications when tab is not visible
- **Rate Limiting**: Prevents notification flooding

### **PDF Export System**
Comprehensive PDF generation for SMS chats with detailed analysis:

```typescript
// SMSPage.tsx - exportAllChatsToPDF function
- Exports all chats in selected date range
- Includes detailed analysis from custom_analysis_data
- Shows message threads with Patient/Assistant labels
- Performance optimized with async processing
- User-friendly progress indicators
```

**Export Features:**
- **Smart Limits**: 50-chat limit with user confirmation for larger exports
- **Progress Feedback**: Real-time progress updates with spinning indicators
- **Error Handling**: Detailed error messages with troubleshooting steps
- **Cost Analysis**: Includes segment counts and cost breakdowns
- **HIPAA Compliant**: Safe patient ID generation with audit logging

---

## **Critical Development Patterns**

### **SMS Segment Calculation**
Always use the `calculateChatSMSSegments()` function instead of direct calculations:

```typescript
// ✅ CORRECT: Use the centralized function
const segments = calculateChatSMSSegments(chat, false)

// ❌ INCORRECT: Direct calculation or undefined functions
const segments = getSegmentCount(chat) // This function doesn't exist
const segments = chat.segments // Direct property access
```

### **Cost Management**
Use `smsCostManager` for all cost-related operations:

```typescript
// ✅ CORRECT: Use the cost manager
const { cost, loading } = smsCostManager.getChatCost(chat.chat_id)

// ❌ INCORRECT: Direct cost calculation
const cost = segments * costPerSegment // May use undefined variables
```

### **Performance Optimization for Large Exports**
When processing large datasets, implement async yields:

```typescript
// ✅ CORRECT: Yield control during long operations
for (let i = 0; i < largeArray.length; i++) {
  if (i % 10 === 0) {
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  // Process item
}
```

---

## **Important Notes for Claude**

1. **Never Bypass Security**: Always maintain encryption and audit logging
2. **HIPAA Compliance**: This is a healthcare application - treat all patient data as PHI
3. **Fallback Support**: Ensure features work even when Supabase is unavailable
4. **Emergency Features**: Respect the Ctrl+Shift+L emergency logout functionality
5. **Service Architecture**: Understand the 40+ service ecosystem before making changes
6. **Demo Mode**: Test changes in both connected and offline modes
7. **Documentation**: Update this file when making architectural changes

---

*Last Updated: Enhanced with Advanced Features - Generated by Claude Code*