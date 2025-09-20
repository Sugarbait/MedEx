import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  console.log('Please ensure these environment variables are set:')
  console.log('- VITE_SUPABASE_URL')
  console.log('- VITE_SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function testConnection() {
  console.log('🔍 Testing Supabase connection...')
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count(*)')
      .limit(1)

    if (error) {
      console.log('⚠️  Database connection established, but tables may not exist yet')
      console.log('   Error:', error.message)
      return false
    } else {
      console.log('✅ Database connection successful')
      return true
    }
  } catch (err) {
    console.error('❌ Failed to connect to database:', err.message)
    return false
  }
}

async function createSampleData() {
  console.log('\n📝 Creating sample data...')

  try {
    // Create a sample admin user
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .insert([
        {
          azure_ad_id: 'admin-test-001',
          email: 'admin@carexps.com',
          name: 'CareXPS Administrator',
          role: 'admin',
          mfa_enabled: true,
          is_active: true
        }
      ])
      .select()

    if (adminError && !adminError.message.includes('duplicate')) {
      console.log('⚠️  Could not create admin user:', adminError.message)
    } else {
      console.log('✅ Sample admin user created/exists')
    }

    // Create a sample healthcare provider
    const { data: providerUser, error: providerError } = await supabase
      .from('users')
      .insert([
        {
          azure_ad_id: 'provider-test-001',
          email: 'provider@carexps.com',
          name: 'Dr. Sarah Johnson',
          role: 'healthcare_provider',
          mfa_enabled: true,
          is_active: true
        }
      ])
      .select()

    if (providerError && !providerError.message.includes('duplicate')) {
      console.log('⚠️  Could not create provider user:', providerError.message)
    } else {
      console.log('✅ Sample healthcare provider created/exists')
    }

    // Create sample SMS templates
    const { data: templates, error: templateError } = await supabase
      .from('sms_templates')
      .insert([
        {
          name: 'Appointment Reminder',
          content: 'Hi {patient_name}, this is a reminder about your appointment tomorrow at {appointment_time}. Please call us if you need to reschedule.',
          category: 'appointment',
          is_approved: true,
          variables: ['patient_name', 'appointment_time'],
          created_by: adminUser?.[0]?.id || 'admin-test-001'
        },
        {
          name: 'Welcome Message',
          content: 'Welcome to CareXPS Healthcare! We\'re here to provide you with excellent care. If you have any questions, please don\'t hesitate to contact us.',
          category: 'welcome',
          is_approved: true,
          variables: [],
          created_by: adminUser?.[0]?.id || 'admin-test-001'
        }
      ])
      .select()

    if (templateError && !templateError.message.includes('duplicate')) {
      console.log('⚠️  Could not create SMS templates:', templateError.message)
    } else {
      console.log('✅ Sample SMS templates created/exist')
    }

    console.log('✅ Sample data creation completed')

  } catch (error) {
    console.error('❌ Error creating sample data:', error.message)
  }
}

async function testRLSPolicies() {
  console.log('\n🛡️  Testing RLS policies...')

  try {
    // Test anonymous access (should be restricted)
    const anonSupabase = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || '', {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const { data: anonData, error: anonError } = await anonSupabase
      .from('users')
      .select('*')
      .limit(1)

    if (anonError) {
      console.log('✅ RLS is working - anonymous access properly restricted')
    } else if (anonData && anonData.length === 0) {
      console.log('✅ RLS is working - no data returned for anonymous user')
    } else {
      console.log('⚠️  RLS may not be working properly - anonymous user can access data')
    }

    // Test service role access (should work)
    const { data: serviceData, error: serviceError } = await supabase
      .from('users')
      .select('count(*)')
      .limit(1)

    if (!serviceError) {
      console.log('✅ Service role access working correctly')
    } else {
      console.log('⚠️  Service role access issue:', serviceError.message)
    }

  } catch (error) {
    console.error('❌ Error testing RLS policies:', error.message)
  }
}

async function testEncryptionFunctions() {
  console.log('\n🔐 Testing PHI encryption functions...')

  try {
    // Test encryption function
    const { data: encryptResult, error: encryptError } = await supabase
      .rpc('encrypt_phi', { data: 'Test Patient Name' })

    if (encryptError) {
      console.log('⚠️  Encryption function may not be available:', encryptError.message)
    } else {
      console.log('✅ PHI encryption function working')

      // Test decryption function
      const { data: decryptResult, error: decryptError } = await supabase
        .rpc('decrypt_phi', { encrypted_data: encryptResult })

      if (decryptError) {
        console.log('⚠️  Decryption function may not be available:', decryptError.message)
      } else if (decryptResult === 'Test Patient Name') {
        console.log('✅ PHI decryption function working correctly')
      } else {
        console.log('⚠️  Decryption result does not match original data')
      }
    }

  } catch (error) {
    console.error('❌ Error testing encryption functions:', error.message)
  }
}

async function generateSetupReport() {
  console.log('\n📊 Generating setup report...')

  try {
    // Count tables and records
    const tables = [
      'users',
      'user_permissions',
      'user_settings',
      'patients',
      'calls',
      'sms_messages',
      'sms_templates',
      'security_events',
      'audit_logs',
      'user_sessions',
      'mfa_challenges',
      'failed_login_attempts',
      'data_retention_policies',
      'compliance_assessments'
    ]

    console.log('\n📋 Database Table Status:')
    console.log('─'.repeat(50))

    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })

        if (error) {
          console.log(`❌ ${table.padEnd(25)} - Error: ${error.message}`)
        } else {
          console.log(`✅ ${table.padEnd(25)} - ${count || 0} records`)
        }
      } catch (err) {
        console.log(`❌ ${table.padEnd(25)} - Exception: ${err.message}`)
      }
    }

    console.log('─'.repeat(50))

  } catch (error) {
    console.error('❌ Error generating setup report:', error.message)
  }
}

async function main() {
  console.log('🚀 CareXPS Healthcare CRM Database Setup & Test')
  console.log('=' .repeat(60))
  console.log(`📍 Database URL: ${supabaseUrl}`)
  console.log()

  // Test connection
  const connected = await testConnection()

  if (connected) {
    // Create sample data
    await createSampleData()

    // Test RLS policies
    await testRLSPolicies()

    // Test encryption functions
    await testEncryptionFunctions()

    // Generate setup report
    await generateSetupReport()

    console.log('\n🎉 Database setup and testing completed!')
    console.log('\n📋 Next Steps:')
    console.log('1. Run the complete_setup.sql script in Supabase SQL Editor if you haven\'t already')
    console.log('2. Run the remaining migration scripts for RLS policies, encryption functions, etc.')
    console.log('3. Set up your application authentication with Azure AD')
    console.log('4. Configure real-time subscriptions in your frontend')
    console.log('5. Test your application end-to-end')

  } else {
    console.log('\n❌ Database connection failed. Please:')
    console.log('1. Verify your Supabase credentials in .env.local')
    console.log('2. Run the complete_setup.sql script in Supabase SQL Editor')
    console.log('3. Try running this test again')
  }
}

// Run the setup if this file is executed directly
if (process.argv[1].endsWith('database_setup.js')) {
  main().catch(console.error)
}

export { testConnection, createSampleData, testRLSPolicies, testEncryptionFunctions }