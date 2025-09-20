# Chat Service Documentation

## Overview

The `ChatService` is a comprehensive service for fetching and managing Retell AI Chat data. It provides a complete abstraction layer over the Retell AI Chat API with support for filtering, pagination, analytics, and demo mode for development.

## Features

- **Complete Chat Management**: Fetch, filter, and manage chat data
- **Real-time Operations**: Create SMS chats and end ongoing conversations
- **Analytics & Statistics**: Comprehensive chat metrics and trend analysis
- **Demo Mode**: Works without API configuration for development
- **TypeScript Support**: Full type safety with comprehensive interfaces
- **Error Handling**: Robust error handling with graceful fallbacks
- **Caching**: Smart caching for improved performance

## Installation & Setup

```typescript
import { chatService } from '../services/chatService'
// or
import { chatService } from '../services'
```

## Configuration

The service automatically loads configuration from localStorage:
- `retellApiKey`: Your Retell AI API key
- `smsAgentId`: The SMS agent ID for filtering

If no configuration is found, the service operates in demo mode with mock data.

## Basic Usage

### Get All Chats
```typescript
// Get all chats for the configured agent
const allChats = await chatService.getAllChats()

// Get chats with filters
const filteredChats = await chatService.getAllChats({
  chat_status: 'ended',
  user_sentiment: 'positive'
})
```

### Get Chat History with Pagination
```typescript
const chatHistory = await chatService.getChatHistory({
  limit: 50,
  sort_order: 'descending',
  filter_criteria: {
    chat_status: 'ended',
    start_timestamp: {
      gte: Math.floor(Date.now() / 1000) - 86400 // Last 24 hours
    }
  }
})

console.log(`Found ${chatHistory.chats.length} chats`)
if (chatHistory.has_more) {
  // Fetch next page using chatHistory.pagination_key
}
```

### Get Specific Chat
```typescript
const chat = await chatService.getChatById('chat_123')
console.log('Chat transcript:', chat.transcript)
console.log('Messages:', chat.message_with_tool_calls.length)
```

### Date Range Filtering
```typescript
const startDate = new Date('2024-01-01')
const endDate = new Date('2024-01-31')
const januaryChats = await chatService.getChatsByDateRange(startDate, endDate)
```

### Create SMS Chat
```typescript
const result = await chatService.createSMSChat({
  agent_id: 'agent_sms_001',
  phone_number: '+1234567890',
  customer_name: 'John Doe',
  initial_message: 'Hello, how can I help you today?',
  metadata: {
    patient_id: 'patient_123',
    campaign_id: 'campaign_001'
  }
})

if (result.success) {
  console.log('Chat created:', result.chat_id)
} else {
  console.error('Failed to create chat:', result.error)
}
```

### End Chat
```typescript
const result = await chatService.endChat('chat_123')
if (result.success) {
  console.log('Chat ended successfully')
}
```

## Analytics & Statistics

### Basic Statistics
```typescript
const allChats = await chatService.getAllChats()
const stats = chatService.getChatStats(allChats)

console.log('Chat Statistics:', {
  total: stats.totalChats,
  active: stats.activeChats,
  completed: stats.completedChats,
  success_rate: `${stats.successRate}%`,
  avg_duration: stats.avgDuration,
  total_cost: `$${stats.totalCost.toFixed(2)}`
})
```

### Comprehensive Analytics
```typescript
const analytics = await chatService.getChatAnalytics()

console.log('Today:', analytics.today)
console.log('This Week:', analytics.thisWeek)
console.log('This Month:', analytics.thisMonth)
console.log('Sentiment Distribution:', analytics.sentimentDistribution)
console.log('Peak Hours:', analytics.peakHours)
console.log('Trends:', analytics.trends)
```

## Filtering Options

### Available Filters (ChatFilters)
```typescript
interface ChatFilters {
  agent_id?: string                    // Filter by agent
  chat_status?: 'ongoing' | 'ended' | 'error'  // Filter by status
  user_sentiment?: string              // Filter by sentiment
  chat_successful?: boolean            // Filter by success
  start_timestamp?: {                  // Filter by date range
    gte?: number                       // Greater than or equal
    lte?: number                       // Less than or equal
  }
  end_timestamp?: {
    gte?: number
    lte?: number
  }
  phone_number?: string               // Filter by phone number
  patient_id?: string                 // Filter by patient ID
}
```

### Usage Examples
```typescript
// Get only successful chats from last week
const successfulChats = await chatService.getChatHistory({
  filter_criteria: {
    chat_successful: true,
    start_timestamp: {
      gte: Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60)
    }
  }
})

// Get ongoing chats for specific agent
const ongoingChats = await chatService.getChatHistory({
  filter_criteria: {
    agent_id: 'agent_sms_001',
    chat_status: 'ongoing'
  }
})

// Get chats with positive sentiment
const positiveChats = await chatService.getChatHistory({
  filter_criteria: {
    user_sentiment: 'positive'
  }
})
```

## Configuration Management

### Update Credentials
```typescript
// Update API credentials at runtime
chatService.updateCredentials('new_api_key', 'new_agent_id')

// Test connection with new credentials
const testResult = await chatService.testConnection()
console.log('Connection status:', testResult)
```

### Check Configuration
```typescript
const isConfigured = chatService.isConfigured()
if (!isConfigured) {
  console.log('Service is running in demo mode')
}
```

## Error Handling

The service includes comprehensive error handling:

```typescript
try {
  const chat = await chatService.getChatById('invalid_id')
} catch (error) {
  console.error('Chat not found:', error.message)
}

// Service-level error handling
const result = await chatService.createSMSChat({
  agent_id: 'invalid_agent',
  phone_number: '+1234567890'
})

if (!result.success) {
  console.error('Failed to create chat:', result.error)
}
```

## Demo Mode

When no API configuration is available, the service automatically operates in demo mode with realistic mock data:

```typescript
// Demo mode automatically provides:
// - 3 sample chats with different statuses
// - Realistic timestamps and metadata
// - Sample message conversations
// - Analytics data for testing

const demoChats = await chatService.getAllChats()
console.log('Demo chats loaded:', demoChats.length)
```

## TypeScript Interfaces

### Core Interfaces
```typescript
interface Chat {
  chat_id: string
  agent_id: string
  chat_status: 'ongoing' | 'ended' | 'error'
  start_timestamp: number
  end_timestamp?: number
  transcript: string
  message_with_tool_calls: ChatMessage[]
  collected_dynamic_variables: Record<string, any>
  retell_llm_dynamic_variables: Record<string, any>
  chat_analysis: {
    chat_summary: string
    user_sentiment: string
    chat_successful: boolean
    custom_analysis_data: Record<string, any>
  }
  chat_cost: {
    product_costs: Record<string, number>
    total_cost: number
  }
  metadata?: Record<string, any>
}

interface ChatMessage {
  message_id: string
  role: 'agent' | 'user'
  content: string
  created_timestamp: number
  tool_calls?: ToolCall[]
  metadata?: Record<string, any>
}
```

## Integration with Existing Services

The chat service integrates seamlessly with existing services:

```typescript
// Use with SMS service
import { retellSMSService } from '../services/retellSMSService'
const smsMessages = await retellSMSService.getSMSMessages()

// Use with call service
import { retellService } from '../services/retellService'
const calls = await retellService.getAllCalls()

// Combined analytics
const combinedStats = {
  chats: chatService.getChatStats(allChats),
  calls: retellService.calculateCallMetrics(calls)
}
```

## Performance Considerations

- **Pagination**: Use pagination for large datasets
- **Filtering**: Apply filters server-side when possible
- **Caching**: Service includes intelligent caching
- **Rate Limiting**: Respects API rate limits with automatic retries

## Testing

The service includes comprehensive tests:

```bash
npm test -- src/test/chatService.test.ts
```

Tests cover:
- Basic functionality
- Error handling
- Demo mode operation
- All filtering options
- Analytics calculations
- Configuration management

## API Endpoints Used

The service integrates with these Retell AI endpoints:

- `GET /list-chat` - List all chats with filters
- `GET /get-chat/{chat_id}` - Get specific chat details
- `POST /create-sms-chat` - Create SMS chats
- `PUT /end-chat/{chat_id}` - End chats

## Support for SMS Pages

The service is specifically designed to support SMS pages in the application:

```typescript
// Perfect for SMS dashboard
const smsAnalytics = await chatService.getChatAnalytics()

// For SMS conversation views
const recentChats = await chatService.getChatHistory({
  limit: 50,
  sort_order: 'descending'
})

// For patient communication tracking
const patientChats = await chatService.getChatHistory({
  filter_criteria: {
    phone_number: patient.phone
  }
})
```

## Migration from Existing Code

If migrating from existing chat functionality:

```typescript
// Old way (using retellService directly)
const chats = await retellService.getChatHistory()

// New way (using dedicated chatService)
const chats = await chatService.getChatHistory()
const analytics = await chatService.getChatAnalytics()
const stats = chatService.getChatStats(chats.chats)
```

The new service provides more features, better error handling, and comprehensive analytics while maintaining compatibility with existing patterns.