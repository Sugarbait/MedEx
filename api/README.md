# CareXPS Azure Functions API

This directory contains Azure Functions for the CareXPS Healthcare CRM application.

## Functions

### send-notification-email
Sends HIPAA-compliant email notifications via Hostinger SMTP.

**Endpoint:** `POST /api/send-notification-email`

**Features:**
- Secure SMTP email delivery via Hostinger
- Multiple recipient support with BCC for privacy
- Comprehensive error handling and diagnostics
- CORS support for cross-origin requests
- Timeout handling (30 second limit)
- Detailed logging for troubleshooting

**Request Body:**
```json
{
  "recipients": ["email1@example.com", "email2@example.com"],
  "notification": {
    "title": "Notification Title",
    "message": "Notification message content",
    "type": "info",
    "timestamp": "2025-09-30T12:00:00Z"
  },
  "template": "optional custom HTML template"
}
```

**Response (Success):**
```json
{
  "success": true,
  "messageId": "<generated-message-id>",
  "recipients": 2,
  "type": "info",
  "timestamp": "2025-09-30T12:00:00Z"
}
```

**Response (Error):**
```json
{
  "error": "Error message",
  "details": "Detailed error information",
  "troubleshooting": [
    "Step 1 to resolve",
    "Step 2 to resolve"
  ],
  "timestamp": "2025-09-30T12:00:00Z"
}
```

## Configuration

### Azure Portal Configuration (REQUIRED)
The function requires the `HOSTINGER_EMAIL_PASSWORD` environment variable to be set in Azure Application Settings:

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your Static Web App
3. Go to **Configuration** > **Application Settings**
4. Add: `HOSTINGER_EMAIL_PASSWORD` = `your-password`
5. Save and restart

See [AZURE_FUNCTION_CONFIGURATION.md](../AZURE_FUNCTION_CONFIGURATION.md) for detailed setup instructions.

### Local Development Configuration
For local testing, create `local.settings.json` (from template):

```bash
cp local.settings.json.example local.settings.json
```

Edit `local.settings.json` and add your password:
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

## Local Development

### Prerequisites
- Node.js 18 or higher
- Azure Functions Core Tools v4

### Install Dependencies
```bash
cd api
npm install
```

### Run Locally
```bash
npm start
# or
func start
```

The function will be available at:
```
http://localhost:7071/api/send-notification-email
```

### Test Locally
```bash
curl -X POST http://localhost:7071/api/send-notification-email \
  -H "Content-Type: application/json" \
  -d '{
    "recipients": ["test@example.com"],
    "notification": {
      "title": "Test Email",
      "message": "This is a test",
      "type": "test",
      "timestamp": "2025-09-30T12:00:00Z"
    }
  }'
```

## Deployment

Deployment is automatic via GitHub Actions when pushing to `main` or `master` branch.

The workflow file (`.github/workflows/azure-static-web-apps-carexps.yml`) handles:
- Building the frontend application
- Deploying the API functions
- Setting environment variables

**Important:** While the workflow passes `HOSTINGER_EMAIL_PASSWORD` during deployment, the function needs this variable configured in Azure Application Settings to work at runtime.

## Troubleshooting

### 503 Service Unavailable
**Cause:** `HOSTINGER_EMAIL_PASSWORD` not configured in Azure Application Settings

**Solution:**
1. Add environment variable in Azure Portal
2. See [AZURE_FUNCTION_CONFIGURATION.md](../AZURE_FUNCTION_CONFIGURATION.md)

### Authentication Errors (EAUTH)
**Cause:** Invalid SMTP credentials

**Solution:**
1. Verify password is correct for `carexps@phaetonai.com`
2. Check Hostinger email account is active
3. Update password in Azure Application Settings

### Connection Timeouts (ETIMEDOUT)
**Cause:** Cannot reach SMTP server

**Solution:**
1. Verify Azure can access `smtp.hostinger.com:465`
2. Check firewall rules
3. Verify SSL/TLS configuration

### Check Azure Function Logs
1. Go to Azure Portal
2. Navigate to your Static Web App
3. Click **Functions** > `send-notification-email`
4. Click **Monitor** or **Logs**
5. Look for diagnostic output

## Diagnostic Features

The function includes comprehensive diagnostics that log on every request:

- Node.js version and platform information
- Environment variable status (without exposing values)
- Azure-specific environment variables
- SMTP connection details
- Detailed error information with troubleshooting steps

## Security

- Credentials are never logged (only their existence and length)
- Uses SSL/TLS for SMTP connection (port 465)
- BCC is used for multiple recipients to protect privacy
- No PHI (Protected Health Information) is included in emails
- Comprehensive audit logging

## File Structure

```
api/
├── send-notification-email/
│   ├── index.js              # Function implementation
│   └── function.json         # Function configuration
├── package.json              # Dependencies
├── host.json                 # Global Azure Functions config
├── local.settings.json       # Local environment (gitignored)
├── local.settings.json.example # Template for local settings
└── README.md                 # This file
```

## Dependencies

- `nodemailer` - SMTP email sending
- `@azure/functions` - Azure Functions runtime

## Support

For issues:
1. Check Azure Function logs
2. Review [AZURE_FUNCTION_CONFIGURATION.md](../AZURE_FUNCTION_CONFIGURATION.md)
3. Verify Azure Application Settings
4. Test SMTP credentials manually
5. Contact support if issues persist

---

*Last updated: 2025-09-30*