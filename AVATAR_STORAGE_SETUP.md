# Avatar Storage System Setup Guide

This guide will help you set up and test the new robust avatar storage system that ensures cross-device persistence and reliability.

## 🎯 What's Been Enhanced

The new avatar storage system provides:

✅ **Cross-device synchronization** - Avatars sync across all user devices
✅ **Bulletproof persistence** - Multiple storage layers with fallbacks
✅ **Automatic optimization** - Images are resized and compressed
✅ **Robust error handling** - Graceful degradation when services are unavailable
✅ **HIPAA compliance** - Full audit trail and secure storage
✅ **Storage cleanup** - Automatic removal of orphaned files

## 🔧 Setup Instructions

### 1. Database Migration

Run the migration script to add avatar support to your database:

```sql
-- Execute the migration script
\i supabase-avatar-migration.sql
```

Or manually apply the migration in Supabase dashboard:
1. Go to SQL Editor in your Supabase dashboard
2. Copy and paste the contents of `supabase-avatar-migration.sql`
3. Execute the script

### 2. Create Storage Bucket

In your Supabase dashboard:

1. Navigate to **Storage** → **Buckets**
2. Click **New bucket**
3. Configure the bucket:
   - **Name**: `avatars`
   - **Public**: ✅ Enabled (for public URLs)
   - **File size limit**: `5242880` (5MB)
   - **Allowed MIME types**: `image/jpeg,image/png,image/webp,image/gif`

### 3. Configure Storage Policies

In **Storage** → **Policies**, add these Row Level Security policies for the `avatars` bucket:

```sql
-- Allow anyone to view avatars (public read)
CREATE POLICY "Public avatar access" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

-- Allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload own avatar" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own avatar
CREATE POLICY "Users can update own avatar" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own avatar
CREATE POLICY "Users can delete own avatar" ON storage.objects
FOR DELETE USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

### 4. Environment Variables

Ensure your `.env` file has the required Supabase configuration:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key (optional)
```

### 5. Initialize Avatar Service

The avatar service is automatically initialized when imported. To manually initialize:

```typescript
import { avatarStorageService } from '@/services/avatarStorageService'

// Initialize the service (optional - called automatically)
await avatarStorageService.initialize()
```

## 🧪 Testing Cross-Device Persistence

### Test 1: Basic Avatar Upload

1. Log in to the application
2. Go to **Settings** → **Profile**
3. Upload an avatar image (JPG, PNG, WebP, or GIF)
4. Verify the avatar appears in the UI
5. Check browser developer tools network tab for successful upload

### Test 2: Cross-Device Synchronization

1. **Device A**: Upload an avatar
2. **Device B**: Log in with the same user account
3. **Verify**: Avatar should automatically appear on Device B
4. **Device B**: Change the avatar
5. **Device A**: Refresh or re-login - should see the new avatar

### Test 3: Offline Fallback

1. Upload an avatar while online
2. Disconnect from internet
3. The avatar should still be visible (from localStorage cache)
4. Reconnect - avatar should sync from database

### Test 4: Error Recovery

1. Temporarily disable Supabase Storage (remove bucket permissions)
2. Try to upload an avatar - should show proper error message
3. Re-enable storage permissions
4. Upload should work again

### Test 5: Storage Cleanup

1. Upload multiple avatars for a user (each upload replaces the previous)
2. Only the latest avatar file should exist in storage
3. Check Supabase Storage dashboard to verify old files are cleaned up

## 🔍 Debugging

### Check Avatar Storage Status

```typescript
import { avatarStorageService } from '@/services/avatarStorageService'

// Get current avatar URL
const avatarUrl = await avatarStorageService.getAvatarUrl(userId)
console.log('Current avatar:', avatarUrl)

// Sync avatar across devices
const syncResult = await avatarStorageService.syncAvatarAcrossDevices(userId)
console.log('Sync result:', syncResult)
```

### Common Issues

**Issue**: "Avatars bucket not found"
- **Solution**: Create the `avatars` bucket in Supabase dashboard

**Issue**: "Permission denied" errors
- **Solution**: Configure the storage policies as shown above

**Issue**: "Invalid avatar URL"
- **Solution**: Check that the URL validation function allows your storage URLs

**Issue**: Avatar not syncing across devices
- **Solution**: Check that the `users.avatar_url` column exists and is being updated

### Monitoring & Logs

The system logs all avatar operations to the audit log:

```sql
-- View recent avatar operations
SELECT * FROM audit_logs
WHERE action LIKE '%AVATAR%'
ORDER BY timestamp DESC
LIMIT 20;
```

## 📱 Mobile & Responsive Considerations

The avatar upload component automatically:
- Resizes images to 512x512 maximum
- Compresses images to reduce file size
- Supports touch/mobile file selection
- Shows upload progress

## 🔒 Security Features

- **File Type Validation**: Only allows image files
- **Size Limits**: Maximum 5MB per file
- **URL Validation**: Only accepts URLs from your Supabase storage
- **Audit Trail**: All operations are logged
- **RLS Policies**: Users can only modify their own avatars
- **Automatic Cleanup**: Orphaned files are automatically removed

## 🚀 Performance Optimizations

- **Image Compression**: Automatic JPEG compression at 80% quality
- **Size Optimization**: Images resized to optimal dimensions
- **Caching**: Multi-layer caching (localStorage + memory)
- **Lazy Loading**: Avatar URLs fetched only when needed
- **Background Sync**: Non-blocking synchronization

## 📊 Key Metrics to Monitor

1. **Upload Success Rate**: Track successful vs failed uploads
2. **Sync Reliability**: Monitor cross-device sync success
3. **Storage Usage**: Track total storage consumption
4. **Load Performance**: Avatar loading times
5. **Error Rates**: Failed operations and causes

## 🔄 Migration from Old System

If you have existing avatars in localStorage only:

```typescript
// Run this migration script to move localStorage avatars to the new system
async function migrateExistingAvatars() {
  const users = JSON.parse(localStorage.getItem('systemUsers') || '[]')

  for (const user of users) {
    if (user.avatar && user.avatar.startsWith('data:')) {
      console.log(`Migrating avatar for user: ${user.id}`)

      try {
        const result = await avatarStorageService.uploadAvatar(user.id, user.avatar)
        if (result.status === 'success') {
          console.log(`✅ Migrated avatar for ${user.name}`)
        } else {
          console.error(`❌ Failed to migrate avatar for ${user.name}:`, result.error)
        }
      } catch (error) {
        console.error(`❌ Error migrating avatar for ${user.name}:`, error)
      }
    }
  }
}

// Run the migration
await migrateExistingAvatars()
```

## ✅ Verification Checklist

- [ ] Database migration completed successfully
- [ ] `avatars` storage bucket created and configured
- [ ] Storage policies applied correctly
- [ ] Avatar upload works in Settings page
- [ ] Avatar displays correctly across the app
- [ ] Cross-device sync working (test with multiple browsers/devices)
- [ ] Error handling working (test with network issues)
- [ ] Old avatar files are cleaned up when new ones are uploaded
- [ ] Audit logs show avatar operations
- [ ] Performance is acceptable (upload/display times)

## 🆘 Support

If you encounter issues:

1. Check the browser console for error messages
2. Verify Supabase configuration and permissions
3. Check the audit logs for detailed operation history
4. Test with different image formats and sizes
5. Ensure the database migration was applied correctly

The new avatar system is designed to be robust and handle various failure scenarios gracefully. Users should never lose their profile pictures with this implementation!