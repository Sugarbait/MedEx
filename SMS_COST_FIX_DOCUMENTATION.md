# SMS Cost Accumulation Fix

## Problem
The SMS page had a serious cost accumulation issue where:
- Multiple instances of the SMS page were running simultaneously due to Hot Module Replacement (HMR)
- Each instance was loading the same chat costs repeatedly
- Costs were accumulating incorrectly (e.g., CAD $7.8435 → $8.2245 and continuing to grow)
- Multiple loadSMSCosts processes were running in parallel
- Same chat IDs were being loaded multiple times by different instances

## Root Cause Analysis
1. **HMR Multiple Instances**: During development, HMR creates multiple component instances with different timestamps (e.g., SMSPage.tsx?t=1758260132509, SMSPage.tsx?t=1758260237639)
2. **No Singleton Loading**: Each instance independently loaded costs without checking if another instance was already loading the same data
3. **State Isolation**: Each component instance had its own state, leading to duplicate API calls and cost calculations
4. **No Cleanup**: Component unmounting didn't cancel ongoing loading operations
5. **Race Conditions**: Multiple instances could modify cost state simultaneously

## Solution Implementation

### 1. SMS Cost Cache Service (`smsCostCacheService.ts`)
- **Singleton Pattern**: Ensures only one instance manages cost loading across the entire application
- **Shared Cache**: All component instances share the same cost cache
- **Duplicate Prevention**: If a cost is already being loaded, subsequent requests join the existing promise
- **Abort Controller Support**: Proper cleanup with AbortController to cancel ongoing requests
- **Instance Identification**: Each service instance has a unique ID for debugging
- **Batch Loading**: Efficient loading of multiple costs with controlled concurrency (5 at a time)
- **Cache Expiry**: Automatic cleanup of expired cache entries (5-minute expiry)
- **Progress Tracking**: Real-time progress callbacks for loading operations

### 2. SMS Cost Manager Hook (`useSMSCostManager.ts`)
- **React Integration**: Provides a clean React hook interface to the cache service
- **Subscription System**: Components subscribe to cost updates from the shared cache
- **Automatic Cleanup**: Properly cleans up subscriptions and cancels operations on unmount
- **State Management**: Manages loading states, costs, totals, and errors
- **Instance Tracking**: Each hook instance has a unique ID for debugging

### 3. Updated SMS Page Component
- **Mount/Unmount Tracking**: Uses `mountedRef` to prevent state updates after unmount
- **Instance Identification**: Each page instance has a unique ID for debugging
- **Proper Cleanup**: Cancels ongoing operations when component unmounts or date range changes
- **Error Handling**: Displays both general errors and cost-specific errors
- **Debug Information**: Shows instance ID, cache stats, and loading progress in development mode

## Key Features

### Singleton Loading Pattern
```typescript
// Multiple calls to the same chat will join the existing promise
const cost1Promise = smsCostCacheService.loadChatCost(chat)
const cost2Promise = smsCostCacheService.loadChatCost(chat) // Joins existing load

// Both promises resolve to the same value, but only one API call is made
```

### Proper Cleanup
```typescript
// Automatic cleanup on component unmount
useEffect(() => {
  return () => {
    mountedRef.current = false
    smsCostCacheService.cancelAllLoading()
  }
}, [])
```

### Shared State Management
```typescript
// All components share the same cost cache
const subscription = smsCostCacheService.subscribe((chatId, cost, loading) => {
  // All subscribers get notified of cost updates
})
```

### Race Condition Prevention
- Only one loading operation per chat ID can exist at any time
- Subsequent requests for the same chat ID join the existing promise
- Cache prevents duplicate API calls for recently loaded costs

## Benefits

1. **Cost Stability**: Costs are now stable and don't accumulate incorrectly
2. **Performance**: Eliminates duplicate API calls and reduces server load
3. **Memory Efficiency**: Shared cache reduces memory usage across instances
4. **Developer Experience**: Debug information helps track loading progress and cache stats
5. **Reliability**: Proper cleanup prevents memory leaks and stale state
6. **HMR Compatibility**: Works correctly with Hot Module Replacement during development

## Usage

### Basic Usage
```typescript
const {
  costs,
  loadingCosts,
  totalCost,
  isLoading,
  loadCostsForChats,
  clearCosts
} = useSMSCostManager()

// Load costs for multiple chats
await loadCostsForChats(chats)

// Clear costs when date range changes
clearCosts()
```

### Advanced Usage
```typescript
// Load with progress tracking
const { loadCostsForChats } = useSMSCostManager({
  onProgress: (loaded, total) => {
    console.log(`Progress: ${loaded}/${total}`)
  }
})

// Direct service usage
const cost = await smsCostCacheService.loadChatCost(chat)
const cached = smsCostCacheService.getChatCost(chatId)
```

## Testing

Run the test suite in the browser console:
```javascript
// In browser console after the page loads
runSMSCostCacheTests()
```

The test suite verifies:
- Singleton loading behavior
- Cache functionality
- Multiple chat loading
- Cleanup and abortion

## Debug Information

In development mode, the SMS page shows:
- Page instance ID
- Cache statistics (cached entries, loading operations, subscribers)
- Cost loading progress
- Total costs and averages

## Migration Notes

The old cost loading system has been completely replaced:
- `loadSMSCosts()` function is deprecated
- `setChatCosts()` and `setLoadingCosts()` are replaced by the cost manager
- Manual cost state management is no longer needed

## File Changes

### New Files
- `src/services/smsCostCacheService.ts` - Singleton cost cache service
- `src/hooks/useSMSCostManager.ts` - React hook for cost management
- `src/test/smsCostCacheTest.ts` - Test suite for cost caching
- `SMS_COST_FIX_DOCUMENTATION.md` - This documentation

### Modified Files
- `src/pages/SMSPage.tsx` - Updated to use new cost management system

## Performance Improvements

1. **API Call Reduction**: Eliminates duplicate API calls for the same chat
2. **Controlled Concurrency**: Limits to 5 concurrent cost loading operations
3. **Smart Caching**: 5-minute cache prevents unnecessary reloads
4. **Batch Processing**: Efficient loading of multiple chats with progress tracking
5. **Memory Management**: Automatic cleanup of expired cache entries

## Error Handling

- Network errors fall back to estimated costs based on chat duration
- Aborted requests are handled gracefully
- Component unmounting cancels ongoing operations
- Error states are displayed to users with retry options

This solution completely resolves the SMS cost accumulation issue while improving performance, reliability, and developer experience.