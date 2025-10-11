# QUICK FIX: Unlock dr@medexhealthservices.com

**Authorization:** MEDEX_OWNER_OVERRIDE_2025
**Time Required:** 10 minutes
**New Password:** `MedEx2025!`

---

## Option 1: Use HTML Tool (EASIEST)

1. **Open:** `unlock-dr-account.html` in browser (within MedEx CRM app)
2. **Click:** "Run Diagnostics" button → Review output
3. **Click:** "Unlock Account & Reset Password" button → Wait for completion
4. **Click:** "Test Login" button → Verify it works
5. **Done!** Password is now: `MedEx2025!`

---

## Option 2: Manual SQL + Console

### Step 1: SQL (Supabase SQL Editor)

```sql
-- Copy-paste and run each query:

-- Get user ID
SELECT id, email, is_active FROM users
WHERE email = 'dr@medexhealthservices.com' AND tenant_id = 'medex';

-- Clear lockouts
DELETE FROM failed_login_attempts WHERE email = 'dr@medexhealthservices.com';

-- Enable account
UPDATE users SET is_active = true
WHERE email = 'dr@medexhealthservices.com' AND tenant_id = 'medex';
```

### Step 2: Browser Console (F12 → Console)

```javascript
// Run diagnostics
await window.diagnoseDrAccount()

// Unlock and reset password
await window.unlockDrAccount()

// Test login
await window.testLogin()
```

---

## New Login Credentials

**Email:** dr@medexhealthservices.com
**Password:** MedEx2025!

**Note:** User should change password in Settings after first login.

---

## What Gets Fixed

- ✅ Account unlocked (cleared lockout data)
- ✅ Failed login attempts cleared
- ✅ New password set and stored in BOTH Supabase AND localStorage
- ✅ Password verified to work
- ✅ Account enabled

---

## Troubleshooting

**"User not found"**
- Check email spelling
- Verify running in MedEx CRM app context

**"Cannot decrypt"**
- Refresh page and try again
- Encryption service may not be loaded

**"Functions not found"**
- Make sure you opened `unlock-dr-account.html` in the app
- Or load the functions: Copy contents of `unlock-dr-account.js` into console

---

## Files Created

1. **unlock-dr-account.html** - Complete web interface (USE THIS)
2. **unlock-dr-account.js** - JavaScript functions
3. **DR_ACCOUNT_FIX_REPORT.md** - Full technical documentation
4. **QUICK_FIX_DR_ACCOUNT.md** - This quick reference

---

## Root Cause: Why Password Wasn't Persisting

**Problem:** Password only stored in localStorage, not in Supabase
**Impact:** Password lost when browser cache cleared
**Fix:** Our script stores in BOTH locations and verifies storage

---

**Questions?** See `DR_ACCOUNT_FIX_REPORT.md` for detailed explanation.
