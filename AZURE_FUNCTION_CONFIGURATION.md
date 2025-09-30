# Azure Function Email Service Configuration Guide

## Overview
This guide explains how to properly configure the Azure Function email notification service to work with Hostinger SMTP.

## Problem: 503 Service Unavailable
If you're seeing 503 errors, it means the Azure Function cannot access the `HOSTINGER_EMAIL_PASSWORD` environment variable.

## Solution: Configure Azure Application Settings

### Step 1: Access Azure Portal
1. Navigate to [Azure Portal](https://portal.azure.com)
2. Sign in with your Azure credentials
3. Find your Static Web App resource: **carexps** (or similar)

### Step 2: Configure Application Settings
1. In your Static Web App, click on **Configuration** in the left menu
2. Click on **Application Settings** tab
3. Click **+ Add** to add a new setting
4. Enter the following:
   - **Name:** `HOSTINGER_EMAIL_PASSWORD`
   - **Value:** Your actual Hostinger email password for `carexps@phaetonai.com`
5. Click **OK**
6. Click **Save** at the top of the page
7. Wait for the deployment to complete (usually 1-2 minutes)

### Step 3: Restart Application (if needed)
1. Go to **Overview** in the left menu
2. Click **Restart** at the top
3. Wait for the application to restart

### Step 4: Verify Configuration
1. Check the Azure Function logs:
   - Go to **Functions** in the left menu
   - Click on `send-notification-email`
   - Click on **Monitor** or **Logs**
2. Look for diagnostic output showing:
   ```
   🔍 === ENVIRONMENT DIAGNOSTICS ===
   HOSTINGER_EMAIL_PASSWORD exists: true
   HOSTINGER_EMAIL_PASSWORD length: <number>
   ✅ Valid credentials detected
   ```

## Why GitHub Secrets Alone Don't Work

GitHub Actions secrets (`${{ secrets.HOSTINGER_EMAIL_PASSWORD }}`) are only available **during the build process**, not at runtime.

**What happens:**
1. ✅ GitHub Actions uses secrets during deployment
2. ❌ Deployed Azure Function **cannot access** GitHub secrets at runtime
3. ✅ Azure Function **can access** Azure Application Settings

**Correct Configuration:**
- **GitHub Secrets:** Used for deploying (optional, can be removed from workflow)
- **Azure Application Settings:** Used at runtime (REQUIRED)

## Environment Variable Access Pattern

The Azure Function checks multiple environment variable names in order:
1. `HOSTINGER_EMAIL_PASSWORD` (primary)
2. `hostinger_email_password` (lowercase fallback)
3. `EMAIL_PASSWORD` (generic fallback)
4. `SMTP_PASSWORD` (SMTP-specific fallback)

## Troubleshooting

### Check 1: Verify Environment Variable Exists
Look in Azure Function logs for:
```
HOSTINGER_EMAIL_PASSWORD exists: true
HOSTINGER_EMAIL_PASSWORD length: >0
```

If you see `exists: false`, the variable is not set in Azure Application Settings.

### Check 2: Verify Credentials Are Valid
Look for:
```
✅ Valid credentials detected
```

If you see `❌ Invalid credentials detected`, the password may be:
- Empty or null
- Set to placeholder value `'your-email-password'`
- Incorrect password

### Check 3: Test SMTP Connection
The function includes detailed SMTP debugging. Look for:
```
SMTP DEBUG: Connection established
SMTP INFO: Authentication successful
```

If you see connection errors:
- Check network/firewall settings
- Verify Hostinger SMTP is accessible from Azure (smtp.hostinger.com:465)
- Ensure SSL/TLS is properly configured

### Check 4: Review Detailed Error Responses
The function now returns comprehensive error details:
```json
{
  "error": "Failed to send email",
  "message": "Authentication failed",
  "code": "EAUTH",
  "troubleshooting": [
    "Authentication failed - check HOSTINGER_EMAIL_PASSWORD",
    "Verify credentials in Azure Application Settings"
  ],
  "timestamp": "2025-09-30T..."
}
```

## Testing the Function

### Option 1: Test via Application
Use the CareXPS application to trigger an email notification.

### Option 2: Test via Azure Portal
1. Go to your Static Web App in Azure Portal
2. Navigate to **Functions** > `send-notification-email`
3. Click on **Code + Test**
4. Use the **Test/Run** feature with this payload:
```json
{
  "recipients": ["your-email@example.com"],
  "notification": {
    "title": "Test Notification",
    "message": "This is a test email from Azure Function",
    "type": "test",
    "timestamp": "2025-09-30T12:00:00Z"
  }
}
```

### Option 3: Test via curl
```bash
curl -X POST https://carexps.nexasync.ca/api/send-notification-email \
  -H "Content-Type: application/json" \
  -d '{
    "recipients": ["your-email@example.com"],
    "notification": {
      "title": "Test Notification",
      "message": "This is a test email",
      "type": "test",
      "timestamp": "2025-09-30T12:00:00Z"
    }
  }'
```

## Local Development

### Setup local.settings.json
For local testing, create `api/local.settings.json` (from template):
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "HOSTINGER_EMAIL_PASSWORD": "your-actual-password"
  }
}
```

**Important:** `local.settings.json` is in `.gitignore` and should never be committed.

### Run locally
```bash
cd api
npm install
func start
```

The function will be available at `http://localhost:7071/api/send-notification-email`

## Security Best Practices

1. **Never commit credentials:**
   - Don't hardcode passwords in source code
   - Don't commit `local.settings.json`
   - Use Azure Application Settings for production

2. **Rotate passwords regularly:**
   - Update Hostinger email password periodically
   - Update Azure Application Settings after rotation

3. **Use strong passwords:**
   - Ensure HOSTINGER_EMAIL_PASSWORD is a strong password
   - Follow your organization's password policy

4. **Monitor logs:**
   - Regularly review Azure Function logs
   - Watch for authentication failures
   - Set up alerts for repeated failures

## Enhanced Features

### Comprehensive Diagnostics
Every request logs:
- Node.js version and platform
- Environment variable status (without exposing values)
- Azure-specific environment variables
- SMTP connection details

### CORS Support
The function properly handles CORS preflight requests for cross-origin calls.

### Timeout Handling
Email sending has a 30-second timeout to prevent hanging requests.

### Multiple Recipient Support
Uses BCC for privacy when sending to multiple recipients.

### Detailed Error Messages
Provides specific troubleshooting guidance based on error type:
- `EAUTH`: Authentication errors
- `ETIMEDOUT/ECONNECTION`: Network/connectivity issues
- `EENVELOPE`: Email validation errors

## Common Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 503 | Service Unavailable | Set HOSTINGER_EMAIL_PASSWORD in Azure Application Settings |
| 500 | Internal Server Error | Check Azure Function logs for detailed error |
| 400 | Bad Request | Verify request payload format |
| 200 | Success | Email sent successfully |

## Support

For issues:
1. Check Azure Function logs in Azure Portal
2. Review this documentation
3. Verify Azure Application Settings are correct
4. Test SMTP credentials manually
5. Contact Azure support if infrastructure issues persist

## Changelog

**2025-09-30: Enhanced Diagnostics and Error Handling**
- Added comprehensive environment diagnostics
- Implemented multiple environment variable name fallbacks
- Added detailed SMTP debugging
- Enhanced error messages with troubleshooting steps
- Added CORS preflight handling
- Implemented timeout handling for email sending
- Added specific error code handling and guidance

---

*This guide ensures the Azure Function email service is properly configured and troubleshootable.*