/**
 * Simple tests for IP detection functionality
 */
import { describe, it, expect } from 'vitest'

describe('IP Detection Validation', () => {
  // Test IP validation regex
  const validateIPv4 = (ip: string): boolean => {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    return ipv4Regex.test(ip)
  }

  const isPrivateIP = (ip: string): boolean => {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
      /^127\./,
      /^169\.254\./, // Link-local
      /^localhost$/i
    ]
    return privateRanges.some(range => range.test(ip))
  }

  const parseForwardedIP = (forwardedHeader: string): string => {
    const ips = forwardedHeader.split(',').map(ip => ip.trim())

    for (const ip of ips) {
      if (validateIPv4(ip) && !isPrivateIP(ip)) {
        return ip
      }
    }

    for (const ip of ips) {
      if (validateIPv4(ip)) {
        return ip
      }
    }

    return '127.0.0.1'
  }

  it('should validate IPv4 addresses correctly', () => {
    // Valid IPv4 addresses
    expect(validateIPv4('192.168.1.1')).toBe(true)
    expect(validateIPv4('203.0.113.10')).toBe(true)
    expect(validateIPv4('0.0.0.0')).toBe(true)
    expect(validateIPv4('255.255.255.255')).toBe(true)

    // Invalid IPv4 addresses
    expect(validateIPv4('256.1.1.1')).toBe(false)
    expect(validateIPv4('192.168.1')).toBe(false)
    expect(validateIPv4('not.an.ip.address')).toBe(false)
    expect(validateIPv4('')).toBe(false)
  })

  it('should identify private IP addresses', () => {
    // Private IP ranges
    expect(isPrivateIP('10.0.0.1')).toBe(true)
    expect(isPrivateIP('192.168.1.1')).toBe(true)
    expect(isPrivateIP('172.16.0.1')).toBe(true)
    expect(isPrivateIP('127.0.0.1')).toBe(true)
    expect(isPrivateIP('169.254.1.1')).toBe(true)

    // Public IP addresses
    expect(isPrivateIP('203.0.113.10')).toBe(false)
    expect(isPrivateIP('8.8.8.8')).toBe(false)
    expect(isPrivateIP('1.1.1.1')).toBe(false)
  })

  it('should parse X-Forwarded-For headers correctly', () => {
    // Public IP first
    expect(parseForwardedIP('203.0.113.10, 10.0.0.1, 192.168.1.1')).toBe('203.0.113.10')

    // Only private IPs
    expect(parseForwardedIP('10.0.0.1, 192.168.1.1')).toBe('10.0.0.1')

    // Single IP
    expect(parseForwardedIP('203.0.113.25')).toBe('203.0.113.25')

    // Invalid IPs
    expect(parseForwardedIP('invalid, 256.256.256.256')).toBe('127.0.0.1')
  })

  it('should detect Azure Static Web Apps hostnames', () => {
    const isAzureStaticWebApp = (hostname: string): boolean => {
      return hostname.includes('.azurestaticapps.net') ||
             hostname.includes('.1.azurestaticapps.net') ||
             hostname.includes('.2.azurestaticapps.net') ||
             hostname.includes('.3.azurestaticapps.net') ||
             hostname.includes('.centralus.azurestaticapps.net')
    }

    expect(isAzureStaticWebApp('myapp.azurestaticapps.net')).toBe(true)
    expect(isAzureStaticWebApp('test.1.azurestaticapps.net')).toBe(true)
    expect(isAzureStaticWebApp('app.centralus.azurestaticapps.net')).toBe(true)
    expect(isAzureStaticWebApp('localhost')).toBe(false)
    expect(isAzureStaticWebApp('myapp.herokuapp.com')).toBe(false)
  })

  it('should handle URL parameter parsing', () => {
    const getIPFromURL = (searchParams: string): string | null => {
      const params = new URLSearchParams(searchParams)
      const ip = params.get('client_ip')
      return ip && validateIPv4(ip) ? ip : null
    }

    expect(getIPFromURL('?client_ip=192.168.1.100')).toBe('192.168.1.100')
    expect(getIPFromURL('?client_ip=invalid')).toBe(null)
    expect(getIPFromURL('?other_param=value')).toBe(null)
    expect(getIPFromURL('')).toBe(null)
  })

  it('should validate cached IP with expiration', () => {
    const isCacheValid = (ip: string, expiresTimestamp: string): boolean => {
      if (!ip || !validateIPv4(ip)) return false

      const expires = parseInt(expiresTimestamp, 10)
      if (isNaN(expires)) return false

      return Date.now() < expires
    }

    const validIP = '203.0.113.10'
    const futureTime = (Date.now() + 60000).toString() // 1 minute future
    const pastTime = (Date.now() - 60000).toString()   // 1 minute past

    expect(isCacheValid(validIP, futureTime)).toBe(true)
    expect(isCacheValid(validIP, pastTime)).toBe(false)
    expect(isCacheValid('invalid', futureTime)).toBe(false)
    expect(isCacheValid(validIP, 'invalid')).toBe(false)
  })
})