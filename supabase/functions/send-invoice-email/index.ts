// ================================================================
// INVOICE EMAIL SUPABASE EDGE FUNCTION
// ================================================================
// Sends invoice notification emails using Resend API
// Deployment: supabase functions deploy send-invoice-email --no-verify-jwt
// ================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Resend SDK (using npm: prefix for Deno)
// @ts-ignore
import { Resend } from 'npm:resend@2.0.0'

// Initialize Resend with API key from environment
const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

// HTML Email Template (matching ARTLEE professional styling)
const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MedEx Invoice</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            line-height: 1.6;
            color: #1a1a1a;
            max-width: 650px;
            margin: 0 auto;
            padding: 40px 20px;
            background-color: #f8f9fa;
            overflow-x: hidden;
        }

        * {
            box-sizing: border-box;
        }

        .email-wrapper {
            background: #ffffff;
            border: 1px solid #e1e4e8;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
            overflow-x: hidden;
        }

        .header {
            background: #ffffff;
            color: #000000;
            padding: 40px 40px 35px 40px;
            border-bottom: 3px solid #e2e8f0;
            text-align: center;
        }

        .header a,
        .header a:link,
        .header a:visited,
        .header a:hover,
        .header a:active {
            color: #000000 !important;
            text-decoration: none !important;
            pointer-events: none;
            cursor: default;
        }

        .header-logo {
            max-width: 200px;
            height: auto;
            margin: 0 auto 20px auto;
            display: block;
        }

        .header h1 {
            margin: 0 0 8px 0;
            font-size: 28px;
            font-weight: 600;
            letter-spacing: -0.5px;
        }

        .header p {
            margin: 0;
            font-size: 14px;
            color: #000000;
            font-weight: 400;
        }
        .content {
            padding: 40px;
            overflow-x: hidden;
        }

        .greeting {
            font-size: 15px;
            color: #2d3748;
            margin-bottom: 25px;
            line-height: 1.5;
            text-align: center;
        }

        .invoice-summary {
            background: #f7fafc;
            border: 1px solid #e2e8f0;
            padding: 30px;
            margin: 30px 0;
        }

        .invoice-id {
            font-size: 11px;
            color: #718096;
            margin-bottom: 20px;
            font-weight: 500;
            letter-spacing: 0.3px;
            word-break: break-all;
            text-align: center;
        }

        .amount-section {
            text-align: center;
            padding: 25px 0;
            border-top: 2px solid #e2e8f0;
            border-bottom: 2px solid #e2e8f0;
            margin: 20px 0;
        }

        .amount-label {
            font-size: 12px;
            color: #718096;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 600;
            margin-bottom: 8px;
        }

        .amount {
            font-size: 42px;
            font-weight: 700;
            color: #1e3a5f;
            margin: 0;
        }

        .breakdown {
            margin-top: 25px;
        }

        .breakdown-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 0;
            border-bottom: 1px solid #e2e8f0;
        }

        .breakdown-item:first-child {
            padding-top: 0;
        }

        .breakdown-item:last-child {
            border-bottom: none;
            padding-bottom: 0;
        }

        .breakdown-left {
            display: flex;
            flex-direction: column;
        }

        .breakdown-label {
            color: #2d3748;
            font-size: 15px;
            font-weight: 500;
        }

        .breakdown-subtext {
            font-size: 13px;
            color: #718096;
            margin-top: 2px;
        }

        .breakdown-value {
            font-weight: 600;
            font-size: 16px;
            color: #1a1a1a;
        }

        .action-section {
            margin: 35px 0;
        }

        .button {
            display: block;
            width: 100%;
            padding: 16px 24px;
            text-align: center;
            text-decoration: none !important;
            font-weight: 600;
            font-size: 15px;
            transition: all 0.2s ease;
            margin-bottom: 12px;
            border: 2px solid transparent;
            word-wrap: break-word;
            overflow-wrap: break-word;
            cursor: pointer;
            pointer-events: auto;
            -webkit-user-select: none;
            user-select: none;
        }

        .btn-primary {
            background: #1e3a5f;
            color: #ffffff !important;
        }

        .btn-primary:hover {
            background: #2c5282;
        }

        .btn-secondary {
            background: #ffffff;
            color: #1e3a5f !important;
            border: 2px solid #cbd5e0;
        }

        .btn-secondary:hover {
            border-color: #1e3a5f;
            background: #f7fafc;
        }

        .info-box {
            background: #f7fafc;
            border-left: 3px solid #4299e1;
            padding: 16px 20px;
            margin: 30px 0;
            font-size: 14px;
            color: #2d3748;
        }

        .info-box strong {
            color: #1a1a1a;
        }

        .closing {
            margin-top: 35px;
            font-size: 15px;
            color: #2d3748;
            text-align: center;
        }

        .footer {
            background: #f7fafc;
            padding: 30px 40px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
        }

        .footer-brand {
            font-weight: 600;
            color: #1e3a5f;
            font-size: 15px;
            margin-bottom: 8px;
        }

        .footer-brand a {
            color: #1e3a5f;
            text-decoration: none;
        }

        .footer-brand a:hover {
            text-decoration: underline;
        }

        .footer p {
            margin: 5px 0;
            font-size: 13px;
            color: #718096;
        }

        .footer a {
            color: #1e3a5f;
            text-decoration: none;
            font-weight: 500;
        }

        .footer a:hover {
            text-decoration: underline;
        }

        .divider {
            height: 1px;
            background: #e2e8f0;
            margin: 30px 0;
        }

        @media (max-width: 480px) {
            body {
                padding: 10px;
            }

            .header, .content, .footer {
                padding: 20px 15px;
            }

            .header-logo {
                max-width: 160px;
            }

            .header h1 {
                font-size: 24px;
            }

            .amount {
                font-size: 36px;
            }

            .button {
                padding: 14px 16px;
                font-size: 14px;
            }

            .invoice-summary {
                padding: 20px 15px;
            }
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="header">
            <img src="https://nexasync.ca/medex/images/medex-logo.png" alt="MedEx Logo" class="header-logo">
            <h1>Invoice Statement</h1>
            <p>Billing Period:<br>{{date_range}}</p>
        </div>

        <div class="content">
            <div class="greeting">
                <strong>Dear {{to_name}},</strong>
                <br><br>
                Please find your MedEx invoice for the period indicated above. This statement details your usage and associated charges.
            </div>

            <div class="invoice-summary">
                <div class="invoice-id">INVOICE #{{invoice_id}}</div>

                <div class="amount-section">
                    <div class="amount-label">Total Amount Due</div>
                    <div class="amount">{{total_amount}}</div>
                </div>

                <div class="breakdown">
                    <div class="breakdown-item">
                        <div class="breakdown-left">
                            <span class="breakdown-label">Voice Call Services</span>
                            <span class="breakdown-subtext">{{total_calls}} calls</span>
                        </div>
                        <span class="breakdown-value">{{call_cost}}</span>
                    </div>
                    <div class="breakdown-item">
                        <div class="breakdown-left">
                            <span class="breakdown-label">SMS Messaging</span>
                            <span class="breakdown-subtext">{{total_chats}} messages</span>
                        </div>
                        <span class="breakdown-value">{{sms_cost}}</span>
                    </div>
                </div>
            </div>

            <div class="action-section">
                <!-- Primary Button: Pay Invoice -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 12px;">
                    <tr>
                        <td align="center" style="border-radius: 4px;" bgcolor="#1e3a5f">
                            <a href="{{invoice_url}}" target="_blank" style="font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 4px; padding: 16px 24px; border: 2px solid #1e3a5f; display: inline-block; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
                                Pay Invoice in Stripe
                            </a>
                        </td>
                    </tr>
                </table>

                <!-- Secondary Button: Download PDF -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td align="center" style="border-radius: 4px; border: 2px solid #cbd5e0;" bgcolor="#ffffff">
                            <a href="{{pdf_download_link}}" target="_blank" style="font-size: 15px; font-weight: 600; color: #1e3a5f; text-decoration: none; border-radius: 4px; padding: 16px 24px; display: inline-block; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
                                Download PDF Details
                            </a>
                        </td>
                    </tr>
                </table>
            </div>

            <div class="info-box">
                <strong>Important:</strong> The PDF download link will expire in {{pdf_expiry_days}} days. Please save a copy for your records.
            </div>

            <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 4px; font-size: 13px; color: #4a5568; text-align: center;">
                <strong>Having trouble with the button?</strong><br>
                Copy and paste this link into your browser: <a href="{{invoice_url}}" style="color: #1e3a5f; word-break: break-all;">{{invoice_url}}</a>
            </div>

            <div class="closing">
                Thank you for choosing Phaeton AI. If you have any questions regarding this invoice, please don't hesitate to contact our support team.
            </div>
        </div>

        <div class="footer">
            <div class="footer-brand"><a href="https://www.phaetonai.com">Phaeton AI</a></div>
            <p>Phone: <a href="tel:+18888957770">1 (888) 895-7770</a></p>
            <p>Email: <a href="mailto:contactus@phaetonai.com">contactus@phaetonai.com</a></p>
            <p style="margin-top: 15px; font-size: 12px; opacity: 0.7;">This is an automated notification. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`

// Edge Function Handler
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    console.log('📧 Invoice email request received')

    // Parse request body
    const requestBody = await req.json()

    const {
      to_email,
      to_name,
      invoice_id,
      date_range,
      total_amount,
      total_calls,
      call_cost,
      total_chats,
      sms_cost,
      invoice_url,
      pdf_download_link,
      pdf_expiry_days,
    } = requestBody

    // Validate required fields
    if (!to_email || !invoice_id || !invoice_url) {
      console.error('❌ Missing required fields')
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    // Replace template placeholders
    let emailHtml = HTML_TEMPLATE
      .replace(/{{to_name}}/g, to_name || 'Valued Customer')
      .replace(/{{invoice_id}}/g, invoice_id)
      .replace(/{{date_range}}/g, date_range || 'Recent Period')
      .replace(/{{total_amount}}/g, total_amount || '$0.00')
      .replace(/{{total_calls}}/g, (total_calls || 0).toString())
      .replace(/{{call_cost}}/g, call_cost || '$0.00')
      .replace(/{{total_chats}}/g, (total_chats || 0).toString())
      .replace(/{{sms_cost}}/g, sms_cost || '$0.00')
      .replace(/{{invoice_url}}/g, invoice_url)
      .replace(/{{pdf_download_link}}/g, pdf_download_link || invoice_url)
      .replace(/{{pdf_expiry_days}}/g, (pdf_expiry_days || 7).toString())

    console.log('📤 Sending email to:', to_email)

    // Send email via Resend (using phaetonai.com domain with Hostinger)
    const data = await resend.emails.send({
      from: 'MedEx CRM <aibot@phaetonai.com>',
      to: [to_email],
      subject: `Your Phaeton AI Service Cost Invoice - ${date_range} - ${total_amount}`,
      html: emailHtml,
    })

    console.log('✅ Email sent successfully:', data)

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (error: any) {
    console.error('❌ Email sending failed:', error)

    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Unknown error' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
})

/* ================================================================
   DEPLOYMENT INSTRUCTIONS
   ================================================================

   1. Install Supabase CLI:
      npm install -g supabase

   2. Login to Supabase:
      supabase login

   3. Link your project:
      supabase link --project-ref YOUR_PROJECT_REF

   4. Deploy the function:
      supabase functions deploy send-invoice-email --no-verify-jwt

   5. Set environment variable:
      supabase secrets set RESEND_API_KEY=your_resend_api_key

   6. Test the function:
      curl -X POST YOUR_SUPABASE_URL/functions/v1/send-invoice-email \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer YOUR_ANON_KEY" \
        -d '{"to_email":"test@example.com","invoice_id":"TEST-001","invoice_url":"https://stripe.com","total_amount":"CAD $100.00"}'

   ================================================================
   RESEND CONFIGURATION
   ================================================================

   1. Sign up at https://resend.com
   2. Verify your domain
   3. Get API key from API Keys section
   4. Add API key to Supabase secrets (step 5 above)
   5. Update "from" email address in code to use your verified domain

   ================================================================ */
