const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || 're_h2zsX65X_DEwVyzwSX5JASbELy8LnZo9m'
const APP_URL = 'https://carexps.nexasync.ca'
const LOGO_URL = 'https://carexps.nexasync.ca/images/Logo.png'

interface EmailPayload {
  type: 'new_sms' | 'new_call' | 'system_alert'
  record: {
    id: string
    created_at: string
  }
  recipients: string[]
}

async function sendEmailViaResend(recipients: string[], subject: string, htmlBody: string) {
  const results = []
  for (const recipient of recipients) {
    try {
      const emailData = {
        from: 'CareXPS CRM <aibot@phaetonai.com>',
        to: [recipient],
        subject: subject,
        html: htmlBody
      }
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + RESEND_API_KEY
        },
        body: JSON.stringify(emailData)
      })
      const responseData = await response.json()
      if (!response.ok) {
        throw new Error('Resend error')
      }
      results.push({ recipient, success: true })
    } catch (error) {
      results.push({ recipient, success: false })
    }
  }
  return { success: results.some(r => r.success), results }
}

function generateEmailHTML(type: string, timestamp: string, linkUrl: string): string {
  let title = 'CareXPS Notification'
  let message = 'You have a new notification from CareXPS Healthcare CRM.'

  if (type === 'new_sms') {
    title = 'New SMS Message'
    message = 'A new SMS message has been received in your CareXPS Healthcare CRM.'
  } else if (type === 'new_call') {
    title = 'New Voice Call'
    message = 'A new voice call has been recorded in your CareXPS Healthcare CRM.'
  }

  const btnText = 'View Details'
  const closeA = '</a>'
  const closeDiv = '</div>'
  const closeP = '</p>'
  const closeH1 = '</h1>'
  const closeH2 = '</h2>'

  let html = '<html><body><div style="font-family:Arial;max-width:600px;margin:0 auto;padding:20px">'
  html = html + '<div style="text-align:center;background:#1e40af;padding:20px">'
  html = html + '<img src="' + LOGO_URL + '" alt="Logo" width="250">'
  html = html + '<h1 style="color:white">CareXPS CRM' + closeH1 + closeDiv
  html = html + '<div style="padding:30px;background:white">'
  html = html + '<h2>' + title + closeH2
  html = html + '<p>' + message + closeP
  html = html + '<p>Received: ' + timestamp + closeP
  const btnStyle = 'background:#1e40af;color:white;padding:10px 20px;text-decoration:none;display:inline-block'
  html = html + '<div style="text-align:center"><a href="' + linkUrl + '" style="' + btnStyle + '">' + btnText + closeA + closeDiv + closeDiv
  html = html + '<div style="padding:20px;background:#f5f5f5;text-align:center">'
  html = html + '<p style="font-size:12px">CareXPS Healthcare CRM' + closeP
  html = html + '<p style="font-size:11px">HIPAA Notice: This email contains no PHI.' + closeP
  html = html + closeDiv + closeDiv + '</body></html>'

  return html
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  try {
    const payload: EmailPayload = await req.json()
    if (!payload.recipients || payload.recipients.length === 0) {
      throw new Error('No recipients')
    }
    let subject = 'CareXPS Notification'
    let linkUrl = APP_URL
    if (payload.type === 'new_sms') {
      subject = 'New SMS Message - CareXPS'
      linkUrl = APP_URL + '/sms'
    } else if (payload.type === 'new_call') {
      subject = 'New Voice Call - CareXPS'
      linkUrl = APP_URL + '/calls'
    }
    const timestamp = new Date(payload.record.created_at).toLocaleString('en-US', {
      dateStyle: 'long',
      timeStyle: 'short'
    })
    const htmlBody = generateEmailHTML(payload.type, timestamp, linkUrl)
    const result = await sendEmailViaResend(payload.recipients, subject, htmlBody)
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error), success: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
