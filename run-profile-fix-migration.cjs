/**
 * Run the profile fix migration to resolve RLS and schema issues
 */

const fs = require('fs')
const path = require('path')

// Read the migration SQL
const migrationPath = path.join(__dirname, 'src', 'migrations', 'fix_user_profiles_rls.sql')
const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

console.log('🔧 Profile Fix Migration')
console.log('========================')
console.log('This migration will:')
console.log('1. Fix RLS policies for user_profiles table')
console.log('2. Add missing MFA columns to users table')
console.log('3. Allow service role access for profile operations')
console.log('')
console.log('To run this migration in Supabase:')
console.log('1. Go to your Supabase project dashboard')
console.log('2. Navigate to SQL Editor')
console.log('3. Copy and paste the following SQL:')
console.log('')
console.log('--- START MIGRATION SQL ---')
console.log(migrationSQL)
console.log('--- END MIGRATION SQL ---')
console.log('')
console.log('4. Click "RUN" to execute the migration')
console.log('')
console.log('This will resolve the profile saving issues you\'re experiencing.')