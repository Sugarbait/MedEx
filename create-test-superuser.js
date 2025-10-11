#!/usr/bin/env node

/**
 * Create Test Super User
 * Creates a test super user account for MedEx CRM
 * Run this AFTER tables are created
 */

const SUPABASE_URL = 'https://onwgbfetzrctshdwwimm.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk4MDk4NiwiZXhwIjoyMDc1NTU2OTg2fQ.uCxrGkQJQjR3wCmmCo3A6Oi6zBY-QdMX1hLZmD5HvZA';

// Crypto for password hashing (Node.js built-in)
import crypto from 'crypto';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function createTestUser() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('CREATE TEST SUPER USER');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  const testUser = {
    id: 'test-super-user-' + Date.now(),
    email: 'admin@medex.local',
    name: 'Test Admin',
    username: 'admin',
    first_name: 'Test',
    last_name: 'Admin',
    role: 'super_user',
    is_active: true,
    tenant_id: 'medex',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const testPassword = 'Admin123!'; // Change this to your desired password
  const hashedPassword = hashPassword(testPassword);

  console.log('Creating test user:');
  console.log('  Email:', testUser.email);
  console.log('  Password:', testPassword);
  console.log('  Role:', testUser.role);
  console.log('  Tenant:', testUser.tenant_id);
  console.log('');

  // Step 1: Create user record
  console.log('Step 1: Creating user record...');
  try {
    const userResponse = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(testUser)
    });

    if (!userResponse.ok) {
      const error = await userResponse.json();
      console.log('  ❌ Failed to create user');
      console.log('  Error:', JSON.stringify(error, null, 2));
      return;
    }

    const userData = await userResponse.json();
    console.log('  ✅ User created successfully');
    console.log('  User ID:', userData[0]?.id || testUser.id);
    console.log('');

    // Step 2: Create user credentials
    console.log('Step 2: Creating user credentials...');
    const credentialsResponse = await fetch(`${SUPABASE_URL}/rest/v1/user_credentials`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        user_id: testUser.id,
        password: hashedPassword,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    });

    if (!credentialsResponse.ok) {
      const error = await credentialsResponse.json();
      console.log('  ❌ Failed to create credentials');
      console.log('  Error:', JSON.stringify(error, null, 2));
      return;
    }

    console.log('  ✅ Credentials created successfully');
    console.log('');

    // Step 3: Create user settings
    console.log('Step 3: Creating user settings...');
    const settingsResponse = await fetch(`${SUPABASE_URL}/rest/v1/user_settings`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        user_id: testUser.id,
        theme: 'light',
        tenant_id: 'medex',
        notifications: { email: true, sms: false, push: true, in_app: true },
        security_preferences: { session_timeout: 15, require_mfa: false },
        communication_preferences: { default_method: 'phone' },
        accessibility_settings: { high_contrast: false, large_text: false },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_synced: new Date().toISOString()
      })
    });

    if (!settingsResponse.ok) {
      const error = await settingsResponse.json();
      console.log('  ⚠️  Failed to create settings (not critical)');
      console.log('  Error:', JSON.stringify(error, null, 2));
    } else {
      console.log('  ✅ Settings created successfully');
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('SUCCESS!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('Test user created successfully!');
    console.log('');
    console.log('Login credentials:');
    console.log('  📧 Email:', testUser.email);
    console.log('  🔑 Password:', testPassword);
    console.log('  👤 Role:', testUser.role);
    console.log('');
    console.log('You can now:');
    console.log('  1. Start the dev server: npm run dev');
    console.log('  2. Navigate to login page');
    console.log('  3. Login with the credentials above');
    console.log('');
    console.log('⚠️  IMPORTANT: Change this password after first login!');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');

  } catch (error) {
    console.log('❌ Error creating test user:', error.message);
    console.log('');
    console.log('Make sure:');
    console.log('  1. Tables are created (run medex-setup-new-database.sql)');
    console.log('  2. Database is accessible');
    console.log('  3. Service role key is correct');
  }
}

// Run the script
createTestUser().catch(console.error);
