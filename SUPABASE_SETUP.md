# Supabase Integration Setup Guide

This guide will walk you through setting up Supabase for your CareXPS Healthcare CRM application with HIPAA-compliant security features.

## Prerequisites

1. Supabase account and project
2. Azure AD application configured
3. Node.js and npm installed
4. Access to encryption keys for PHI data

## 1. Supabase Project Setup

### Create a New Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - Name: "CareXPS Healthcare CRM"
   - Database Password: Generate a strong password
   - Region: Choose closest to your users
5. Click "Create new project"

### Configure Project Settings

1. Go to Project Settings → General
2. Note down:
   - Project URL
   - Project API keys (anon public key and service role key)

## 2. Environment Configuration

Update your `.env.local` file with the following variables:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Encryption Keys for PHI Data (Generate 256-bit base64 keys)
VITE_PHI_ENCRYPTION_KEY=your-256-bit-base64-key
VITE_AUDIT_ENCRYPTION_KEY=your-256-bit-base64-key

# Environment
VITE_ENVIRONMENT=development
VITE_HIPAA_MODE=true

# Azure AD Configuration (existing)
VITE_AZURE_CLIENT_ID=your-azure-client-id
VITE_AZURE_TENANT_ID=your-azure-tenant-id
```

### Generate Encryption Keys

Use this Node.js script to generate secure encryption keys:

```javascript
const crypto = require('crypto');

// Generate 256-bit keys
const phiKey = crypto.randomBytes(32).toString('base64');
const auditKey = crypto.randomBytes(32).toString('base64');

console.log('PHI Encryption Key:', phiKey);
console.log('Audit Encryption Key:', auditKey);
```

## 3. Database Schema Setup

### Run Migrations

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Initialize Supabase in your project:
```bash
supabase init
```

3. Link to your project:
```bash
supabase link --project-ref your-project-id
```

4. Apply the database migrations:
```bash
supabase db push
```

Alternatively, you can run the SQL files manually in the Supabase SQL Editor:

1. Go to SQL Editor in your Supabase dashboard
2. Run `supabase/migrations/001_initial_schema.sql`
3. Run `supabase/migrations/002_rls_policies.sql`

### Verify Setup

Check that the following tables were created:
- `users`
- `user_permissions`
- `user_settings`
- `patients`
- `calls`
- `sms_messages`
- `sms_templates`
- `security_events`
- `audit_logs`
- `user_sessions`
- `mfa_challenges`
- `failed_login_attempts`
- `data_retention_policies`
- `compliance_assessments`

## 4. Configure Row Level Security

RLS policies are automatically applied via the migration. Verify they're enabled:

1. Go to Authentication → Policies in Supabase dashboard
2. Confirm policies exist for all tables
3. Test with a test user to ensure proper access control

## 5. Set Up Real-time

Real-time is enabled by default. Configure which events you want to listen to:

1. Go to Database → Replication in Supabase dashboard
2. Enable replication for tables you want real-time updates:
   - `user_settings`
   - `calls`
   - `sms_messages`
   - `security_events`

## 6. Application Integration

### Update Main App Component

Wrap your app with the Supabase provider:

```tsx
import { SupabaseProvider } from '@/contexts/SupabaseContext'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseProvider>
        {/* Your existing app components */}
      </SupabaseProvider>
    </QueryClientProvider>
  )
}
```

### Update AuthContext

Integrate Supabase with your existing Azure AD authentication:

```tsx
import { useSupabase } from '@/contexts/SupabaseContext'

// In your AuthContext
const { signInWithAzureAD } = useSupabase()

// After successful Azure AD login
const handleAzureLogin = async (azureUser) => {
  const response = await signInWithAzureAD(azureUser)
  if (response.status === 'success') {
    // User is now authenticated with Supabase
    setUser(response.data)
  }
}
```

## 7. Usage Examples

### User Settings Management

```tsx
import { useUserSettings, useUpdateUserSettings } from '@/hooks/useSupabaseQueries'

function SettingsComponent() {
  const { data: settings, isLoading } = useUserSettings()
  const updateSettings = useUpdateUserSettings()

  const handleThemeChange = (theme: 'light' | 'dark' | 'auto') => {
    updateSettings.mutate({ theme })
  }

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      <button onClick={() => handleThemeChange('dark')}>
        Dark Mode
      </button>
    </div>
  )
}
```

### Patient Management

```tsx
import { usePatients, useCreatePatient } from '@/hooks/useSupabaseQueries'

function PatientList() {
  const { data: patients } = usePatients('search-query')
  const createPatient = useCreatePatient()

  const handleCreatePatient = (data: PatientData) => {
    createPatient.mutate(data)
  }

  return (
    <div>
      {patients?.map(patient => (
        <div key={patient.id}>
          {patient.firstName} {patient.lastName}
        </div>
      ))}
    </div>
  )
}
```

### Real-time Subscriptions

```tsx
import { useUserCallsSubscription } from '@/hooks/useSupabaseQueries'

function CallsComponent() {
  // Automatically subscribes to user's calls
  useUserCallsSubscription()

  return <div>Calls will update in real-time</div>
}
```

### Audit and Compliance

```tsx
import { useComplianceMetrics, useAuditLogs } from '@/hooks/useSupabaseQueries'

function ComplianceDashboard() {
  const { data: metrics } = useComplianceMetrics()
  const { data: auditLogs } = useAuditLogs({
    dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    pageSize: 50
  })

  return (
    <div>
      <h2>Compliance Metrics</h2>
      <p>Audit Log Completeness: {metrics?.auditLogCompleteness}%</p>
      <p>Encryption Coverage: {metrics?.encryptionCoverage}%</p>

      <h2>Recent Audit Logs</h2>
      {auditLogs?.data?.map(log => (
        <div key={log.id}>{log.action} on {log.table_name}</div>
      ))}
    </div>
  )
}
```

## 8. Security Considerations

### PHI Data Encryption

All patient data is automatically encrypted before storing:

- `firstName` → `encrypted_first_name`
- `lastName` → `encrypted_last_name`
- `phone` → `encrypted_phone`
- `email` → `encrypted_email`

### Row Level Security

- Users can only access their own data
- Healthcare providers can access patient data they're assigned to
- Admins have broader access with full audit trails

### Audit Logging

Every data access and modification is logged:
- Who accessed what data
- When it was accessed
- What changes were made
- IP address and user agent

### Session Management

- Sessions expire after 15 minutes of inactivity (HIPAA compliant)
- Multi-device session tracking
- Automatic cleanup of expired sessions

## 9. Testing

### Test User Creation

Create test users with different roles:

```sql
-- Insert test admin user (run in Supabase SQL Editor)
INSERT INTO users (azure_ad_id, email, name, role)
VALUES ('test-admin-id', 'admin@test.com', 'Test Admin', 'admin');

-- Insert test healthcare provider
INSERT INTO users (azure_ad_id, email, name, role)
VALUES ('test-provider-id', 'provider@test.com', 'Test Provider', 'healthcare_provider');

-- Insert test staff user
INSERT INTO users (azure_ad_id, email, name, role)
VALUES ('test-staff-id', 'staff@test.com', 'Test Staff', 'staff');
```

### Test Data Access

Verify RLS policies work correctly by testing data access with different user roles.

## 10. Production Deployment

### Environment Variables

Ensure all production environment variables are set securely:
- Use Azure Key Vault or similar for encryption keys
- Rotate keys regularly
- Monitor access to sensitive configuration

### Backup and Recovery

Set up automated backups:
1. Go to Settings → Database in Supabase
2. Configure automated backups
3. Test recovery procedures

### Monitoring

Set up monitoring for:
- Failed login attempts
- High-severity security events
- Audit log completeness
- Performance metrics

## 11. Troubleshooting

### Common Issues

1. **RLS Policies Too Restrictive**
   - Check user permissions in `user_permissions` table
   - Verify user role assignments

2. **Encryption/Decryption Failures**
   - Verify encryption keys are properly set
   - Check key rotation procedures

3. **Real-time Subscription Issues**
   - Check table replication settings
   - Verify websocket connectivity

4. **Performance Issues**
   - Review database indexes
   - Monitor query performance
   - Consider pagination for large datasets

### Support

For additional support:
- Check Supabase documentation: https://supabase.com/docs
- Review audit logs for security events
- Monitor compliance metrics regularly

## 12. HIPAA Compliance Checklist

- ✅ PHI data encrypted at rest and in transit
- ✅ Access controls with RLS policies
- ✅ Comprehensive audit logging
- ✅ Session management and timeouts
- ✅ User authentication and authorization
- ✅ Data retention policies
- ✅ Security event monitoring
- ✅ Backup and recovery procedures
- ✅ Regular compliance assessments

Remember to conduct regular security assessments and maintain documentation for HIPAA compliance audits.