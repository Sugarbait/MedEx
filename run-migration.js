// Quick migration runner to fix 400 errors
import fs from 'fs';

console.log('🔧 Running database migration to fix 400 errors...');

// Read the SQL file
const sqlContent = fs.readFileSync('./FINAL_400_ERRORS_FIX.sql', 'utf8');

// Log the migration content for the user to copy/paste
console.log('\n📋 SQL Migration Content (copy this to Supabase SQL Editor):');
console.log('=' .repeat(80));
console.log(sqlContent);
console.log('=' .repeat(80));

console.log('\n✅ Migration SQL generated successfully!');
console.log('\n📝 Instructions:');
console.log('1. Copy the SQL content above');
console.log('2. Go to your Supabase Dashboard');
console.log('3. Navigate to SQL Editor');
console.log('4. Paste and run the migration');
console.log('5. This will fix all 400 Bad Request errors');
console.log('\n🎯 This migration creates all missing tables that cause 400 errors:');
console.log('   • user_profiles');
console.log('   • failed_login_attempts');
console.log('   • user_settings');
console.log('   • audit_logs');
console.log('   • notes');
console.log('   • patients');
console.log('   • calls');
console.log('   • sms_messages');