/**
 * Simple Express Email Server for CareXPS Notifications
 * Handles Hostinger SMTP email sending
 */

import express from 'express'
import cors from 'cors'
import nodemailer from 'nodemailer'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

// Load environment variables from .env.email file
dotenv.config({ path: path.join(process.cwd(), '.env.email') })

// Load and encode logo as base64
let logoBase64 = ''
try {
  const logoPath = path.join(process.cwd(), 'public', 'images', 'Logo.png')
  if (fs.existsSync(logoPath)) {
    const logoBuffer = fs.readFileSync(logoPath)
    logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`
    console.log('✅ Logo loaded and encoded for email templates')
  } else {
    console.warn('⚠️ Logo file not found at:', logoPath)
  }
} catch (error) {
  console.warn('⚠️ Failed to load logo for emails:', error.message)
}

const app = express()
const PORT = process.env.EMAIL_SERVER_PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Hostinger SMTP Configuration
const SMTP_CONFIG = {
  host: 'smtp.hostinger.com',
  port: 465,
  secure: true, // SSL
  auth: {
    user: 'carexps@phaetonai.com',
    pass: process.env.HOSTINGER_EMAIL_PASSWORD || process.env.EMAIL_PASSWORD || null
  }
}

// Check if email credentials are configured
const hasValidCredentials = () => {
  return SMTP_CONFIG.auth.pass && SMTP_CONFIG.auth.pass !== 'your-email-password' && SMTP_CONFIG.auth.pass !== null
}

// Create reusable transporter
let transporter = null

const createTransporter = () => {
  try {
    if (!hasValidCredentials()) {
      console.warn('⚠️ Email credentials not configured. Set HOSTINGER_EMAIL_PASSWORD or EMAIL_PASSWORD environment variable.')
      console.warn('📧 Email functionality will be disabled until credentials are provided.')
      return
    }
    transporter = nodemailer.createTransport(SMTP_CONFIG)
    console.log('✅ Email transporter created successfully')
  } catch (error) {
    console.error('❌ Failed to create email transporter:', error)
  }
}

// Initialize transporter
createTransporter()

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'CareXPS Email Server',
    timestamp: new Date().toISOString()
  })
})

// Send notification email endpoint
app.post('/api/send-notification-email', async (req, res) => {
  try {
    console.log('📧 Received email notification request')

    // Check if credentials are configured
    if (!hasValidCredentials()) {
      return res.status(503).json({
        error: 'Email service unavailable',
        details: 'SMTP credentials not configured. Please set HOSTINGER_EMAIL_PASSWORD environment variable.'
      })
    }

    const { recipients, notification, template } = req.body

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        error: 'No recipients provided'
      })
    }

    if (!notification) {
      return res.status(400).json({
        error: 'No notification data provided'
      })
    }

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const validRecipients = recipients.filter(email => emailRegex.test(email))

    if (validRecipients.length === 0) {
      return res.status(400).json({
        error: 'No valid email addresses provided'
      })
    }

    // Create transporter if not exists
    if (!transporter) {
      createTransporter()
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
    }

    // Add logo attachment if using CID template and logo file exists
    if (template && template.includes('cid:logo')) {
      try {
        const logoPath = path.join(process.cwd(), 'public', 'images', 'Logo.png')
        if (fs.existsSync(logoPath)) {
          mailOptions.attachments = [{
            filename: 'logo.png',
            path: logoPath,
            cid: 'logo' // same cid value as in the html img src
          }]
        }
      } catch (error) {
        console.warn('⚠️ Failed to attach logo file:', error.message)
      }
    }

    console.log(`📧 Sending email to ${validRecipients.length} recipients:`, validRecipients)

    // Send email
    const result = await transporter.sendMail(mailOptions)

    console.log('✅ Email sent successfully:', {
      messageId: result.messageId,
      recipients: validRecipients.length,
      type: notification.type
    })

    res.json({
      success: true,
      messageId: result.messageId,
      recipients: validRecipients.length,
      type: notification.type,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Email sending failed:', error)

    res.status(500).json({
      error: 'Failed to send email',
      details: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

// Test email endpoint
app.post('/api/test-email', async (req, res) => {
  try {
    // Check if credentials are configured
    if (!hasValidCredentials()) {
      return res.status(503).json({
        error: 'Email service unavailable',
        details: 'SMTP credentials not configured. Please set HOSTINGER_EMAIL_PASSWORD environment variable.'
      })
    }

    const { recipient } = req.body

    if (!recipient) {
      return res.status(400).json({ error: 'Recipient email required' })
    }

    const testNotification = {
      type: 'system_alert',
      title: 'Email Configuration Test',
      message: 'This is a test email to verify your healthcare CRM email notification system is working correctly.',
      timestamp: new Date()
    }

    const mailOptions = {
      from: {
        name: 'Healthcare CRM',
        address: 'carexps@phaetonai.com'
      },
      to: 'carexps@phaetonai.com', // Send to self to avoid empty 'to' field
      bcc: recipient, // Use BCC for privacy consistency
      subject: 'Healthcare CRM: Email Configuration Test',
      html: getDefaultTemplate(testNotification),
      text: getPlainTextVersion(testNotification)
    }

    if (!transporter) {
      createTransporter()
    }

    const result = await transporter.sendMail(mailOptions)

    console.log('✅ Test email sent successfully to:', recipient)

    res.json({
      success: true,
      messageId: result.messageId,
      recipient,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Test email failed:', error)

    res.status(500).json({
      error: 'Failed to send test email',
      details: error.message
    })
  }
})

// Test logo display endpoint
app.post('/api/test-logo-email', async (req, res) => {
  try {
    if (!hasValidCredentials()) {
      return res.status(503).json({
        error: 'Email service unavailable',
        details: 'SMTP credentials not configured.'
      })
    }

    const { recipient, method } = req.body

    if (!recipient) {
      return res.status(400).json({ error: 'Recipient email required' })
    }

    const testNotification = {
      type: 'logo_test',
      title: 'Logo Display Test',
      message: 'This test email helps verify logo display using different methods: base64 inline, external URL, and CID attachment.',
      timestamp: new Date()
    }

    let htmlTemplate
    const mailOptions = {
      from: {
        name: 'Healthcare CRM',
        address: 'carexps@phaetonai.com'
      },
      to: 'carexps@phaetonai.com', // Send to self to avoid empty 'to' field
      bcc: recipient, // Use BCC for privacy consistency
      subject: 'Healthcare CRM: Logo Display Test',
      text: getPlainTextVersion(testNotification)
    }

    // Choose template method based on request
    switch (method) {
      case 'cid':
        htmlTemplate = getCIDTemplate(testNotification)
        // Add logo attachment for CID method
        try {
          const logoPath = path.join(process.cwd(), 'public', 'images', 'Logo.png')
          if (fs.existsSync(logoPath)) {
            mailOptions.attachments = [{
              filename: 'logo.png',
              path: logoPath,
              cid: 'logo'
            }]
          }
        } catch (error) {
          console.warn('⚠️ Failed to attach logo file:', error.message)
        }
        break
      case 'external':
        // Force external URL template (without base64)
        const tempLogoBase64 = logoBase64
        global.logoBase64 = '' // Temporarily disable base64
        htmlTemplate = getDefaultTemplate(testNotification)
        global.logoBase64 = tempLogoBase64 // Restore
        break
      default:
        htmlTemplate = getDefaultTemplate(testNotification)
    }

    mailOptions.html = htmlTemplate

    if (!transporter) {
      createTransporter()
    }

    const result = await transporter.sendMail(mailOptions)

    console.log(`✅ Logo test email sent (${method || 'default'}) to:`, recipient)

    res.json({
      success: true,
      messageId: result.messageId,
      recipient,
      method: method || 'default',
      logoMethod: logoBase64 ? 'base64' : 'external',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Logo test email failed:', error)

    res.status(500).json({
      error: 'Failed to send logo test email',
      details: error.message
    })
  }
})

// Logo status endpoint
app.get('/api/logo-status', (req, res) => {
  const logoPath = path.join(process.cwd(), 'public', 'images', 'Logo.png')
  const logoExists = fs.existsSync(logoPath)

  res.json({
    logoAvailable: !!logoBase64,
    logoFileExists: logoExists,
    logoSize: logoBase64 ? Buffer.from(logoBase64.split(',')[1], 'base64').length : 0,
    externalUrl: 'https://nexasync.ca/images/Logo.png',
    timestamp: new Date().toISOString()
  })
})

// Enhanced HTML template with multiple image fallback strategies
function getDefaultTemplate(notification) {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CareXPS Notification</title>
    <!--[if mso]>
    <noscript>
    <xml>
    <o:OfficeDocumentSettings>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
    </xml>
    </noscript>
    <![endif]-->
    <style>
        /* Reset styles for email compatibility */
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
            -ms-interpolation-mode: bicubic !important;
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
        /* Outlook specific styles */
        .outlook-logo {
            mso-hide: all;
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
            <!-- Primary: Base64 embedded image for maximum compatibility -->
            ${logoBase64 ? `
            <img src="${logoBase64}" alt="CareXPS Healthcare CRM" title="CareXPS Healthcare CRM" style="max-height: 60px; max-width: 200px; display: block !important; margin: 0 auto 10px auto; width: auto !important; height: auto !important; border: 0; outline: none;" width="200" height="60">
            ` : ''}

            <!-- Fallback 1: External URL with improved attributes -->
            ${!logoBase64 ? `
            <img src="https://nexasync.ca/images/Logo.png" alt="CareXPS Healthcare CRM" title="CareXPS Healthcare CRM" style="max-height: 60px; max-width: 200px; display: block !important; margin: 0 auto 10px auto; width: auto !important; height: auto !important; border: 0; outline: none;" width="200" height="60">
            ` : ''}

            <!-- Fallback 2: Text-based logo for when images are completely blocked -->
            <div class="logo-fallback" style="${logoBase64 ? 'display: none;' : ''}">
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
  `
}

// Alternative template with CID attachment method
function getCIDTemplate(notification) {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CareXPS Notification</title>
    <style>
        body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
        .header img { border: 0; outline: none; text-decoration: none; display: block !important; margin: 0 auto 10px auto; max-width: 200px; max-height: 60px; }
        .content { padding: 20px; }
        .notification { background: #f0f9ff; border-left: 4px solid #2563eb; padding: 15px; margin: 15px 0; }
        .footer { background: #f9fafb; padding: 15px; text-align: center; color: #6b7280; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="cid:logo" alt="CareXPS Healthcare CRM" title="CareXPS Healthcare CRM" width="200" height="60">
            <h2 style="margin: 10px 0 0 0; font-size: 16px; font-weight: normal;">System Notification</h2>
        </div>
        <div class="content">
            <div class="notification">
                <h3>${notification.title}</h3>
                <p>${notification.message}</p>
                <p><small>Time: ${notification.timestamp}</small></p>
            </div>
        </div>
        <div class="footer">
            <p>Secure Healthcare Communication Platform</p>
            <p style="font-size: 12px; margin-top: 10px;">
                <strong>PRIVACY NOTICE:</strong> This notification contains no Protected Health Information (PHI).
            </p>
        </div>
    </div>
</body>
</html>
  `
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
  `
}

// Start server
app.listen(PORT, () => {
  console.log(`📧 CareXPS Email Server running on port ${PORT}`)
  console.log(`📧 SMTP configured for: ${SMTP_CONFIG.host}:${SMTP_CONFIG.port}`)
  console.log(`📧 Sender email: ${SMTP_CONFIG.auth.user}`)
  console.log('📧 Ready to send notifications!')
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📧 Email server shutting down gracefully...')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('📧 Email server shutting down gracefully...')
  process.exit(0)
})