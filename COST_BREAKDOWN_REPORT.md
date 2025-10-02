# CareXPS CRM - Complete Cost Breakdown Report

## Exchange Rate: 1 USD = 1.45 CAD (FIXED)

---

## ✅ CONFIRMED: Both Retell AI and Twilio Costs Are Tracked

### 🎙️ **VOICE CALLS - Two Cost Components**

#### 1. **Retell AI Voice Service** (AI Processing)
- **Source**: `call.call_cost.combined_cost` (in cents USD)
- **What it covers**:
  - AI conversation processing
  - Speech-to-text (STT)
  - Text-to-speech (TTS)
  - LLM (language model) usage
  - Real-time AI interaction
- **Cost structure**: Per-second pricing across products
  - Example: ElevenLabs TTS at 1 cent/second
  - Combined total includes all AI services used
- **Conversion**: Cents → USD → CAD (× 1.45)
- **Code location**: `CallsPage.tsx:512-514`

```typescript
const retellCostCents = call.call_cost?.combined_cost || 0
const retellCostUSD = retellCostCents / 100
const retellCostCAD = currencyService.convertUSDToCAD(retellCostUSD) // × 1.45
```

#### 2. **Twilio Voice Service** (Phone Network)
- **Rate**: $0.022 USD per minute (1-800 toll-free)
- **What it covers**:
  - Inbound call routing
  - Phone network connectivity
  - Call quality and reliability
- **Billing**: Rounded up to next minute (⌈seconds/60⌉)
- **Conversion**: USD → CAD (× 1.45)
- **Code location**: `twilioCostService.ts:57-92`

```typescript
const billedMinutes = Math.ceil(callLengthSeconds / 60)
const costUSD = billedMinutes * 0.022
const costCAD = currencyService.convertUSDToCAD(costUSD) // × 1.45
```

#### **Total Voice Call Cost**
```
TOTAL = Retell AI Voice (CAD) + Twilio Voice (CAD)
```

**Example Calculation:**
```
Call: 90 seconds (1.5 minutes)
- Retell AI: 70 cents = $0.70 USD × 1.45 = $1.015 CAD
- Twilio: 2 min × $0.022 = $0.044 USD × 1.45 = $0.064 CAD
- TOTAL: $1.079 CAD
```

---

### 💬 **SMS CHATS - Two Cost Components**

#### 1. **Retell AI Chat Service** (AI Processing)
- **Source**: `chat.chat_cost.combined_cost` (in cents USD)
- **What it covers**:
  - AI conversation processing
  - Message analysis and response generation
  - Context management
  - LLM usage for chat
- **Fallback**: If API returns $0, add $0.03 USD fee
- **Conversion**: Cents → USD → CAD (× 1.45)
- **Code location**: `smsCostCacheService.ts:182-187`

```typescript
const retellChatCostCents = chat.chat_cost?.combined_cost || 0
const retellChatCostUSD = retellChatCostCents / 100
const retellChatCostWithFee = retellChatCostUSD > 0 ? retellChatCostUSD : 0.03
const retellChatCostCAD = currencyService.convertUSDToCAD(retellChatCostWithFee) // × 1.45
```

#### 2. **Twilio SMS Service** (Text Messages)
- **Rate**: $0.0083 USD per segment (toll-free)
- **What it covers**:
  - SMS delivery via phone network
  - Message routing and reliability
- **Segment calculation**:
  - GSM-7: 160 chars (single), 152 chars (multi)
  - UCS-2: 70 chars (single), 66 chars (multi)
  - +4 segments for initial prompt overhead
- **Conversion**: USD → CAD (× 1.45)
- **Code location**: `twilioCostService.ts:267-312`

```typescript
const totalSegments = calculateSMSSegments(messages) + 4 // +4 initial prompt
const costUSD = totalSegments * 0.0083
const costCAD = currencyService.convertUSDToCAD(costUSD) // × 1.45
```

#### **Total SMS Chat Cost**
```
TOTAL = Retell AI Chat (CAD) + Twilio SMS (CAD)
```

**Example Calculation:**
```
Chat: 8 messages, 20 segments
- Retell AI: $0.03 USD × 1.45 = $0.0435 CAD
- Twilio: 20 segments × $0.0083 = $0.166 USD × 1.45 = $0.2407 CAD
- TOTAL: $0.2842 CAD
```

---

## 📊 Cost Flow Architecture

### Voice Calls Flow:
```
1. Customer calls 1-800 number
2. Twilio routes call → charges $0.022/min
3. Retell AI processes voice → charges per-second AI usage
4. App fetches call data from Retell API
5. Extracts call.call_cost.combined_cost (Retell AI)
6. Calculates Twilio cost from duration
7. Converts both to CAD (× 1.45)
8. Displays combined total
```

### SMS Chats Flow:
```
1. Customer sends SMS to phone number
2. Twilio delivers messages → charges $0.0083/segment
3. Retell AI processes conversation → charges AI usage
4. App fetches chat data from Retell API
5. Extracts chat.chat_cost.combined_cost (Retell AI)
6. Calculates Twilio SMS cost from segments
7. Converts both to CAD (× 1.45)
8. Displays combined total
```

---

## 💰 Real Data from Yesterday (October 1, 2025)

### 5 Most Recent SMS Chats:

**1. Chat (16 hours ago)**
- Retell AI: $0.0260 USD → $0.0377 CAD
- Twilio SMS: $0.0332 USD → $0.0481 CAD
- **Total: $0.0858 CAD**

**2. Chat (17 hours ago)**
- Retell AI: $0.0910 USD → $0.1319 CAD
- Twilio SMS: $0.0332 USD → $0.0481 CAD
- **Total: $0.1801 CAD**

**3. Chat (20 hours ago)**
- Retell AI: $0.0260 USD → $0.0377 CAD
- Twilio SMS: $0.0332 USD → $0.0481 CAD
- **Total: $0.0858 CAD**

**4. Chat (21 hours ago)**
- Retell AI: $0.0260 USD → $0.0377 CAD
- Twilio SMS: $0.0332 USD → $0.0481 CAD
- **Total: $0.0858 CAD**

**5. Chat (21 hours ago)**
- Retell AI: $0.0130 USD → $0.0189 CAD
- Twilio SMS: $0.0332 USD → $0.0481 CAD
- **Total: $0.0670 CAD**

### Voice Calls Status:
**⚠️ No voice calls found in your Retell AI account**
- Your account currently only has SMS chats
- No phone calls have been made/recorded
- Voice call integration is ready but unused

---

## 🔍 Where Costs Are Displayed

### 1. **Calls Page** (`/calls`)
- Shows voice call list
- Each call displays: Retell AI + Twilio = Total CAD
- Metrics section shows aggregated costs

### 2. **SMS Page** (`/sms`)
- Shows SMS chat list
- Each chat displays: Retell AI + Twilio = Total CAD
- Combined cost visible per conversation

### 3. **Dashboard** (`/dashboard`)
- Aggregated analytics
- Charts show cost breakdowns
- Total spending across both services

### 4. **Browser Console**
Press F12 to see detailed logs:
```
💱 Currency service initialized with fixed rate: 1.45 CAD per USD
[SMSCostCache] Combined cost breakdown for chat_xxx:
  twilioSMSCostCAD: 0.0481
  retellChatCostCAD: 0.0377
  combinedTotalCAD: 0.0858
```

---

## ✅ Integration Status

### ✅ **CONFIRMED: Both Services Integrated**

| Service | Status | Rate | Conversion | Location |
|---------|--------|------|------------|----------|
| **Retell AI Voice** | ✅ Integrated | Variable (per-second) | × 1.45 CAD | CallsPage.tsx:512-514 |
| **Twilio Voice** | ✅ Integrated | $0.022 USD/min | × 1.45 CAD | twilioCostService.ts:57-92 |
| **Retell AI Chat** | ✅ Integrated | Variable + $0.03 fallback | × 1.45 CAD | smsCostCacheService.ts:182-187 |
| **Twilio SMS** | ✅ Integrated | $0.0083 USD/segment | × 1.45 CAD | twilioCostService.ts:267-312 |

### 🎯 **All 4 Services Use Fixed 1.45 CAD Rate**

Every USD cost from both Retell AI and Twilio passes through:
```typescript
currencyService.convertUSDToCAD(usdAmount)
// Returns: usdAmount × 1.45
```

---

## 📝 Summary

### Your CRM Tracks:

**Voice Calls:**
1. ✅ Retell AI processing fees (AI conversation)
2. ✅ Twilio phone network fees (call routing)
3. ✅ Combined total in CAD

**SMS Chats:**
1. ✅ Retell AI chat fees (AI messaging)
2. ✅ Twilio SMS fees (text delivery)
3. ✅ Combined total in CAD

**Currency:**
- ✅ Fixed 1.45 CAD per USD
- ✅ Applied to ALL costs
- ✅ No fluctuations

**Current Usage:**
- SMS: 100 chats recorded (active)
- Voice: 0 calls recorded (not yet used)

---

*Report Generated: October 2, 2025*
*Exchange Rate: 1.45 CAD/USD (Fixed)*
