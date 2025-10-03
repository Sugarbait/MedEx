/**
 * Stripe Invoice Service
 *
 * Generates Stripe invoices based on Combined Service costs (Calls + SMS)
 * Supports manual and automatic monthly invoice generation
 */

import Stripe from 'stripe'
import { retellService, currencyService, twilioCostService, chatService } from './index'
import { AuditService } from './auditService'

interface InvoiceLineItem {
  description: string
  quantity: number
  unit_amount_cents: number // Amount in cents
  amount_total: number // Total in dollars
}

interface InvoiceData {
  dateRange: {
    start: Date
    end: Date
    label: string
  }
  callCosts: {
    totalCalls: number
    totalCostCAD: number
    items: InvoiceLineItem[]
  }
  smsCosts: {
    totalChats: number
    totalSegments: number
    totalCostCAD: number
    items: InvoiceLineItem[]
  }
  combinedTotal: number
  currency: 'cad'
}

interface StripeCustomerInfo {
  email: string
  name: string
  description?: string
}

interface CreateInvoiceOptions {
  customerInfo: StripeCustomerInfo
  dateRange: {
    start: Date
    end: Date
    label?: string
  }
  sendImmediately?: boolean
  autoFinalize?: boolean
  dueDate?: Date
}

class StripeInvoiceService {
  private stripe: Stripe | null = null
  private isInitialized = false

  /**
   * Initialize Stripe with API key from environment or settings
   */
  public async initialize(apiKey?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Try to get API key from parameter, environment, or user settings
      let stripeKey = apiKey

      if (!stripeKey) {
        // Check environment variables
        stripeKey = import.meta.env.VITE_STRIPE_SECRET_KEY
      }

      if (!stripeKey) {
        // Check user settings in localStorage
        try {
          const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
          if (currentUser.id) {
            const settings = JSON.parse(localStorage.getItem(`settings_${currentUser.id}`) || '{}')
            stripeKey = settings.stripeSecretKey
          }
        } catch (error) {
          console.error('Failed to load Stripe key from settings:', error)
        }
      }

      if (!stripeKey) {
        return {
          success: false,
          error: 'Stripe API key not configured. Please add VITE_STRIPE_SECRET_KEY to environment or configure in Settings.'
        }
      }

      // Initialize Stripe client
      this.stripe = new Stripe(stripeKey, {
        apiVersion: '2024-11-20.acacia',
        typescript: true
      })

      this.isInitialized = true

      // Log audit event
      await AuditService.logAction(
        'STRIPE_SERVICE_INITIALIZED',
        'stripe_invoice_service',
        { success: true }
      )

      return { success: true }
    } catch (error) {
      console.error('Failed to initialize Stripe:', error)

      await AuditService.createSecurityEvent({
        action: 'STRIPE_INITIALIZATION_FAILED',
        resource: 'stripe_invoice_service',
        success: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        severity: 'high'
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initialize Stripe'
      }
    }
  }

  /**
   * Check if Stripe is initialized and ready
   */
  public isConfigured(): boolean {
    return this.isInitialized && this.stripe !== null
  }

  /**
   * Calculate invoice data for a given date range
   */
  public async calculateInvoiceData(startDate: Date, endDate: Date): Promise<InvoiceData> {
    try {
      // Convert dates to timestamps
      const startMs = startDate.getTime()
      const endMs = endDate.getTime()

      // Fetch all calls and chats
      const [allCalls, allChatsResponse] = await Promise.all([
        retellService.getAllCalls(),
        chatService.getChatHistory({ limit: 500 })
      ])

      // Filter calls by date range
      const filteredCalls = allCalls.filter(call => {
        const callTimeMs = call.start_timestamp.toString().length <= 10
          ? call.start_timestamp * 1000
          : call.start_timestamp
        return callTimeMs >= startMs && callTimeMs <= endMs
      })

      // Filter chats by date range
      const filteredChats = allChatsResponse.chats.filter(chat => {
        const chatTimeMs = chat.start_timestamp.toString().length <= 10
          ? chat.start_timestamp * 1000
          : chat.start_timestamp
        return chatTimeMs >= startMs && chatTimeMs <= endMs
      })

      // Calculate call costs (Retell AI + Twilio)
      let totalCallCostCAD = 0
      const callItems: InvoiceLineItem[] = []

      for (const call of filteredCalls) {
        // Retell AI cost
        const retellCostCents = call.call_cost?.combined_cost || 0
        const retellCostUSD = retellCostCents / 100
        const retellCostCAD = currencyService.convertUSDToCAD(retellCostUSD)

        // Twilio voice cost
        const twilioCostCAD = twilioCostService.getTwilioCostCAD(call.call_length_seconds || 0)

        const totalCallCost = retellCostCAD + twilioCostCAD
        totalCallCostCAD += totalCallCost
      }

      // Add consolidated call line item
      if (filteredCalls.length > 0) {
        callItems.push({
          description: `Voice Calls (${filteredCalls.length} calls)`,
          quantity: filteredCalls.length,
          unit_amount_cents: Math.round((totalCallCostCAD / filteredCalls.length) * 100),
          amount_total: totalCallCostCAD
        })
      }

      // Calculate SMS costs (Retell AI Chat + Twilio SMS)
      let totalSMSCostCAD = 0
      let totalRetellChatCostCAD = 0
      let totalTwilioSMSCostCAD = 0
      let totalSegments = 0
      const smsItems: InvoiceLineItem[] = []

      for (const chat of filteredChats) {
        const messages = chat.message_with_tool_calls || []
        if (messages.length > 0) {
          // Get Retell AI chat cost from API response - combined_cost is in cents
          const retellChatCostCents = chat.chat_cost?.combined_cost || 0

          // Calculate COMPLETE SMS cost (Retell + Twilio)
          const completeCost = twilioCostService.calculateCompleteSMSCost(messages, retellChatCostCents)

          totalRetellChatCostCAD += completeCost.retellChatCostCAD
          totalTwilioSMSCostCAD += completeCost.twilioSMSCostCAD
          totalSMSCostCAD += completeCost.totalCostCAD
          totalSegments += completeCost.segmentCount
        }
      }

      // Add consolidated SMS line item showing both costs
      if (filteredChats.length > 0) {
        smsItems.push({
          description: `SMS Conversations (${filteredChats.length} chats) - Retell AI Chat: CAD $${totalRetellChatCostCAD.toFixed(2)} + Twilio SMS (${totalSegments} segments): CAD $${totalTwilioSMSCostCAD.toFixed(2)}`,
          quantity: filteredChats.length,
          unit_amount_cents: Math.round((totalSMSCostCAD / filteredChats.length) * 100),
          amount_total: totalSMSCostCAD
        })
      }

      return {
        dateRange: {
          start: startDate,
          end: endDate,
          label: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
        },
        callCosts: {
          totalCalls: filteredCalls.length,
          totalCostCAD: totalCallCostCAD,
          items: callItems
        },
        smsCosts: {
          totalChats: filteredChats.length,
          totalSegments,
          totalCostCAD: totalSMSCostCAD,
          items: smsItems
        },
        combinedTotal: totalCallCostCAD + totalSMSCostCAD,
        currency: 'cad'
      }
    } catch (error) {
      console.error('Failed to calculate invoice data:', error)
      throw error
    }
  }

  /**
   * Create or retrieve Stripe customer
   */
  private async getOrCreateCustomer(customerInfo: StripeCustomerInfo): Promise<string> {
    if (!this.stripe) {
      throw new Error('Stripe not initialized')
    }

    try {
      // Search for existing customer by email
      const existingCustomers = await this.stripe.customers.list({
        email: customerInfo.email,
        limit: 1
      })

      if (existingCustomers.data.length > 0) {
        return existingCustomers.data[0].id
      }

      // Create new customer
      const newCustomer = await this.stripe.customers.create({
        email: customerInfo.email,
        name: customerInfo.name,
        description: customerInfo.description || 'CareXPS Healthcare CRM Customer'
      })

      return newCustomer.id
    } catch (error) {
      console.error('Failed to get or create Stripe customer:', error)
      throw error
    }
  }

  /**
   * Create a Stripe invoice
   */
  public async createInvoice(options: CreateInvoiceOptions): Promise<{
    success: boolean
    invoiceId?: string
    invoiceUrl?: string
    error?: string
  }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Stripe not initialized. Please configure Stripe API key first.'
      }
    }

    try {
      // Calculate invoice data
      const invoiceData = await this.calculateInvoiceData(
        options.dateRange.start,
        options.dateRange.end
      )

      // Check if there are any charges
      if (invoiceData.combinedTotal <= 0) {
        return {
          success: false,
          error: 'No charges found for the selected date range'
        }
      }

      // Get or create customer
      const customerId = await this.getOrCreateCustomer(options.customerInfo)

      // Create invoice items
      const stripe = this.stripe!

      // Add call costs
      for (const item of invoiceData.callCosts.items) {
        await stripe.invoiceItems.create({
          customer: customerId,
          amount: Math.round(item.amount_total * 100), // Convert to cents
          currency: 'cad',
          description: item.description
        })
      }

      // Add SMS costs
      for (const item of invoiceData.smsCosts.items) {
        await stripe.invoiceItems.create({
          customer: customerId,
          amount: Math.round(item.amount_total * 100), // Convert to cents
          currency: 'cad',
          description: item.description
        })
      }

      // Create the invoice
      const invoice = await stripe.invoices.create({
        customer: customerId,
        auto_advance: options.autoFinalize !== false,
        collection_method: 'send_invoice',
        days_until_due: options.dueDate
          ? Math.ceil((options.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : 30,
        description: `CareXPS Services - ${options.dateRange.label || invoiceData.dateRange.label}`,
        metadata: {
          service: 'CareXPS Healthcare CRM',
          date_range_start: options.dateRange.start.toISOString(),
          date_range_end: options.dateRange.end.toISOString(),
          total_calls: invoiceData.callCosts.totalCalls.toString(),
          total_chats: invoiceData.smsCosts.totalChats.toString(),
          total_segments: invoiceData.smsCosts.totalSegments.toString()
        }
      })

      // Finalize and send if requested
      if (options.sendImmediately) {
        await stripe.invoices.finalizeInvoice(invoice.id)
        await stripe.invoices.sendInvoice(invoice.id)
      }

      // Log audit event
      await AuditService.logAction(
        'STRIPE_INVOICE_CREATED',
        'stripe_invoice',
        {
          invoiceId: invoice.id,
          customerId,
          totalAmount: invoiceData.combinedTotal,
          currency: 'CAD',
          dateRange: invoiceData.dateRange.label,
          sentImmediately: options.sendImmediately || false
        }
      )

      return {
        success: true,
        invoiceId: invoice.id,
        invoiceUrl: invoice.hosted_invoice_url || undefined
      }
    } catch (error) {
      console.error('Failed to create Stripe invoice:', error)

      await AuditService.createSecurityEvent({
        action: 'STRIPE_INVOICE_CREATION_FAILED',
        resource: 'stripe_invoice',
        success: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          customerEmail: options.customerInfo.email
        },
        severity: 'high'
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create invoice'
      }
    }
  }

  /**
   * Generate automatic monthly invoice
   * Calculates costs for previous month and creates invoice
   */
  public async generateMonthlyInvoice(customerInfo: StripeCustomerInfo): Promise<{
    success: boolean
    invoiceId?: string
    invoiceUrl?: string
    error?: string
  }> {
    // Calculate previous month date range
    const now = new Date()
    const firstDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDayOfPreviousMonth = new Date(firstDayOfCurrentMonth.getTime() - 1)
    const firstDayOfPreviousMonth = new Date(lastDayOfPreviousMonth.getFullYear(), lastDayOfPreviousMonth.getMonth(), 1)

    return this.createInvoice({
      customerInfo,
      dateRange: {
        start: firstDayOfPreviousMonth,
        end: lastDayOfPreviousMonth,
        label: `${firstDayOfPreviousMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}`
      },
      sendImmediately: true,
      autoFinalize: true
    })
  }

  /**
   * Preview invoice data without creating in Stripe
   */
  public async previewInvoice(startDate: Date, endDate: Date): Promise<InvoiceData> {
    return this.calculateInvoiceData(startDate, endDate)
  }
}

// Export singleton instance
export const stripeInvoiceService = new StripeInvoiceService()
export default stripeInvoiceService

// Export types
export type { InvoiceData, InvoiceLineItem, StripeCustomerInfo, CreateInvoiceOptions }
