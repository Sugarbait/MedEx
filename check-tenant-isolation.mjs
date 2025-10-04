import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cpkslvmydfdevdftieck.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjkwMDI5NSwiZXhwIjoyMDYyNDc2Mjk1fQ.5Nwr-DrgL63DwPMH2egxgdjoHGhAxCvIrz2SMTMKqD0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTenantIsolation() {
  console.log('🔍 Checking tenant isolation breach...\n');

  // Check admin@phaetonai.com user
  const { data: adminUser, error: adminError } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'admin@phaetonai.com')
    .single();

  if (adminError) {
    console.error('❌ Error fetching admin user:', adminError);
  } else {
    console.log('📧 admin@phaetonai.com details:');
    console.log('   - User ID:', adminUser.id);
    console.log('   - Tenant ID:', adminUser.tenant_id);
    console.log('   - Name:', adminUser.name);
    console.log('   - Role:', adminUser.role);
    console.log('   - Created:', adminUser.created_at);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Check all users by tenant
  const { data: allUsers, error: usersError } = await supabase
    .from('users')
    .select('id, email, tenant_id, name, role')
    .order('tenant_id', { ascending: true });

  if (usersError) {
    console.error('❌ Error fetching all users:', usersError);
  } else {
    console.log('👥 All users grouped by tenant:\n');

    const byTenant = allUsers.reduce((acc, user) => {
      const tenant = user.tenant_id || 'NO_TENANT';
      if (!acc[tenant]) acc[tenant] = [];
      acc[tenant].push(user);
      return acc;
    }, {});

    Object.entries(byTenant).forEach(([tenant, users]) => {
      console.log(`📁 Tenant: ${tenant} (${users.length} users)`);
      users.forEach(user => {
        console.log(`   - ${user.email} (${user.role || 'no role'})`);
      });
      console.log('');
    });
  }

  console.log('='.repeat(60) + '\n');

  // Check CareXPS users specifically
  const { data: carexpsUsers, error: carexpsError } = await supabase
    .from('users')
    .select('id, email, name, role')
    .eq('tenant_id', 'carexps');

  if (carexpsError) {
    console.error('❌ Error fetching CareXPS users:', carexpsError);
  } else {
    console.log(`🏢 CareXPS Users (tenant_id = 'carexps'): ${carexpsUsers.length} users`);
    carexpsUsers.forEach(user => {
      console.log(`   - ${user.email} (${user.role || 'no role'})`);
    });
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Check MedEx users specifically
  const { data: medexUsers, error: medexError } = await supabase
    .from('users')
    .select('id, email, name, role')
    .eq('tenant_id', 'medex');

  if (medexError) {
    console.error('❌ Error fetching MedEx users:', medexError);
  } else {
    console.log(`🏥 MedEx Users (tenant_id = 'medex'): ${medexUsers.length} users`);
    medexUsers.forEach(user => {
      console.log(`   - ${user.email} (${user.role || 'no role'})`);
    });
  }
}

checkTenantIsolation().catch(console.error);
