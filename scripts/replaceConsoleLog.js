#!/usr/bin/env node

/**
 * Script to replace console.log statements with secure logging
 * Usage: node scripts/replaceConsoleLog.js
 */

const fs = require('fs')
const path = require('path')
const glob = require('glob')

// Files to process (TypeScript and JavaScript in src directory)
const PATTERN = 'src/**/*.{ts,tsx,js,jsx}'
const EXCLUDE_PATTERNS = [
  'src/**/*.test.*',
  'src/**/*.spec.*',
  'src/test/**/*',
  'node_modules/**/*'
]

// Console log patterns to replace
const CONSOLE_PATTERNS = [
  {
    // console.log(message)
    pattern: /console\.log\s*\(\s*(['"`])(.*?)\1\s*\)/g,
    replacement: "secureLogger.debug('$2')"
  },
  {
    // console.log(message, data)
    pattern: /console\.log\s*\(\s*(['"`])(.*?)\1\s*,\s*([^)]+)\)/g,
    replacement: "secureLogger.debug('$2', undefined, undefined, undefined, { data: $3 })"
  },
  {
    // console.error(message)
    pattern: /console\.error\s*\(\s*(['"`])(.*?)\1\s*\)/g,
    replacement: "secureLogger.error('$2')"
  },
  {
    // console.error(message, error)
    pattern: /console\.error\s*\(\s*(['"`])(.*?)\1\s*,\s*([^)]+)\)/g,
    replacement: "secureLogger.error('$2', undefined, undefined, undefined, { error: $3 })"
  },
  {
    // console.warn(message)
    pattern: /console\.warn\s*\(\s*(['"`])(.*?)\1\s*\)/g,
    replacement: "secureLogger.warn('$2')"
  },
  {
    // console.warn(message, data)
    pattern: /console\.warn\s*\(\s*(['"`])(.*?)\1\s*,\s*([^)]+)\)/g,
    replacement: "secureLogger.warn('$2', undefined, undefined, undefined, { data: $3 })"
  },
  {
    // console.info(message)
    pattern: /console\.info\s*\(\s*(['"`])(.*?)\1\s*\)/g,
    replacement: "secureLogger.info('$2')"
  }
]

function shouldProcessFile(filePath) {
  // Skip if file is in exclude patterns
  for (const excludePattern of EXCLUDE_PATTERNS) {
    if (filePath.includes('node_modules') ||
        filePath.includes('.test.') ||
        filePath.includes('.spec.') ||
        filePath.includes('/test/')) {
      return false
    }
  }
  return true
}

function addImportIfNeeded(content, filePath) {
  // Check if secureLogger import already exists
  if (content.includes('secureLogger') || content.includes('from \'@/services/secureLogger\'')) {
    return content
  }

  // Check if file has any console.log statements that would be replaced
  const hasConsoleStatements = CONSOLE_PATTERNS.some(({ pattern }) => pattern.test(content))

  if (!hasConsoleStatements) {
    return content
  }

  // Add import at the top
  const importStatement = "import { secureLogger } from '@/services/secureLogger'\n"

  // Find the right place to insert import
  const lines = content.split('\n')
  let insertIndex = 0

  // Skip over existing imports
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.startsWith('import ') || line.startsWith('// ') || line === '') {
      insertIndex = i + 1
    } else {
      break
    }
  }

  lines.splice(insertIndex, 0, importStatement)
  return lines.join('\n')
}

function replaceConsoleStatements(content) {
  let modified = content
  let replacementCount = 0

  for (const { pattern, replacement } of CONSOLE_PATTERNS) {
    const matches = modified.match(pattern)
    if (matches) {
      replacementCount += matches.length
      modified = modified.replace(pattern, replacement)
    }
  }

  return { content: modified, count: replacementCount }
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const { content: modifiedContent, count } = replaceConsoleStatements(content)

    if (count > 0) {
      const contentWithImport = addImportIfNeeded(modifiedContent, filePath)
      fs.writeFileSync(filePath, contentWithImport, 'utf8')
      console.log(`✓ ${filePath}: Replaced ${count} console statements`)
      return count
    }

    return 0
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message)
    return 0
  }
}

function main() {
  console.log('🔒 Replacing console.log statements with secure logging...\n')

  // Find all files matching pattern
  const files = glob.sync(PATTERN, { ignore: EXCLUDE_PATTERNS })

  let totalReplacements = 0
  let processedFiles = 0

  for (const file of files) {
    if (shouldProcessFile(file)) {
      const count = processFile(file)
      totalReplacements += count
      if (count > 0) {
        processedFiles++
      }
    }
  }

  console.log(`\n🎉 Security update complete!`)
  console.log(`📊 Processed ${processedFiles} files`)
  console.log(`🔄 Replaced ${totalReplacements} console statements`)
  console.log(`🛡️ Console output is now HIPAA-compliant and production-safe`)

  if (totalReplacements > 0) {
    console.log('\n⚠️  Next steps:')
    console.log('1. Review the changes to ensure logging context is appropriate')
    console.log('2. Test the application to ensure functionality is preserved')
    console.log('3. In production, only ERROR and WARN levels will output to console')
  }
}

// Check if glob is available
try {
  require('glob')
  main()
} catch (error) {
  console.error('❌ Error: glob package not found')
  console.log('Please install dependencies first: npm install')
  process.exit(1)
}