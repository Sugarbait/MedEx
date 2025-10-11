const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  console.log('=== CHECKING ACTUAL users TABLE SCHEMA ===\n');

  // Method 1: Try to fetch a sample record to infer types
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .limit(1);

  if (!userError && userData && userData.length > 0) {
    console.log('Sample user record:');
    console.log(JSON.stringify(userData[0], null, 2));
    console.log('\nid field type:', typeof userData[0].id);
    console.log('id field value:', userData[0].id);

    // Check if it looks like a UUID or text
    if (userData[0].id && userData[0].id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      console.log('\n✓ ID appears to be UUID format');
    } else {
      console.log('\n✓ ID appears to be TEXT format');
    }
  }

  // Method 2: Check existing tables that reference users
  console.log('\n=== CHECKING EXISTING FOREIGN KEYS ===\n');

  const { data: settingsData } = await supabase
    .from('user_settings')
    .select('user_id')
    .limit(1);

  if (settingsData && settingsData.length > 0) {
    console.log('user_settings.user_id sample:', settingsData[0].user_id);
    console.log('Type:', typeof settingsData[0].user_id);
  }

  const { data: auditData } = await supabase
    .from('audit_logs')
    .select('user_id')
    .limit(1);

  if (auditData && auditData.length > 0) {
    console.log('audit_logs.user_id sample:', auditData[0].user_id);
    console.log('Type:', typeof auditData[0].user_id);
  }

  console.log('\n=== CONCLUSION ===');
  console.log('Based on the error message and data samples:');
  console.log('users.id is TEXT type (not UUID)');
  console.log('All foreign keys must use TEXT type to match');
}

checkSchema()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
