/**
 * Currency Service for USD to CAD Conversion
 *
 * Handles automatic exchange rate fetching and conversion for call costs.
 * Updates rates every 4 hours from free APIs while ensuring HIPAA compliance.
 */

import { supabase } from '@/config/supabase'

interface ExchangeRate {
  id: string
  from_currency: string
  to_currency: string
  rate: number
  last_updated: string
  is_active: boolean
  created_at: string
}

interface CurrencyApiResponse {
  result: string
  rates: {
    CAD: number
  }
}

class CurrencyService {
  private currentRate: number = 1.35 // Fallback rate
  private lastUpdate: Date = new Date(0)
  private updateInterval: number = 4 * 60 * 60 * 1000 // 4 hours in milliseconds
  private intervalId: NodeJS.Timeout | null = null

  constructor() {
    this.initialize()
  }

  private async initialize() {
    try {
      // Load current rate from database
      await this.loadCurrentRate()

      // Start automatic updates
      this.startAutoUpdate()

      // Check if we need to update immediately
      const timeSinceUpdate = Date.now() - this.lastUpdate.getTime()
      if (timeSinceUpdate >= this.updateInterval) {
        await this.updateExchangeRate()
      }

      console.log('💱 Currency service initialized with rate:', this.currentRate, 'CAD per USD')
    } catch (error) {
      console.error('💱 Currency service initialization failed:', error)
    }
  }

  private async loadCurrentRate() {
    try {
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .eq('from_currency', 'USD')
        .eq('to_currency', 'CAD')
        .eq('is_active', true)
        .order('last_updated', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        console.log('💱 No exchange rate found in database or connection unavailable, using fallback rate')
        return
      }

      this.currentRate = data.rate
      this.lastUpdate = new Date(data.last_updated)

      console.log('💱 Loaded exchange rate from database:', this.currentRate, 'CAD per USD')
    } catch (error) {
      // Gracefully handle connection failures - don't spam the console
      if (error instanceof Error && (error.message.includes('Failed to fetch') || error.message.includes('ERR_CONNECTION_REFUSED'))) {
        console.log('💱 Database connection unavailable, using fallback exchange rate')
      } else {
        console.log('💱 Error loading exchange rate from database, using fallback:', error instanceof Error ? error.message : 'Unknown error')
      }
    }
  }

  private startAutoUpdate() {
    // Clear any existing interval
    if (this.intervalId) {
      clearInterval(this.intervalId)
    }

    // Set up 4-hour update cycle
    this.intervalId = setInterval(async () => {
      await this.updateExchangeRate()
    }, this.updateInterval)

    console.log('💱 Auto-update started: checking every 4 hours')
  }

  private async updateExchangeRate() {
    try {
      console.log('💱 Fetching new exchange rate...')

      const newRate = await this.fetchRateFromAPI()
      if (!newRate) {
        console.warn('💱 Failed to fetch new rate, keeping current rate:', this.currentRate)
        return
      }

      // Save new rate to database
      await this.saveRateToDatabase(newRate)

      // Update local cache
      this.currentRate = newRate
      this.lastUpdate = new Date()

      console.log('💱 Exchange rate updated:', newRate, 'CAD per USD')
    } catch (error) {
      console.error('💱 Error updating exchange rate:', error)
    }
  }

  private async fetchRateFromAPI(): Promise<number | null> {
    // Primary API: exchangerate-api.com (free, no API key required)
    const primaryUrl = 'https://api.exchangerate-api.com/v4/latest/USD'

    // Backup API: open.er-api.com (free backup)
    const backupUrl = 'https://open.er-api.com/v6/latest/USD'

    try {
      // Try primary API first
      const response = await fetch(primaryUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        // No PHI data sent - only currency codes
      })

      if (response.ok) {
        const data: CurrencyApiResponse = await response.json()
        if (data.rates && data.rates.CAD) {
          console.log('💱 Primary API success:', data.rates.CAD)
          return data.rates.CAD
        }
      }
    } catch (error) {
      console.warn('💱 Primary API failed:', error)
    }

    try {
      // Try backup API
      const response = await fetch(backupUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      })

      if (response.ok) {
        const data: CurrencyApiResponse = await response.json()
        if (data.rates && data.rates.CAD) {
          console.log('💱 Backup API success:', data.rates.CAD)
          return data.rates.CAD
        }
      }
    } catch (error) {
      console.warn('💱 Backup API failed:', error)
    }

    return null
  }

  private async saveRateToDatabase(rate: number) {
    try {
      // First, deactivate old rates
      await supabase
        .from('exchange_rates')
        .update({ is_active: false })
        .eq('from_currency', 'USD')
        .eq('to_currency', 'CAD')

      // Insert new active rate
      const { error } = await supabase
        .from('exchange_rates')
        .insert({
          from_currency: 'USD',
          to_currency: 'CAD',
          rate: rate,
          last_updated: new Date().toISOString(),
          is_active: true
        })

      if (error) {
        console.log('💱 Cannot save rate to database (connection unavailable), using in-memory fallback')
        return
      }

      console.log('💱 Rate saved to database successfully')
    } catch (error) {
      // Gracefully handle connection failures
      if (error instanceof Error && (error.message.includes('Failed to fetch') || error.message.includes('ERR_CONNECTION_REFUSED'))) {
        console.log('💱 Database connection unavailable, rate will be kept in memory only')
      } else {
        console.log('💱 Database save error, rate will be kept in memory only:', error instanceof Error ? error.message : 'Unknown error')
      }
    }
  }

  /**
   * Convert USD amount to CAD using current exchange rate
   */
  public convertUSDToCAD(usdAmount: number): number {
    if (!usdAmount || usdAmount <= 0) return 0
    return usdAmount * this.currentRate
  }

  /**
   * Get current exchange rate
   */
  public getCurrentRate(): number {
    return this.currentRate
  }

  /**
   * Get last update time
   */
  public getLastUpdate(): Date {
    return this.lastUpdate
  }

  /**
   * Format CAD amount for display
   */
  public formatCAD(cadAmount: number): string {
    return `CAD $${cadAmount.toFixed(2)}`
  }

  /**
   * Get rate source information
   */
  public getRateInfo(): string {
    const timeDiff = Date.now() - this.lastUpdate.getTime()
    const hoursDiff = Math.floor(timeDiff / (1000 * 60 * 60))

    if (hoursDiff < 1) {
      return 'Updated less than 1 hour ago'
    } else if (hoursDiff === 1) {
      return 'Updated 1 hour ago'
    } else {
      return `Updated ${hoursDiff} hours ago`
    }
  }

  /**
   * Manual rate refresh (for debugging/admin use)
   */
  public async forceUpdate(): Promise<boolean> {
    try {
      await this.updateExchangeRate()
      return true
    } catch (error) {
      console.error('💱 Force update failed:', error)
      return false
    }
  }

  /**
   * Cleanup when service is destroyed
   */
  public destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }
}

// Export singleton instance
export const currencyService = new CurrencyService()
export default currencyService