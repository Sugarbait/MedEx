import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://onwgbfetzrctshdwwimm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjc2NTMzOTUsImV4cCI6MjA0MzIyOTM5NX0.w5E5_dkCCbWcD5H3dON5_nO5MqJqZ5Zg5Nxg5g5g';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRLS() {
  console.log('🔍 Checking user_profiles table structure and RLS policies...\n');

  // First, try to query the table directly to see what happens
  console.log('1. Testing direct SELECT query:');
  const { data: testData, error: testError } = await supabase
    .from('user_profiles')
    .select('*')
    .limit(1);

  if (testError) {
    console.error('   ❌ SELECT Error:', testError.message);
    console.error('   Error code:', testError.code);
    console.error('   Details:', testError.details);
  } else {
    console.log('   ✅ SELECT works, rows:', testData?.length || 0);
  }

  // Test INSERT
  console.log('\n2. Testing INSERT query:');
  const testUserId = 'test-user-' + Date.now();
  const { data: insertData, error: insertError } = await supabase
    .from('user_profiles')
    .insert({
      user_id: testUserId,
      password: 'test-password-hash',
      updated_at: new Date().toISOString()
    })
    .select();

  if (insertError) {
    console.error('   ❌ INSERT Error:', insertError.message);
    console.error('   Error code:', insertError.code);
    console.error('   Details:', insertError.details);
  } else {
    console.log('   ✅ INSERT works');

    // Clean up test data
    await supabase
      .from('user_profiles')
      .delete()
      .eq('user_id', testUserId);
  }

  // Check table schema
  console.log('\n3. Checking table schema:');
  const { data: columns, error: columnsError } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable')
    .eq('table_name', 'user_profiles')
    .eq('table_schema', 'public');

  if (columnsError) {
    console.error('   ❌ Schema Error:', columnsError.message);
  } else if (columns) {
    console.log('   Columns:');
    columns.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
  }
}

checkRLS().catch(console.error);
