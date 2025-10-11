const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://onwgbfetzrctshdwwimm.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk4MDk4NiwiZXhwIjoyMDc1NTU2OTg2fQ.uCxrGkQJQjR3wCmmCo3A6Oi6zBY-QdMX1hLZmD5HvZA';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function diagnoseLoginIssue() {
  console.log('=== MEDEX LOGIN ISSUE DIAGNOSTIC REPORT ===\n');
  
  // 1. Check Auth users
  console.log('1. CHECKING AUTH.USERS TABLE:');
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.error('❌ Error fetching auth users:', authError);
  } else {
    console.log(`✅ Found ${authUsers.users.length} users in auth.users`);
    authUsers.users.forEach(user => {
      console.log(`  - ID: ${user.id}`);
      console.log(`    Email: ${user.email}`);
      console.log(`    Created: ${user.created_at}`);
      console.log(`    Email Confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);
      console.log(`    Last Sign In: ${user.last_sign_in_at || 'Never'}`);
      console.log('');
    });
  }
  
  // 2. Check public.users table
  console.log('\n2. CHECKING PUBLIC.USERS TABLE:');
  const { data: publicUsers, error: publicError } = await supabase
    .from('users')
    .select('*')
    .eq('tenant_id', 'medex');
  
  if (publicError) {
    console.error('❌ Error fetching public users:', publicError);
  } else {
    console.log(`✅ Found ${publicUsers?.length || 0} users with tenant_id='medex'`);
    publicUsers?.forEach(user => {
      console.log(`  - ID: ${user.id}`);
      console.log(`    Email: ${user.email}`);
      console.log(`    Name: ${user.name || 'N/A'}`);
      console.log(`    Role: ${user.role}`);
      console.log(`    Active: ${user.is_active}`);
      console.log(`    Tenant ID: ${user.tenant_id}`);
      console.log('');
    });
  }
  
  // 3. Check user_credentials table
  console.log('\n3. CHECKING USER_CREDENTIALS TABLE:');
  const { data: credentials, error: credError } = await supabase
    .from('user_credentials')
    .select('*');
  
  if (credError) {
    console.error('❌ Error fetching credentials:', credError);
  } else {
    console.log(`✅ Found ${credentials?.length || 0} credential records`);
    credentials?.forEach(cred => {
      console.log(`  - User ID: ${cred.user_id}`);
      console.log(`    Has Password: ${cred.password ? 'Yes' : 'No'}`);
      console.log(`    Password Length: ${cred.password?.length || 0}`);
      console.log('');
    });
  }
  
  // 4. Check failed_login_attempts
  console.log('\n4. CHECKING FAILED_LOGIN_ATTEMPTS TABLE:');
  const { data: attempts, error: attemptsError } = await supabase
    .from('failed_login_attempts')
    .select('*')
    .order('attempted_at', { ascending: false })
    .limit(10);
  
  if (attemptsError) {
    console.error('❌ Error fetching login attempts:', attemptsError);
  } else {
    console.log(`✅ Found ${attempts?.length || 0} recent failed attempts`);
    attempts?.forEach(attempt => {
      console.log(`  - Email: ${attempt.email}`);
      console.log(`    Attempted: ${attempt.attempted_at}`);
      console.log(`    Error: ${attempt.error_message || 'N/A'}`);
      console.log('');
    });
  }
  
  // 5. Cross-reference check
  console.log('\n5. CROSS-REFERENCE ANALYSIS:');
  if (authUsers && publicUsers) {
    const authEmails = new Set(authUsers.users.map(u => u.email));
    const publicEmails = new Set(publicUsers.map(u => u.email));
    
    const inAuthNotPublic = [...authEmails].filter(e => !publicEmails.has(e));
    const inPublicNotAuth = [...publicEmails].filter(e => !authEmails.has(e));
    
    if (inAuthNotPublic.length > 0) {
      console.log('⚠️  Users in Auth but NOT in public.users:');
      inAuthNotPublic.forEach(email => console.log(`  - ${email}`));
    }
    
    if (inPublicNotAuth.length > 0) {
      console.log('⚠️  Users in public.users but NOT in Auth:');
      inPublicNotAuth.forEach(email => console.log(`  - ${email}`));
    }
    
    if (inAuthNotPublic.length === 0 && inPublicNotAuth.length === 0) {
      console.log('✅ All users are properly synced between Auth and public.users');
    }
  }
  
  console.log('\n=== END DIAGNOSTIC REPORT ===');
}

diagnoseLoginIssue().catch(console.error);
