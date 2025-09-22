# Testing Cross-Device Sync

Now that the tables are created in Supabase, let's test if sync actually works.

## Test 1: Settings Sync (API Keys)

### On Computer 1:
1. Open http://localhost:3002 in your browser
2. Log in with your account
3. Go to Settings page
4. Enter your Retell API key and Agent IDs
5. Click "Save Changes"
6. Open browser console (F12) and look for messages like:
   - "✅ Settings saved to Supabase (cross-device sync)"
   - "✅ Settings force-synced from Supabase successfully"

### On Computer 2:
1. Open the app in a different browser or incognito/private window (to simulate another device)
2. Log in with the same account
3. Check the browser console for:
   - "🔄 Syncing cross-device data from Supabase..."
   - "✅ Settings sync: successful"
   - "✅ Retell credentials updated from synced settings"
4. Go to Settings page
5. **Your API key and Agent IDs should be there!**

## Test 2: MFA Sync

### On Computer 1:
1. Go to Settings page
2. Enable MFA and complete the setup with authenticator app
3. Log out

### On Computer 2:
1. Log in with the same account
2. **You should NOT be asked to set up MFA again**
3. It should recognize MFA is already set up and ask for your code

## What to Check in Browser Console

Look for these success messages:
- `🔄 Syncing cross-device data from Supabase...`
- `✅ MFA data sync: successful`
- `✅ Settings sync: successful`
- `✅ Retell credentials updated from synced settings`

If you see errors like:
- `⚠️ Cross-device sync failed` - Check your Supabase connection
- `No MFA configuration found in cloud` - MFA hasn't been set up yet

## Checking Supabase Directly

1. Go to your Supabase dashboard
2. Click on "Table Editor"
3. Check the `user_settings` table - you should see your settings saved there
4. Check the `user_mfa_configs` table - you should see MFA data if MFA is set up

## If It's Still Not Working

1. Check browser console for any errors
2. Make sure your `.env.local` has correct Supabase credentials:
   ```
   VITE_SUPABASE_URL=your-url
   VITE_SUPABASE_ANON_KEY=your-key
   ```
3. Try refreshing the page (Ctrl+F5) to clear cache
4. Check if data is being saved in Supabase tables directly

## Important Notes

- The sync happens automatically on login and when Settings page loads
- API keys are encrypted before being stored in Supabase
- If Supabase is down, the app falls back to localStorage (device-specific)