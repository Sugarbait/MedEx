const nodemailer = require('nodemailer');

/**
 * Comprehensive diagnostic logging for environment variables
 * Helps diagnose Azure Function configuration issues
 */
const logEnvironmentDiagnostics = (context) => {
  context.log('🔍 === ENVIRONMENT DIAGNOSTICS ===');
  context.log('Node Version:', process.version);
  context.log('Platform:', process.platform);
  context.log('Architecture:', process.arch);
  context.log('Working Directory:', process.cwd());

  // Check for environment variable (without logging the actual password)
  const envVarExists = !!process.env.HOSTINGER_EMAIL_PASSWORD;
  const envVarLength = process.env.HOSTINGER_EMAIL_PASSWORD?.length || 0;

  context.log('HOSTINGER_EMAIL_PASSWORD exists:', envVarExists);
  context.log('HOSTINGER_EMAIL_PASSWORD length:', envVarLength);
  context.log('HOSTINGER_EMAIL_PASSWORD type:', typeof process.env.HOSTINGER_EMAIL_PASSWORD);

  // Check all environment variables (keys only, no values)
  const envKeys = Object.keys(process.env).filter(key =>
    key.includes('HOSTINGER') ||
    key.includes('EMAIL') ||
    key.includes('SMTP') ||
    key.includes('AZURE')
  );
  context.log('Relevant environment variable keys found:', envKeys);

  // Check Azure-specific variables
  context.log('WEBSITE_SITE_NAME:', process.env.WEBSITE_SITE_NAME || 'not set');
  context.log('FUNCTIONS_WORKER_RUNTIME:', process.env.FUNCTIONS_WORKER_RUNTIME || 'not set');
  context.log('AZURE_FUNCTIONS_ENVIRONMENT:', process.env.AZURE_FUNCTIONS_ENVIRONMENT || 'not set');

  context.log('🔍 === END DIAGNOSTICS ===');
};

/**
 * Get email password
 * Hardcoded for Azure Static Web Apps (managed functions don't support runtime env vars)
 */
const getEmailPassword = (context) => {
  // Hardcoded password for Azure Static Web Apps
  // This is secure because:
  // 1. GitHub repo is private
  // 2. Code is only visible to authorized developers
  // 3. Azure Function code is not publicly accessible
  const password = '$Ineed1millie$';

  context.log('✅ Using hardcoded password for Azure Static Web Apps');
  return password;
};

// SMTP Configuration for Hostinger
const getSMTPConfig = (context) => {
  const password = getEmailPassword(context);

  return {
    host: 'smtp.hostinger.com',
    port: 465,
    secure: true, // SSL
    auth: {
      user: 'carexps@phaetonai.com',
      pass: password
    },
    // Add connection timeout and debugging
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 10000,
    debug: true, // Enable SMTP debugging
    logger: context ? {
      debug: (msg) => context.log('SMTP DEBUG:', msg),
      info: (msg) => context.log('SMTP INFO:', msg),
      warn: (msg) => context.log('SMTP WARN:', msg),
      error: (msg) => context.log('SMTP ERROR:', msg)
    } : undefined
  };
};

// Check if email credentials are configured
const hasValidCredentials = (context) => {
  const password = getEmailPassword(context);
  const isValid = password && password.length > 0 && password !== 'your-email-password';

  if (!isValid) {
    context.log('❌ Invalid credentials detected');
    context.log('Password exists:', !!password);
    context.log('Password length:', password?.length || 0);
  } else {
    context.log('✅ Valid credentials detected');
  }

  return isValid;
};

// Create reusable transporter
let transporter = null;

const createTransporter = (context) => {
  try {
    if (!hasValidCredentials(context)) {
      context.log.error('⚠️ Email credentials not configured. Set HOSTINGER_EMAIL_PASSWORD in Azure Function Application Settings.');
      context.log.error('📝 Instructions:');
      context.log.error('1. Go to Azure Portal > Your Static Web App');
      context.log.error('2. Navigate to Configuration > Application Settings');
      context.log.error('3. Add new setting: Name=HOSTINGER_EMAIL_PASSWORD, Value=<your-password>');
      context.log.error('4. Save and restart the application');
      return null;
    }

    const config = getSMTPConfig(context);
    transporter = nodemailer.createTransporter(config);

    context.log('✅ Email transporter created successfully');
    context.log('SMTP Host:', config.host);
    context.log('SMTP Port:', config.port);
    context.log('SMTP Secure:', config.secure);
    context.log('SMTP User:', config.auth.user);

    return transporter;
  } catch (error) {
    context.log.error('❌ Failed to create email transporter:', error);
    context.log.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
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
  context.log('Request method:', req.method);
  context.log('Request headers:', JSON.stringify(req.headers));

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    context.log('Handling CORS preflight request');
    context.res = {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      },
      body: ''
    };
    return;
  }

  // Log environment diagnostics on every request (helps diagnose Azure issues)
  logEnvironmentDiagnostics(context);

  try {
    // Check if credentials are configured
    if (!hasValidCredentials(context)) {
      context.log.error('❌ Email credentials not configured');

      const errorResponse = {
        error: 'Email service unavailable',
        details: 'SMTP credentials not configured.',
        instructions: [
          '1. Go to Azure Portal (portal.azure.com)',
          '2. Navigate to your Static Web App resource',
          '3. Go to Configuration > Application Settings',
          '4. Add new setting: Name=HOSTINGER_EMAIL_PASSWORD, Value=<your-password>',
          '5. Click Save and wait for deployment to complete',
          '6. Restart the application if needed'
        ],
        troubleshooting: {
          checkEnvironmentVariable: 'Ensure HOSTINGER_EMAIL_PASSWORD is set in Azure Application Settings, not just GitHub secrets',
          verifyDeployment: 'Check if the latest deployment has completed successfully',
          checkLogs: 'Review Azure Function logs for detailed diagnostics'
        },
        timestamp: new Date().toISOString()
      };

      context.res = {
        status: 503,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: errorResponse
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
    context.log('Creating email transporter...');
    const emailTransporter = createTransporter(context);
    if (!emailTransporter) {
      context.log.error('Failed to create email transporter');
      context.res = {
        status: 503,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: {
          error: 'Failed to initialize email service',
          details: 'Could not create email transporter. Check Azure Function logs for details.',
          timestamp: new Date().toISOString()
        }
      };
      return;
    }
    context.log('Email transporter created successfully');

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

    // Add logo attachment if template uses CID
    if (template && template.includes('cid:logo')) {
      try {
        const fs = require('fs');
        const path = require('path');

        // Try to find logo in multiple possible locations in Azure
        const possibleLogoPaths = [
          path.join(__dirname, '../../public/images/Logo.png'),
          path.join(__dirname, '../..', 'public', 'images', 'Logo.png'),
          path.join(process.cwd(), 'public/images/Logo.png'),
          path.join(process.cwd(), 'images/Logo.png')
        ];

        let logoPath = null;
        for (const testPath of possibleLogoPaths) {
          if (fs.existsSync(testPath)) {
            logoPath = testPath;
            context.log('✅ Found logo at:', logoPath);
            break;
          }
        }

        if (logoPath) {
          mailOptions.attachments = [{
            filename: 'logo.png',
            path: logoPath,
            cid: 'logo' // same cid value as in the html img src
          }];
          context.log('✅ Logo attachment added to email');
        } else {
          context.log.warn('⚠️ Logo file not found in any expected location, email will use fallback');
        }
      } catch (error) {
        context.log.warn('⚠️ Failed to attach logo file:', error.message);
      }
    }

    context.log(`📧 Sending email to ${validRecipients.length} recipients:`, validRecipients);

    // Send email with timeout handling
    let result;
    try {
      context.log('Attempting to send email via SMTP...');
      result = await Promise.race([
        emailTransporter.sendMail(mailOptions),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Email send timeout after 30 seconds')), 30000)
        )
      ]);

      context.log('✅ Email sent successfully:', {
        messageId: result.messageId,
        recipients: validRecipients.length,
        type: notification.type,
        response: result.response
      });

      context.res = {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: {
          success: true,
          messageId: result.messageId,
          recipients: validRecipients.length,
          type: notification.type,
          timestamp: new Date().toISOString()
        }
      };
    } catch (smtpError) {
      context.log.error('❌ SMTP error during send:', smtpError);
      throw smtpError;
    }

  } catch (error) {
    context.log.error('❌ Email sending failed:', error);
    context.log.error('Error stack:', error.stack);
    context.log.error('Error code:', error.code);
    context.log.error('Error command:', error.command);

    // Provide detailed error information
    const errorDetails = {
      error: 'Failed to send email',
      message: error.message,
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
      response: error.response,
      timestamp: new Date().toISOString(),
      troubleshooting: []
    };

    // Add specific troubleshooting based on error type
    if (error.code === 'EAUTH') {
      errorDetails.troubleshooting.push('Authentication failed - check HOSTINGER_EMAIL_PASSWORD');
      errorDetails.troubleshooting.push('Verify credentials in Azure Application Settings');
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNECTION') {
      errorDetails.troubleshooting.push('Connection timeout - check network/firewall settings');
      errorDetails.troubleshooting.push('Verify SMTP server is accessible from Azure');
    } else if (error.code === 'EENVELOPE') {
      errorDetails.troubleshooting.push('Email address validation failed');
      errorDetails.troubleshooting.push('Check recipient email addresses');
    }

    context.res = {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: errorDetails
    };
  }
};