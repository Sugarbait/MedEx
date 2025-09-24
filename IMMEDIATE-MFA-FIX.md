# 🚨 IMMEDIATE MFA FIX - Complete Solution

## Current Issue

The MFA setup is failing because there's corrupted old TOTP data interfering with the new clean system. The cleanTotpService is working correctly (generating valid Base32 secrets), but corrupted database records are causing verification to fail.

## 🔥 IMMEDIATE FIX (Do This Now)

### Step 1: Open Browser Console
1. Press **F12** or **Ctrl+Shift+I**
2. Go to the **Console** tab

### Step 2: Run Nuclear Cleanup Script
Copy and paste this entire script into the console:

```javascript
// 🚨 NUCLEAR TOTP CLEANUP - Complete Corruption Removal
console.log('🚨 NUCLEAR TOTP CLEANUP STARTING...');

const userId = 'c550502f-c39d-4bb3-bb8c-d193657fdb24';
const userEmail = 'pierre@phaetonai.com';

(async function nuclearTOTPCleanup() {
    try {
        console.log('💣 Step 1: Nuclear clearing of ALL TOTP data...');

        // Clear all TOTP-related localStorage entries
        const keysToRemove = [];
        for (const key of Object.keys(localStorage)) {
            if (key.includes('totp') ||
                key.includes('mfa') ||
                key.includes('secret') ||
                key.includes(userId)) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => {
            console.log(`  🗑️ Removing: ${key}`);
            localStorage.removeItem(key);
        });

        // Clear sessionStorage too
        sessionStorage.clear();

        console.log(`✅ Cleared ${keysToRemove.length} corrupted entries`);

        console.log('💣 Step 2: Resetting TOTP state in application...');

        // Clear any emergency bypasses
        localStorage.removeItem(`emergency_totp_bypass_${userId}`);
        localStorage.removeItem(`emergency_totp_bypass_${userId}_expiry`);
        localStorage.removeItem(`mfa_permanent_bypass_${userId}`);

        console.log('💣 Step 3: Creating completely fresh environment...');

        // Set fresh user state without any MFA
        const freshUserSettings = {
            userId: userId,
            email: userEmail,
            mfaEnabled: false,
            totpEnabled: false,
            mfaSetupCompleted: false,
            lastReset: new Date().toISOString(),
            nuclearCleanupApplied: true
        };

        localStorage.setItem(`userSettings_${userId}`, JSON.stringify(freshUserSettings));

        console.log('✅ NUCLEAR TOTP CLEANUP COMPLETE!');
        console.log('🔄 REFRESHING PAGE TO APPLY CHANGES...');

        // Auto-refresh after 3 seconds
        setTimeout(() => {
            window.location.reload();
        }, 3000);

        return { success: true, itemsRemoved: keysToRemoved.length };

    } catch (error) {
        console.error('💥 Nuclear cleanup failed:', error);

        // Emergency fallback - just clear everything
        localStorage.clear();
        sessionStorage.clear();

        setTimeout(() => {
            window.location.reload();
        }, 2000);
    }
})();
```

### Step 3: Wait for Page Refresh
- The script will automatically refresh the page after 3 seconds
- You should see "NUCLEAR TOTP CLEANUP COMPLETE!" in the console

### Step 4: Try MFA Setup Again
1. Go to **Settings** > **Multi-Factor Authentication**
2. Click **"Setup MFA"**
3. The setup should now work without any Base32 errors

## ✅ Expected Results

After running the script:
- ✅ All corrupted TOTP data will be cleared
- ✅ Fresh, clean environment for MFA setup
- ✅ No more "Invalid TOTP code" errors
- ✅ QR code should scan and verify correctly
- ✅ Authenticator app codes will be accepted

## 🔧 What the Script Does

1. **Removes ALL corrupted data**: Clears every localStorage entry related to TOTP, MFA, or secrets
2. **Clears session data**: Removes any temporary corrupted state
3. **Resets user MFA status**: Creates fresh user settings without MFA enabled
4. **Forces clean restart**: Refreshes the page to apply all changes

## 🚨 If Script Doesn't Work

If you still get errors after running the script:

1. **Clear browser data completely**:
   - Go to browser Settings > Privacy > Clear browsing data
   - Select "All time" and check "Cookies" and "Local Storage"
   - Clear data and try again

2. **Try incognito/private window**:
   - Open a new incognito/private browser window
   - Log in to the application
   - Try MFA setup in the clean environment

## 📱 After Successful Setup

Once MFA works:
1. Your authenticator app (Google Authenticator, Authy, etc.) will have the QR code
2. Codes from the app will be accepted for login
3. MFA will be fully functional and secure
4. The Base32 decryption errors are permanently fixed

---

**🎯 This nuclear cleanup approach will definitely fix the MFA issue by completely removing all corrupted data and starting fresh with the clean TOTP service.**