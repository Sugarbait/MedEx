const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://onwgbfetzrctshdwwimm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjc2NTMzOTUsImV4cCI6MjA0MzIyOTM5NX0.wම5E5_dkCCbWcD5H3dON5_nO5MqJqZ5Zg5Nxg5g5g';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRLS() {
  console.log('🔍 Checking RLS policies on user_profiles table...\n');

  // First, check if table exists and RLS is enabled
  const { data: tableInfo, error: tableError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT
        c.relname AS table_name,
        c.relrowsecurity AS rls_enabled,
        c.relforcerowsecurity AS rls_forced
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = 'user_profiles'
        AND n.nspname = 'public'
    `
  });

  console.log('📊 Table Information:');
  if (tableInfo) {
    console.log(JSON.stringify(tableInfo, null, 2));
  }

  // Query pg_policies to get current RLS policies
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE tablename = 'user_profiles'
      ORDER BY policyname
    `
  });

  if (error) {
    console.error('❌ Error fetching policies:', error.message);
    console.error('Full error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('\n⚠️ No RLS policies found on user_profiles table');
    return;
  }

  console.log('\n📋 Current RLS Policies:');
  data.forEach((policy, index) => {
    console.log(`\n${index + 1}. Policy: ${policy.policyname}`);
    console.log(`   Permissive: ${policy.permissive}`);
    console.log(`   Command: ${policy.cmd}`);
    console.log(`   Roles: ${policy.roles}`);
    console.log(`   USING: ${policy.qual || 'N/A'}`);
    console.log(`   WITH CHECK: ${policy.with_check || 'N/A'}`);
  });
}

checkRLS().catch(console.error);
