# 📦 Invoice PDF Storage Setup Guide

## Issue
The "Download PDF Details" button in invoice emails is redirecting to Stripe instead of downloading the PDF report because the PDF upload to Supabase Storage is failing.

---

## Solution Steps

### **Step 1: Create Storage Bucket in Supabase**

1. Go to **Supabase Dashboard**: https://supabase.com/dashboard/project/onwgbfetzrctshdwwimm
2. Navigate to **Storage** → **Buckets** (left sidebar)
3. Click **"New Bucket"** button
4. Fill in the bucket details:
   - **Name**: `invoice-reports`
   - **Public**: ❌ **No** (keep private for security)
   - **File size limit**: `50 MB`
   - **Allowed MIME types**: `application/pdf` (optional but recommended)
5. Click **"Create Bucket"**

---

### **Step 2: Configure RLS Policies**

After creating the bucket, you need to set up Row Level Security policies.

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Click **"New Query"**
3. Copy and paste the following SQL:

```sql
-- ================================================================
-- INVOICE STORAGE RLS POLICIES
-- ================================================================

-- Policy 1: Enable upload for authenticated users
CREATE POLICY "Enable upload for authenticated users"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'invoice-reports');

-- Policy 2: Enable upload for anonymous users (for invoice generation)
CREATE POLICY "Enable upload for anonymous users"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (bucket_id = 'invoice-reports');

-- Policy 3: Enable download via signed URLs for all users
CREATE POLICY "Enable download via signed URLs"
ON storage.objects
FOR SELECT
TO authenticated, anon
USING (bucket_id = 'invoice-reports');

-- Policy 4: Enable update for authenticated users
CREATE POLICY "Enable update for authenticated users"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'invoice-reports')
WITH CHECK (bucket_id = 'invoice-reports');

-- Policy 5: Enable delete for authenticated users
CREATE POLICY "Enable delete for authenticated users"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'invoice-reports');
```

4. Click **"Run"** to execute the SQL

---

### **Step 3: Verify Setup**

Run this query to verify the bucket exists:

```sql
-- Check if bucket exists
SELECT * FROM storage.buckets WHERE name = 'invoice-reports';

-- Check storage policies
SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
```

You should see:
- ✅ One row with bucket name `invoice-reports`
- ✅ Multiple rows showing the RLS policies

---

### **Step 4: Test PDF Upload**

1. Go to **Dashboard** in your MedEx app
2. Select a date range with data
3. Click **"Generate Invoice"**
4. Click **"Confirm & Send"**
5. Check the browser console for logs:
   - ✅ Should see: `📤 Uploading PDF report to Supabase Storage...`
   - ✅ Should see: `✅ PDF uploaded successfully: https://...`
   - ❌ Should NOT see: `❌ PDF upload failed`

---

### **Step 5: Test Email PDF Link**

1. Check your email at `elitesquadp@protonmail.com`
2. Open the invoice email
3. Click **"Download PDF Details"** button
4. **Expected**: PDF file downloads with MedEx logo and dashboard report
5. **Before Fix**: Redirects to Stripe invoice page

---

## Troubleshooting

### **Issue: "Permission denied" error during upload**

**Check console logs** - Look for error messages like:
```
❌ PDF upload failed: new row violates row-level security policy
```

**Solution**: Make sure you ran the RLS policies in Step 2, especially the anonymous user policy.

---

### **Issue: Signed URLs return 404**

**Check if file was uploaded**:
1. Go to **Supabase Dashboard** → **Storage** → **Buckets** → **invoice-reports**
2. Look for PDF files with names like: `invoice_INV-1234_20251030_123456.pdf`

**Solution**: If no files appear, the upload is failing. Check console for error messages.

---

### **Issue: Still redirecting to Stripe**

**Check the code fallback** (line 1183 in DashboardPage.tsx):
```typescript
pdf_download_link: pdfDownloadLink || finalizedInvoice.hosted_invoice_url
```

This means if `pdfDownloadLink` is empty (upload failed), it falls back to Stripe.

**Solution**: Fix the upload issue by completing Steps 1-2 above.

---

## Expected Result

After setup, when you generate an invoice:

1. ✅ PDF is generated with MedEx logo
2. ✅ PDF is uploaded to `invoice-reports` bucket
3. ✅ Signed URL is generated (valid for 7 days)
4. ✅ Email includes the PDF download link
5. ✅ "Download PDF Details" button downloads the PDF
6. ✅ PDF contains complete dashboard report for invoice period

---

## Security Notes

- **Bucket is private**: Only accessible via signed URLs
- **7-day expiry**: Download links expire after 7 days for security
- **RLS protected**: Only authorized users can upload/download
- **HTTPS only**: All downloads are over secure connections

---

## Next Steps

After completing the setup:

1. ✅ Test invoice generation
2. ✅ Verify PDF upload in console logs
3. ✅ Check email "Download PDF Details" button
4. ✅ Download and review PDF content
5. ✅ Confirm MedEx logo appears in PDF

---

**Setup Date**: October 30, 2025
**Bucket Name**: `invoice-reports`
**File Format**: `invoice_{invoice_number}_{date}_{time}.pdf`
**Expiry**: 7 days
