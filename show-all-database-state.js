import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function showAllData() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 COMPLETE DATABASE STATE - USERS TABLE');
  console.log('='.repeat(80));

  // Get ALL users from database (no filters)
  const { data: allDbUsers, error: dbError } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: true });

  if (dbError) {
    console.log('❌ Database Error:', dbError.message);
  } else if (!allDbUsers || allDbUsers.length === 0) {
    console.log('❌ NO USERS found in database');
  } else {
    console.log(`\n✅ Total users in database: ${allDbUsers.length}\n`);

    // Group by tenant
    const medexUsers = allDbUsers.filter(u => u.tenant_id === 'medex');
    const carexpsUsers = allDbUsers.filter(u => u.tenant_id === 'carexps');
    const noTenantUsers = allDbUsers.filter(u => !u.tenant_id);
    const otherTenantUsers = allDbUsers.filter(u => u.tenant_id && u.tenant_id !== 'medex' && u.tenant_id !== 'carexps');

    console.log('📋 MEDEX USERS (tenant_id = "medex"):');
    console.log('-'.repeat(80));
    if (medexUsers.length === 0) {
      console.log('  (none)');
    } else {
      medexUsers.forEach((user, index) => {
        console.log(`\n  ${index + 1}. ${user.email}`);
        console.log(`     ID: ${user.id}`);
        console.log(`     Name: ${user.name || '(no name)'}`);
        console.log(`     Role: ${user.role}`);
        console.log(`     Is Active: ${user.is_active}`);
        console.log(`     MFA Enabled: ${user.mfa_enabled}`);
        console.log(`     Last Login: ${user.last_login || '(never)'}`);
        console.log(`     Created: ${user.created_at}`);
      });
    }

    console.log('\n\n📋 CAREXPS USERS (tenant_id = "carexps"):');
    console.log('-'.repeat(80));
    if (carexpsUsers.length === 0) {
      console.log('  (none)');
    } else {
      carexpsUsers.forEach((user, index) => {
        console.log(`\n  ${index + 1}. ${user.email}`);
        console.log(`     ID: ${user.id}`);
        console.log(`     Name: ${user.name || '(no name)'}`);
        console.log(`     Role: ${user.role}`);
        console.log(`     Is Active: ${user.is_active}`);
      });
    }

    if (noTenantUsers.length > 0) {
      console.log('\n\n⚠️  USERS WITHOUT TENANT_ID:');
      console.log('-'.repeat(80));
      noTenantUsers.forEach((user, index) => {
        console.log(`\n  ${index + 1}. ${user.email}`);
        console.log(`     ID: ${user.id}`);
        console.log(`     Tenant: (NULL)`);
      });
    }

    if (otherTenantUsers.length > 0) {
      console.log('\n\n⚠️  USERS WITH OTHER TENANT_ID:');
      console.log('-'.repeat(80));
      otherTenantUsers.forEach((user, index) => {
        console.log(`\n  ${index + 1}. ${user.email}`);
        console.log(`     ID: ${user.id}`);
        console.log(`     Tenant: ${user.tenant_id}`);
      });
    }
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('🔐 SUPABASE AUTH USERS');
  console.log('='.repeat(80));

  const { data: authData } = await supabase.auth.admin.listUsers();
  const authUsers = authData.users;

  if (!authUsers || authUsers.length === 0) {
    console.log('❌ NO USERS found in Supabase Auth');
  } else {
    console.log(`\n✅ Total users in Auth: ${authUsers.length}\n`);

    authUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);
      console.log(`   Last Sign In: ${user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : '(never)'}`);
      console.log('');
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('🔍 MISMATCH ANALYSIS (Auth vs Database)');
  console.log('='.repeat(80));

  const dbEmails = new Set(allDbUsers?.map(u => u.email) || []);
  const authEmails = new Set(authUsers?.map(u => u.email) || []);

  // Users in Auth but NOT in database
  const authOnly = authUsers?.filter(u => !dbEmails.has(u.email)) || [];

  // Users in Database but NOT in Auth
  const dbOnly = allDbUsers?.filter(u => !authEmails.has(u.email)) || [];

  if (authOnly.length > 0) {
    console.log('\n🚨 USERS IN AUTH BUT NOT IN DATABASE:');
    console.log('-'.repeat(80));
    authOnly.forEach((user, index) => {
      console.log(`\n  ${index + 1}. ${user.email}`);
      console.log(`     Auth ID: ${user.id}`);
      console.log(`     Created: ${new Date(user.created_at).toLocaleString()}`);
      console.log(`     ⚠️  This user CANNOT log in (missing database record)`);
    });
  } else {
    console.log('\n✅ All Auth users have database records');
  }

  if (dbOnly.length > 0) {
    console.log('\n\n⚠️  USERS IN DATABASE BUT NOT IN AUTH:');
    console.log('-'.repeat(80));
    dbOnly.forEach((user, index) => {
      console.log(`\n  ${index + 1}. ${user.email}`);
      console.log(`     DB ID: ${user.id}`);
      console.log(`     Tenant: ${user.tenant_id}`);
      console.log(`     ⚠️  This user CANNOT log in (missing Auth record)`);
    });
  } else {
    console.log('\n✅ All database users have Auth records');
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('📈 SUMMARY');
  console.log('='.repeat(80));
  console.log(`Database Users Total: ${allDbUsers?.length || 0}`);
  console.log(`  - MedEx Tenant: ${medexUsers?.length || 0}`);
  console.log(`  - CareXPS Tenant: ${carexpsUsers?.length || 0}`);
  console.log(`Auth Users Total: ${authUsers?.length || 0}`);
  console.log(`Mismatches: ${authOnly.length + dbOnly.length}`);

  if (authOnly.length > 0 || dbOnly.length > 0) {
    console.log('\n⚠️  ACTION REQUIRED: Fix mismatches to ensure all users can log in');
  } else {
    console.log('\n✅ All users properly synchronized between Auth and Database');
  }

  console.log('\n' + '='.repeat(80));
}

showAllData();
