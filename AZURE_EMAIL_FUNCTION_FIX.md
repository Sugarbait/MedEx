# Azure Email Function 503 Error - Complete Fix Guide

## Problem Summary

The Azure Function `/api/send-notification-email` returns 503 errors with the message:
```json
{
  "error": "Email service unavailable",
  "details": "SMTP credentials not configured. Please set HOSTINGER_EMAIL_PASSWORD environment variable in Azure Function settings."
}
```

**Root Cause**: The `HOSTINGER_EMAIL_PASSWORD` environment variable is not being passed to the Azure Function during GitHub Actions deployment, even though it's configured in the Azure Portal.

---

## Solution: 3-Step Fix

### **Step 1: Add GitHub Secret**

1. Go to your GitHub repository: `https://github.com/YOUR_ORG/CareXPS-CRM`
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Enter the following:
   - **Name**: `HOSTINGER_EMAIL_PASSWORD`
   - **Value**: Your actual Hostinger email password for `carexps@phaetonai.com`
5. Click **"Add secret"**

### **Step 2: Verify Workflow Update**

The GitHub Actions workflow has been updated to include the environment variable:

**File**: `.github/workflows/azure-static-web-apps-carexps.yml`

**Change Made**:
```yaml
- name: Build And Deploy
  id: builddeploy
  uses: Azure/static-web-apps-deploy@v1
  with:
    azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
    repo_token: ${{ secrets.GITHUB_TOKEN }}
    action: "upload"
    app_location: "dist"
    api_location: "api"
    output_location: "."
    skip_app_build: true
    skip_api_build: false
  env:
    OPENAI_API_KEY: ${{ secrets.VITE_OPENAI_API_KEY }}
    HOSTINGER_EMAIL_PASSWORD: ${{ secrets.HOSTINGER_EMAIL_PASSWORD }}  # ← NEW LINE ADDED
```

### **Step 3: Deploy and Verify**

#### **3.1 Commit and Push Changes**
```bash
git add .github/workflows/azure-static-web-apps-carexps.yml
git commit -m "🔧 AZURE EMAIL FIX: Add HOSTINGER_EMAIL_PASSWORD to deployment environment"
git push origin main
```

#### **3.2 Monitor Deployment**
1. Go to **Actions** tab in GitHub
2. Watch the deployment workflow run
3. Verify it completes successfully

#### **3.3 Test the Function**

**Test Command (PowerShell)**:
```powershell
$body = @{
    recipients = @("your-email@example.com")
    notification = @{
        title = "Test Notification"
        message = "Testing Azure Function email service after fix"
        type = "test"
        timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    }
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://carexps.nexasync.ca/api/send-notification-email" `
    -Method POST `
    -Body $body `
    -ContentType "application/json"
```

**Test Command (curl)**:
```bash
curl -X POST https://carexps.nexasync.ca/api/send-notification-email \
  -H "Content-Type: application/json" \
  -d '{
    "recipients": ["your-email@example.com"],
    "notification": {
      "title": "Test Notification",
      "message": "Testing Azure Function email service after fix",
      "type": "test",
      "timestamp": "2025-09-30 04:30:00"
    }
  }'
```

**Expected Success Response**:
```json
{
  "success": true,
  "messageId": "<message-id@smtp.hostinger.com>",
  "recipients": 1,
  "type": "test",
  "timestamp": "2025-09-30T04:30:00.000Z"
}
```

---

## Technical Details

### **Why the Fix Works**

1. **Azure Static Web Apps Environment Variables**: Azure Static Web Apps requires environment variables to be explicitly passed during GitHub Actions deployment for managed API functions.

2. **Function Code Validation**: The function checks for valid credentials using:
   ```javascript
   const hasValidCredentials = () => {
     return SMTP_CONFIG.auth.pass &&
            SMTP_CONFIG.auth.pass !== 'your-email-password' &&
            SMTP_CONFIG.auth.pass !== null;
   };
   ```

3. **Deployment Flow**:
   - GitHub Actions runs on push to `main`
   - Builds the app with frontend environment variables
   - Deploys to Azure with API function environment variables
   - Azure injects `HOSTINGER_EMAIL_PASSWORD` into function runtime
   - Function can now access `process.env.HOSTINGER_EMAIL_PASSWORD`

### **SMTP Configuration**

**Provider**: Hostinger
**Email**: `carexps@phaetonai.com`
**SMTP Settings**:
- **Host**: `smtp.hostinger.com`
- **Port**: `465`
- **Security**: SSL (secure: true)
- **Authentication**: Required

### **Files Modified**

1. **`.github/workflows/azure-static-web-apps-carexps.yml`**
   - Added `HOSTINGER_EMAIL_PASSWORD` to deployment environment variables
   - Line 58: New environment variable reference

---

## Verification Checklist

- [ ] GitHub Secret `HOSTINGER_EMAIL_PASSWORD` created
- [ ] Workflow file updated with environment variable
- [ ] Changes committed and pushed to `main` branch
- [ ] GitHub Actions deployment completed successfully
- [ ] Test API call returns 200 status (not 503)
- [ ] Email received in test inbox
- [ ] Azure Function logs show "✅ Email sent successfully"

---

## Troubleshooting

### **Issue: Still Getting 503 Error**

**Check 1: Verify GitHub Secret Exists**
```bash
# In GitHub repo settings, confirm secret is present
Settings → Secrets and variables → Actions → Repository secrets
```

**Check 2: Check Deployment Logs**
```bash
# In GitHub Actions, look for:
"Setting environment variables"
HOSTINGER_EMAIL_PASSWORD: ***
```

**Check 3: Azure Function Logs**
1. Go to Azure Portal
2. Navigate to your Static Web App
3. Open **Log Stream** or **Application Insights**
4. Look for error messages

### **Issue: "Invalid credentials" from SMTP server**

**Possible Causes**:
- Incorrect password in GitHub Secret
- Password contains special characters that need escaping
- Hostinger account locked or requires verification

**Solution**:
1. Log into Hostinger webmail with the same credentials
2. Verify password works for SMTP
3. Update GitHub Secret if needed
4. Trigger new deployment

### **Issue: Emails not being received**

**Check**:
1. Spam/junk folder
2. Email client filters
3. Hostinger sending limits (daily quota)
4. Azure Function logs for successful send confirmation

---

## Production Considerations

### **Security Best Practices**
- ✅ Password stored as GitHub Secret (encrypted)
- ✅ Not hardcoded in code
- ✅ Not exposed in logs
- ✅ Uses SSL for SMTP connection

### **Monitoring**
- Monitor Azure Function execution logs
- Set up Application Insights alerts for failures
- Track email sending success rate
- Monitor Hostinger sending quota

### **Email Sending Limits**
- **Hostinger Free/Basic**: ~300 emails/day
- **Hostinger Premium**: ~500 emails/day
- **Hostinger Business**: ~1000 emails/day

If exceeding limits, consider:
- Implementing rate limiting
- Using dedicated email service (SendGrid, Mailgun)
- Batching notifications

---

## Additional Configuration (Optional)

### **Azure Portal Application Settings**

While the GitHub Actions deployment now handles this, you can also configure environment variables directly in Azure Portal as a backup:

1. Go to **Azure Portal** → **Static Web Apps**
2. Select your app: `carexps`
3. Navigate to **Configuration** → **Application settings**
4. Click **+ Add**
5. Add:
   - **Name**: `HOSTINGER_EMAIL_PASSWORD`
   - **Value**: Your password
6. Click **Save**

**Note**: GitHub Actions deployment will override portal settings, so always keep them in sync.

---

## Related Files

**Azure Function Code**:
- `api/send-notification-email/index.js` - Main function logic
- `api/send-notification-email/function.json` - Function configuration
- `api/package.json` - Node.js dependencies
- `api/host.json` - Azure Functions host configuration

**Deployment Configuration**:
- `.github/workflows/azure-static-web-apps-carexps.yml` - CI/CD pipeline
- `staticwebapp.config.json` - Static Web App routing and API settings

---

## Success Criteria

✅ **Function responds with 200 status**
✅ **Emails successfully delivered to recipients**
✅ **Azure logs show "✅ Email sent successfully"**
✅ **No 503 errors in production**
✅ **HIPAA-compliant email notifications working**

---

**Last Updated**: 2025-09-30
**Status**: Fix Ready for Deployment
**Next Steps**: Add GitHub Secret → Push Changes → Test Function