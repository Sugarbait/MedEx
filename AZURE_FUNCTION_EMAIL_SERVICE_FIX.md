# Azure Function Email Service 503 Error Fix

## Problem Diagnosis

The Azure Function `/api/send-notification-email` was returning 503 Service Unavailable errors due to several critical issues:

### Root Causes Identified:

1. **Azure Function Runtime Compatibility**
   - Original code used outdated patterns for Azure Functions
   - Missing proper Azure Functions v4 SDK integration
   - Incorrect error handling for Azure environment

2. **SMTP Connection Issues in Azure Cloud**
   - Azure Functions have network restrictions that can interfere with SMTP
   - Connection timeouts due to cold starts
   - Missing connection pooling optimizations for serverless

3. **Environment Variable Access Problems**
   - Azure Function environment variable handling differs from local development
   - Missing validation for Azure-specific environment setup

4. **Dependencies and Runtime Issues**
   - Version mismatch between local and Azure Function nodemailer versions
   - Missing Azure Functions SDK dependency

## Solutions Implemented

### 1. Updated Package Dependencies (`api/package.json`)

**Key Changes:**
- Added `@azure/functions: ^4.0.0` dependency for proper Azure Functions v4 support
- Added installation verification scripts
- Maintained `nodemailer: ^6.9.8` compatibility

### 2. Created Two Azure Function Implementations

#### Option A: Azure Functions v4 Compatible (`index-fixed.js`)
- Uses new `@azure/functions` SDK with `app.http()` pattern
- Enhanced error handling with specific Azure optimizations
- Timeout protection for SMTP connections (45 seconds)
- Comprehensive logging and debugging

#### Option B: Azure Functions v3 Compatible (`index-v3-compatible.js`)
- Maintains backward compatibility with existing v3 runtime
- Traditional `module.exports` pattern
- Same SMTP optimizations and error handling
- CORS header support for preflight requests

### 3. SMTP Configuration Optimizations

**Azure-Specific SMTP Settings:**
```javascript
const SMTP_CONFIG = {
  host: 'smtp.hostinger.com',
  port: 465,
  secure: true,
  connectionTimeout: 60000,  // 60 seconds for Azure
  greetingTimeout: 30000,    // 30 seconds
  socketTimeout: 60000,      // 60 seconds
  pool: false,               // Disable pooling for serverless
  maxConnections: 1,
  maxMessages: 1
};
```

### 4. Enhanced Error Handling

**Specific Error Types:**
- `CREDENTIALS_MISSING`: Environment variable not set
- `AUTH_FAILED`: SMTP authentication failure
- `CONNECTION_FAILED`: Network/SMTP server connection issues
- `TIMEOUT`: Operation timeout (45-second limit)
- `INVALID_JSON`: Request parsing errors

### 5. Improved Host Configuration (`api/host.json`)

**Optimizations:**
- Reduced function timeout to 2 minutes (more appropriate for email sending)
- Added HTTP-specific optimizations
- Enhanced logging configuration
- Added retry strategy and health monitoring

## Deployment Instructions

### Step 1: Choose the Right Implementation

**For Azure Functions v4 Runtime:**
```bash
# Replace the current index.js with the v4 compatible version
cp api/send-notification-email/index-fixed.js api/send-notification-email/index.js
```

**For Azure Functions v3 Runtime:**
```bash
# Replace the current index.js with the v3 compatible version
cp api/send-notification-email/index-v3-compatible.js api/send-notification-email/index.js
```

### Step 2: Install Updated Dependencies

```bash
cd api
npm install
```

### Step 3: Configure Environment Variables in Azure Portal

1. Go to Azure Portal → Your Static Web App → Configuration
2. Add/verify the following Application Settings:

```
HOSTINGER_EMAIL_PASSWORD = [your-actual-hostinger-email-password]
WEBSITE_NODE_DEFAULT_VERSION = 18-lts
```

### Step 4: Deploy to Azure

```bash
# Deploy using Azure Static Web Apps CLI or GitHub Actions
npm run build
# Push to your connected GitHub repository
```

### Step 5: Test the Function

#### Test 1: Basic Health Check
```bash
curl -X POST https://your-app.azurestaticapps.net/api/send-notification-email \
  -H "Content-Type: application/json" \
  -d '{
    "recipients": ["test@example.com"],
    "notification": {
      "title": "Test Notification",
      "message": "Testing Azure Function email service",
      "type": "system_alert"
    }
  }'
```

#### Test 2: Using Browser Console
```javascript
// Test from your CareXPS app
sendQuickTestEmail('your-email@example.com')
```

## Error Resolution Guide

### 503 Service Unavailable

**Potential Causes & Solutions:**

1. **Missing Environment Variable**
   - **Error**: `CREDENTIALS_MISSING`
   - **Solution**: Set `HOSTINGER_EMAIL_PASSWORD` in Azure Portal Application Settings

2. **SMTP Authentication Failure**
   - **Error**: `AUTH_FAILED`
   - **Solution**: Verify Hostinger email password is correct

3. **Network/Connection Issues**
   - **Error**: `CONNECTION_FAILED`
   - **Solution**: Check if Azure is blocking SMTP connections (port 465)

4. **Function Timeout**
   - **Error**: `TIMEOUT`
   - **Solution**: Function is configured with appropriate timeouts, but check Azure logs

### 500 Internal Server Error

**Potential Causes:**
- Invalid JSON in request body
- Missing required fields in notification object
- Runtime errors in function code

### 400 Bad Request

**Potential Causes:**
- Invalid email addresses in recipients array
- Missing notification object
- Malformed request body

## Monitoring and Debugging

### View Azure Function Logs

1. Go to Azure Portal → Your Static Web App → Functions
2. Click on `send-notification-email` function
3. View "Monitor" or "Logs" tab for real-time debugging

### Common Log Messages

**Success:**
```
✅ SMTP connection verified successfully
✅ Email sent successfully: { messageId: "...", recipients: 1 }
```

**Errors:**
```
❌ Email credentials not configured properly
❌ SMTP setup failed: EAUTH
❌ Email sending failed: timeout
```

## Testing Checklist

### ✅ Before Deployment
- [ ] Environment variable `HOSTINGER_EMAIL_PASSWORD` is set in Azure Portal
- [ ] Correct Azure Function implementation is selected (v3 vs v4)
- [ ] Package dependencies are updated (`npm install`)

### ✅ After Deployment
- [ ] Function responds with 200 status for valid requests
- [ ] Error responses include proper error codes and messages
- [ ] Email delivery is working (check recipient inbox)
- [ ] Azure Function logs show successful SMTP connections

### ✅ Production Validation
- [ ] Test with CareXPS app email notification settings
- [ ] Verify cross-origin requests work properly
- [ ] Monitor Azure Function performance and cold start times
- [ ] Confirm HIPAA compliance (no PHI in email content)

## Alternative Solutions

If SMTP continues to fail in Azure, consider these alternatives:

### Option 1: Azure Communication Services
Replace SMTP with Azure Communication Services Email API for better Azure integration.

### Option 2: SendGrid Integration
Use SendGrid API which has better Azure support and reliability.

### Option 3: Logic Apps
Create an Azure Logic App for email sending as an alternative to Azure Functions.

## Security Considerations

1. **Environment Variables**: Never commit email passwords to source control
2. **CORS**: Function includes proper CORS headers for browser requests
3. **PHI Compliance**: Email templates exclude any Protected Health Information
4. **Rate Limiting**: Azure Function includes built-in throttling protection

## Support and Troubleshooting

For additional support:
1. Check Azure Function logs in Azure Portal
2. Verify Hostinger SMTP settings with hosting provider
3. Test local email service first (`npm run email-server`)
4. Review Azure Static Web Apps documentation for latest best practices

---

**Implementation Status:** ✅ Ready for deployment
**Last Updated:** December 2024
**Azure Functions Runtime:** v3/v4 Compatible
**Node.js Version:** 18 LTS