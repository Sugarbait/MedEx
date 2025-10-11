import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findCheryl() {
  console.log('🔍 Searching for Cheryl user...\n');

  // Search by name
  const { data: byName, error: nameError } = await supabase
    .from('users')
    .select('*')
    .ilike('name', '%cheryl%');

  console.log('📋 Search by name (LIKE %cheryl%):');
  if (nameError) {
    console.log(`   ❌ Error: ${nameError.message}`);
  } else if (byName && byName.length > 0) {
    byName.forEach(u => {
      console.log(`   ✅ Found: ${u.name || u.email}`);
      console.log(`      Email: ${u.email}`);
      console.log(`      Tenant: ${u.tenant_id}`);
      console.log(`      Role: ${u.role}`);
      console.log(`      ID: ${u.id}`);
      console.log('');
    });
  } else {
    console.log('   ⚠️  No users found with name containing "cheryl"\n');
  }

  // Search by email
  const { data: byEmail, error: emailError } = await supabase
    .from('users')
    .select('*')
    .ilike('email', '%cheryl%');

  console.log('📋 Search by email (LIKE %cheryl%):');
  if (emailError) {
    console.log(`   ❌ Error: ${emailError.message}`);
  } else if (byEmail && byEmail.length > 0) {
    byEmail.forEach(u => {
      console.log(`   ✅ Found: ${u.name || u.email}`);
      console.log(`      Email: ${u.email}`);
      console.log(`      Tenant: ${u.tenant_id}`);
      console.log(`      Role: ${u.role}`);
      console.log('');
    });
  } else {
    console.log('   ⚠️  No users found with email containing "cheryl"\n');
  }

  // Get ALL users to see what's there
  const { data: allUsers, error: allError } = await supabase
    .from('users')
    .select('id, email, name, tenant_id, role')
    .order('created_at', { ascending: true });

  console.log('📋 ALL users in database:');
  if (allError) {
    console.log(`   ❌ Error: ${allError.message}`);
  } else {
    console.log(`   Total: ${allUsers.length} users\n`);
    allUsers.forEach((u, i) => {
      console.log(`   ${i + 1}. ${u.name || '(no name)'}`);
      console.log(`      Email: ${u.email}`);
      console.log(`      Tenant: ${u.tenant_id}`);
      console.log(`      Role: ${u.role}`);
      console.log('');
    });
  }
}

findCheryl();
