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
  const { data } = await supabase
    .from('users')
    .select('email, is_active, role, created_at')
    .eq('tenant_id', 'medex')
    .order('created_at', { ascending: true });

  console.log('MedEx Users:');
  console.log('============');
  data.forEach(u => {
    const status = u.is_active ? 'ACTIVE  ' : 'PENDING ';
    console.log(`${status} | ${u.email.padEnd(25)} | ${u.role}`);
  });
}

check();
