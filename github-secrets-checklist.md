# GitHub Secrets Configuration for MedEx CRM

Add these secrets at: https://github.com/Sugarbait/MedEx/settings/secrets/actions

## Required Secrets

### 1. AZURE_STATIC_WEB_APPS_API_TOKEN_MEDEX
**Value**: `4dd732d6a3a2efce1c837286e19899c3a359938fb53e8cec4ad4b4eb16c1285902-685e3179-e63e-4a32-8b6d-f98fa065903500f05100ffab9a0f`
**Source**: Azure deployment token you provided earlier

### 2. VITE_PHI_ENCRYPTION_KEY
**Value**: `UxatBAkb3xe0Bc7+9RCP8Fqwh75tuFEu/ojggnH8rO0=`
**Source**: Freshly generated (see above)

### 3. VITE_AUDIT_ENCRYPTION_KEY
**Value**: `V5qskvbJTcWa0AfX0/w72kHJ1+dEWVZxgnqOApiYCA4=`
**Source**: Freshly generated (see above)

### 4. VITE_SUPABASE_URL
**Value**: `https://cpkslvmydfdevdftieck.supabase.co`
**Source**: Your Supabase project URL

### 5. VITE_SUPABASE_ANON_KEY
**Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5MDAyOTUsImV4cCI6MjA2MjQ3NjI5NX0.WxS0DQqMQZ7spD9XY_PW-d2dv5u-7J5Uu_LNO0vUgMU`
**Source**: Your Supabase anon key (public safe key)

## Optional Secrets (can skip for now)

### 6. VITE_OPENAI_API_KEY
**Purpose**: For help chatbot feature
**Can Skip**: Yes, feature will be disabled without it

### 7. HOSTINGER_EMAIL_PASSWORD
**Purpose**: For email notifications
**Can Skip**: Yes, email notifications will be disabled without it

### 8. VITE_EMAILJS_SERVICE_ID
**Purpose**: Legacy email service (not used in MedEx)
**Can Skip**: Yes

### 9. VITE_EMAILJS_TEMPLATE_ID
**Purpose**: Legacy email service (not used in MedEx)
**Can Skip**: Yes

### 10. VITE_EMAILJS_PUBLIC_KEY
**Purpose**: Legacy email service (not used in MedEx)
**Can Skip**: Yes

---

## ⚠️ SECURITY NOTES

1. **Never commit these values to Git** - They are secrets!
2. **Store the encryption keys securely** - If lost, encrypted data cannot be recovered
3. **The Azure token is unique to your deployment** - Don't share it
4. **The Supabase anon key is public-safe** - It's designed to be exposed in frontend code

---

## ✅ Quick Add Instructions

1. Go to: https://github.com/Sugarbait/MedEx/settings/secrets/actions
2. Click "New repository secret"
3. Copy the name (e.g., `AZURE_STATIC_WEB_APPS_API_TOKEN_MEDEX`)
4. Paste the value
5. Click "Add secret"
6. Repeat for secrets #2-5 (required)
7. Skip #6-10 (optional) for now

---

## 🚀 After Adding Secrets

Once you've added all required secrets (#1-5):

1. Go to `.github/workflows/azure-static-web-apps-medex.yml`
2. Uncomment lines 18-26 (the push/pull_request triggers)
3. Comment out line 17 (`workflow_dispatch`)
4. Commit and push
5. GitHub Actions will automatically deploy to Azure on every push!

---

**Generated**: October 3, 2025
