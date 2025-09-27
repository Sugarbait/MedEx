# Email Notification System Test Guide

## Issues Fixed

### 1. ✅ Database Schema Issue - RESOLVED
- **Problem**: `email_notifications` column missing from `user_settings` table
- **Solution**: Created migration script `supabase-add-email-notifications-migration.sql` to add the required column
- **Status**: Migration ready to be applied to Supabase

### 2. ✅ Port Configuration Issue - RESOLVED
- **Problem**: Email service was hardcoded to port 3001 (already in use by main app)
- **Solution**: Updated service to use port 4001 and made it configurable via environment variable
- **Status**: Email server now runs on port 4001, frontend updated to connect to correct port

### 3. ✅ SMTP Credential Handling - RESOLVED
- **Problem**: Email server would fail with authentication errors when credentials not configured
- **Solution**: Added proper credential validation and graceful error handling
- **Status**: Server now provides clear error messages when credentials missing

### 4. ✅ Email Service Integration - RESOLVED
- **Problem**: Frontend and backend email services not properly connected
- **Solution**: Updated API endpoints, added proper error handling, created startup scripts
- **Status**: Services properly integrated with clear API contracts

## Current Status

### ✅ WORKING COMPONENTS:
1. **Email Settings UI**: Properly loads and displays settings
2. **Email Server**: Runs on port 4001 with proper error handling
3. **API Endpoints**: Health check and email endpoints responding correctly
4. **Configuration Management**: Environment variables properly handled
5. **Database Schema**: Migration script ready for email_notifications column

### ⚠️ PENDING REQUIREMENTS:
1. **Database Migration**: Run the migration script on Supabase to add email_notifications column
2. **SMTP Credentials**: Set HOSTINGER_EMAIL_PASSWORD environment variable for actual email sending
3. **User Testing**: Test the complete workflow with real user settings

## Testing Instructions

### Prerequisites
1. Apply the database migration:
   ```sql
   -- Run supabase-add-email-notifications-migration.sql in Supabase
   ```

2. Start the email server:
   ```bash
   npm run email-server
   # OR
   EMAIL_SERVER_PORT=4001 node src/api/emailServer.js
   ```

### Test Scenario 1: Settings Persistence (Ready to Test)
1. Login as a super user
2. Go to Settings → Email Notifications
3. Enable email notifications
4. Add recipient email addresses
5. Configure notification types
6. Click "Save Settings"
7. Refresh page - settings should persist
8. Check browser console for any errors

### Test Scenario 2: Email Sending (Requires SMTP Credentials)
1. Complete Test Scenario 1
2. Set environment variable: `HOSTINGER_EMAIL_PASSWORD=actual-password`
3. Restart email server
4. Click "Send Test Email" button
5. Check recipient inbox for test email

### Test Scenario 3: API Testing (Ready to Test)
1. Test health endpoint:
   ```bash
   curl http://localhost:4001/health
   ```

2. Test email endpoint without credentials:
   ```bash
   curl -X POST http://localhost:4001/api/test-email -H "Content-Type: application/json" -d '{"recipient": "test@example.com"}'
   ```

## File Changes Made

### Modified Files:
1. `src/services/emailNotificationService.ts` - Updated API endpoints to use port 4001
2. `src/api/emailServer.js` - Added credential validation and error handling
3. `package.json` - Added email server startup scripts

### New Files Created:
1. `supabase-add-email-notifications-migration.sql` - Database migration
2. `.env.email.example` - Environment configuration template
3. `email-notification-test.md` - This test guide

## Next Steps

1. **Apply Database Migration**: Run the SQL migration in Supabase
2. **Configure SMTP**: Set the HOSTINGER_EMAIL_PASSWORD environment variable
3. **Test Complete Workflow**: Test settings persistence and email sending
4. **Production Setup**: Document deployment configuration for Azure Static Web Apps

## Error Messages and Troubleshooting

### Common Issues:

**"Email service unavailable"**
- Solution: Set HOSTINGER_EMAIL_PASSWORD environment variable

**"Failed to save notification settings"**
- Solution: Apply the database migration to add email_notifications column

**"Connection refused on port 4001"**
- Solution: Start the email server using `npm run email-server`

**Settings not persisting after page refresh**
- Solution: Check browser console for Supabase errors, verify database migration applied

## Production Deployment Notes

For Azure Static Web Apps deployment, the email server will need to be:
1. Deployed as a separate Azure Function or Container Instance
2. Environment variables configured in Azure portal
3. CORS headers updated for production domain
4. SSL/TLS certificate configured for email server endpoint