# User Profile Storage Migration: localStorage to Supabase

This document outlines the migration from localStorage-based user profile storage to Supabase for HIPAA-compliant healthcare CRM.

## Overview

The migration replaces localStorage operations with secure Supabase storage while maintaining backward compatibility and ensuring data persistence across server restarts.

## What Was Migrated

### Previous localStorage Keys
- `currentUser` - Current user profile data
- `systemUsers` - All system users list
- `userCredentials` - User authentication credentials
- `settings_${userId}` - User-specific settings
- `mfa_secret_${userId}` - MFA secrets
- `mfa_backup_codes_${userId}` - MFA backup codes

### New Supabase Tables
- `users` - Enhanced user profiles with avatar support
- `user_profiles` - Extended profile data and API configurations
- `user_settings` - Comprehensive user preferences and settings
- `user_permissions` - User role-based permissions
- Storage bucket `avatars` - Secure avatar file storage

## Migration Steps

### 1. Run Database Migration

Execute the SQL migration script:

```bash
# Apply the schema changes
psql -h [your-supabase-host] -d [your-database] -f supabase-migration.sql
```

The migration script includes:
- Enhanced table schemas
- Row Level Security (RLS) policies
- HIPAA-compliant audit logging
- Avatar storage configuration
- Automatic profile creation triggers

### 2. Update Environment Variables

Ensure your `.env` file includes:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
VITE_HIPAA_MODE=true
VITE_PHI_ENCRYPTION_KEY=your_phi_encryption_key
VITE_AUDIT_ENCRYPTION_KEY=your_audit_encryption_key
```

### 3. Service Integration

The migration includes these new services:

#### UserProfileService
- `loadUserProfile(userId)` - Replaces `localStorage.getItem('currentUser')`
- `saveUserProfile(userData)` - Replaces `localStorage.setItem('currentUser')`
- `syncUserSettings(userId, settings)` - Settings synchronization
- `saveAvatar(userId, base64)` - Secure avatar storage
- `removeAvatar(userId)` - Avatar cleanup

#### UserManagementService
- `loadSystemUsers()` - Replaces `localStorage.getItem('systemUsers')`
- `saveSystemUsers(users)` - Replaces `localStorage.setItem('systemUsers')`
- `createSystemUser(userData, credentials)` - User creation with credentials
- `authenticateUser(email, password)` - Secure authentication
- `deleteSystemUser(userId)` - User deletion

### 4. Component Updates

Key components updated to use Supabase:

#### LoginPage
- Uses `userManagementService.authenticateUser()` for authentication
- Maintains demo account support with Supabase backup
- Automatic user profile creation for new demo users

#### UserManagementPage
- Loads users from Supabase with localStorage fallback
- Creates users in Supabase with encrypted credentials
- Real-time user management with audit logging

#### SettingsPage
- Loads settings from Supabase with caching
- Saves settings to Supabase with optimistic updates
- Avatar upload to Supabase Storage
- Cross-device synchronization support

## Security Features

### HIPAA Compliance
- All sensitive data encrypted at rest
- Comprehensive audit logging for all operations
- Row Level Security (RLS) policies
- Automatic data retention management
- PHI (Protected Health Information) handling

### Data Protection
- API keys encrypted using AES-256-GCM
- User avatars stored in secure Supabase Storage
- Session-based access control
- Failed login attempt tracking and account locking

### Access Control
- Role-based permissions (admin, healthcare_provider, staff)
- User-specific data access policies
- Admin-only user management operations
- Cross-device session management

## Migration Process

### Phase 1: Backward Compatibility
The implementation maintains full backward compatibility:
- Services attempt Supabase operations first
- Falls back to localStorage if Supabase fails
- Gradual migration of existing localStorage data

### Phase 2: Data Migration
For existing deployments with localStorage data:

```typescript
// Example migration script
import { userProfileService } from './services/userProfileService'

async function migrateExistingUsers() {
  const storedUsers = localStorage.getItem('systemUsers')
  if (storedUsers) {
    const users = JSON.parse(storedUsers)

    for (const user of users) {
      try {
        await userProfileService.saveUserProfile(user)
        console.log(`Migrated user: ${user.email}`)
      } catch (error) {
        console.error(`Failed to migrate user ${user.email}:`, error)
      }
    }
  }
}
```

### Phase 3: localStorage Cleanup
After successful migration and testing:
- Remove localStorage fallback code
- Clear old localStorage keys
- Update error handling for Supabase-only operations

## Testing Strategy

### 1. User Authentication
- [ ] Demo account login (demo@carexps.com)
- [ ] Admin account login (elmfarrell@yahoo.com)
- [ ] New user creation and login
- [ ] Failed login attempt handling
- [ ] Account lockout functionality

### 2. Profile Management
- [ ] User profile loading from Supabase
- [ ] Profile updates and synchronization
- [ ] Avatar upload and display
- [ ] Settings persistence across sessions
- [ ] Cross-device synchronization

### 3. User Management
- [ ] Load system users list
- [ ] Create new users with credentials
- [ ] Edit existing user profiles
- [ ] Delete users (soft delete)
- [ ] Role-based access control

### 4. Data Persistence
- [ ] User data persists after server restart
- [ ] Settings maintained across browser sessions
- [ ] Audit logs properly generated
- [ ] Backup and recovery procedures

### 5. Security Testing
- [ ] RLS policies prevent unauthorized access
- [ ] API keys properly encrypted
- [ ] Audit logging captures all operations
- [ ] HIPAA compliance verification

## Troubleshooting

### Common Issues

1. **Supabase Connection Errors**
   - Verify environment variables
   - Check network connectivity
   - Review RLS policies
   - Confirm user authentication

2. **Data Migration Failures**
   - Check for duplicate email addresses
   - Verify required field constraints
   - Review encryption key configuration
   - Monitor audit logs for details

3. **Performance Issues**
   - Enable caching in UserSettingsService
   - Optimize database queries
   - Use connection pooling
   - Monitor Supabase dashboard

### Error Handling

The services include comprehensive error handling:
- Automatic fallback to localStorage
- Detailed error logging and reporting
- User-friendly error messages
- Audit trail for security events

## Monitoring and Maintenance

### Database Monitoring
- Monitor Supabase dashboard for performance
- Review audit logs regularly
- Track user activity patterns
- Monitor storage usage for avatars

### Data Retention
- Automatic cleanup based on retention policies
- HIPAA-compliant data archival
- Regular backup verification
- Compliance assessment reporting

### Security Monitoring
- Failed login attempt analysis
- Unusual access pattern detection
- Regular security audit reviews
- Encryption key rotation procedures

## Rollback Procedure

If issues arise during migration:

1. **Immediate Rollback**
   ```bash
   # Disable Supabase services
   export VITE_ENABLE_SUPABASE=false
   # Restart application
   ```

2. **Data Recovery**
   - Restore from localStorage backups
   - Verify user data integrity
   - Test core functionality

3. **Investigation**
   - Review error logs
   - Check Supabase service status
   - Analyze failed operations
   - Plan corrective actions

## Success Criteria

The migration is considered successful when:
- [ ] All users can authenticate successfully
- [ ] User profiles persist across server restarts
- [ ] Settings synchronize across devices
- [ ] Avatar uploads work correctly
- [ ] Audit logs capture all operations
- [ ] Performance meets requirements
- [ ] HIPAA compliance maintained
- [ ] No data loss during migration

## Future Enhancements

Post-migration improvements:
- Real-time user presence indicators
- Advanced user analytics
- Enhanced security monitoring
- Multi-tenant support
- Advanced data archival
- Automated compliance reporting

---

For technical support or questions about this migration, please refer to the service documentation or contact the development team.