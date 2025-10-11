import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function getColumns() {
  console.log('=== GETTING ACTUAL TABLE COLUMNS ===\n');

  // Try inserting with minimal data
  console.log('Test 1: Insert with only email and attempted_at...');
  const { data: test1, error: error1 } = await supabase
    .from('failed_login_attempts')
    .insert({
      email: 'test@test.com',
      attempted_at: new Date().toISOString()
    })
    .select();

  if (error1) {
    console.error('❌ Error:', error1.message);
  } else {
    console.log('✅ Success! Columns in returned data:', Object.keys(test1[0]));
  }

  // Try with different column names
  console.log('\nTest 2: Try with different column variations...');
  const possibleColumns = {
    email: 'test2@test.com',
    attempted_at: new Date().toISOString(),
    ip_address: '127.0.0.1',
    user_agent: 'Test'
  };

  const { data: test2, error: error2 } = await supabase
    .from('failed_login_attempts')
    .insert(possibleColumns)
    .select();

  if (error2) {
    console.error('❌ Error:', error2.message);
  } else {
    console.log('✅ Success! Inserted with columns:', Object.keys(test2[0]));
  }

  // Clean up test data
  console.log('\nCleaning up test data...');
  await supabase
    .from('failed_login_attempts')
    .delete()
    .in('email', ['test@test.com', 'test2@test.com']);
  console.log('✅ Cleanup done');
}

getColumns()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
  });
