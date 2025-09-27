const { app } = require('@azure/functions');
const nodemailer = require('nodemailer');

// SMTP Configuration for Hostinger with Azure optimizations
const SMTP_CONFIG = {
  host: 'smtp.hostinger.com',
  port: 465,
  secure: true, // SSL
  connectionTimeout: 60000, // 60 seconds for Azure
  greetingTimeout: 30000,   // 30 seconds for Azure
  socketTimeout: 60000,     // 60 seconds for Azure
  auth: {
    user: 'carexps@phaetonai.com',
    pass: process.env.HOSTINGER_EMAIL_PASSWORD || null
  },
  // Azure-specific optimizations
  pool: false, // Disable connection pooling for serverless
  maxConnections: 1,
  maxMessages: 1,
  debug: process.env.NODE_ENV === 'development',
  logger: process.env.NODE_ENV === 'development' ? console : false
};

// Enhanced credential validation
const hasValidCredentials = () => {
  const password = process.env.HOSTINGER_EMAIL_PASSWORD;

  if (!password) {
    console.warn('⚠️ HOSTINGER_EMAIL_PASSWORD environment variable not set');
    return false;
  }

  if (password === 'your-email-password' || password.length < 8) {
    console.warn('⚠️ HOSTINGER_EMAIL_PASSWORD appears to be placeholder or too short');
    return false;
  }

  console.log('✅ Email credentials validation passed');
  return true;
};

// Create transporter with Azure-specific error handling
const createTransporter = async () => {
  try {
    if (!hasValidCredentials()) {
      throw new Error('Invalid or missing email credentials');
    }

    console.log('🔧 Creating email transporter for Azure environment...');
    const transporter = nodemailer.createTransporter(SMTP_CONFIG);

    // Verify connection with timeout
    console.log('🔍 Verifying SMTP connection...');
    const verifyPromise = transporter.verify();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('SMTP verification timeout')), 30000)
    );

    await Promise.race([verifyPromise, timeoutPromise]);
    console.log('✅ SMTP connection verified successfully');

    return transporter;
  } catch (error) {
    console.error('❌ Failed to create/verify email transporter:', error.message);

    // Provide specific error guidance
    if (error.code === 'EAUTH') {
      throw new Error('SMTP Authentication failed. Please verify HOSTINGER_EMAIL_PASSWORD is correct.');
    } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      throw new Error('SMTP connection timeout. Azure may be blocking SMTP connections.');
    } else if (error.code === 'ENOTFOUND') {
      throw new Error('SMTP server not found. Check network connectivity from Azure.');
    } else {
      throw new Error(`SMTP setup failed: ${error.message}`);
    }
  }
};

// Enhanced HTML template with Azure-optimized inline styles
function getDefaultTemplate(notification) {
  const timestamp = notification.timestamp || new Date().toISOString();
  const formattedTime = new Date(timestamp).toLocaleString('en-US', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>CareXPS Notification</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            margin: 0; padding: 20px; background: #f8fafc; line-height: 1.6;
            -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;
        }
        .container {
            max-width: 600px; margin: 0 auto; background: white;
            border-radius: 12px; overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.06);
        }
        .header {
            background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
            color: white; padding: 32px 24px; text-align: center;
        }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .header p { margin: 8px 0 0 0; opacity: 0.9; font-size: 14px; }
        .content { padding: 32px 24px; }
        .notification-box {
            background: #f0f9ff; border-left: 4px solid #2563eb;
            padding: 20px; border-radius: 8px; margin: 20px 0;
        }
        .notification-title {
            font-size: 18px; font-weight: 600; color: #1e293b;
            margin: 0 0 12px 0;
        }
        .notification-message {
            color: #475569; font-size: 16px; margin: 0;
        }
        .metadata {
            background: #f8fafc; padding: 16px; border-radius: 8px;
            margin-top: 20px; border: 1px solid #e2e8f0;
        }
        .metadata-row {
            display: flex; justify-content: space-between;
            margin: 6px 0; font-size: 14px;
        }
        .metadata-label { font-weight: 600; color: #374151; }
        .metadata-value { color: #6b7280; }
        .footer {
            background: #f8fafc; padding: 24px; text-align: center;
            color: #6b7280; font-size: 14px; border-top: 1px solid #e2e8f0;
        }
        .footer-brand { font-weight: 600; color: #374151; margin-bottom: 8px; }
        .disclaimer {
            font-size: 12px; color: #9ca3af; margin-top: 16px;
            padding-top: 16px; border-top: 1px solid #e5e7eb;
        }
        @media only screen and (max-width: 600px) {
            .container { margin: 0; border-radius: 0; }
            .content, .header { padding: 24px 16px; }
            .metadata-row { flex-direction: column; gap: 4px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏥 CareXPS Healthcare CRM</h1>
            <p>System Notification</p>
        </div>

        <div class="content">
            <div class="notification-box">
                <div class="notification-title">
                    📧 ${notification.title || 'System Notification'}
                </div>
                <div class="notification-message">
                    ${notification.message || 'A system notification has been generated.'}
                </div>
            </div>

            <div class="metadata">
                <div class="metadata-row">
                    <span class="metadata-label">Timestamp:</span>
                    <span class="metadata-value">${formattedTime}</span>
                </div>
                <div class="metadata-row">
                    <span class="metadata-label">Type:</span>
                    <span class="metadata-value">${notification.type || 'system_alert'}</span>
                </div>
                <div class="metadata-row">
                    <span class="metadata-label">Source:</span>
                    <span class="metadata-value">CareXPS Azure Function</span>
                </div>
            </div>
        </div>

        <div class="footer">
            <div class="footer-brand">CareXPS Healthcare CRM</div>
            <div>Secure Healthcare Communication Platform</div>

            <div class="disclaimer">
                <strong>PRIVACY NOTICE:</strong> This notification contains no Protected Health Information (PHI).
                Only general system alerts are sent via email to maintain HIPAA compliance.
                <br><br>
                © ${new Date().getFullYear()} CareXPS. All rights reserved.
            </div>
        </div>
    </div>
</body>
</html>`;
}

// Plain text version for email clients that don't support HTML
function getPlainTextVersion(notification) {
  const timestamp = notification.timestamp || new Date().toISOString();
  const formattedTime = new Date(timestamp).toLocaleString('en-US', {
    timeZone: 'America/Toronto'
  });

  return `
CareXPS Healthcare CRM - System Notification

${notification.title || 'System Notification'}

${notification.message || 'A system notification has been generated.'}

Details:
- Time: ${formattedTime}
- Type: ${notification.type || 'system_alert'}
- Source: CareXPS Azure Function

---
CareXPS Healthcare CRM
Secure Healthcare Communication Platform

PRIVACY NOTICE: This notification contains no Protected Health Information (PHI).
Only general system alerts are sent via email to maintain HIPAA compliance.

© ${new Date().getFullYear()} CareXPS. All rights reserved.
`;
}

// Azure Function HTTP trigger
app.http('send-notification-email', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'send-notification-email',
  handler: async (request, context) => {
    const startTime = Date.now();
    context.log('📧 Azure Function: Email notification request received');

    try {
      // Log environment info for debugging
      context.log('🔍 Environment check:', {
        nodeVersion: process.version,
        hasEmailPassword: !!process.env.HOSTINGER_EMAIL_PASSWORD,
        azureRegion: process.env.REGION_NAME || 'unknown'
      });

      // Check credentials first
      if (!hasValidCredentials()) {
        context.log.error('❌ Email credentials not configured properly');
        return {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'Email service unavailable',
            details: 'SMTP credentials not configured. Please set HOSTINGER_EMAIL_PASSWORD environment variable in Azure Function App Settings.',
            code: 'CREDENTIALS_MISSING',
            timestamp: new Date().toISOString()
          })
        };
      }

      // Parse and validate request body
      let requestBody;
      try {
        requestBody = typeof request.body === 'string'
          ? JSON.parse(request.body)
          : request.body;
      } catch (parseError) {
        context.log.error('❌ Invalid JSON in request body:', parseError.message);
        return {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'Invalid request format',
            details: 'Request body must be valid JSON',
            code: 'INVALID_JSON'
          })
        };
      }

      const { recipients, notification, template } = requestBody;

      // Validate recipients
      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'Invalid recipients',
            details: 'Recipients must be a non-empty array of email addresses',
            code: 'INVALID_RECIPIENTS'
          })
        };
      }

      // Validate notification data
      if (!notification || typeof notification !== 'object') {
        return {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'Invalid notification data',
            details: 'Notification must be an object with title and message',
            code: 'INVALID_NOTIFICATION'
          })
        };
      }

      // Validate email addresses
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const validRecipients = recipients.filter(email => {
        if (typeof email !== 'string') return false;
        return emailRegex.test(email.trim());
      });

      if (validRecipients.length === 0) {
        return {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'No valid email addresses',
            details: 'At least one valid email address is required',
            code: 'NO_VALID_EMAILS'
          })
        };
      }

      context.log(`📧 Processing email for ${validRecipients.length} valid recipients`);

      // Create and verify transporter
      let emailTransporter;
      try {
        emailTransporter = await createTransporter();
      } catch (transporterError) {
        context.log.error('❌ Email transporter creation failed:', transporterError.message);
        return {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'Email service initialization failed',
            details: transporterError.message,
            code: 'TRANSPORTER_FAILED',
            timestamp: new Date().toISOString()
          })
        };
      }

      // Prepare email content
      const emailHtml = template || getDefaultTemplate(notification);
      const emailText = getPlainTextVersion(notification);

      // Prepare mail options
      const mailOptions = {
        from: {
          name: 'CareXPS Healthcare CRM',
          address: 'carexps@phaetonai.com'
        },
        to: 'carexps@phaetonai.com', // Main recipient
        bcc: validRecipients.join(', '), // Use BCC for privacy
        subject: `CareXPS Alert: ${notification.title || 'System Notification'}`,
        html: emailHtml,
        text: emailText,
        // Azure Function optimizations
        priority: 'normal',
        headers: {
          'X-Mailer': 'CareXPS Azure Function',
          'X-Priority': '3',
          'X-MSMail-Priority': 'Normal'
        }
      };

      context.log('📧 Sending email via SMTP...');

      // Send email with timeout protection
      const sendPromise = emailTransporter.sendMail(mailOptions);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Email send timeout after 45 seconds')), 45000)
      );

      const result = await Promise.race([sendPromise, timeoutPromise]);

      const processingTime = Date.now() - startTime;

      context.log('✅ Email sent successfully:', {
        messageId: result.messageId,
        recipients: validRecipients.length,
        processingTime: `${processingTime}ms`,
        response: result.response
      });

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          messageId: result.messageId,
          recipients: validRecipients.length,
          type: notification.type || 'notification',
          processingTime: processingTime,
          timestamp: new Date().toISOString()
        })
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      context.log.error('❌ Email sending failed:', {
        error: error.message,
        stack: error.stack,
        processingTime: `${processingTime}ms`
      });

      // Determine appropriate error response
      let statusCode = 500;
      let errorCode = 'UNKNOWN_ERROR';

      if (error.message.includes('timeout')) {
        statusCode = 504;
        errorCode = 'TIMEOUT';
      } else if (error.message.includes('authentication') || error.message.includes('EAUTH')) {
        statusCode = 503;
        errorCode = 'AUTH_FAILED';
      } else if (error.message.includes('connection') || error.message.includes('ENOTFOUND')) {
        statusCode = 503;
        errorCode = 'CONNECTION_FAILED';
      }

      return {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Email delivery failed',
          details: error.message,
          code: errorCode,
          processingTime: processingTime,
          timestamp: new Date().toISOString()
        })
      };
    }
  }
});