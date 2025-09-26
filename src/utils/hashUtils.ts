/**
 * CRYPTOGRAPHIC HASH UTILITIES
 *
 * Secure hash generation and verification utilities using Web Crypto API
 * for integrity monitoring and verification. Provides consistent, secure
 * hashing for file integrity checks and data verification.
 *
 * Features:
 * - SHA-256, SHA-384, SHA-512 hash algorithms
 * - File content hashing with chunked processing
 * - Configuration object hashing with canonical JSON
 * - Hash comparison and verification
 * - Performance optimized for large files
 * - Browser and Node.js compatible
 */

export type HashAlgorithm = 'SHA-256' | 'SHA-384' | 'SHA-512'

export interface HashOptions {
  algorithm?: HashAlgorithm
  encoding?: 'hex' | 'base64'
  chunkSize?: number
  includeMetadata?: boolean
}

export interface FileHashResult {
  hash: string
  algorithm: HashAlgorithm
  size: number
  timestamp: Date
  chunks?: number
  metadata?: FileMetadata
}

export interface FileMetadata {
  name?: string
  type?: string
  lastModified?: Date
  size: number
  permissions?: string
  checksum?: string
}

export interface ConfigurationHash {
  hash: string
  algorithm: HashAlgorithm
  properties: string[]
  timestamp: Date
  version: string
}

export interface HashComparison {
  match: boolean
  expected: string
  actual: string
  algorithm: HashAlgorithm
  confidence: number
  discrepancies?: string[]
}

export interface HashVerificationResult {
  verified: boolean
  hash: string
  baseline: string
  algorithm: HashAlgorithm
  timestamp: Date
  metadata?: Record<string, any>
}

/**
 * Hash utility class providing cryptographic hash operations
 */
export class HashUtils {
  private static readonly DEFAULT_ALGORITHM: HashAlgorithm = 'SHA-256'
  private static readonly DEFAULT_ENCODING: 'hex' | 'base64' = 'hex'
  private static readonly DEFAULT_CHUNK_SIZE = 1024 * 1024 // 1MB chunks

  /**
   * Generate hash for string content
   */
  static async hashString(
    content: string,
    options: HashOptions = {}
  ): Promise<string> {
    try {
      const algorithm = options.algorithm || this.DEFAULT_ALGORITHM
      const encoding = options.encoding || this.DEFAULT_ENCODING

      // Convert string to Uint8Array
      const encoder = new TextEncoder()
      const data = encoder.encode(content)

      // Generate hash
      const hashBuffer = await crypto.subtle.digest(algorithm, data)

      return this.bufferToString(hashBuffer, encoding)

    } catch (error) {
      console.error('Failed to hash string:', error)
      throw new Error(`Hash generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate hash for binary data
   */
  static async hashBytes(
    data: Uint8Array | ArrayBuffer,
    options: HashOptions = {}
  ): Promise<string> {
    try {
      const algorithm = options.algorithm || this.DEFAULT_ALGORITHM
      const encoding = options.encoding || this.DEFAULT_ENCODING

      // Ensure we have ArrayBuffer
      const buffer = data instanceof Uint8Array ? data.buffer : data

      // Generate hash
      const hashBuffer = await crypto.subtle.digest(algorithm, buffer)

      return this.bufferToString(hashBuffer, encoding)

    } catch (error) {
      console.error('Failed to hash bytes:', error)
      throw new Error(`Hash generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate hash for File object (browser environment)
   */
  static async hashFile(
    file: File,
    options: HashOptions = {}
  ): Promise<FileHashResult> {
    try {
      const algorithm = options.algorithm || this.DEFAULT_ALGORITHM
      const encoding = options.encoding || this.DEFAULT_ENCODING
      const chunkSize = options.chunkSize || this.DEFAULT_CHUNK_SIZE
      const includeMetadata = options.includeMetadata ?? true

      const result: FileHashResult = {
        hash: '',
        algorithm,
        size: file.size,
        timestamp: new Date()
      }

      // Process file in chunks for memory efficiency
      const chunks = Math.ceil(file.size / chunkSize)
      result.chunks = chunks

      // Initialize hash context
      const hashContext = await this.createIncrementalHash(algorithm)

      for (let i = 0; i < chunks; i++) {
        const start = i * chunkSize
        const end = Math.min(start + chunkSize, file.size)
        const chunk = file.slice(start, end)

        const chunkBuffer = await chunk.arrayBuffer()
        await this.updateIncrementalHash(hashContext, chunkBuffer)

        // Yield control periodically for large files
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0))
        }
      }

      // Finalize hash
      result.hash = await this.finalizeIncrementalHash(hashContext, encoding)

      // Include metadata if requested
      if (includeMetadata) {
        result.metadata = {
          name: file.name,
          type: file.type,
          lastModified: new Date(file.lastModified),
          size: file.size,
          checksum: result.hash
        }
      }

      return result

    } catch (error) {
      console.error('Failed to hash file:', error)
      throw new Error(`File hash generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate hash for configuration object
   */
  static async hashConfiguration(
    config: Record<string, any>,
    options: HashOptions = {}
  ): Promise<ConfigurationHash> {
    try {
      const algorithm = options.algorithm || this.DEFAULT_ALGORITHM

      // Create canonical JSON representation
      const canonicalJson = this.canonicalizeObject(config)
      const properties = Object.keys(config).sort()

      // Generate hash
      const hash = await this.hashString(canonicalJson, { algorithm })

      return {
        hash,
        algorithm,
        properties,
        timestamp: new Date(),
        version: '1.0'
      }

    } catch (error) {
      console.error('Failed to hash configuration:', error)
      throw new Error(`Configuration hash generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Compare two hashes
   */
  static compareHashes(
    expected: string,
    actual: string,
    algorithm: HashAlgorithm = 'SHA-256'
  ): HashComparison {
    try {
      const match = expected === actual
      const confidence = match ? 100 : 0

      const comparison: HashComparison = {
        match,
        expected,
        actual,
        algorithm,
        confidence
      }

      if (!match) {
        comparison.discrepancies = this.analyzeHashDifferences(expected, actual)
      }

      return comparison

    } catch (error) {
      console.error('Failed to compare hashes:', error)
      return {
        match: false,
        expected,
        actual,
        algorithm,
        confidence: 0,
        discrepancies: ['Comparison failed']
      }
    }
  }

  /**
   * Verify content against baseline hash
   */
  static async verifyHash(
    content: string | Uint8Array | File,
    baselineHash: string,
    options: HashOptions = {}
  ): Promise<HashVerificationResult> {
    try {
      const algorithm = options.algorithm || this.DEFAULT_ALGORITHM
      let actualHash: string

      // Generate hash based on content type
      if (typeof content === 'string') {
        actualHash = await this.hashString(content, options)
      } else if (content instanceof File) {
        const result = await this.hashFile(content, options)
        actualHash = result.hash
      } else {
        actualHash = await this.hashBytes(content, options)
      }

      const verified = actualHash === baselineHash

      return {
        verified,
        hash: actualHash,
        baseline: baselineHash,
        algorithm,
        timestamp: new Date(),
        metadata: {
          contentType: typeof content,
          contentSize: content instanceof File ? content.size :
                      content instanceof Uint8Array ? content.length :
                      content.length
        }
      }

    } catch (error) {
      console.error('Failed to verify hash:', error)
      throw new Error(`Hash verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate multiple hashes for the same content
   */
  static async generateMultipleHashes(
    content: string | Uint8Array,
    algorithms: HashAlgorithm[] = ['SHA-256', 'SHA-384', 'SHA-512']
  ): Promise<Record<HashAlgorithm, string>> {
    try {
      const hashes: Record<string, string> = {}

      for (const algorithm of algorithms) {
        if (typeof content === 'string') {
          hashes[algorithm] = await this.hashString(content, { algorithm })
        } else {
          hashes[algorithm] = await this.hashBytes(content, { algorithm })
        }
      }

      return hashes as Record<HashAlgorithm, string>

    } catch (error) {
      console.error('Failed to generate multiple hashes:', error)
      throw new Error(`Multiple hash generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Create HMAC for authenticated hashing
   */
  static async createHMAC(
    content: string | Uint8Array,
    key: string,
    algorithm: HashAlgorithm = 'SHA-256'
  ): Promise<string> {
    try {
      // Import key for HMAC
      const encoder = new TextEncoder()
      const keyData = encoder.encode(key)

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: algorithm },
        false,
        ['sign']
      )

      // Prepare content
      const contentData = typeof content === 'string' ?
        encoder.encode(content) : content

      // Generate HMAC
      const signature = await crypto.subtle.sign('HMAC', cryptoKey, contentData)

      return this.bufferToString(signature, 'hex')

    } catch (error) {
      console.error('Failed to create HMAC:', error)
      throw new Error(`HMAC generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Verify HMAC
   */
  static async verifyHMAC(
    content: string | Uint8Array,
    signature: string,
    key: string,
    algorithm: HashAlgorithm = 'SHA-256'
  ): Promise<boolean> {
    try {
      const expectedSignature = await this.createHMAC(content, key, algorithm)
      return expectedSignature === signature
    } catch (error) {
      console.error('Failed to verify HMAC:', error)
      return false
    }
  }

  /**
   * Convert ArrayBuffer to string representation
   */
  private static bufferToString(
    buffer: ArrayBuffer,
    encoding: 'hex' | 'base64'
  ): string {
    const bytes = new Uint8Array(buffer)

    if (encoding === 'hex') {
      return Array.from(bytes)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('')
    } else {
      // Base64 encoding
      let binary = ''
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      return btoa(binary)
    }
  }

  /**
   * Create canonical JSON representation of object
   */
  private static canonicalizeObject(obj: any): string {
    if (obj === null || obj === undefined) {
      return JSON.stringify(obj)
    }

    if (typeof obj !== 'object') {
      return JSON.stringify(obj)
    }

    if (Array.isArray(obj)) {
      return '[' + obj.map(item => this.canonicalizeObject(item)).join(',') + ']'
    }

    // Sort object keys and recursively canonicalize values
    const sortedKeys = Object.keys(obj).sort()
    const keyValuePairs = sortedKeys.map(key => {
      const value = this.canonicalizeObject(obj[key])
      return `"${key}":${value}`
    })

    return '{' + keyValuePairs.join(',') + '}'
  }

  /**
   * Analyze differences between two hashes
   */
  private static analyzeHashDifferences(
    expected: string,
    actual: string
  ): string[] {
    const differences: string[] = []

    if (expected.length !== actual.length) {
      differences.push(`Length mismatch: expected ${expected.length}, got ${actual.length}`)
    }

    // Find differing character positions
    const diffPositions: number[] = []
    const maxLength = Math.max(expected.length, actual.length)

    for (let i = 0; i < maxLength; i++) {
      if (expected[i] !== actual[i]) {
        diffPositions.push(i)
      }
    }

    if (diffPositions.length > 0) {
      if (diffPositions.length <= 5) {
        differences.push(`Character differences at positions: ${diffPositions.join(', ')}`)
      } else {
        differences.push(`${diffPositions.length} character differences found`)
      }
    }

    // Check for common patterns
    if (expected.toLowerCase() === actual.toLowerCase()) {
      differences.push('Case difference detected')
    }

    if (expected.replace(/\s/g, '') === actual.replace(/\s/g, '')) {
      differences.push('Whitespace difference detected')
    }

    return differences
  }

  /**
   * Create incremental hash context for processing large files
   */
  private static async createIncrementalHash(algorithm: HashAlgorithm): Promise<any> {
    // Note: Web Crypto API doesn't support streaming hashes directly
    // This is a simplified implementation that accumulates data
    // In a real implementation, you might use a streaming hash library
    return {
      algorithm,
      chunks: [] as ArrayBuffer[]
    }
  }

  /**
   * Update incremental hash with new data
   */
  private static async updateIncrementalHash(
    context: any,
    data: ArrayBuffer
  ): Promise<void> {
    context.chunks.push(data)
  }

  /**
   * Finalize incremental hash and get result
   */
  private static async finalizeIncrementalHash(
    context: any,
    encoding: 'hex' | 'base64'
  ): Promise<string> {
    // Combine all chunks
    const totalSize = context.chunks.reduce((sum: number, chunk: ArrayBuffer) => sum + chunk.byteLength, 0)
    const combined = new Uint8Array(totalSize)

    let offset = 0
    for (const chunk of context.chunks) {
      combined.set(new Uint8Array(chunk), offset)
      offset += chunk.byteLength
    }

    // Generate final hash
    const hashBuffer = await crypto.subtle.digest(context.algorithm, combined)
    return this.bufferToString(hashBuffer, encoding)
  }

  /**
   * Hash a URL's content (for external resources)
   */
  static async hashUrl(
    url: string,
    options: HashOptions = {}
  ): Promise<string> {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`)
      }

      const content = await response.text()
      return await this.hashString(content, options)

    } catch (error) {
      console.error('Failed to hash URL content:', error)
      throw new Error(`URL hash generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate hash for DOM element content
   */
  static async hashDOMElement(
    element: Element,
    options: HashOptions = {}
  ): Promise<string> {
    try {
      // Get element's outer HTML
      const content = element.outerHTML

      // Normalize whitespace and remove attributes that change frequently
      const normalizedContent = content
        .replace(/\s+/g, ' ')
        .replace(/\s*=\s*/g, '=')
        .replace(/data-react-\w+="[^"]*"/g, '')
        .replace(/style="[^"]*"/g, '')
        .trim()

      return await this.hashString(normalizedContent, options)

    } catch (error) {
      console.error('Failed to hash DOM element:', error)
      throw new Error(`DOM element hash generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate integrity checksum for multiple files
   */
  static async generateManifestHash(
    files: Record<string, string>,
    options: HashOptions = {}
  ): Promise<string> {
    try {
      // Create manifest object with sorted keys
      const sortedEntries = Object.entries(files).sort(([a], [b]) => a.localeCompare(b))
      const manifest = Object.fromEntries(sortedEntries)

      // Generate hash of the manifest
      const manifestJson = this.canonicalizeObject(manifest)
      return await this.hashString(manifestJson, options)

    } catch (error) {
      console.error('Failed to generate manifest hash:', error)
      throw new Error(`Manifest hash generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Validate hash format
   */
  static isValidHash(hash: string, algorithm: HashAlgorithm): boolean {
    if (!hash || typeof hash !== 'string') {
      return false
    }

    // Check length based on algorithm
    const expectedLengths = {
      'SHA-256': 64,  // 32 bytes * 2 hex chars
      'SHA-384': 96,  // 48 bytes * 2 hex chars
      'SHA-512': 128  // 64 bytes * 2 hex chars
    }

    const expectedLength = expectedLengths[algorithm]
    if (hash.length !== expectedLength) {
      return false
    }

    // Check if it's valid hexadecimal
    return /^[a-f0-9]+$/i.test(hash)
  }

  /**
   * Get hash strength score
   */
  static getHashStrength(algorithm: HashAlgorithm): number {
    const strengths = {
      'SHA-256': 80,
      'SHA-384': 90,
      'SHA-512': 95
    }

    return strengths[algorithm] || 0
  }

  /**
   * Generate random salt for enhanced security
   */
  static generateSalt(length: number = 32): string {
    const array = new Uint8Array(length)
    crypto.getRandomValues(array)
    return this.bufferToString(array.buffer, 'hex')
  }

  /**
   * Hash with salt
   */
  static async hashWithSalt(
    content: string,
    salt: string,
    options: HashOptions = {}
  ): Promise<string> {
    const saltedContent = content + salt
    return await this.hashString(saltedContent, options)
  }
}

// Export commonly used hash functions
export const {
  hashString,
  hashBytes,
  hashFile,
  hashConfiguration,
  compareHashes,
  verifyHash,
  generateMultipleHashes,
  createHMAC,
  verifyHMAC,
  hashUrl,
  hashDOMElement,
  generateManifestHash,
  isValidHash,
  getHashStrength,
  generateSalt,
  hashWithSalt
} = HashUtils

// Export default instance
export default HashUtils