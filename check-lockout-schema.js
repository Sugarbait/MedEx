const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function checkLockoutSchema() {
  console.log('=== CHECKING LOCKOUT SCHEMA ===\n');

  // 1. Get one user to see all available columns
  const { data: oneUser, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('tenant_id', 'medex')
    .limit(1)
    .single();

  if (oneUser) {
    console.log('--- Users Table Columns ---');
    console.log(Object.keys(oneUser).sort().join(', '));
    console.log('');

    // Check for lockout-related columns
    const lockoutColumns = Object.keys(oneUser).filter(key =>
      key.includes('lock') ||
      key.includes('attempt') ||
      key.includes('failed')
    );

    if (lockoutColumns.length > 0) {
      console.log('--- Lockout-Related Columns Found ---');
      lockoutColumns.forEach(col => {
        console.log(`  ${col}: ${oneUser[col]}`);
      });
    } else {
      console.log('--- No Lockout-Related Columns Found in Users Table ---');
    }
  } else {
    console.log('No users found in database');
  }

  console.log('\n--- Failed Login Attempts Table ---');
  const { data: attempts, error: attemptsError } = await supabase
    .from('failed_login_attempts')
    .select('*')
    .limit(1);

  if (attemptsError) {
    console.log('Error or table does not exist:', attemptsError.message);
  } else if (attempts && attempts.length > 0) {
    console.log('Table exists with columns:', Object.keys(attempts[0]).join(', '));
  } else {
    console.log('Table exists but is empty');
  }

  // 3. Check all users for their lockout status
  console.log('\n--- All MedEx Users Lockout Status ---');
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, email, is_active')
    .eq('tenant_id', 'medex');

  if (allUsers) {
    for (const user of allUsers) {
      // Check failed login attempts for this user
      const { data: userAttempts } = await supabase
        .from('failed_login_attempts')
        .select('*')
        .eq('email', user.email)
        .gte('attempted_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());

      console.log(`${user.email}:`);
      console.log(`  is_active: ${user.is_active}`);
      console.log(`  recent failed attempts: ${userAttempts?.length || 0}`);
      console.log(`  should be locked: ${(userAttempts?.length || 0) >= 3}`);
    }
  }
}

checkLockoutSchema()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
