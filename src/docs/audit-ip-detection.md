# HIPAA Audit Logger - Real IP Detection Implementation

## Overview

The HIPAA Audit Logger now includes robust real client IP detection for production HIPAA compliance. The system replaces the previous placeholder "127.0.0.1" with actual client IP addresses detected through multiple methods.

## Features

### ✅ Multi-Source IP Detection
- **URL Parameters**: `?client_ip=x.x.x.x` (for server-injected IPs)
- **Meta Tags**: `<meta name="client-ip" content="x.x.x.x">` (for server-side rendering)
- **Environment Variables**: `HTTP_X_FORWARDED_FOR`, `HTTP_X_REAL_IP`, etc.
- **Azure Static Web Apps**: Azure-specific headers and environment detection
- **External APIs**: Fallback to IP detection services (ipify.org, httpbin.org, etc.)
- **Cached Detection**: Persistent caching with 24-hour expiration

### ✅ Azure Static Web Apps Support
- Automatic detection of Azure SWA environment
- Support for Azure-specific headers:
  - `HTTP_X_AZURE_CLIENTIP`
  - `HTTP_X_AZURE_FDID`
  - `HTTP_X_FORWARDED_FOR`
  - `HTTP_X_REAL_IP`

### ✅ Production-Grade Features
- **IPv4 & IPv6 Validation**: Comprehensive IP format validation
- **Private IP Detection**: Filters private/internal IP ranges
- **X-Forwarded-For Parsing**: Handles comma-separated proxy chains
- **Graceful Fallback**: Always returns valid IP (127.0.0.1 as last resort)
- **Background Detection**: Non-blocking async IP detection
- **Error Handling**: Robust error handling with detailed logging

## Usage

### Basic IP Detection

```typescript
import { auditIPUtils } from '@/services/auditLogger'

// Get current detected IP
const currentIP = auditIPUtils.getCurrentIP()
console.log('Current IP:', currentIP)

// Get detailed detection status
const status = auditIPUtils.getIPStatus()
console.log('Detection Status:', status)
```

### Manual IP Refresh

```typescript
// Force refresh IP detection (clears cache, tries all methods)
const newIP = await auditIPUtils.refreshIP()
console.log('Refreshed IP:', newIP)
```

### Integration with Audit Logging

The IP detection is automatically integrated into all audit log entries:

```typescript
import { auditLogger } from '@/services/auditLogger'

// All audit events automatically include real IP
await auditLogger.logPHIAccess(
  AuditAction.VIEW,
  ResourceType.PATIENT,
  'patient-123'
)
// Audit entry will include actual client IP instead of 127.0.0.1
```

## Configuration for Production

### Method 1: Server-Side Injection (Recommended)

For Azure Static Web Apps or other hosting platforms, inject the client IP via URL parameter or meta tag:

```html
<!-- Server renders this with actual client IP -->
<meta name="client-ip" content="203.0.113.10">
```

Or redirect with IP parameter:
```
https://yourapp.com?client_ip=203.0.113.10
```

### Method 2: Environment Variables

Set environment variables for server-side detection:

```bash
# Azure Static Web Apps
HTTP_X_FORWARDED_FOR=203.0.113.10,10.0.0.1
HTTP_X_REAL_IP=203.0.113.10
HTTP_X_AZURE_CLIENTIP=203.0.113.10

# General hosting
REMOTE_ADDR=203.0.113.10
HTTP_CLIENT_IP=203.0.113.10
```

### Method 3: External API Detection

The system automatically falls back to external IP detection APIs:
- `https://api.ipify.org?format=json`
- `https://httpbin.org/ip`
- `https://ipinfo.io/json`
- `https://api.my-ip.io/ip.json`

## Detection Flow

1. **URL Parameters** → Check for `?client_ip=x.x.x.x`
2. **Meta Tags** → Look for `<meta name="client-ip" content="x.x.x.x">`
3. **Cached IP** → Use valid cached IP (with expiration check)
4. **Environment Variables** → Server-side headers and variables
5. **Azure Detection** → Azure Static Web Apps specific methods
6. **Async External APIs** → Background detection via external services
7. **Fallback** → Return `127.0.0.1` if all methods fail

## IP Validation & Security

### Supported IP Formats
- **IPv4**: `192.168.1.1`, `203.0.113.10`
- **IPv6**: `2001:db8::1`, `::1` (basic support)
- **Compressed IPv6**: `2001:db8::abcd:1234`

### Private IP Detection
Automatically identifies and handles private IP ranges:
- `10.0.0.0/8` (Class A private)
- `172.16.0.0/12` (Class B private)
- `192.168.0.0/16` (Class C private)
- `127.0.0.0/8` (Loopback)
- `169.254.0.0/16` (Link-local)

### X-Forwarded-For Parsing
Correctly parses proxy chains, prioritizing first public IP:
```
X-Forwarded-For: 203.0.113.10, 10.0.0.1, 192.168.1.1
                 ↑ Returns this (first public IP)
```

## Caching Strategy

### Cache Types
1. **Detected IP Cache**: `detected_client_ip` (24-hour expiration)
2. **Async Detection Cache**: `async_detected_ip` (24-hour expiration)
3. **Detection Throttling**: `last_async_ip_detection` (1-hour throttle)

### Cache Management
```typescript
// Cache is automatically managed, but you can force refresh:
await auditIPUtils.refreshIP() // Clears all caches and re-detects
```

## Monitoring & Debugging

### Detection Status
```typescript
const status = auditIPUtils.getIPStatus()
console.log(status)
// Output:
{
  hasUrlParam: false,
  hasMetaTag: true,
  hasCachedIP: true,
  hasAsyncIP: false,
  isAzureEnvironment: true,
  detectedIP: "203.0.113.10",
  lastAsyncDetection: "1703875200000"
}
```

### Audit Log Integration
All audit entries now include IP detection status in `additional_info`:

```json
{
  "action": "SYSTEM_ACCESS",
  "source_ip": "203.0.113.10",
  "additional_info": {
    "ipDetectionStatus": {
      "detectedIP": "203.0.113.10",
      "isAzureEnvironment": true,
      "hasCachedIP": true
    }
  }
}
```

## HIPAA Compliance

### Requirements Met
- ✅ **Real IP Logging**: Actual client IPs for audit trail
- ✅ **Graceful Fallback**: Never fails, always provides valid IP
- ✅ **Privacy Protection**: No logging of invalid/private detection attempts
- ✅ **Audit Integration**: Seamless integration with existing audit system
- ✅ **Error Handling**: Robust error handling without breaking audit flow

### Security Considerations
- **No PII Logging**: Only valid IP addresses are logged
- **Fallback Safety**: System continues functioning even if IP detection fails
- **Privacy Compliance**: External API calls are throttled and optional
- **Cache Security**: Cached IPs expire automatically for security

## Testing

The implementation includes comprehensive tests:

```bash
# Run IP detection tests
npm test -- auditIPSimple.test.ts
```

Test coverage includes:
- IPv4/IPv6 validation
- Private IP detection
- X-Forwarded-For parsing
- Azure environment detection
- URL parameter extraction
- Cache validation with expiration

## Browser Console Utilities

For debugging and monitoring:

```javascript
// Check current IP detection status
console.log(auditIPUtils.getIPStatus())

// Force refresh IP detection
auditIPUtils.refreshIP().then(ip => console.log('New IP:', ip))

// Get current detected IP
console.log('Current IP:', auditIPUtils.getCurrentIP())
```

## Error Handling

The system handles all errors gracefully:

```typescript
// All methods never throw, always return valid results
const ip = auditIPUtils.getCurrentIP() // Never throws
const status = auditIPUtils.getIPStatus() // Never throws
const newIP = await auditIPUtils.refreshIP() // Never throws
```

Error scenarios:
- **Network failures**: Falls back to cached or localhost
- **Invalid responses**: Continues to next detection method
- **Timeout issues**: 5-second timeout on external API calls
- **Parsing errors**: Graceful fallback to previous working IP

## Production Deployment Checklist

- [ ] Configure server to inject client IP via meta tag or URL parameter
- [ ] Set appropriate environment variables for Azure SWA or hosting platform
- [ ] Verify external API access for fallback detection
- [ ] Test IP detection in production environment
- [ ] Monitor audit logs for proper IP detection
- [ ] Confirm HIPAA compliance with real IP logging

---

*Implementation completed for HIPAA-compliant real client IP detection in audit logging system.*