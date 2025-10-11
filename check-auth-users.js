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

async function checkAuth() {
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  
  console.log('All users in Supabase Auth:');
  console.log('===========================\n');
  
  authUsers.users.forEach((u, i) => {
    console.log(`${i + 1}. ${u.email}`);
    console.log(`   ID: ${u.id}`);
    console.log(`   Created: ${new Date(u.created_at).toLocaleString()}\n`);
  });
  
  console.log(`Total: ${authUsers.users.length} users in Auth`);
}

checkAuth();
