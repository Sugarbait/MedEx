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

async function check() {
  console.log('🔍 All MedEx Users:\n');

  const { data, error } = await supabase
    .from('users')
    .select('email, is_active, role, created_at')
    .eq('tenant_id', 'medex')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Total:', data.length, 'users\n');

  const pending = data.filter(u => !u.is_active);
  const active = data.filter(u => u.is_active);

  if (pending.length > 0) {
    console.log('📋 PENDING USERS (Awaiting Approval):');
    console.log('=====================================');
    pending.forEach((u, i) => {
      console.log(`${i + 1}. ${u.email}`);
      console.log(`   Role: ${u.role}`);
      console.log(`   Status: PENDING APPROVAL\n`);
    });
  } else {
    console.log('✅ No pending users\n');
  }

  if (active.length > 0) {
    console.log('✅ ACTIVE USERS (Can Log In):');
    console.log('=============================');
    active.forEach((u, i) => {
      console.log(`${i + 1}. ${u.email}`);
      console.log(`   Role: ${u.role}`);
      console.log(`   Status: ACTIVE\n`);
    });
  }
}

check();
