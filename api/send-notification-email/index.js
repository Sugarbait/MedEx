const nodemailer = require('nodemailer');

// SMTP Configuration for Hostinger
const SMTP_CONFIG = {
  host: 'smtp.hostinger.com',
  port: 465,
  secure: true, // SSL
  auth: {
    user: 'carexps@phaetonai.com',
    pass: process.env.HOSTINGER_EMAIL_PASSWORD || null
  }
};

// Check if email credentials are configured
const hasValidCredentials = () => {
  return SMTP_CONFIG.auth.pass && SMTP_CONFIG.auth.pass !== 'your-email-password' && SMTP_CONFIG.auth.pass !== null;
};

// Create reusable transporter
let transporter = null;

const createTransporter = () => {
  try {
    if (!hasValidCredentials()) {
      console.warn('⚠️ Email credentials not configured. Set HOSTINGER_EMAIL_PASSWORD environment variable.');
      return null;
    }
    transporter = nodemailer.createTransporter(SMTP_CONFIG);
    console.log('✅ Email transporter created successfully');
    return transporter;
  } catch (error) {
    console.error('❌ Failed to create email transporter:', error);
    return null;
  }
};

// Enhanced HTML template with base64 logo fallback
function getDefaultTemplate(notification) {
  // Base64 encoded logo (CareXPS logo)
  const logoBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAOxAAADsQBlSsOGwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAA==';

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CareXPS Notification</title>
    <style>
        body {
            font-family: Arial, Helvetica, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
            width: 100% !important;
            min-width: 100%;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            background: #2563eb;
            color: white;
            padding: 20px;
            text-align: center;
        }
        .header img {
            border: 0 !important;
            outline: none !important;
            text-decoration: none !important;
            display: block !important;
            width: auto !important;
            height: auto !important;
            margin: 0 auto 10px auto !important;
            max-width: 200px !important;
            max-height: 60px !important;
        }
        .logo-fallback {
            background: #ffffff;
            color: #2563eb;
            font-weight: bold;
            font-size: 18px;
            padding: 10px 20px;
            border-radius: 4px;
            display: inline-block;
            margin: 0 auto 10px auto;
            border: 2px solid #2563eb;
        }
        .content {
            padding: 20px;
        }
        .notification {
            background: #f0f9ff;
            border-left: 4px solid #2563eb;
            padding: 15px;
            margin: 15px 0;
        }
        .footer {
            background: #f9fafb;
            padding: 15px;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
        }
        @media only screen and (max-width: 600px) {
            .container {
                width: 100% !important;
                margin: 0 !important;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <!-- Primary: External URL logo -->
            <img src="https://nexasync.ca/images/Logo.png" alt="CareXPS Healthcare CRM" title="CareXPS Healthcare CRM" style="max-height: 60px; max-width: 200px; display: block !important; margin: 0 auto 10px auto; width: auto !important; height: auto !important; border: 0; outline: none;" width="200" height="60">

            <!-- Fallback: Text-based logo -->
            <div class="logo-fallback" style="display: none;">
                CareXPS
            </div>

            <h2 style="margin: 10px 0 0 0; font-size: 16px; font-weight: normal;">System Notification</h2>
        </div>
        <div class="content">
            <div class="notification">
                <h3 style="margin: 0 0 10px 0; color: #1f2937;">${notification.title}</h3>
                <p style="margin: 0 0 10px 0; line-height: 1.5; color: #374151;">${notification.message}</p>
                <p style="margin: 0; color: #6b7280; font-size: 12px;"><small>Time: ${notification.timestamp}</small></p>
            </div>
        </div>
        <div class="footer">
            <p style="margin: 0 0 10px 0;">Secure Healthcare Communication Platform</p>
            <p style="font-size: 12px; margin: 0; color: #9ca3af;">
                <strong>PRIVACY NOTICE:</strong> This notification contains no Protected Health Information (PHI).
            </p>
        </div>
    </div>
</body>
</html>
  `;
}

// Plain text version
function getPlainTextVersion(notification) {
  return `
System Notification

${notification.title}

${notification.message}

Time: ${notification.timestamp}

---
Secure Healthcare Communication Platform

PRIVACY NOTICE: This notification contains no Protected Health Information (PHI).
  `;
}

// Azure Function entry point
module.exports = async function (context, req) {
  context.log('📧 Azure Function: Received email notification request');

  try {
    // Check if credentials are configured
    if (!hasValidCredentials()) {
      context.log.error('❌ Email credentials not configured');
      context.res = {
        status: 503,
        body: {
          error: 'Email service unavailable',
          details: 'SMTP credentials not configured. Please set HOSTINGER_EMAIL_PASSWORD environment variable in Azure Function settings.'
        }
      };
      return;
    }

    const { recipients, notification, template } = req.body;

    // Validate input
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      context.res = {
        status: 400,
        body: { error: 'No recipients provided' }
      };
      return;
    }

    if (!notification) {
      context.res = {
        status: 400,
        body: { error: 'No notification data provided' }
      };
      return;
    }

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validRecipients = recipients.filter(email => emailRegex.test(email));

    if (validRecipients.length === 0) {
      context.res = {
        status: 400,
        body: { error: 'No valid email addresses provided' }
      };
      return;
    }

    // Create transporter
    const emailTransporter = createTransporter();
    if (!emailTransporter) {
      context.res = {
        status: 503,
        body: {
          error: 'Failed to initialize email service',
          details: 'Could not create email transporter'
        }
      };
      return;
    }

    // Prepare email options with BCC for privacy
    const mailOptions = {
      from: {
        name: 'Healthcare CRM',
        address: 'carexps@phaetonai.com'
      },
      to: 'carexps@phaetonai.com', // Send to self to avoid empty 'to' field
      bcc: validRecipients.join(', '), // Use BCC to protect recipient privacy
      subject: `Healthcare CRM: ${notification.title}`,
      html: template || getDefaultTemplate(notification),
      text: getPlainTextVersion(notification)
    };

    context.log(`📧 Sending email to ${validRecipients.length} recipients:`, validRecipients);

    // Send email
    const result = await emailTransporter.sendMail(mailOptions);

    context.log('✅ Email sent successfully:', {
      messageId: result.messageId,
      recipients: validRecipients.length,
      type: notification.type
    });

    context.res = {
      status: 200,
      body: {
        success: true,
        messageId: result.messageId,
        recipients: validRecipients.length,
        type: notification.type,
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    context.log.error('❌ Email sending failed:', error);

    context.res = {
      status: 500,
      body: {
        error: 'Failed to send email',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    };
  }
};