/**
 * TOTP Database Fix Deployment Script
 * Runs the critical database fixes for TOTP authentication
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

async function deployTOTPFix() {
    console.log('🔧 TOTP Database Fix Deployment Starting...');
    console.log('==================================================');

    if (!SUPABASE_SERVICE_KEY) {
        console.error('❌ ERROR: VITE_SUPABASE_SERVICE_ROLE_KEY environment variable is required');
        console.log('Please set your Supabase service role key in your .env.local file');
        process.exit(1);
    }

    try {
        // Read the SQL fix script
        const sqlScript = fs.readFileSync(
            path.join(__dirname, 'TOTP_DATABASE_CRITICAL_FIX.sql'),
            'utf8'
        );

        console.log('📖 SQL script loaded successfully');
        console.log(`📄 Script length: ${sqlScript.length} characters`);

        // Instructions for manual deployment
        console.log('\n🚀 DEPLOYMENT INSTRUCTIONS:');
        console.log('============================');
        console.log('1. Open your Supabase Dashboard');
        console.log('2. Go to SQL Editor');
        console.log('3. Copy and paste the contents of TOTP_DATABASE_CRITICAL_FIX.sql');
        console.log('4. Execute the script');
        console.log('5. Check the output for success messages');

        console.log('\n📋 WHAT THIS FIX DOES:');
        console.log('========================');
        console.log('✅ Adds missing "metadata" column to audit_logs table');
        console.log('✅ Cleans up duplicate TOTP records causing conflicts');
        console.log('✅ Recreates user_totp table with correct schema');
        console.log('✅ Fixes upsert_user_totp database function');
        console.log('✅ Sets up proper RLS policies for TOTP authentication');
        console.log('✅ Creates emergency cleanup functions');
        console.log('✅ Inserts clean test data for demo users');

        console.log('\n🎯 TARGET USER:');
        console.log('================');
        console.log('User ID: c550502f-c39d-4bb3-bb8c-d193657fdb24');
        console.log('Email: pierre@phaetonai.com');
        console.log('Issue: Database conflicts preventing TOTP setup/verification');

        console.log('\n⚠️  IMPORTANT NOTES:');
        console.log('===================');
        console.log('• This script will clean up ALL duplicate TOTP records');
        console.log('• Users may need to re-setup MFA after this fix');
        console.log('• The script includes comprehensive error handling');
        console.log('• All changes are logged in the audit_logs table');

        console.log('\n🔍 POST-DEPLOYMENT VERIFICATION:');
        console.log('=================================');
        console.log('1. Try setting up TOTP for pierre@phaetonai.com');
        console.log('2. Verify QR code generation works');
        console.log('3. Test TOTP verification with authenticator app');
        console.log('4. Check that no 400/406/409 errors occur');
        console.log('5. Verify audit logs are being created properly');

        // Create a simple test query for verification
        const testQuery = `
-- Verification Query - Run this after deployment
SELECT
    'Database Fix Status' as check_type,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'audit_logs' AND column_name = 'metadata'
        ) AND EXISTS (
            SELECT 1 FROM information_schema.routines
            WHERE routine_name = 'upsert_user_totp'
        ) AND EXISTS (
            SELECT 1 FROM user_totp
            WHERE user_id = 'c550502f-c39d-4bb3-bb8c-d193657fdb24'
        )
        THEN '✅ ALL FIXES APPLIED SUCCESSFULLY'
        ELSE '❌ SOME FIXES MISSING - CHECK DEPLOYMENT'
    END as status;
        `;

        // Write verification query to file
        fs.writeFileSync(
            path.join(__dirname, 'verify-totp-fix.sql'),
            testQuery.trim()
        );

        console.log('\n📁 FILES CREATED:');
        console.log('==================');
        console.log('• TOTP_DATABASE_CRITICAL_FIX.sql - Main fix script');
        console.log('• verify-totp-fix.sql - Post-deployment verification');

        console.log('\n🎉 Deployment script preparation completed!');
        console.log('Run the SQL script in Supabase Dashboard to apply fixes.');

    } catch (error) {
        console.error('❌ ERROR during deployment preparation:', error.message);
        process.exit(1);
    }
}

// Run the deployment
deployTOTPFix().catch(console.error);