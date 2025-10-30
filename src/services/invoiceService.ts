/**
 * Invoice Service for Database Operations
 * Handles saving and retrieving invoice records from Supabase
 */

import { supabase } from '@/config/supabase'

export interface InvoiceData {
  invoice_number: string
  customer_email: string
  customer_name: string
  date_range: string
  total_amount: number
  currency: string
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible'
  stripe_invoice_id: string
  stripe_invoice_url: string
  pdf_download_url: string | null
  call_count: number
  call_cost: number
  sms_count: number
  sms_cost: number
  tenant_id: string
  due_date?: string
  paid_at?: string
  metadata?: Record<string, any>
}

export interface Invoice extends InvoiceData {
  id: string
  created_at: string
}

/**
 * Save invoice to database after successful generation
 * @param invoiceData - Invoice data to save
 * @returns Success status and saved invoice data
 */
export const saveInvoiceToDatabase = async (
  invoiceData: InvoiceData
): Promise<{ success: boolean; data?: Invoice; error?: string }> => {
  try {
    console.log('💾 Saving invoice to database...')

    const { data, error } = await supabase
      .from('invoices')
      .insert([invoiceData])
      .select()
      .single()

    if (error) {
      console.error('❌ Error saving invoice to database:', error)
      return { success: false, error: error.message }
    }

    console.log('✅ Invoice saved to database:', data.id)
    return { success: true, data: data as Invoice }
  } catch (error: any) {
    console.error('❌ Failed to save invoice:', error)
    return { success: false, error: error.message || 'Unknown error saving invoice' }
  }
}

/**
 * Get all invoices for the current tenant
 * @param tenantId - Tenant ID to filter invoices
 * @returns List of invoices
 */
export const getInvoices = async (
  tenantId: string
): Promise<{ success: boolean; data?: Invoice[]; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error loading invoices:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data as Invoice[] }
  } catch (error: any) {
    console.error('❌ Failed to load invoices:', error)
    return { success: false, error: error.message || 'Unknown error loading invoices' }
  }
}

/**
 * Get a single invoice by ID
 * @param invoiceId - Invoice ID
 * @returns Invoice data
 */
export const getInvoiceById = async (
  invoiceId: string
): Promise<{ success: boolean; data?: Invoice; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    if (error) {
      console.error('❌ Error loading invoice:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data as Invoice }
  } catch (error: any) {
    console.error('❌ Failed to load invoice:', error)
    return { success: false, error: error.message || 'Unknown error loading invoice' }
  }
}

/**
 * Update invoice status (e.g., when paid via webhook)
 * @param invoiceId - Invoice ID
 * @param status - New status
 * @param paidAt - Optional paid timestamp
 * @returns Success status
 */
export const updateInvoiceStatus = async (
  invoiceId: string,
  status: InvoiceData['status'],
  paidAt?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const updateData: any = { status }
    if (paidAt) {
      updateData.paid_at = paidAt
    }

    const { error } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', invoiceId)

    if (error) {
      console.error('❌ Error updating invoice status:', error)
      return { success: false, error: error.message }
    }

    console.log('✅ Invoice status updated:', invoiceId, status)
    return { success: true }
  } catch (error: any) {
    console.error('❌ Failed to update invoice status:', error)
    return { success: false, error: error.message || 'Unknown error updating invoice' }
  }
}

/**
 * Delete an invoice (Super User only)
 * @param invoiceId - Invoice ID to delete
 * @returns Success status
 */
export const deleteInvoice = async (
  invoiceId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', invoiceId)

    if (error) {
      console.error('❌ Error deleting invoice:', error)
      return { success: false, error: error.message }
    }

    console.log('✅ Invoice deleted:', invoiceId)
    return { success: true }
  } catch (error: any) {
    console.error('❌ Failed to delete invoice:', error)
    return { success: false, error: error.message || 'Unknown error deleting invoice' }
  }
}
