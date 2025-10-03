# Generate Monthly Invoices - Supabase Edge Function

This Edge Function automatically generates and sends Stripe invoices on the 1st of each month for all users with auto-invoicing enabled.

## Features

- Runs automatically via Supabase Cron (2 AM on 1st of month)
- Generates invoices for previous month's services
- Calculates combined costs (Calls + SMS)
- Creates Stripe customers automatically
- Sends invoices via Stripe
- Tracks all invoices in `invoice_history` table
- Handles failures with retry support
- Sends email notifications (via separate function)

## Deployment

### 1. Install Supabase CLI

```bash
npm install -g supabase
```

### 2. Login to Supabase

```bash
supabase login
```

### 3. Link Your Project

```bash
supabase link --project-ref your-project-ref
```

### 4. Set Secrets

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
```

### 5. Deploy the Function

```bash
supabase functions deploy generate-monthly-invoices
```

### 6. Set Up Cron Schedule

Run this SQL in Supabase SQL Editor:

```sql
-- Create cron job to run on 1st of each month at 2 AM
SELECT
  cron.schedule(
    'generate-monthly-invoices',
    '0 2 1 * *', -- Cron expression: 2 AM on 1st of month
    $$
    SELECT
      net.http_post(
        url:='https://your-project.supabase.co/functions/v1/generate-monthly-invoices',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
        body:='{}'::jsonb
      ) as request_id;
    $$
  );
```

Replace `your-project.supabase.co` with your actual Supabase project URL.

## Manual Testing

You can manually trigger the function for testing:

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/generate-monthly-invoices' \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json"
```

## Environment Variables

The function requires these environment variables (set via Supabase secrets):

- `STRIPE_SECRET_KEY` - Your Stripe secret key
- `SUPABASE_URL` - Auto-provided by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-provided by Supabase

## Monitoring

Check function logs:

```bash
supabase functions logs generate-monthly-invoices
```

Or view in Supabase Dashboard:
- Go to Edge Functions
- Click on `generate-monthly-invoices`
- View Logs tab

## Database Tables

The function reads from:
- `user_settings` - To find users with auto-invoice enabled
- `calls` - For call data and costs
- `chats` - For SMS data and costs

The function writes to:
- `invoice_history` - Invoice tracking with retry support

## Retry Logic

Failed invoices are saved with `invoice_status = 'failed'` and can be retried up to 3 times. A separate retry function should be created to handle retries.

## Cost Calculation

The function calculates:
1. **Call Costs**: Retell AI fees + Twilio voice charges ($ 0.022 USD/min)
2. **SMS Costs**: Twilio SMS segments ($ 0.0083 USD/segment) + 4-segment overhead
3. **Currency Conversion**: USD to CAD (using 1.35 exchange rate estimate)

## Invoice Details

Each invoice includes:
- Line item for Voice Calls (if any)
- Line item for SMS Conversations (if any)
- 30-day payment terms
- Hosted invoice URL for payment
- Metadata: user_id, invoice_month, generated_automatically flag

## Troubleshooting

### Function not running on schedule
- Check cron job is created: `SELECT * FROM cron.job;`
- Check cron job logs: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;`

### Stripe errors
- Verify `STRIPE_SECRET_KEY` is set correctly
- Check Stripe Dashboard for API errors
- Ensure Stripe API key has permissions for invoices and customers

### No invoices generated
- Verify users have `stripe_auto_invoice_enabled = true` in `user_settings`
- Ensure `stripe_customer_email` and `stripe_customer_name` are set
- Check if invoices already exist for the month in `invoice_history`

## Next Steps

1. Create `retry-failed-invoices` Edge Function for handling failures
2. Create `send-invoice-notification` Edge Function for email notifications
3. Set up monitoring alerts for function failures
4. Add cost calculation service integration for accurate pricing
