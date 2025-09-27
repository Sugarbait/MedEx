// Azure Functions v3 Compatible Version
const nodemailer = require('nodemailer');

// SMTP Configuration optimized for Azure environment
const SMTP_CONFIG = {
  host: 'smtp.hostinger.com',
  port: 465,
  secure: true, // SSL
  connectionTimeout: 60000, // 60 seconds
  greetingTimeout: 30000,   // 30 seconds
  socketTimeout: 60000,     // 60 seconds
  auth: {
    user: 'carexps@phaetonai.com',
    pass: process.env.HOSTINGER_EMAIL_PASSWORD || null
  },
  // Azure optimizations
  pool: false, // Disable pooling for serverless
  maxConnections: 1,
  maxMessages: 1,
  debug: false // Disable debug in production
};

// Enhanced credential validation
const hasValidCredentials = () => {
  const password = process.env.HOSTINGER_EMAIL_PASSWORD;

  if (!password) {
    console.warn('⚠️ HOSTINGER_EMAIL_PASSWORD environment variable not set');
    return false;
  }

  if (password === 'your-email-password' || password.length < 8) {
    console.warn('⚠️ HOSTINGER_EMAIL_PASSWORD appears to be invalid');
    return false;
  }

  return true;
};

// Create transporter with enhanced error handling
const createTransporter = async () => {
  try {
    if (!hasValidCredentials()) {
      throw new Error('Email credentials not configured properly');
    }

    const transporter = nodemailer.createTransporter(SMTP_CONFIG);

    // Test connection with timeout
    const verifyPromise = transporter.verify();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('SMTP verification timeout')), 30000)
    );

    await Promise.race([verifyPromise, timeoutPromise]);
    console.log('✅ SMTP connection verified');

    return transporter;
  } catch (error) {
    console.error('❌ SMTP setup failed:', error.message);

    if (error.code === 'EAUTH') {
      throw new Error('SMTP Authentication failed - verify HOSTINGER_EMAIL_PASSWORD');
    } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      throw new Error('SMTP connection timeout - Azure may be blocking SMTP');
    } else if (error.code === 'ENOTFOUND') {
      throw new Error('SMTP server not found - check network connectivity');
    } else {
      throw new Error(`SMTP error: ${error.message}`);
    }
  }
};

// Enhanced email template with inline styles
function getEmailTemplate(notification) {
  const timestamp = notification.timestamp || new Date().toISOString();
  const formattedTime = new Date(timestamp).toLocaleString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CareXPS Notification</title>
</head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="background: #2563eb; color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">🏥 CareXPS Healthcare CRM</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">System Notification</p>
        </div>

        <div style="padding: 30px;">
            <div style="background: #f0f9ff; border-left: 4px solid #2563eb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0; color: #1f2937; font-size: 18px;">
                    📧 ${notification.title || 'System Notification'}
                </h3>
                <p style="margin: 0; line-height: 1.5; color: #374151;">
                    ${notification.message || 'A system notification has been generated.'}
                </p>
            </div>

            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin-top: 20px;">
                <p style="margin: 5px 0; font-size: 14px;"><strong>Time:</strong> ${formattedTime}</p>
                <p style="margin: 5px 0; font-size: 14px;"><strong>Type:</strong> ${notification.type || 'system_alert'}</p>
                <p style="margin: 5px 0; font-size: 14px;"><strong>Source:</strong> CareXPS Azure Function</p>
            </div>
        </div>

        <div style="background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 14px;">
            <p style="margin: 0 0 10px 0; font-weight: bold;">CareXPS Healthcare CRM</p>
            <p style="margin: 0;">Secure Healthcare Communication Platform</p>
            <div style="font-size: 12px; color: #9ca3af; margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
                <strong>PRIVACY NOTICE:</strong> This notification contains no Protected Health Information (PHI).
                <br>© ${new Date().getFullYear()} CareXPS. All rights reserved.
            </div>
        </div>
    </div>
</body>
</html>`;
}

// Plain text version
function getPlainTextVersion(notification) {
  const timestamp = notification.timestamp || new Date().toISOString();
  const formattedTime = new Date(timestamp).toLocaleString();

  return `CareXPS Healthcare CRM - System Notification

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
© ${new Date().getFullYear()} CareXPS. All rights reserved.`;
}

// Azure Function entry point (v3 compatible)
module.exports = async function (context, req) {
  const startTime = Date.now();
  context.log('📧 Azure Function v3: Email notification request received');

  // Set CORS headers for preflight requests
  if (req.method === 'OPTIONS') {
    context.res = {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      },
      body: ''
    };
    return;
  }

  try {
    // Environment validation
    context.log('🔍 Environment check:', {
      nodeVersion: process.version,
      hasEmailPassword: !!process.env.HOSTINGER_EMAIL_PASSWORD,
      functionName: context.executionContext?.functionName || 'unknown'
    });

    // Credential validation
    if (!hasValidCredentials()) {
      context.log.error('❌ Email credentials not configured');
      context.res = {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: {
          error: 'Email service unavailable',
          details: 'SMTP credentials not configured. Set HOSTINGER_EMAIL_PASSWORD in Azure Function App Settings.',
          code: 'CREDENTIALS_MISSING',
          timestamp: new Date().toISOString()
        }
      };
      return;
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (parseError) {
      context.log.error('❌ Invalid JSON:', parseError.message);
      context.res = {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: {
          error: 'Invalid request format',
          details: 'Request body must be valid JSON',
          code: 'INVALID_JSON'
        }
      };
      return;
    }

    const { recipients, notification, template } = requestBody;

    // Validate inputs
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      context.res = {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: {
          error: 'Invalid recipients',
          details: 'Recipients must be a non-empty array',
          code: 'INVALID_RECIPIENTS'
        }
      };
      return;
    }

    if (!notification || typeof notification !== 'object') {
      context.res = {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: {
          error: 'Invalid notification data',
          details: 'Notification must be an object',
          code: 'INVALID_NOTIFICATION'
        }
      };
      return;
    }

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validRecipients = recipients.filter(email =>
      typeof email === 'string' && emailRegex.test(email.trim())
    );

    if (validRecipients.length === 0) {
      context.res = {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: {
          error: 'No valid email addresses',
          details: 'At least one valid email is required',
          code: 'NO_VALID_EMAILS'
        }
      };
      return;
    }

    context.log(`📧 Processing ${validRecipients.length} recipients`);

    // Create transporter
    let emailTransporter;
    try {
      emailTransporter = await createTransporter();
    } catch (transporterError) {
      context.log.error('❌ Transporter failed:', transporterError.message);
      context.res = {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: {
          error: 'Email service initialization failed',
          details: transporterError.message,
          code: 'TRANSPORTER_FAILED',
          timestamp: new Date().toISOString()
        }
      };
      return;
    }

    // Prepare email
    const mailOptions = {
      from: {
        name: 'CareXPS Healthcare CRM',
        address: 'carexps@phaetonai.com'
      },
      to: 'carexps@phaetonai.com',
      bcc: validRecipients.join(', '),
      subject: `CareXPS Alert: ${notification.title || 'System Notification'}`,
      html: template || getEmailTemplate(notification),
      text: getPlainTextVersion(notification)
    };

    context.log('📧 Sending email...');

    // Send with timeout
    const sendPromise = emailTransporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Email send timeout')), 45000)
    );

    const result = await Promise.race([sendPromise, timeoutPromise]);
    const processingTime = Date.now() - startTime;

    context.log('✅ Email sent successfully:', {
      messageId: result.messageId,
      recipients: validRecipients.length,
      processingTime: `${processingTime}ms`
    });

    context.res = {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: {
        success: true,
        messageId: result.messageId,
        recipients: validRecipients.length,
        type: notification.type || 'notification',
        processingTime: processingTime,
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    context.log.error('❌ Email failed:', {
      error: error.message,
      processingTime: `${processingTime}ms`
    });

    let statusCode = 500;
    let errorCode = 'UNKNOWN_ERROR';

    if (error.message.includes('timeout')) {
      statusCode = 504;
      errorCode = 'TIMEOUT';
    } else if (error.message.includes('auth')) {
      statusCode = 503;
      errorCode = 'AUTH_FAILED';
    } else if (error.message.includes('connection')) {
      statusCode = 503;
      errorCode = 'CONNECTION_FAILED';
    }

    context.res = {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: {
        error: 'Email delivery failed',
        details: error.message,
        code: errorCode,
        processingTime: processingTime,
        timestamp: new Date().toISOString()
      }
    };
  }
};