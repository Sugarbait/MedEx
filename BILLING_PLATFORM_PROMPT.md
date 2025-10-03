# **Detailed Prompt: Billing Admin Platform for CareXPS CRM**

## **Project Overview**
Create a dedicated billing administration platform within the existing CareXPS CRM that allows authorized administrators (Super Users only) to view aggregated billing data across all customers and generate Stripe invoices for monthly usage costs (Twilio SMS + Retell AI Chat costs).

**IMPORTANT SECURITY NOTES:**
- ✅ **MFA MANDATORY**: This platform REQUIRES multi-factor authentication (MFA) to access
- ✅ **NO PHI/HIPAA**: This platform handles ONLY billing and usage data (costs, call counts, SMS segments)
- ✅ **NO PROTECTED HEALTH INFORMATION**: No patient names, medical records, or healthcare data
- ✅ **USAGE METRICS ONLY**: Call durations, SMS segment counts, timestamps, costs - NO identifiable patient information

---

## **Requirements**

### **1. Access Control & Security**

#### **Route & Authentication**
- **Route**: Add new route `/admin/billing` to existing CareXPS CRM application
- **Authentication Requirements** (STRICTLY ENFORCED):
  1. User must be logged in with valid Azure AD authentication
  2. User must have `Super User` role (check via existing role system)
  3. **MFA VERIFICATION REQUIRED**: User must have MFA enabled and verified
     - Check `fresh_mfa_enabled` and `fresh_mfa_setup_completed` from user_settings
     - If MFA not enabled, redirect to MFA setup page with message: "MFA is required to access Billing Admin"
     - Implement MFA challenge on first access to billing page (similar to Settings page protection)
  4. Optional: Add additional hardcoded user ID check for extra security (only specific user IDs can access)

#### **MFA Protection Implementation**
```typescript
// Check MFA status before allowing access to billing routes
const billingRouteGuard = async () => {
  const mfaStatus = await freshMfaService.checkMFAStatus(userId)

  if (!mfaStatus.enabled || !mfaStatus.setupCompleted) {
    // Redirect to MFA setup with return URL
    navigate('/mfa-setup', {
      state: {
        returnUrl: '/admin/billing',
        message: 'Multi-factor authentication is required to access Billing Admin'
      }
    })
    return false
  }

  return true
}
```

#### **Navigation**
- Add "Billing Admin" menu item to sidebar
- **Visible ONLY to Super Users with MFA enabled**
- Icon: Use `DollarSign` icon from lucide-react with badge showing "MFA Required"
- Display shield icon next to menu item indicating MFA protection

#### **Data Access Rules**
- ✅ **CAN ACCESS**: Call durations, SMS segment counts, costs, timestamps, call/chat IDs
- ✅ **CAN ACCESS**: Aggregated usage metrics (total calls, total SMS, total costs)
- ❌ **CANNOT ACCESS**: Patient names, health card numbers, medical information
- ❌ **CANNOT ACCESS**: Chat transcripts containing PHI
- ❌ **CANNOT ACCESS**: Any encrypted PHI data from audit logs

#### **Audit Logging**
- Log all billing actions using existing audit system BUT:
  - Use action type: `BILLING_ADMIN_ACCESS`, `BILLING_INVOICE_GENERATED`, etc.
  - Mark severity as `ADMINISTRATIVE` (not medical/HIPAA)
  - No PHI in audit logs (only usage metrics and invoice amounts)
  - Store: user ID, action, timestamp, invoice ID, customer name (business name, not patient)

---

## **2. Cost Calculation System Integration**

### **Use Existing CareXPS Cost Services**

#### **A. Twilio SMS Cost Calculation**
**Service**: `src/services/twilioCostService.ts`

**Method to Use**: `getCombinedSMSCostCAD(messages, retellChatCostCents)`

**How it works**:
```typescript
// For each chat, calculate combined cost:
import { twilioCostService } from '@/services/twilioCostService'
import { chatService } from '@/services/chatService'

// 1. Get full chat with messages
const chat = await chatService.getChatById(chatId)

// 2. Extract Retell AI cost (in cents) from API response
const retellChatCostCents = chat.chat_cost?.combined_cost ?? 0

// 3. Calculate combined cost (Twilio SMS + Retell AI)
const combinedCostCAD = twilioCostService.getCombinedSMSCostCAD(
  chat.message_with_tool_calls || [],
  retellChatCostCents
)
```

**Cost Breakdown Components**:
- **Twilio SMS Cost**:
  - Rate: $0.0083 USD per segment
  - Calculated per message using Twilio toll-free rules:
    - GSM-7: Single ≤160 chars, multi uses 152 chars/segment
    - UCS-2: Single ≤70 chars, multi uses 66 chars/segment
  - Includes +4 segments for initial SMS prompt (not in transcript)
  - Converted to CAD using `currencyService`

- **Retell AI Chat Cost**:
  - Extracted from `chat_cost.combined_cost` field (in cents)
  - Includes: LLM costs, TTS costs, STT costs (from `product_costs` array)
  - Converted from cents to USD, then to CAD

- **Total Combined Cost**: Twilio SMS + Retell AI in CAD

**Important Notes**:
- Raw message content used (no stripping) to match Twilio billing
- Per-message calculation (not combined) matches Twilio's actual billing method
- All costs cached for 5 minutes to improve performance

#### **B. Voice Call Cost Calculation**
**Service**: `src/services/twilioCostService.ts`

**Method to Use**: `getTwilioCostCAD(callLengthSeconds)`

**How it works**:
```typescript
// For each call, calculate Twilio inbound call cost:
const callCostCAD = twilioCostService.getTwilioCostCAD(callLengthSeconds)
```

**Cost Breakdown**:
- **Twilio Inbound Voice**:
  - Rate: $0.022 USD per minute (Canadian 1-800 toll-free)
  - Billing: Rounded UP to next whole minute (e.g., 61 seconds = 2 minutes)
  - Formula: `Math.ceil(seconds / 60) * 0.022 USD`
  - Converted to CAD using `currencyService`

- **Retell AI Voice Cost**:
  - Already included in call cost from Retell API
  - No separate calculation needed for voice calls

**Important Notes**:
- Voice calls are billed per minute (rounded up)
- SMS chats are billed per segment (no rounding)

#### **C. Currency Conversion**
**Service**: `src/services/currencyService.ts`

**Method to Use**: `convertUSDToCAD(amountUSD)`

**How it works**:
- Fetches real-time exchange rates from API
- Updates rates periodically (cached)
- Fallback rate: 1.35 CAD/USD if API unavailable
- All costs displayed in CAD (Canadian Dollars)

#### **D. Cost Cache Service**
**Service**: `src/services/smsCostCacheService.ts`

**How it works**:
- Caches calculated costs for 5 minutes to avoid repeated API calls
- Singleton pattern prevents duplicate calculations
- Use for bulk operations to improve performance

**Method to Use for Billing**:
```typescript
import { smsCostCacheService } from '@/services/smsCostCacheService'

// Load costs for multiple chats efficiently
const costs = await smsCostCacheService.loadMultipleChatCosts(
  chatsArray,
  (loaded, total) => console.log(`Progress: ${loaded}/${total}`)
)
```

---

## **3. Data Aggregation for Billing**

### **What Data to Query**

#### **For SMS Chat Billing**:
```typescript
// Query chats table (via chatService)
const chats = await chatService.getAllChats({
  start_timestamp: {
    gte: startOfMonth, // Unix timestamp
    lte: endOfMonth
  },
  chat_status: 'ended' // Only completed chats
})

// For each chat, extract:
interface ChatBillingData {
  chat_id: string              // Unique identifier (NO PHI)
  start_timestamp: number       // Unix timestamp
  end_timestamp: number         // Unix timestamp
  message_count: number         // Count of messages
  segments: number              // SMS segments (calculated)
  twilio_sms_cost_cad: number  // Twilio portion
  retell_ai_cost_cad: number   // Retell AI portion
  combined_cost_cad: number    // Total cost
  duration_seconds: number      // Chat duration
}
```

#### **For Voice Call Billing**:
```typescript
// Query calls table (via callService)
const calls = await callService.getCallHistory({
  start_timestamp_after: startOfMonth,
  end_timestamp_before: endOfMonth
})

// For each call, extract:
interface CallBillingData {
  call_id: string               // Unique identifier (NO PHI)
  start_timestamp: number       // Unix timestamp
  end_timestamp: number         // Unix timestamp
  call_duration_seconds: number // Call length
  twilio_voice_cost_cad: number // Twilio inbound cost
  retell_ai_cost_cad: number   // Retell AI voice processing
  combined_cost_cad: number    // Total cost
}
```

#### **Aggregation Query Example**:
```typescript
// Aggregate all costs for a billing period
async function calculateBillingPeriodCosts(startDate: Date, endDate: Date) {
  const startTimestamp = Math.floor(startDate.getTime() / 1000)
  const endTimestamp = Math.floor(endDate.getTime() / 1000)

  // Get all chats in period
  const chats = await chatService.getAllChats({
    start_timestamp: { gte: startTimestamp, lte: endTimestamp },
    chat_status: 'ended'
  })

  // Calculate costs for each chat
  let totalSMSCost = 0
  let totalRetellChatCost = 0
  let totalSegments = 0

  for (const chat of chats) {
    const breakdown = twilioCostService.getDetailedCombinedBreakdown(
      chat.message_with_tool_calls || [],
      chat.chat_cost?.combined_cost ?? 0
    )

    totalSMSCost += breakdown.twilioSMSCostCAD
    totalRetellChatCost += breakdown.retellChatCostCAD
    totalSegments += breakdown.segmentCount
  }

  return {
    chatCount: chats.length,
    totalSegments,
    twilioSMSCostCAD: totalSMSCost,
    retellAIChatCostCAD: totalRetellChatCost,
    combinedCostCAD: totalSMSCost + totalRetellChatCost
  }
}
```

---

## **4. Customer Management**

### **Database Schema** (Supabase)

#### **Table: `billing_customers`**
```sql
CREATE TABLE billing_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_name TEXT NOT NULL,          -- Business/Organization name (NOT patient name)
  customer_email TEXT NOT NULL,         -- Billing contact email
  stripe_customer_id TEXT UNIQUE,       -- Stripe customer ID
  markup_percentage DECIMAL DEFAULT 0,  -- e.g., 20 = 20% markup
  auto_invoice_enabled BOOLEAN DEFAULT false,
  billing_contact_name TEXT,            -- Business contact person
  billing_address TEXT,                 -- Business address
  phone_number TEXT,                    -- Business phone
  tax_id TEXT,                          -- Business tax ID (optional)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  notes TEXT,

  -- NO PHI FIELDS - This is business billing info only
  CONSTRAINT valid_markup CHECK (markup_percentage >= 0 AND markup_percentage <= 10000)
);

-- RLS Policies (Row Level Security)
ALTER TABLE billing_customers ENABLE ROW LEVEL SECURITY;

-- Only Super Users with MFA can access
CREATE POLICY "billing_customers_super_user_access" ON billing_customers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_settings
      WHERE user_settings.user_id = auth.uid()
        AND user_settings.role = 'Super User'
        AND user_settings.fresh_mfa_enabled = true
        AND user_settings.fresh_mfa_setup_completed = true
    )
  );
```

#### **Table: `invoice_records`**
```sql
CREATE TABLE invoice_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  billing_customer_id UUID REFERENCES billing_customers(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT UNIQUE,
  invoice_number TEXT,                   -- Human-readable invoice number

  -- Billing period
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,

  -- Usage metrics (NO PHI)
  total_chats INTEGER DEFAULT 0,
  total_calls INTEGER DEFAULT 0,
  total_sms_segments INTEGER DEFAULT 0,
  total_call_minutes DECIMAL DEFAULT 0,

  -- Cost breakdown (all in CAD)
  twilio_sms_cost_cad DECIMAL NOT NULL DEFAULT 0,
  twilio_voice_cost_cad DECIMAL NOT NULL DEFAULT 0,
  retell_ai_chat_cost_cad DECIMAL NOT NULL DEFAULT 0,
  retell_ai_voice_cost_cad DECIMAL NOT NULL DEFAULT 0,
  subtotal_cad DECIMAL NOT NULL,
  markup_amount_cad DECIMAL DEFAULT 0,
  total_amount_cad DECIMAL NOT NULL,

  -- Invoice status
  invoice_status TEXT DEFAULT 'draft',
  -- Status options: draft, sent, paid, overdue, cancelled
  stripe_invoice_url TEXT,
  stripe_invoice_pdf_url TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  due_date DATE,

  -- Audit
  created_by UUID REFERENCES auth.users(id),

  CONSTRAINT valid_status CHECK (
    invoice_status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')
  ),
  CONSTRAINT valid_period CHECK (billing_period_end >= billing_period_start)
);

-- RLS Policy
ALTER TABLE invoice_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_records_super_user_access" ON invoice_records
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_settings
      WHERE user_settings.user_id = auth.uid()
        AND user_settings.role = 'Super User'
        AND user_settings.fresh_mfa_enabled = true
        AND user_settings.fresh_mfa_setup_completed = true
    )
  );
```

#### **Table: `billing_settings`**
```sql
CREATE TABLE billing_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) UNIQUE,

  -- Stripe configuration (encrypted)
  stripe_api_key_encrypted TEXT,
  stripe_publishable_key TEXT,
  stripe_test_mode BOOLEAN DEFAULT true,

  -- Invoice defaults
  default_markup_percentage DECIMAL DEFAULT 0,
  default_due_date_days INTEGER DEFAULT 30, -- Net 30
  default_invoice_note TEXT,
  invoice_footer_text TEXT,

  -- Automation
  auto_invoice_enabled BOOLEAN DEFAULT false,
  auto_invoice_day_of_month INTEGER DEFAULT 1, -- 1-28
  auto_invoice_time TEXT DEFAULT '00:00',
  auto_send_invoices BOOLEAN DEFAULT false,

  -- Notifications
  notification_email TEXT,
  notify_on_invoice_generated BOOLEAN DEFAULT true,
  notify_on_payment_received BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_invoice_day CHECK (
    auto_invoice_day_of_month >= 1 AND auto_invoice_day_of_month <= 28
  ),
  CONSTRAINT valid_due_days CHECK (default_due_date_days > 0)
);

-- RLS Policy
ALTER TABLE billing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_settings_own_access" ON billing_settings
  FOR ALL
  USING (user_id = auth.uid());
```

### **Customer Management UI**

#### **Location**: `/admin/billing/customers` sub-page

#### **Features**:
- **MFA Gate**: Verify MFA before allowing access to customer management
- Table listing all billing customers (NO patient information)
- Columns: Customer Name (Business), Email, Stripe Status, Markup %, Auto-Invoice, Actions
- "Add New Customer" button → Opens modal form
- Edit customer button (pencil icon) → Opens edit modal
- Delete customer button (with confirmation) → Also warns if unpaid invoices exist
- Search/filter by customer name or email
- Export customer list to CSV

#### **Customer Form Fields**:
- **Customer Name** (required) - Business/Organization name
- **Customer Email** (required, validated)
- **Billing Contact Name** (optional) - Person to contact for billing
- **Phone Number** (optional) - Business phone
- **Billing Address** (optional textarea) - Business address
- **Tax ID** (optional) - Business tax identification number
- **Markup Percentage** (default 0%, e.g., 20% = 1.20x multiplier)
  - Input validation: 0-10000% (allow up to 100x markup if needed)
  - Display as percentage with % symbol
- **Auto-Invoice Enabled** (toggle switch)
  - Tooltip: "Automatically generate invoices on billing day"
- **Notes** (optional textarea) - Internal notes about customer
- **Create Stripe Customer** (checkbox, checked by default)
  - If checked: Create customer in Stripe when saving
  - If unchecked: Can add Stripe ID manually later

#### **Validation**:
- Email must be valid format
- Customer name required (min 2 characters)
- Markup percentage must be numeric and >= 0
- Cannot delete customer with unpaid invoices (show warning)

---

## **5. Main Billing Dashboard**

### **Route**: `/admin/billing` (default page)

### **MFA Verification on First Access**:
- Check if user has accessed billing today
- If first access of the day: Show MFA re-verification prompt
- Use existing `FreshMfaVerification` component
- Store last verification timestamp in sessionStorage

### **Dashboard Sections**:

#### **A. Summary Cards (Top Row)**

**1. Current Month Revenue (MTD)**
```typescript
// Calculate revenue for current month so far
const now = new Date()
const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
const costs = await calculateBillingPeriodCosts(monthStart, now)

// Display
<Card>
  <CardHeader>Current Month (MTD)</CardHeader>
  <CardValue>${costs.combinedCostCAD.toFixed(2)} CAD</CardValue>
  <CardTrend>+12% vs last month</CardTrend> {/* Calculate trend */}
</Card>
```

**2. Previous Month Revenue**
```typescript
// Calculate complete previous month
const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
const lastMonthCosts = await calculateBillingPeriodCosts(lastMonth, lastMonthEnd)
```

**3. Total Customers**
```typescript
// Count active billing customers
const customerCount = await supabase
  .from('billing_customers')
  .select('id', { count: 'exact' })
```

**4. Pending Invoices**
```typescript
// Count draft/sent invoices
const pendingCount = await supabase
  .from('invoice_records')
  .select('id', { count: 'exact' })
  .in('invoice_status', ['draft', 'sent'])
```

#### **B. Quick Actions (Button Row)**

**"Generate Monthly Invoices" Button** (primary, blue)
- Opens multi-step modal:
  1. Select date range (default: previous month)
  2. Preview customers and costs
  3. Select Stripe options (draft vs send)
  4. Confirm and process

**"View Invoice History" Button**
- Navigate to `/admin/billing/invoices`

**"Manage Customers" Button**
- Navigate to `/admin/billing/customers`

**"Export Report" Button**
- Download CSV with all billing data for selected period
- Includes: Usage metrics, costs breakdown, customer details

#### **C. Recent Activity Table**

Show last 10 invoice records:
```typescript
const recentInvoices = await supabase
  .from('invoice_records')
  .select(`
    *,
    billing_customers!inner(customer_name, customer_email)
  `)
  .order('created_at', { ascending: false })
  .limit(10)
```

**Columns**:
- Date Created
- Customer Name (Business)
- Billing Period (e.g., "Sep 1-30, 2025")
- Usage (e.g., "150 chats, 2,340 segments")
- Amount (CAD)
- Status (badge with color)
- Actions (View, Send, Mark Paid)

**Status Badge Colors**:
- Draft: Gray
- Sent: Blue
- Paid: Green
- Overdue: Red
- Cancelled: Gray with strikethrough

#### **D. Monthly Trends Chart**

**Chart Type**: Stacked Bar Chart (using Recharts)

**Data Structure**:
```typescript
interface MonthlyTrend {
  month: string          // "Jan", "Feb", "Mar"
  twilioSMS: number     // Twilio SMS costs
  twilioVoice: number   // Twilio voice costs
  retellAI: number      // Retell AI costs (chat + voice)
  total: number         // Total revenue
}

const chartData: MonthlyTrend[] = []
// Calculate for last 6 months
```

**Chart Configuration**:
- X-axis: Months
- Y-axis: Revenue in CAD (formatted with $ and commas)
- Stacked bars with 3 colors:
  - Twilio SMS: Blue (#3B82F6)
  - Twilio Voice: Indigo (#6366F1)
  - Retell AI: Green (#10B981)
- Tooltip shows breakdown on hover
- Legend at bottom

**Implementation**:
```typescript
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'

<BarChart data={chartData}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="month" />
  <YAxis tickFormatter={(value) => `$${value.toFixed(0)}`} />
  <Tooltip formatter={(value) => `$${value.toFixed(2)} CAD`} />
  <Legend />
  <Bar dataKey="twilioSMS" stackId="a" fill="#3B82F6" name="Twilio SMS" />
  <Bar dataKey="twilioVoice" stackId="a" fill="#6366F1" name="Twilio Voice" />
  <Bar dataKey="retellAI" stackId="a" fill="#10B981" name="Retell AI" />
</BarChart>
```

---

## **6. Invoice Generation System**

### **Multi-Step Invoice Generation Wizard**

#### **Step 1: Select Date Range**

**Modal UI**:
```typescript
<Modal title="Generate Monthly Invoices" size="large">
  <DateRangePicker
    defaultRange="previousMonth"
    onRangeChange={(start, end) => setDateRange({ start, end })}
  />

  <InfoBox>
    Selected Period: September 1-30, 2025
    This will calculate costs for all completed chats and calls in this period.
  </InfoBox>

  <Button onClick={calculatePreview}>Next: Preview Invoices</Button>
</Modal>
```

**Date Range Options**:
- Previous Month (default)
- Current Month (MTD)
- Last 30 Days
- Custom Range (date pickers)

#### **Step 2: Calculate & Preview Invoices**

**Loading State**:
```typescript
<ProgressBar>
  Calculating costs for customer 1 of 5...
  {progressPercent}%
</ProgressBar>
```

**Preview Table**:
```typescript
interface InvoicePreview {
  customerId: string
  customerName: string

  // Usage metrics
  totalChats: number
  totalCalls: number
  totalSegments: number
  totalMinutes: number

  // Cost breakdown
  twilioSMSCost: number
  twilioVoiceCost: number
  retellAICost: number
  subtotal: number
  markupPercent: number
  markupAmount: number
  total: number

  // Flags
  hasStripeCustomer: boolean
  includeInBatch: boolean  // Checkbox state
}

const previews = await Promise.all(
  customers.map(async (customer) => {
    // Calculate costs for this customer
    const costs = await calculateCustomerCosts(customer.id, dateRange)
    const markup = costs.subtotal * (customer.markup_percentage / 100)

    return {
      customerId: customer.id,
      customerName: customer.customer_name,
      totalChats: costs.chatCount,
      totalCalls: costs.callCount,
      totalSegments: costs.totalSegments,
      totalMinutes: costs.totalMinutes,
      twilioSMSCost: costs.twilioSMSCostCAD,
      twilioVoiceCost: costs.twilioVoiceCostCAD,
      retellAICost: costs.retellAICostCAD,
      subtotal: costs.subtotal,
      markupPercent: customer.markup_percentage,
      markupAmount: markup,
      total: costs.subtotal + markup,
      hasStripeCustomer: !!customer.stripe_customer_id,
      includeInBatch: true
    }
  })
)
```

**Preview Table UI**:
- Columns:
  - ☑️ Include (checkbox)
  - Customer Name
  - Usage (chats, calls, segments, minutes)
  - Costs (SMS, Voice, AI)
  - Subtotal
  - Markup (%)
  - Total
  - Status (✓ Ready / ⚠️ No Stripe ID)
- "Select All" / "Deselect All" buttons
- Filter: Show only customers with usage > $0
- Sort by: Total (descending)

**Summary Footer**:
```
Selected: 4 of 5 customers
Total Amount: $1,234.56 CAD
Missing Stripe IDs: 1 customer
```

#### **Step 3: Stripe Integration Options**

**Radio Button Options**:
```typescript
<RadioGroup value={invoiceMode} onChange={setInvoiceMode}>
  <Radio value="draft">
    Create Draft Invoices
    <HelpText>Invoices will be created but not sent. You can review before sending.</HelpText>
  </Radio>

  <Radio value="finalize">
    Finalize Invoices (Don't Send)
    <HelpText>Invoices will be finalized but not emailed to customers.</HelpText>
  </Radio>

  <Radio value="send">
    Create and Send Invoices
    <HelpText>Invoices will be created and automatically emailed to customers.</HelpText>
  </Radio>
</RadioGroup>
```

**Due Date Configuration**:
```typescript
<Select label="Payment Due Date">
  <Option value="0">Due on Receipt</Option>
  <Option value="15">Net 15 (15 days)</Option>
  <Option value="30" selected>Net 30 (30 days)</Option>
  <Option value="60">Net 60 (60 days)</Option>
</Select>
```

**Missing Stripe Customers Warning**:
```typescript
{customersWithoutStripe.length > 0 && (
  <WarningBox>
    ⚠️ {customersWithoutStripe.length} customer(s) don't have Stripe Customer IDs.

    <Options>
      <Checkbox checked={autoCreateStripeCustomers}>
        Automatically create Stripe customers for them
      </Checkbox>

      <Checkbox checked={skipMissingCustomers}>
        Skip customers without Stripe IDs
      </Checkbox>
    </Options>
  </WarningBox>
)}
```

#### **Step 4: Processing & Results**

**Processing UI**:
```typescript
<ProgressModal>
  <h3>Generating Invoices...</h3>

  <ProgressBar value={processed} max={total} />

  <StatusList>
    {results.map(result => (
      <StatusItem key={result.customerId}>
        {result.success ? '✓' : '✗'} {result.customerName}
        {result.error && <ErrorText>{result.error}</ErrorText>}
      </StatusItem>
    ))}
  </StatusList>
</ProgressModal>
```

**Results Summary**:
```typescript
<ResultsModal>
  <h3>Invoice Generation Complete</h3>

  <Summary>
    ✓ Successfully created: {successCount} invoices
    ✗ Failed: {failureCount} invoices
    💰 Total amount: ${totalAmount.toFixed(2)} CAD
  </Summary>

  {failures.length > 0 && (
    <ErrorTable>
      <h4>Errors:</h4>
      {failures.map(failure => (
        <ErrorRow>
          <CustomerName>{failure.customerName}</CustomerName>
          <ErrorReason>{failure.error}</ErrorReason>
          <RetryButton>Retry</RetryButton>
        </ErrorRow>
      ))}
    </ErrorTable>
  )}

  <Actions>
    <Button onClick={viewInvoices}>View Invoice History</Button>
    <Button onClick={close}>Close</Button>
  </Actions>
</ResultsModal>
```

### **Invoice Creation Logic**

#### **Core Function**:
```typescript
async function generateInvoiceForCustomer(
  customer: BillingCustomer,
  dateRange: { start: Date; end: Date },
  options: InvoiceOptions
): Promise<InvoiceResult> {
  try {
    // 1. Calculate usage and costs
    const costs = await calculateCustomerCosts(customer.id, dateRange)

    // 2. Create or get Stripe customer
    let stripeCustomerId = customer.stripe_customer_id
    if (!stripeCustomerId && options.autoCreateStripeCustomers) {
      const stripeCustomer = await stripe.customers.create({
        email: customer.customer_email,
        name: customer.customer_name,
        metadata: {
          carexps_customer_id: customer.id
        }
      })
      stripeCustomerId = stripeCustomer.id

      // Update database
      await supabase
        .from('billing_customers')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', customer.id)
    }

    if (!stripeCustomerId) {
      throw new Error('No Stripe customer ID')
    }

    // 3. Create Stripe invoice
    const invoice = await stripe.invoices.create({
      customer: stripeCustomerId,
      collection_method: 'send_invoice',
      days_until_due: options.dueInDays || 30,
      auto_advance: options.mode !== 'draft',
      metadata: {
        billing_period_start: dateRange.start.toISOString(),
        billing_period_end: dateRange.end.toISOString(),
        carexps_customer_id: customer.id
      }
    })

    // 4. Add line items to invoice

    // Line Item 1: Twilio SMS
    if (costs.twilioSMSCostCAD > 0) {
      await stripe.invoiceItems.create({
        customer: stripeCustomerId,
        invoice: invoice.id,
        description: `SMS Services - ${formatDateRange(dateRange)}\n${costs.totalSegments} segments, ${costs.chatCount} conversations`,
        amount: Math.round(costs.twilioSMSCostCAD * 100), // Convert to cents
        currency: 'cad'
      })
    }

    // Line Item 2: Twilio Voice
    if (costs.twilioVoiceCostCAD > 0) {
      await stripe.invoiceItems.create({
        customer: stripeCustomerId,
        invoice: invoice.id,
        description: `Voice Call Services - ${formatDateRange(dateRange)}\n${costs.totalMinutes.toFixed(1)} minutes, ${costs.callCount} calls`,
        amount: Math.round(costs.twilioVoiceCostCAD * 100),
        currency: 'cad'
      })
    }

    // Line Item 3: Retell AI
    if (costs.retellAICostCAD > 0) {
      await stripe.invoiceItems.create({
        customer: stripeCustomerId,
        invoice: invoice.id,
        description: `AI Processing Services - ${formatDateRange(dateRange)}\nConversational AI, speech processing`,
        amount: Math.round(costs.retellAICostCAD * 100),
        currency: 'cad'
      })
    }

    // Line Item 4: Markup (if applicable)
    if (customer.markup_percentage > 0) {
      const markupAmount = costs.subtotal * (customer.markup_percentage / 100)
      await stripe.invoiceItems.create({
        customer: stripeCustomerId,
        invoice: invoice.id,
        description: `Service Markup (${customer.markup_percentage}%)`,
        amount: Math.round(markupAmount * 100),
        currency: 'cad'
      })
    }

    // 5. Finalize or send invoice based on options
    if (options.mode === 'finalize' || options.mode === 'send') {
      await stripe.invoices.finalizeInvoice(invoice.id)
    }

    if (options.mode === 'send') {
      await stripe.invoices.sendInvoice(invoice.id)
    }

    // 6. Save invoice record to database
    const invoiceRecord = await supabase
      .from('invoice_records')
      .insert({
        billing_customer_id: customer.id,
        stripe_invoice_id: invoice.id,
        invoice_number: invoice.number,
        billing_period_start: dateRange.start,
        billing_period_end: dateRange.end,
        total_chats: costs.chatCount,
        total_calls: costs.callCount,
        total_sms_segments: costs.totalSegments,
        total_call_minutes: costs.totalMinutes,
        twilio_sms_cost_cad: costs.twilioSMSCostCAD,
        twilio_voice_cost_cad: costs.twilioVoiceCostCAD,
        retell_ai_chat_cost_cad: costs.retellAIChatCostCAD,
        retell_ai_voice_cost_cad: costs.retellAIVoiceCostCAD,
        subtotal_cad: costs.subtotal,
        markup_amount_cad: costs.markupAmount,
        total_amount_cad: costs.total,
        invoice_status: options.mode === 'draft' ? 'draft' : 'sent',
        stripe_invoice_url: invoice.hosted_invoice_url,
        stripe_invoice_pdf_url: invoice.invoice_pdf,
        due_date: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
        sent_at: options.mode === 'send' ? new Date() : null,
        created_by: auth.uid()
      })
      .select()
      .single()

    // 7. Log to audit system (NO PHI)
    await auditLogger.log({
      action: 'BILLING_INVOICE_GENERATED',
      resource: 'billing_invoice',
      resource_id: invoiceRecord.data.id,
      details: {
        customer_name: customer.customer_name,
        billing_period: `${dateRange.start} to ${dateRange.end}`,
        total_amount_cad: costs.total,
        invoice_status: options.mode,
        stripe_invoice_id: invoice.id
      },
      severity: 'medium'
    })

    return {
      success: true,
      customerId: customer.id,
      customerName: customer.customer_name,
      invoiceId: invoice.id,
      invoiceRecordId: invoiceRecord.data.id,
      amount: costs.total
    }

  } catch (error) {
    // Log error
    console.error(`Failed to generate invoice for ${customer.customer_name}:`, error)

    return {
      success: false,
      customerId: customer.id,
      customerName: customer.customer_name,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
```

#### **Cost Calculation Helper**:
```typescript
async function calculateCustomerCosts(
  customerId: string,
  dateRange: { start: Date; end: Date }
) {
  const startTimestamp = Math.floor(dateRange.start.getTime() / 1000)
  const endTimestamp = Math.floor(dateRange.end.getTime() / 1000)

  // Get all chats for this customer in date range
  // NOTE: You'll need to filter by customer somehow - either by agent_id
  // or by adding customer_id to chat metadata
  const chats = await chatService.getAllChats({
    start_timestamp: { gte: startTimestamp, lte: endTimestamp },
    chat_status: 'ended',
    // TODO: Add customer filtering logic based on your system
  })

  // Calculate SMS costs
  let twilioSMSCostCAD = 0
  let retellAIChatCostCAD = 0
  let totalSegments = 0

  for (const chat of chats) {
    const breakdown = twilioCostService.getDetailedCombinedBreakdown(
      chat.message_with_tool_calls || [],
      chat.chat_cost?.combined_cost ?? 0
    )

    twilioSMSCostCAD += breakdown.twilioSMSCostCAD
    retellAIChatCostCAD += breakdown.retellChatCostCAD
    totalSegments += breakdown.segmentCount
  }

  // Get all calls for this customer in date range
  // TODO: Implement call querying and cost calculation
  const calls = [] // await callService.getCallHistory(...)

  let twilioVoiceCostCAD = 0
  let retellAIVoiceCostCAD = 0
  let totalMinutes = 0

  for (const call of calls) {
    const callCost = twilioCostService.getTwilioCostCAD(call.call_duration_seconds)
    twilioVoiceCostCAD += callCost
    totalMinutes += call.call_duration_seconds / 60

    // Retell AI voice cost (if available in call data)
    // retellAIVoiceCostCAD += call.retell_ai_cost || 0
  }

  const subtotal = twilioSMSCostCAD + twilioVoiceCostCAD + retellAIChatCostCAD + retellAIVoiceCostCAD

  // Get customer markup
  const customer = await supabase
    .from('billing_customers')
    .select('markup_percentage')
    .eq('id', customerId)
    .single()

  const markupAmount = subtotal * (customer.data.markup_percentage / 100)
  const total = subtotal + markupAmount

  return {
    chatCount: chats.length,
    callCount: calls.length,
    totalSegments,
    totalMinutes,
    twilioSMSCostCAD,
    twilioVoiceCostCAD,
    retellAIChatCostCAD,
    retellAIVoiceCostCAD,
    subtotal,
    markupAmount,
    total
  }
}
```

---

## **7. Invoice History Page**

### **Route**: `/admin/billing/invoices`

### **MFA Verification**: Required (same as dashboard)

### **Page Layout**:

#### **Header with Filters**:
```typescript
<PageHeader>
  <Title>Invoice History</Title>

  <Filters>
    <DateRangePicker
      value={dateFilter}
      onChange={setDateFilter}
      placeholder="All time"
    />

    <Select
      value={statusFilter}
      onChange={setStatusFilter}
      placeholder="All statuses"
    >
      <Option value="all">All Statuses</Option>
      <Option value="draft">Draft</Option>
      <Option value="sent">Sent</Option>
      <Option value="paid">Paid</Option>
      <Option value="overdue">Overdue</Option>
      <Option value="cancelled">Cancelled</Option>
    </Select>

    <Select
      value={customerFilter}
      onChange={setCustomerFilter}
      placeholder="All customers"
    >
      <Option value="all">All Customers</Option>
      {customers.map(c => (
        <Option value={c.id}>{c.customer_name}</Option>
      ))}
    </Select>

    <AmountRangeFilter
      min={minAmount}
      max={maxAmount}
      onChange={setAmountRange}
    />
  </Filters>

  <Actions>
    <SearchInput
      placeholder="Search invoice #, customer..."
      value={searchQuery}
      onChange={setSearchQuery}
    />

    <Button onClick={exportToCSV}>
      <DownloadIcon /> Export CSV
    </Button>
  </Actions>
</PageHeader>
```

#### **Invoice Table**:
```typescript
<DataTable
  data={filteredInvoices}
  columns={[
    {
      key: 'invoice_number',
      header: 'Invoice #',
      render: (invoice) => (
        <Link to={invoice.stripe_invoice_url} target="_blank">
          {invoice.invoice_number || invoice.stripe_invoice_id.slice(0, 8)}
        </Link>
      )
    },
    {
      key: 'created_at',
      header: 'Date Created',
      sortable: true,
      render: (invoice) => formatDate(invoice.created_at)
    },
    {
      key: 'customer',
      header: 'Customer',
      sortable: true,
      render: (invoice) => invoice.billing_customers.customer_name
    },
    {
      key: 'billing_period',
      header: 'Billing Period',
      render: (invoice) =>
        `${formatDate(invoice.billing_period_start)} - ${formatDate(invoice.billing_period_end)}`
    },
    {
      key: 'usage',
      header: 'Usage',
      render: (invoice) => (
        <div>
          <div>{invoice.total_chats} chats</div>
          <div>{invoice.total_calls} calls</div>
          <div className="text-xs text-gray-500">
            {invoice.total_sms_segments} segments, {invoice.total_call_minutes.toFixed(1)} min
          </div>
        </div>
      )
    },
    {
      key: 'total_amount_cad',
      header: 'Amount',
      sortable: true,
      render: (invoice) => `$${invoice.total_amount_cad.toFixed(2)} CAD`
    },
    {
      key: 'invoice_status',
      header: 'Status',
      sortable: true,
      render: (invoice) => <StatusBadge status={invoice.invoice_status} />
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (invoice) => (
        <ActionMenu>
          <MenuItem onClick={() => viewDetails(invoice)}>
            <EyeIcon /> View Details
          </MenuItem>

          {invoice.invoice_status === 'draft' && (
            <MenuItem onClick={() => sendInvoice(invoice)}>
              <SendIcon /> Send Invoice
            </MenuItem>
          )}

          {invoice.invoice_status === 'sent' && (
            <MenuItem onClick={() => markAsPaid(invoice)}>
              <CheckIcon /> Mark as Paid
            </MenuItem>
          )}

          <MenuItem onClick={() => downloadPDF(invoice)}>
            <DownloadIcon /> Download PDF
          </MenuItem>

          {invoice.stripe_invoice_url && (
            <MenuItem onClick={() => window.open(invoice.stripe_invoice_url, '_blank')}>
              <ExternalLinkIcon /> View in Stripe
            </MenuItem>
          )}

          {invoice.invoice_status === 'draft' && (
            <MenuItem onClick={() => cancelInvoice(invoice)} danger>
              <TrashIcon /> Cancel Invoice
            </MenuItem>
          )}
        </ActionMenu>
      )
    }
  ]}
  pagination={{
    pageSize: 50,
    currentPage: page,
    totalItems: totalInvoices,
    onPageChange: setPage
  }}
  sorting={{
    sortBy: sortColumn,
    sortOrder: sortOrder,
    onSort: handleSort
  }}
/>
```

#### **Status Badge Component**:
```typescript
function StatusBadge({ status }: { status: string }) {
  const config = {
    draft: { color: 'gray', icon: FileTextIcon, label: 'Draft' },
    sent: { color: 'blue', icon: SendIcon, label: 'Sent' },
    paid: { color: 'green', icon: CheckCircleIcon, label: 'Paid' },
    overdue: { color: 'red', icon: AlertCircleIcon, label: 'Overdue' },
    cancelled: { color: 'gray', icon: XCircleIcon, label: 'Cancelled' }
  }

  const { color, icon: Icon, label } = config[status] || config.draft

  return (
    <Badge color={color}>
      <Icon className="w-3 h-3" />
      {label}
    </Badge>
  )
}
```

### **Invoice Detail Modal**:

```typescript
<Modal size="large" title={`Invoice ${invoice.invoice_number}`}>
  <ModalSection title="Customer Information">
    <Field label="Customer Name">
      {invoice.billing_customers.customer_name}
    </Field>
    <Field label="Email">
      {invoice.billing_customers.customer_email}
    </Field>
    <Field label="Billing Period">
      {formatDate(invoice.billing_period_start)} - {formatDate(invoice.billing_period_end)}
    </Field>
  </ModalSection>

  <ModalSection title="Usage Summary">
    <Grid cols={2}>
      <StatCard label="Total Chats" value={invoice.total_chats} />
      <StatCard label="Total Calls" value={invoice.total_calls} />
      <StatCard label="SMS Segments" value={invoice.total_sms_segments} />
      <StatCard label="Call Minutes" value={invoice.total_call_minutes.toFixed(1)} />
    </Grid>
  </ModalSection>

  <ModalSection title="Cost Breakdown">
    <Table>
      <Row>
        <Cell>Twilio SMS Services</Cell>
        <Cell align="right">${invoice.twilio_sms_cost_cad.toFixed(2)}</Cell>
      </Row>
      <Row>
        <Cell>Twilio Voice Services</Cell>
        <Cell align="right">${invoice.twilio_voice_cost_cad.toFixed(2)}</Cell>
      </Row>
      <Row>
        <Cell>Retell AI Chat Services</Cell>
        <Cell align="right">${invoice.retell_ai_chat_cost_cad.toFixed(2)}</Cell>
      </Row>
      <Row>
        <Cell>Retell AI Voice Services</Cell>
        <Cell align="right">${invoice.retell_ai_voice_cost_cad.toFixed(2)}</Cell>
      </Row>
      <Row className="border-t">
        <Cell className="font-semibold">Subtotal</Cell>
        <Cell align="right" className="font-semibold">
          ${invoice.subtotal_cad.toFixed(2)}
        </Cell>
      </Row>

      {invoice.markup_amount_cad > 0 && (
        <Row>
          <Cell>Service Markup ({invoice.billing_customers.markup_percentage}%)</Cell>
          <Cell align="right">
            ${invoice.markup_amount_cad.toFixed(2)}
          </Cell>
        </Row>
      )}

      <Row className="border-t-2 border-black">
        <Cell className="font-bold text-lg">Total</Cell>
        <Cell align="right" className="font-bold text-lg">
          ${invoice.total_amount_cad.toFixed(2)} CAD
        </Cell>
      </Row>
    </Table>
  </ModalSection>

  <ModalSection title="Invoice Status">
    <Timeline>
      <TimelineItem
        date={invoice.created_at}
        icon={FileTextIcon}
        label="Invoice Created"
      />

      {invoice.sent_at && (
        <TimelineItem
          date={invoice.sent_at}
          icon={SendIcon}
          label="Invoice Sent"
        />
      )}

      {invoice.paid_at && (
        <TimelineItem
          date={invoice.paid_at}
          icon={CheckCircleIcon}
          label="Payment Received"
          color="green"
        />
      )}

      {invoice.invoice_status === 'overdue' && (
        <TimelineItem
          date={invoice.due_date}
          icon={AlertCircleIcon}
          label="Payment Overdue"
          color="red"
        />
      )}
    </Timeline>
  </ModalSection>

  <ModalActions>
    {invoice.stripe_invoice_url && (
      <Button
        variant="secondary"
        onClick={() => window.open(invoice.stripe_invoice_url, '_blank')}
      >
        View in Stripe
      </Button>
    )}

    {invoice.stripe_invoice_pdf_url && (
      <Button
        variant="secondary"
        onClick={() => window.open(invoice.stripe_invoice_pdf_url, '_blank')}
      >
        Download PDF
      </Button>
    )}

    {invoice.invoice_status === 'draft' && (
      <Button variant="primary" onClick={() => sendInvoice(invoice)}>
        Send Invoice
      </Button>
    )}

    {invoice.invoice_status === 'sent' && (
      <Button variant="primary" onClick={() => markAsPaid(invoice)}>
        Mark as Paid
      </Button>
    )}

    <Button variant="secondary" onClick={closeModal}>
      Close
    </Button>
  </ModalActions>
</Modal>
```

### **CSV Export Function**:
```typescript
async function exportInvoicesToCSV() {
  const invoices = await supabase
    .from('invoice_records')
    .select(`
      *,
      billing_customers!inner(customer_name, customer_email)
    `)
    .order('created_at', { ascending: false })

  const csvData = invoices.data.map(invoice => ({
    'Invoice Number': invoice.invoice_number || invoice.stripe_invoice_id,
    'Date Created': formatDate(invoice.created_at),
    'Customer Name': invoice.billing_customers.customer_name,
    'Customer Email': invoice.billing_customers.customer_email,
    'Billing Period Start': formatDate(invoice.billing_period_start),
    'Billing Period End': formatDate(invoice.billing_period_end),
    'Total Chats': invoice.total_chats,
    'Total Calls': invoice.total_calls,
    'SMS Segments': invoice.total_sms_segments,
    'Call Minutes': invoice.total_call_minutes.toFixed(1),
    'Twilio SMS Cost (CAD)': invoice.twilio_sms_cost_cad.toFixed(2),
    'Twilio Voice Cost (CAD)': invoice.twilio_voice_cost_cad.toFixed(2),
    'Retell AI Chat Cost (CAD)': invoice.retell_ai_chat_cost_cad.toFixed(2),
    'Retell AI Voice Cost (CAD)': invoice.retell_ai_voice_cost_cad.toFixed(2),
    'Subtotal (CAD)': invoice.subtotal_cad.toFixed(2),
    'Markup Amount (CAD)': invoice.markup_amount_cad.toFixed(2),
    'Total Amount (CAD)': invoice.total_amount_cad.toFixed(2),
    'Status': invoice.invoice_status,
    'Due Date': invoice.due_date ? formatDate(invoice.due_date) : '',
    'Sent Date': invoice.sent_at ? formatDate(invoice.sent_at) : '',
    'Paid Date': invoice.paid_at ? formatDate(invoice.paid_at) : '',
    'Stripe Invoice URL': invoice.stripe_invoice_url || ''
  }))

  // Convert to CSV and download
  const csv = convertToCSV(csvData)
  downloadFile(csv, `invoices_${Date.now()}.csv`, 'text/csv')
}
```

---

## **8. Settings Page**

### **Route**: `/admin/billing/settings`

### **MFA Verification**: Required

### **Settings Sections**:

#### **A. Stripe Configuration**

```typescript
<SettingsSection title="Stripe Integration">
  <Alert type="info">
    Your Stripe API keys are encrypted and stored securely. Test mode allows you to
    test invoice generation without creating real charges.
  </Alert>

  <FormField label="Stripe Secret Key">
    <PasswordInput
      value={stripeSecretKey}
      onChange={setStripeSecretKey}
      placeholder="sk_test_... or sk_live_..."
      helperText="Your Stripe Secret Key (starts with sk_)"
    />
  </FormField>

  <FormField label="Stripe Publishable Key">
    <Input
      value={stripePublishableKey}
      onChange={setStripePublishableKey}
      placeholder="pk_test_... or pk_live_..."
      helperText="Your Stripe Publishable Key (starts with pk_)"
    />
  </FormField>

  <FormField label="Mode">
    <Toggle
      checked={stripeTestMode}
      onChange={setStripeTestMode}
      label={stripeTestMode ? 'Test Mode' : 'Live Mode'}
    />
    <HelperText>
      {stripeTestMode
        ? '🧪 Test mode: No real charges will be made'
        : '⚡ Live mode: Real invoices and charges will be created'
      }
    </HelperText>
  </FormField>

  <Button onClick={testStripeConnection}>
    Test Connection
  </Button>

  {connectionTestResult && (
    <Alert type={connectionTestResult.success ? 'success' : 'error'}>
      {connectionTestResult.message}
    </Alert>
  )}

  <Button variant="primary" onClick={saveStripeSettings}>
    Save Stripe Settings
  </Button>
</SettingsSection>
```

#### **B. Invoice Defaults**

```typescript
<SettingsSection title="Invoice Defaults">
  <FormField label="Default Markup Percentage">
    <NumberInput
      value={defaultMarkup}
      onChange={setDefaultMarkup}
      min={0}
      max={10000}
      suffix="%"
      helperText="Default markup applied to all new customers (can be overridden per customer)"
    />
  </FormField>

  <FormField label="Payment Terms">
    <Select value={defaultDueDays} onChange={setDefaultDueDays}>
      <Option value={0}>Due on Receipt</Option>
      <Option value={15}>Net 15 (15 days)</Option>
      <Option value={30}>Net 30 (30 days)</Option>
      <Option value={60}>Net 60 (60 days)</Option>
      <Option value={90}>Net 90 (90 days)</Option>
    </Select>
  </FormField>

  <FormField label="Default Invoice Note">
    <Textarea
      value={defaultInvoiceNote}
      onChange={setDefaultInvoiceNote}
      placeholder="Thank you for your business..."
      rows={3}
      helperText="This note will appear on all invoices"
    />
  </FormField>

  <FormField label="Invoice Footer">
    <Textarea
      value={invoiceFooter}
      onChange={setInvoiceFooter}
      placeholder="CareXPS CRM | www.carexps.com | support@carexps.com"
      rows={2}
      helperText="Footer text displayed at bottom of invoices"
    />
  </FormField>

  <Button variant="primary" onClick={saveInvoiceDefaults}>
    Save Invoice Defaults
  </Button>
</SettingsSection>
```

#### **C. Automation Settings**

```typescript
<SettingsSection title="Automatic Invoice Generation">
  <Alert type="warning">
    ⚠️ Automation is currently in development. Manual invoice generation is recommended.
  </Alert>

  <FormField label="Enable Automatic Invoices">
    <Toggle
      checked={autoInvoiceEnabled}
      onChange={setAutoInvoiceEnabled}
      label="Automatically generate invoices monthly"
      disabled={true} // Disable for Phase 1
    />
    <HelperText>
      When enabled, invoices will be automatically generated on the specified day each month.
      (Coming in Phase 2)
    </HelperText>
  </FormField>

  {autoInvoiceEnabled && (
    <>
      <FormField label="Billing Day of Month">
        <Select value={billingDay} onChange={setBillingDay}>
          {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
            <Option key={day} value={day}>
              {day}{getDaySuffix(day)} of each month
            </Option>
          ))}
        </Select>
        <HelperText>
          Invoices will be generated for the previous month's usage
        </HelperText>
      </FormField>

      <FormField label="Time of Day">
        <Select value={billingTime} onChange={setBillingTime}>
          {Array.from({ length: 24 }, (_, i) => i).map(hour => (
            <Option key={hour} value={`${hour.toString().padStart(2, '0')}:00`}>
              {hour === 0 ? '12:00 AM' : hour < 12 ? `${hour}:00 AM` : hour === 12 ? '12:00 PM' : `${hour - 12}:00 PM`}
            </Option>
          ))}
        </Select>
      </FormField>

      <FormField label="Auto-Send Invoices">
        <Toggle
          checked={autoSendInvoices}
          onChange={setAutoSendInvoices}
          label="Automatically send invoices to customers"
        />
        <HelperText>
          If disabled, invoices will be created as drafts for manual review
        </HelperText>
      </FormField>
    </>
  )}
</SettingsSection>
```

#### **D. Notification Settings**

```typescript
<SettingsSection title="Email Notifications">
  <FormField label="Notification Email">
    <Input
      type="email"
      value={notificationEmail}
      onChange={setNotificationEmail}
      placeholder="billing@example.com"
      helperText="Email address to receive billing notifications"
    />
  </FormField>

  <FormField label="Notify when invoices are generated">
    <Toggle
      checked={notifyOnGeneration}
      onChange={setNotifyOnGeneration}
      label="Send email summary when invoices are created"
    />
  </FormField>

  <FormField label="Notify when payments are received">
    <Toggle
      checked={notifyOnPayment}
      onChange={setNotifyOnPayment}
      label="Send email when Stripe reports payment received"
    />
    <HelperText>
      Requires Stripe webhook configuration (Phase 2)
    </HelperText>
  </FormField>

  <Button variant="primary" onClick={saveNotificationSettings}>
    Save Notification Settings
  </Button>
</SettingsSection>
```

---

## **9. Stripe API Integration**

### **Stripe Service Implementation**

Create: `src/services/stripeInvoiceService.ts`

```typescript
import Stripe from 'stripe'
import { supabase } from '@/config/supabase'

class StripeInvoiceService {
  private stripe: Stripe | null = null
  private testMode: boolean = true

  /**
   * Initialize Stripe with API keys from settings
   */
  async initialize(userId: string): Promise<boolean> {
    try {
      // Load Stripe settings from database
      const { data: settings } = await supabase
        .from('billing_settings')
        .select('stripe_api_key_encrypted, stripe_test_mode')
        .eq('user_id', userId)
        .single()

      if (!settings || !settings.stripe_api_key_encrypted) {
        console.warn('No Stripe API key configured')
        return false
      }

      // Decrypt API key (you'll need to implement decryption)
      const apiKey = await this.decryptApiKey(settings.stripe_api_key_encrypted)

      this.stripe = new Stripe(apiKey, {
        apiVersion: '2023-10-16', // Use latest stable version
        typescript: true
      })

      this.testMode = settings.stripe_test_mode

      console.log('Stripe initialized:', this.testMode ? 'Test Mode' : 'Live Mode')
      return true

    } catch (error) {
      console.error('Failed to initialize Stripe:', error)
      return false
    }
  }

  /**
   * Test Stripe connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.stripe) {
      return { success: false, message: 'Stripe not initialized' }
    }

    try {
      // Try to list customers (limit 1) to test connection
      await this.stripe.customers.list({ limit: 1 })

      return {
        success: true,
        message: `Connected successfully (${this.testMode ? 'Test Mode' : 'Live Mode'})`
      }
    } catch (error) {
      if (error instanceof Stripe.errors.StripeAuthenticationError) {
        return { success: false, message: 'Invalid API key' }
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed'
      }
    }
  }

  /**
   * Create Stripe customer
   */
  async createCustomer(customerData: {
    email: string
    name: string
    phone?: string
    address?: string
    metadata?: Record<string, string>
  }): Promise<{ success: boolean; customerId?: string; error?: string }> {
    if (!this.stripe) {
      return { success: false, error: 'Stripe not initialized' }
    }

    try {
      const customer = await this.stripe.customers.create({
        email: customerData.email,
        name: customerData.name,
        phone: customerData.phone,
        address: customerData.address ? {
          line1: customerData.address
        } : undefined,
        metadata: {
          ...customerData.metadata,
          carexps_created_at: new Date().toISOString()
        }
      })

      return { success: true, customerId: customer.id }

    } catch (error) {
      console.error('Failed to create Stripe customer:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create customer'
      }
    }
  }

  /**
   * Create invoice with line items
   */
  async createInvoice(params: {
    stripeCustomerId: string
    lineItems: Array<{
      description: string
      amount: number // In cents
      currency: string
    }>
    dueInDays: number
    metadata?: Record<string, string>
    autoAdvance?: boolean
  }): Promise<{ success: boolean; invoice?: Stripe.Invoice; error?: string }> {
    if (!this.stripe) {
      return { success: false, error: 'Stripe not initialized' }
    }

    try {
      // Create invoice
      const invoice = await this.stripe.invoices.create({
        customer: params.stripeCustomerId,
        collection_method: 'send_invoice',
        days_until_due: params.dueInDays,
        auto_advance: params.autoAdvance ?? false,
        metadata: params.metadata || {}
      })

      // Add line items
      for (const item of params.lineItems) {
        await this.stripe.invoiceItems.create({
          customer: params.stripeCustomerId,
          invoice: invoice.id,
          description: item.description,
          amount: item.amount,
          currency: item.currency
        })
      }

      return { success: true, invoice }

    } catch (error) {
      console.error('Failed to create invoice:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create invoice'
      }
    }
  }

  /**
   * Finalize invoice (make it immutable and ready to send)
   */
  async finalizeInvoice(invoiceId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.stripe) {
      return { success: false, error: 'Stripe not initialized' }
    }

    try {
      await this.stripe.invoices.finalizeInvoice(invoiceId)
      return { success: true }

    } catch (error) {
      console.error('Failed to finalize invoice:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to finalize invoice'
      }
    }
  }

  /**
   * Send invoice to customer
   */
  async sendInvoice(invoiceId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.stripe) {
      return { success: false, error: 'Stripe not initialized' }
    }

    try {
      await this.stripe.invoices.sendInvoice(invoiceId)
      return { success: true }

    } catch (error) {
      console.error('Failed to send invoice:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send invoice'
      }
    }
  }

  /**
   * Mark invoice as paid (manually)
   */
  async markInvoiceAsPaid(invoiceId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.stripe) {
      return { success: false, error: 'Stripe not initialized' }
    }

    try {
      await this.stripe.invoices.pay(invoiceId, {
        paid_out_of_band: true // Mark as paid outside of Stripe
      })
      return { success: true }

    } catch (error) {
      console.error('Failed to mark invoice as paid:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mark as paid'
      }
    }
  }

  /**
   * Void/cancel invoice
   */
  async voidInvoice(invoiceId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.stripe) {
      return { success: false, error: 'Stripe not initialized' }
    }

    try {
      await this.stripe.invoices.voidInvoice(invoiceId)
      return { success: true }

    } catch (error) {
      console.error('Failed to void invoice:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to void invoice'
      }
    }
  }

  /**
   * Decrypt API key from storage
   * TODO: Implement proper encryption/decryption
   */
  private async decryptApiKey(encrypted: string): Promise<string> {
    // For now, assume it's base64 encoded
    // In production, use proper encryption (AES-256-GCM like the rest of the app)
    return atob(encrypted)
  }
}

export const stripeInvoiceService = new StripeInvoiceService()
```

### **Stripe Package Installation**

```bash
npm install stripe @stripe/stripe-js
npm install --save-dev @types/stripe
```

---

## **10. Error Handling & Validation**

### **Form Validation Rules**

```typescript
import { z } from 'zod'

// Customer validation schema
export const customerSchema = z.object({
  customer_name: z.string()
    .min(2, 'Customer name must be at least 2 characters')
    .max(100, 'Customer name too long'),

  customer_email: z.string()
    .email('Invalid email format')
    .max(255, 'Email too long'),

  billing_contact_name: z.string()
    .max(100, 'Contact name too long')
    .optional(),

  phone_number: z.string()
    .regex(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/, 'Invalid phone number')
    .optional()
    .or(z.literal('')),

  billing_address: z.string()
    .max(500, 'Address too long')
    .optional(),

  tax_id: z.string()
    .max(50, 'Tax ID too long')
    .optional(),

  markup_percentage: z.number()
    .min(0, 'Markup cannot be negative')
    .max(10000, 'Markup too high'),

  auto_invoice_enabled: z.boolean(),

  notes: z.string()
    .max(1000, 'Notes too long')
    .optional()
})

// Invoice generation validation
export const invoiceGenerationSchema = z.object({
  dateRange: z.object({
    start: z.date(),
    end: z.date()
  }).refine(
    data => data.end >= data.start,
    'End date must be after start date'
  ),

  customers: z.array(z.string().uuid())
    .min(1, 'Select at least one customer'),

  mode: z.enum(['draft', 'finalize', 'send']),

  dueInDays: z.number()
    .int()
    .min(0, 'Due days cannot be negative')
    .max(365, 'Due days too far in future'),

  autoCreateStripeCustomers: z.boolean()
})
```

### **API Error Handling Patterns**

```typescript
/**
 * Wrapper for Stripe API calls with error handling
 */
async function handleStripeApiCall<T>(
  operation: () => Promise<T>,
  context: string
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const data = await operation()
    return { success: true, data }

  } catch (error) {
    console.error(`Stripe API error (${context}):`, error)

    if (error instanceof Stripe.errors.StripeError) {
      // Specific Stripe error types
      if (error instanceof Stripe.errors.StripeCardError) {
        return { success: false, error: `Card error: ${error.message}` }
      }

      if (error instanceof Stripe.errors.StripeRateLimitError) {
        return { success: false, error: 'Too many requests. Please try again in a moment.' }
      }

      if (error instanceof Stripe.errors.StripeInvalidRequestError) {
        return { success: false, error: `Invalid request: ${error.message}` }
      }

      if (error instanceof Stripe.errors.StripeAPIError) {
        return { success: false, error: 'Stripe API error. Please try again.' }
      }

      if (error instanceof Stripe.errors.StripeConnectionError) {
        return { success: false, error: 'Network error. Please check your connection.' }
      }

      if (error instanceof Stripe.errors.StripeAuthenticationError) {
        return { success: false, error: 'Invalid Stripe API key. Please check your settings.' }
      }

      return { success: false, error: error.message }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Example usage
 */
async function createCustomerWithErrorHandling(email: string, name: string) {
  return handleStripeApiCall(
    () => stripe.customers.create({ email, name }),
    'create customer'
  )
}
```

### **User-Facing Error Messages**

```typescript
// Map technical errors to user-friendly messages
const errorMessages = {
  // Stripe errors
  'invalid_request': 'The request was invalid. Please check your input and try again.',
  'rate_limit': 'Too many requests. Please wait a moment and try again.',
  'authentication': 'API authentication failed. Please check your Stripe settings.',
  'card_declined': 'The payment card was declined.',
  'expired_card': 'The payment card has expired.',
  'no_customer': 'Customer not found in Stripe. Please create the customer first.',
  'no_stripe_id': 'This customer does not have a Stripe ID. Please link them to a Stripe customer.',

  // Database errors
  'duplicate_customer': 'A customer with this email already exists.',
  'duplicate_invoice': 'An invoice for this period already exists.',
  'foreign_key': 'Cannot delete: This record is referenced by other records.',

  // Validation errors
  'invalid_email': 'Please enter a valid email address.',
  'invalid_date_range': 'End date must be after start date.',
  'no_usage': 'No usage data found for the selected period.',
  'zero_amount': 'Invoice amount is $0. Do you want to create it anyway?',

  // Network errors
  'network_error': 'Network error. Please check your connection and try again.',
  'timeout': 'Request timed out. Please try again.',

  // Generic
  'unknown': 'An unexpected error occurred. Please try again or contact support.'
}
```

### **Edge Case Handling**

```typescript
/**
 * Handle zero-cost invoices
 */
async function handleZeroCostInvoice(customer: BillingCustomer, costs: CostBreakdown) {
  if (costs.total === 0) {
    // Show confirmation dialog
    const confirmed = await confirm({
      title: 'Zero-Cost Invoice',
      message: `${customer.customer_name} had no usage in this period. Do you want to create a $0 invoice anyway?`,
      confirmText: 'Create Invoice',
      cancelText: 'Skip Customer'
    })

    return confirmed
  }

  return true
}

/**
 * Handle customers without Stripe IDs
 */
async function handleMissingStripeId(
  customer: BillingCustomer,
  options: InvoiceOptions
): Promise<string | null> {
  if (!customer.stripe_customer_id) {
    if (options.autoCreateStripeCustomers) {
      // Auto-create Stripe customer
      const result = await stripeInvoiceService.createCustomer({
        email: customer.customer_email,
        name: customer.customer_name,
        phone: customer.phone_number,
        metadata: {
          carexps_customer_id: customer.id
        }
      })

      if (result.success && result.customerId) {
        // Update database
        await supabase
          .from('billing_customers')
          .update({ stripe_customer_id: result.customerId })
          .eq('id', customer.id)

        return result.customerId
      }

      throw new Error('Failed to create Stripe customer')
    }

    if (options.skipMissingCustomers) {
      return null // Skip this customer
    }

    throw new Error('Customer does not have a Stripe ID')
  }

  return customer.stripe_customer_id
}

/**
 * Handle duplicate invoices
 */
async function checkDuplicateInvoice(
  customerId: string,
  dateRange: { start: Date; end: Date }
): Promise<boolean> {
  const { data: existing } = await supabase
    .from('invoice_records')
    .select('id, invoice_number, invoice_status')
    .eq('billing_customer_id', customerId)
    .eq('billing_period_start', dateRange.start)
    .eq('billing_period_end', dateRange.end)
    .single()

  if (existing) {
    const confirmed = await confirm({
      title: 'Duplicate Invoice',
      message: `An invoice (${existing.invoice_number}) already exists for this period. Do you want to create another one?`,
      confirmText: 'Create Duplicate',
      cancelText: 'Skip'
    })

    return !confirmed // Return false if user wants to skip
  }

  return false // No duplicate found
}
```

---

## **11. UI/UX Design Guidelines**

### **Color Palette**

```typescript
// Extend existing Tailwind theme
const billingColors = {
  primary: '#3B82F6',      // Blue (matches CareXPS theme)
  success: '#10B981',      // Green
  warning: '#F59E0B',      // Amber
  danger: '#EF4444',       // Red
  neutral: '#6B7280',      // Gray

  // Status colors
  status: {
    draft: '#9CA3AF',      // Gray
    sent: '#3B82F6',       // Blue
    paid: '#10B981',       // Green
    overdue: '#EF4444',    // Red
    cancelled: '#6B7280'   // Gray
  }
}
```

### **Typography**

```typescript
// Consistent with existing CareXPS design
const typography = {
  fontFamily: {
    sans: ['Roboto', 'Inter', 'system-ui', 'sans-serif'],
    mono: ['Fira Code', 'monospace']
  },

  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem' // 30px
  }
}
```

### **Component Library**

Use existing CareXPS components:
- `Button` - Primary, secondary, danger variants
- `Modal` - Various sizes
- `Card` - Dashboard stat cards
- `Table` - Sortable, filterable tables
- `Input`, `Textarea`, `Select` - Form inputs
- `Badge` - Status indicators
- `Alert` - Info, success, warning, error alerts
- `Toggle` - Boolean switches
- `DateRangePicker` - Date selection (already implemented)

### **Icons** (lucide-react)

```typescript
import {
  DollarSign,      // Main billing icon
  CreditCard,      // Stripe/payment
  Users,           // Customers
  FileText,        // Invoices/documents
  Settings,        // Settings
  Download,        // Export/download
  Send,            // Send invoice
  Check,           // Success/paid
  CheckCircle,     // Completed
  Clock,           // Pending/time
  AlertCircle,     // Warning/overdue
  XCircle,         // Cancelled/error
  Eye,             // View details
  Edit,            // Edit
  Trash,           // Delete
  Plus,            // Add new
  RefreshCw,       // Refresh/reload
  TrendingUp,      // Trends/analytics
  BarChart3,       // Charts
  Calendar,        // Date
  Mail,            // Email
  Shield,          // MFA/security
  ExternalLink     // Open in new tab
} from 'lucide-react'
```

### **Responsive Design**

- Mobile: 320px - 640px (sm)
- Tablet: 641px - 1024px (md)
- Desktop: 1025px+ (lg, xl, 2xl)

**Responsive Patterns**:
```typescript
// Dashboard cards: Stack on mobile, grid on desktop
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

// Tables: Horizontal scroll on mobile
<div className="overflow-x-auto">

// Modals: Full screen on mobile, centered on desktop
<Modal className="w-full md:w-auto md:max-w-2xl">

// Forms: Single column on mobile, two columns on desktop
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
```

### **Loading States**

```typescript
// Skeleton loading for tables
<SkeletonTable rows={5} cols={7} />

// Spinner for buttons
<Button disabled>
  <Spinner className="mr-2" />
  Processing...
</Button>

// Progress bar for bulk operations
<ProgressBar
  value={processed}
  max={total}
  label={`${processed} of ${total} completed`}
/>
```

### **Empty States**

```typescript
// No customers yet
<EmptyState
  icon={Users}
  title="No Customers Yet"
  description="Add your first billing customer to get started"
  action={
    <Button onClick={openAddCustomerModal}>
      <Plus className="mr-2" />
      Add Customer
    </Button>
  }
/>

// No invoices in date range
<EmptyState
  icon={FileText}
  title="No Invoices Found"
  description="No invoices match your current filters"
  action={
    <Button onClick={clearFilters} variant="secondary">
      Clear Filters
    </Button>
  }
/>
```

---

## **12. Testing Requirements**

### **Manual Test Scenarios**

#### **Phase 1 Testing Checklist**:

**Authentication & Access**:
- [ ] Verify only Super Users can access `/admin/billing`
- [ ] Verify MFA is required before accessing billing pages
- [ ] Verify MFA re-verification on first daily access
- [ ] Verify non-Super Users see 403 error
- [ ] Verify users without MFA are redirected to MFA setup

**Customer Management**:
- [ ] Create new billing customer with valid data
- [ ] Edit existing customer
- [ ] Delete customer (with no invoices)
- [ ] Try to delete customer with unpaid invoices (should warn)
- [ ] Search for customer by name
- [ ] Filter customers by auto-invoice status
- [ ] Export customer list to CSV

**Invoice Generation**:
- [ ] Select previous month date range (default)
- [ ] Select custom date range
- [ ] Calculate preview for single customer
- [ ] Calculate preview for all customers
- [ ] Verify usage metrics are accurate (match SMS/Dashboard pages)
- [ ] Verify cost calculations match existing cost services
- [ ] Create draft invoices in Stripe
- [ ] Create and send invoices
- [ ] Handle customer without Stripe ID (auto-create)
- [ ] Handle customer with no usage (zero-cost invoice)
- [ ] Handle duplicate invoice warning
- [ ] Verify invoice appears in Stripe dashboard

**Invoice History**:
- [ ] View all invoices
- [ ] Filter by status (draft, sent, paid)
- [ ] Filter by customer
- [ ] Filter by date range
- [ ] Search by invoice number
- [ ] Sort by date, customer, amount
- [ ] View invoice details modal
- [ ] Send draft invoice
- [ ] Mark sent invoice as paid
- [ ] Download invoice PDF
- [ ] Export invoice history to CSV
- [ ] Open invoice in Stripe (external link)

**Settings**:
- [ ] Save Stripe API keys
- [ ] Test Stripe connection (success/fail)
- [ ] Toggle test/live mode
- [ ] Set default markup percentage
- [ ] Set default payment terms
- [ ] Set invoice note and footer
- [ ] Save notification email

**Dashboard**:
- [ ] Verify current month revenue calculation
- [ ] Verify previous month revenue calculation
- [ ] Verify customer count
- [ ] Verify pending invoice count
- [ ] Verify recent activity table
- [ ] Verify monthly trends chart renders
- [ ] Verify chart data accuracy

**Error Handling**:
- [ ] Invalid Stripe API key error
- [ ] Network error during invoice creation
- [ ] Stripe rate limit error
- [ ] Database constraint violation
- [ ] Invalid form input validation

**Audit Logging**:
- [ ] Verify all billing actions are logged
- [ ] Verify no PHI in audit logs
- [ ] Verify log entries have correct severity
- [ ] Verify user ID is recorded

### **Test Data Setup**

```typescript
// Create test customers
const testCustomers = [
  {
    customer_name: 'Acme Healthcare',
    customer_email: 'billing@acme-health.test',
    markup_percentage: 0,
    auto_invoice_enabled: false
  },
  {
    customer_name: 'Beta Medical',
    customer_email: 'accounting@betamed.test',
    markup_percentage: 20,
    auto_invoice_enabled: true
  }
]

// Create test date ranges
const testPeriods = {
  previousMonth: {
    start: new Date(2025, 8, 1),  // Sept 1
    end: new Date(2025, 8, 30)    // Sept 30
  },
  currentMonth: {
    start: new Date(2025, 9, 1),  // Oct 1
    end: new Date()                // Today
  }
}
```

### **Stripe Test Mode**

Use Stripe test cards:
```
Successful payment: 4242 4242 4242 4242
Declined payment: 4000 0000 0000 0002
Requires authentication: 4000 0025 0000 3155
```

---

## **13. Deployment Considerations**

### **Environment Variables**

Add to `.env.local`:
```bash
# Stripe Configuration
VITE_STRIPE_PUBLISHABLE_KEY_TEST=pk_test_...
VITE_STRIPE_PUBLISHABLE_KEY_LIVE=pk_live_...

# These should be stored in database, not env vars (for security)
# VITE_STRIPE_SECRET_KEY_TEST=sk_test_...
# VITE_STRIPE_SECRET_KEY_LIVE=sk_live_...
```

Add to Azure Static Web Apps configuration:
```json
{
  "VITE_STRIPE_PUBLISHABLE_KEY_TEST": "pk_test_...",
  "VITE_STRIPE_PUBLISHABLE_KEY_LIVE": "pk_live_..."
}
```

### **Database Migrations**

Run migrations in order:
```bash
# 1. Create billing_customers table
npx supabase migration up 20251001000001_create_billing_customers

# 2. Create invoice_records table
npx supabase migration up 20251001000002_create_invoice_records

# 3. Create billing_settings table
npx supabase migration up 20251001000003_create_billing_settings

# 4. Set up RLS policies
npx supabase migration up 20251001000004_billing_rls_policies
```

### **Security Checklist**

- [ ] Stripe secret keys stored encrypted in database (not in env vars)
- [ ] MFA required for all billing access
- [ ] RLS policies enforce Super User + MFA access
- [ ] Audit logging enabled for all billing actions
- [ ] No PHI/HIPAA data in billing system
- [ ] HTTPS enforced in production
- [ ] Rate limiting on invoice generation (prevent abuse)
- [ ] Input validation on all forms
- [ ] SQL injection prevention (using Supabase parameterized queries)
- [ ] XSS prevention (React auto-escapes)

### **Performance Optimization**

- [ ] Use `smsCostCacheService` for bulk cost calculations
- [ ] Implement pagination for invoice history (50 per page)
- [ ] Cache Stripe customer lookups (5 min TTL)
- [ ] Use database indexes on:
  - `billing_customers.customer_email`
  - `invoice_records.billing_customer_id`
  - `invoice_records.billing_period_start`
  - `invoice_records.invoice_status`
- [ ] Lazy load chart data (only when dashboard visible)
- [ ] Debounce search inputs (300ms)

---

## **14. Documentation Requirements**

### **User Guide** (Optional)

Create: `docs/BILLING_ADMIN_GUIDE.md`

Topics:
1. Getting Started
   - Setting up Stripe integration
   - Adding your first customer
   - Understanding cost calculations

2. Generating Invoices
   - Manual invoice generation
   - Selecting billing periods
   - Reviewing invoice previews
   - Handling errors

3. Managing Customers
   - Adding customers
   - Setting markup percentages
   - Linking Stripe customers

4. Invoice Management
   - Viewing invoice history
   - Sending invoices
   - Marking invoices as paid
   - Exporting reports

5. Settings & Configuration
   - Stripe test vs live mode
   - Invoice defaults
   - Notification preferences

### **Developer Documentation**

Create: `docs/BILLING_TECHNICAL.md`

Topics:
1. Architecture Overview
   - Database schema
   - Service layer structure
   - Stripe integration patterns

2. Cost Calculation Logic
   - How Twilio SMS costs are calculated
   - How Retell AI costs are extracted
   - Currency conversion
   - Markup application

3. Adding New Features
   - Extending customer fields
   - Adding new invoice line items
   - Customizing invoice templates

4. Troubleshooting
   - Common errors and solutions
   - Debugging cost calculations
   - Stripe API issues

---

## **15. Implementation Phases**

### **Phase 1: Core Functionality (MVP)** - Estimated 2-3 days

**Day 1: Setup & Customer Management**
- [ ] Create database tables and migrations
- [ ] Set up RLS policies
- [ ] Implement MFA gate for billing routes
- [ ] Create customer management page
- [ ] Implement CRUD operations for customers
- [ ] Add Stripe customer creation

**Day 2: Invoice Generation**
- [ ] Implement cost calculation aggregation
- [ ] Create invoice generation wizard UI
- [ ] Integrate with Stripe API (invoice creation)
- [ ] Save invoice records to database
- [ ] Add error handling and validation

**Day 3: Invoice History & Dashboard**
- [ ] Create invoice history page with filters
- [ ] Implement invoice detail modal
- [ ] Create dashboard with summary cards
- [ ] Add monthly trends chart
- [ ] Implement settings page (Stripe config)

**Testing & Polish**
- [ ] Manual testing of all features
- [ ] Fix bugs and edge cases
- [ ] Add loading states and error messages
- [ ] Update documentation

### **Phase 2: Automation & Advanced Features** - Estimated 2-3 days

**Automation**:
- [ ] Implement scheduled job for monthly invoices
- [ ] Add Supabase Edge Function or Azure Function
- [ ] Configure cron schedule
- [ ] Add email notifications

**Webhooks**:
- [ ] Set up Stripe webhook endpoint
- [ ] Handle `invoice.paid` event
- [ ] Handle `invoice.payment_failed` event
- [ ] Update invoice status automatically

**Advanced Features**:
- [ ] Advanced filtering and search
- [ ] Export to CSV/PDF
- [ ] Email templates customization
- [ ] Multi-currency support (if needed)
- [ ] Custom invoice templates

### **Phase 3: Future Enhancements** - Future

**Potential Features**:
- [ ] Subscription-based billing (recurring)
- [ ] Payment reminders for overdue invoices
- [ ] Revenue forecasting and analytics
- [ ] Customer portal (self-service billing)
- [ ] Integration with accounting software (QuickBooks, Xero)
- [ ] Multi-user billing access (grant access to accountant)

---

## **16. Technical Stack Summary**

**Frontend**:
- React 18 + TypeScript
- Tailwind CSS (existing theme)
- React Router DOM v6
- Recharts (for charts)
- Lucide React (for icons)
- Zod (for validation)

**Backend**:
- Supabase PostgreSQL (database)
- Supabase Auth (for user authentication)
- Supabase RLS (for security)

**External Services**:
- Stripe API (for invoicing)
- Azure AD (for authentication)
- Existing CareXPS cost services

**Security**:
- MFA (TOTP via existing `freshMfaService`)
- RLS (Row Level Security)
- Encrypted storage for API keys
- Audit logging (via existing `auditLogger`)

---

## **17. Success Criteria**

✅ **Functional Requirements Met**:
- [ ] Super Users with MFA can access billing admin
- [ ] Can add/edit/delete billing customers
- [ ] Can manually generate invoices for any date range
- [ ] Invoices are created in Stripe with correct amounts
- [ ] Invoices can be sent to customers via Stripe
- [ ] Invoice history is viewable and filterable
- [ ] All billing actions are audit-logged (NO PHI)
- [ ] System uses existing combined SMS + Retell AI costs
- [ ] UI matches existing CareXPS design system

✅ **Security Requirements Met**:
- [ ] MFA enforced for all billing access
- [ ] Only Super Users can access billing routes
- [ ] No PHI/HIPAA data in billing system
- [ ] Stripe keys stored encrypted
- [ ] All actions audit-logged
- [ ] RLS policies properly configured

✅ **Performance Requirements Met**:
- [ ] Cost calculations complete in < 30 seconds for 500+ chats
- [ ] Dashboard loads in < 3 seconds
- [ ] Invoice generation handles 10+ customers efficiently
- [ ] No memory leaks or performance degradation

✅ **Usability Requirements Met**:
- [ ] Intuitive UI matching existing CareXPS patterns
- [ ] Clear error messages and validation
- [ ] Loading states for all async operations
- [ ] Responsive design (mobile, tablet, desktop)

---

## **18. START IMPLEMENTATION**

When you're ready to begin, provide this entire prompt to Claude with:

**Additional Context**:
1. Your Stripe account details (test/live mode preference)
2. Any specific customer requirements
3. Preferred markup percentages
4. Invoice template customizations

**Initial Setup Steps**:
1. Install Stripe package: `npm install stripe @stripe/stripe-js`
2. Create database migrations
3. Set up MFA verification for billing routes
4. Create base billing page structure
5. Implement customer management first (simplest)
6. Then invoice generation (most complex)
7. Finally dashboard and settings

**Estimated Timeline**: 2-3 days for Phase 1 (MVP)

Good luck! 🚀
