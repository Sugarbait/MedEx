# MedEx Invoice Email Deployment Guide

## Updated Invoice Email System
The invoice email function has been updated to match ARTLEE's professional styling and use the same email infrastructure (Resend API with Hostinger domain).

## Changes Made
- ✅ Email sender: `MedEx CRM <aibot@phaetonai.com>` (same as ARTLEE)
- ✅ Subject line: `Your Phaeton AI Service Cost Invoice - {date_range} - {total_amount}`
- ✅ Professional ARTLEE-style email template with Inter font
- ✅ MedEx logo at top: `https://nexasync.ca/medex/images/medex-logo.png`
- ✅ Phaeton AI branding in footer with contact info
- ✅ Table-based buttons for email client compatibility

## Deployment Steps

### 1. Login to Supabase CLI
```bash
npx supabase login
```
This will open a browser window for authentication.

### 2. Link to Your Project (if not already linked)
```bash
npx supabase link --project-ref onwgbfetzrctshdwwimm
```

### 3. Deploy the Function
```bash
cd "I:\Apps Back Up\Main MedEX CRM"
npx supabase functions deploy send-invoice-email --no-verify-jwt
```

### 4. Verify Environment Variables (if needed)
Check if `RESEND_API_KEY` is set:
```bash
npx supabase secrets list
```

If not set, add it:
```bash
npx supabase secrets set RESEND_API_KEY=your_resend_api_key_here
```

**Note**: The Resend API key should be the same one used by ARTLEE for the `aibot@phaetonai.com` email address.

## Testing the Deployment

### Test with cURL:
```bash
curl -X POST https://onwgbfetzrctshdwwimm.supabase.co/functions/v1/send-invoice-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -d '{
    "to_email": "elitesquadp@protonmail.com",
    "to_name": "Elite Squad",
    "invoice_id": "TEST-001",
    "date_range": "Dec 1, 2024 - Dec 31, 2024",
    "total_amount": "CAD $100.00",
    "total_calls": 10,
    "call_cost": "CAD $60.00",
    "total_chats": 5,
    "sms_cost": "CAD $40.00",
    "invoice_url": "https://invoice.stripe.com/test",
    "pdf_download_link": "https://example.com/pdf",
    "pdf_expiry_days": 7
  }'
```

### Test from Dashboard:
1. Navigate to Dashboard page
2. Select a date range with data
3. Click "Generate Invoice" button
4. Modal will appear with invoice details
5. Click "Generate Invoice" → "Confirm & Send"
6. Check `elitesquadp@protonmail.com` for the email

## Expected Email Appearance

The recipient will receive an email with:
- **From**: MedEx CRM <aibot@phaetonai.com>
- **Subject**: Your Phaeton AI Service Cost Invoice - [date range] - [amount]
- **Content**:
  - MedEx logo at top (white background header)
  - Professional greeting: "Dear [Name]"
  - Invoice number and total amount
  - Breakdown of Voice Call Services and SMS Messaging
  - Primary button: "Pay Invoice in Stripe" (dark blue)
  - Secondary button: "Download PDF Details" (white with border)
  - PDF expiry notice
  - Fallback link for email clients
  - Phaeton AI footer with phone (1-888-895-7770) and email (contactus@phaetonai.com)

## Troubleshooting

### If emails don't send:
1. Check Supabase logs:
   ```bash
   npx supabase functions logs send-invoice-email
   ```

2. Verify Resend API key is correct:
   - Login to Resend dashboard: https://resend.com
   - Check API Keys section
   - Verify `phaetonai.com` domain is verified

3. Check email in Resend dashboard:
   - Go to https://resend.com/emails
   - Look for recent sends
   - Check delivery status

### If deployment fails:
- Ensure you're logged in: `npx supabase login`
- Ensure project is linked: `npx supabase link --project-ref onwgbfetzrctshdwwimm`
- Check file syntax is valid TypeScript
- Try with `--debug` flag for more information

## Verification Checklist

- [ ] Function deployed successfully
- [ ] RESEND_API_KEY environment variable is set
- [ ] Test email sent to elitesquadp@protonmail.com
- [ ] Email received with correct formatting
- [ ] MedEx logo displays correctly
- [ ] Both buttons work (Stripe payment & PDF download)
- [ ] Footer shows Phaeton AI branding
- [ ] Email comes from aibot@phaetonai.com

## File Modified
- `supabase/functions/send-invoice-email/index.ts`

## Related Files
- `src/pages/DashboardPage.tsx` (invoice generation logic)
- `.env.local` (Stripe configuration)

---

**Deployment Date**: 2025-10-30
**System**: MedEx Healthcare CRM
**Email Provider**: Resend API + Hostinger (aibot@phaetonai.com)
