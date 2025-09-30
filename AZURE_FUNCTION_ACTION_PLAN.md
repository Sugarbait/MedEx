# Azure Function 503 Error - Quick Action Plan

## Immediate Action Required

The Azure Function email service is currently returning 503 errors because the `HOSTINGER_EMAIL_PASSWORD` environment variable is not accessible at runtime.

## Why It's Failing

**GitHub secrets are NOT available to Azure Functions at runtime.** The workflow passes the secret during deployment, but the deployed function cannot access it when executing.

## Fix (5 Minutes)

### Step 1: Go to Azure Portal
1. Navigate to https://portal.azure.com
2. Sign in with your Azure credentials
3. Find your Static Web App: **carexps** (or similar name)

### Step 2: Add Application Setting
1. Click **Configuration** in the left menu
2. Click **Application Settings** tab
3. Click **+ Add**
4. Enter:
   - **Name:** `HOSTINGER_EMAIL_PASSWORD`
   - **Value:** `[Your Hostinger password for carexps@phaetonai.com]`
5. Click **OK**
6. Click **Save** at the top
7. Wait 1-2 minutes for deployment

### Step 3: Test
Test the function using curl:
```bash
curl -X POST https://carexps.nexasync.ca/api/send-notification-email \
  -H "Content-Type: application/json" \
  -d '{
    "recipients": ["your-email@example.com"],
    "notification": {
      "title": "Test Notification",
      "message": "Testing Azure Function after configuration",
      "type": "test",
      "timestamp": "2025-09-30T12:00:00Z"
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "messageId": "...",
  "recipients": 1,
  "type": "test",
  "timestamp": "2025-09-30T..."
}
```

## What Was Fixed in the Code

The updated Azure Function now includes:

1. **Comprehensive Diagnostics** - Logs environment variable status on every request
2. **Multi-Source Lookup** - Tries multiple environment variable names
3. **Detailed Error Messages** - Provides step-by-step troubleshooting
4. **CORS Support** - Handles preflight requests
5. **Timeout Handling** - 30-second limit prevents hanging
6. **SMTP Debugging** - Detailed connection logs
7. **Better Error Handling** - Specific guidance based on error type

## Deploy the Code Changes

```bash
git add .
git commit -m "🔧 Fix Azure Function 503 error with enhanced diagnostics and error handling"
git push
```

GitHub Actions will automatically deploy the updated function.

## Verify Success

After configuring Azure Application Settings and deploying, check Azure Function logs:

### Expected Success Logs:
```
📧 Azure Function: Received email notification request
🔍 === ENVIRONMENT DIAGNOSTICS ===
HOSTINGER_EMAIL_PASSWORD exists: true
HOSTINGER_EMAIL_PASSWORD length: 16
✅ Valid credentials detected
✅ Found password in: HOSTINGER_EMAIL_PASSWORD
✅ Email transporter created successfully
📧 Sending email to 1 recipients
SMTP INFO: Authentication successful
✅ Email sent successfully
```

### If Still Failing (503):
```
HOSTINGER_EMAIL_PASSWORD exists: false
❌ Invalid credentials detected
```
**Solution:** Double-check the environment variable name is exactly `HOSTINGER_EMAIL_PASSWORD` in Azure Application Settings.

## Documentation

For detailed information, see:
- **Configuration Guide:** [AZURE_FUNCTION_CONFIGURATION.md](./AZURE_FUNCTION_CONFIGURATION.md)
- **Implementation Details:** [AZURE_FUNCTION_FIX_SUMMARY.md](./AZURE_FUNCTION_FIX_SUMMARY.md)
- **API Documentation:** [api/README.md](./api/README.md)

## Quick Troubleshooting

| Symptom | Solution |
|---------|----------|
| 503 Error | Add HOSTINGER_EMAIL_PASSWORD to Azure Application Settings |
| EAUTH Error | Verify password is correct |
| Timeout | Check firewall allows smtp.hostinger.com:465 |
| CORS Error | Already fixed in updated code |

## Contact

For support:
1. Check Azure Function logs in Azure Portal
2. Review AZURE_FUNCTION_CONFIGURATION.md
3. Verify Azure Application Settings
4. Test SMTP credentials manually

---

**Priority:** HIGH - Critical email functionality blocked
**Estimated Fix Time:** 5 minutes (Azure configuration only)
**Status:** Code fixes deployed, waiting for Azure configuration

*Last updated: 2025-09-30*