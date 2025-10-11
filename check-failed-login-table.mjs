import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function checkTable() {
  console.log('=== CHECKING FAILED_LOGIN_ATTEMPTS TABLE ===\n');

  // Try to insert with error checking
  console.log('Attempting to insert test record...');
  const { data: insertData, error: insertError } = await supabase
    .from('failed_login_attempts')
    .insert({
      email: 'test@test.com',
      ip_address: '127.0.0.1',
      user_agent: 'TestScript',
      reason: 'Test',
      attempted_at: new Date().toISOString()
    })
    .select();

  if (insertError) {
    console.error('❌ Insert Error:', insertError);
    console.error('Details:', JSON.stringify(insertError, null, 2));
  } else {
    console.log('✅ Insert successful:', insertData);
  }

  // Try to query all records
  console.log('\nQuerying all records...');
  const { data: allData, error: queryError } = await supabase
    .from('failed_login_attempts')
    .select('*');

  if (queryError) {
    console.error('❌ Query Error:', queryError);
  } else {
    console.log(`✅ Found ${allData?.length || 0} total records`);
    if (allData && allData.length > 0) {
      console.log('Sample record:', allData[0]);
    }
  }

  // Check if table even exists by trying to describe it
  console.log('\nAttempting to get table info...');
  const { data: tableData, error: tableError } = await supabase
    .from('failed_login_attempts')
    .select('*')
    .limit(0);

  if (tableError) {
    console.error('❌ Table may not exist:', tableError);
  } else {
    console.log('✅ Table exists');
  }
}

checkTable()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
  });
