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

  console.log('Supabase Auth Users:');
  console.log('===================\n');

  authUsers.users.forEach((u) => {
    console.log(`Email: ${u.email}`);
    console.log(`ID: ${u.id}`);
    console.log(`Created: ${new Date(u.created_at).toLocaleString()}\n`);
  });

  console.log(`Total: ${authUsers.users.length} users in Auth`);
}

checkAuth();
