# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
```bash
npm run dev          # Start development server on localhost:3000
npm run build        # Build for production
npm run build:check  # Build with TypeScript checking
npm run preview      # Preview production build
```

### Quality Assurance
```bash
npm run lint         # Run ESLint
npm run test         # Run Vitest tests
npm run test:coverage # Run tests with coverage
npx tsc --noEmit     # Type checking without emit
```

### Deployment
```bash
npm run build        # Production build (outputs to dist/)
# Deployment is automatic via Azure Static Web Apps on main branch push
```

## Architecture Overview

### Core Technology Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Authentication**: Azure AD (MSAL) with custom user management
- **Database**: Supabase with custom authentication (NOT Supabase Auth)
- **Real-time**: Supabase Realtime subscriptions
- **Styling**: Tailwind CSS with Lucide React icons
- **AI Integration**: Retell AI for voice calls and SMS

### Critical Architecture Patterns

#### Authentication System
- **Hybrid approach**: Azure AD for authentication + custom user management
- **No Supabase Auth**: App uses custom user identification system
- **User ID Translation**: String IDs (e.g., "pierre-user-789") are converted to UUIDs via `userIdTranslationService`
- **Supabase Config**: Auth is disabled (`detectSessionInUrl: false, persistSession: false`)

#### Database Architecture (Supabase)
- **Custom Authentication**: Row Level Security (RLS) policies are permissive since app doesn't use Supabase Auth
- **UUID vs String IDs**: External IDs are strings, database uses UUIDs
- **Real-time Subscriptions**: Used for cross-device sync and live updates
- **Encryption**: AES-256-GCM for PHI data when HIPAA mode enabled

#### Services Layer
- **RetellService**: Handles all Retell AI API interactions (calls, SMS, webhooks)
- **NotesService**: Real-time notes with optimistic UI updates and cross-device sync
- **UserSettingsService**: Cross-device settings synchronization with cloud backup
- **EncryptionService**: PHI data encryption with fallback strategies

#### Notes System (Critical Implementation)
- **Optimistic UI Updates**: Local state updates immediately, then syncs to database
- **Real-time Sync**: Supabase subscriptions for cross-device updates
- **Error Recovery**: Failed operations restore previous state
- **Callback Chain**: Child components notify parents via `onNotesChanged` callbacks
- **Dual Storage**: Works with/without Supabase (localStorage fallback)

### File Structure Patterns

#### Services (`src/services/`)
- Each service is a singleton class with async methods
- Services handle both online and offline modes gracefully
- Real-time subscriptions are managed at service level

#### Components (`src/components/`)
- **UI**: Basic reusable components
- **Common**: Feature-specific components (CallNotes, ChatNotes, etc.)
- **Layout**: Application shell components

#### Pages (`src/pages/`)
- Each page manages its own state and data fetching
- CallsPage and SMSPage follow identical patterns for consistency

## Environment Configuration

### Required Environment Variables
```env
# Azure AD
VITE_AZURE_CLIENT_ID=your-azure-ad-client-id
VITE_AZURE_TENANT_ID=your-azure-ad-tenant-id

# Supabase (Production instance required for persistence)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Retell AI (Optional - app works without)
VITE_RETELL_API_KEY=your-retell-api-key

# Security
VITE_ENCRYPTION_KEY=32-character-encryption-key
VITE_HIPAA_MODE=true  # Enables PHI encryption
```

### Fallback Behavior
- **No Supabase**: App operates in localStorage-only mode
- **No Retell AI**: Demo data is used, API calls fail gracefully
- **No Encryption Key**: Base64 encoding used as fallback

## Database Schema (Supabase)

### Key Tables
- **notes**: Call/SMS notes with real-time sync
- **user_settings**: Cross-device settings synchronization
- **audit_logs**: HIPAA compliance audit trail

### Important Constraints
- **No Foreign Keys to auth.users**: Custom authentication means no Supabase user references
- **Permissive RLS**: Policies allow all operations since app handles authorization
- **UUID Primary Keys**: All tables use UUIDs for primary keys

## Real-time Features

### Notes System
- **Immediate UI Updates**: Local state updated before database confirmation
- **Cross-device Sync**: Supabase subscriptions sync changes across devices
- **Icon Updates**: Blue note icons in lists update in real-time
- **Error Recovery**: Failed operations restore previous UI state

### Settings Sync
- **Optimistic Updates**: Settings apply immediately, sync in background
- **Conflict Resolution**: Last-write-wins with retry logic
- **Fallback**: localStorage used when cloud sync unavailable

## HIPAA Compliance Features

### Data Protection
- **Encryption**: AES-256-GCM for PHI data at rest
- **Audit Logging**: All data access logged with timestamps
- **Session Management**: 15-minute timeout with MFA
- **Access Controls**: Role-based permissions

### Security Headers
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options, X-Content-Type-Options

## Development Patterns

### Error Handling
- Services return `{ success: boolean, data?: T, error?: string }` pattern
- UI components show user-friendly error messages
- Fallback modes for service unavailability

### State Management
- React hooks for local state
- Context for global state (theme, user)
- Service layer for data persistence

### Real-time Updates
- Supabase subscriptions for database changes
- Optimistic updates for immediate UI feedback
- Callback chains for parent-child communication

## Testing Strategy

### Unit Tests
- Services: API integration and data transformation
- Utilities: Helper functions and encryption
- Components: User interactions and state changes

### Integration Tests
- Database operations with Supabase
- Real-time subscriptions
- Cross-device synchronization

## Deployment

### Azure Static Web Apps
- Automatic deployment from main branch
- Environment variables configured in Azure portal
- Custom domain and SSL managed by Azure
- Build output: `dist/` directory

### Production Considerations
- All environment variables must be production values
- Supabase URL must be production instance for persistence
- Encryption keys must be unique 32-character strings
- HIPAA mode should be enabled for production