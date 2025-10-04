import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cpkslvmydfdevdftieck.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjkwMDI5NSwiZXhwIjoyMDYyNDc2Mjk1fQ.5Nwr-DrgL63DwPMH2egxgdjoHGhAxCvIrz2SMTMKqD0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
  console.log('🔍 Checking users table schema...\n');

  // Get one user to inspect columns
  const { data: sampleUser, error } = await supabase
    .from('users')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    console.error('❌ Error:', error);
  } else {
    console.log('📋 Users table columns:');
    Object.keys(sampleUser).forEach(col => {
      console.log(`   - ${col}: ${typeof sampleUser[col]} = ${sampleUser[col]}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('🔍 Checking other tables for tenant_id...\n');

  // Check user_settings table
  const { data: settings } = await supabase
    .from('user_settings')
    .select('*')
    .limit(1)
    .single();

  if (settings) {
    console.log('📋 user_settings columns:', Object.keys(settings).filter(k => k.includes('tenant')));
  }

  // Check audit_logs table
  const { data: audit } = await supabase
    .from('audit_logs')
    .select('*')
    .limit(1)
    .single();

  if (audit) {
    console.log('📋 audit_logs columns:', Object.keys(audit).filter(k => k.includes('tenant')));
  }
}

checkSchema().catch(console.error);
