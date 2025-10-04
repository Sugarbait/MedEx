/**
 * Generate Encryption Keys for MedEx CRM
 * Creates secure random keys for PHI and Audit encryption
 */

import crypto from 'crypto'

function generateSecureKey() {
  // Generate 32 bytes (256 bits) of random data
  const key = crypto.randomBytes(32).toString('base64')
  return key
}

console.log('🔐 MedEx CRM - Encryption Keys Generator\n')
console.log('=' .repeat(60))
console.log('\n📋 Copy these values to your GitHub Secrets:\n')

const phiKey = generateSecureKey()
const auditKey = generateSecureKey()

console.log('VITE_PHI_ENCRYPTION_KEY:')
console.log(phiKey)
console.log('\nVITE_AUDIT_ENCRYPTION_KEY:')
console.log(auditKey)

console.log('\n' + '='.repeat(60))
console.log('\n✅ Keys generated successfully!')
console.log('\n📝 Instructions:')
console.log('1. Go to: https://github.com/Sugarbait/MedEx/settings/secrets/actions')
console.log('2. Click "New repository secret"')
console.log('3. Add VITE_PHI_ENCRYPTION_KEY with the first key above')
console.log('4. Add VITE_AUDIT_ENCRYPTION_KEY with the second key above')
console.log('\n⚠️  IMPORTANT: Store these keys securely!')
console.log('   If lost, encrypted data cannot be recovered.')
console.log('\n')
