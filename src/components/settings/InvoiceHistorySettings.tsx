/**
 * Invoice History Settings Component
 * Displays all generated invoices with search and filtering capabilities
 */

import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import {
  SearchIcon,
  DollarSignIcon,
  FileTextIcon,
  CalendarIcon,
  MailIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  Loader2Icon,
  RefreshCwIcon,
  DownloadIcon,
  RefreshCcw
} from 'lucide-react'
import { getInvoices, Invoice, updateInvoiceStatus, saveInvoiceToDatabase, type InvoiceData } from '@/services/invoiceService'
import { getCurrentTenantId } from '@/config/tenantConfig'
import { ToastContainer, type ToastProps } from '@/components/common/Toast'

const statusColors = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  open: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  paid: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  void: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  uncollectible: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
}

const statusIcons = {
  draft: ClockIcon,
  open: FileTextIcon,
  paid: CheckCircleIcon,
  void: XCircleIcon,
  uncollectible: XCircleIcon
}

export const InvoiceHistorySettings: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [toasts, setToasts] = useState<ToastProps[]>([])

  const showToast = (type: ToastProps['type'], title: string, message: string, duration = 5000) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    const newToast: ToastProps = {
      id,
      type,
      title,
      message,
      duration,
      onClose: removeToast
    }
    setToasts(prev => [...prev, newToast])
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  useEffect(() => {
    loadInvoices()
  }, [])

  const loadInvoices = async () => {
    try {
      setLoading(true)
      const tenantId = getCurrentTenantId()

      // Load from Supabase
      const result = await getInvoices(tenantId)

      if (result.success && result.data) {
        setInvoices(result.data)
      } else {
        console.error('Error loading invoices:', result.error)
      }
    } catch (error) {
      console.error('Failed to load invoices:', error)
    } finally {
      setLoading(false)
    }
  }

  const syncFromStripe = async () => {
    try {
      setSyncing(true)

      const stripeSecretKey = import.meta.env.VITE_STRIPE_SECRET_KEY
      const stripeCustomerId = import.meta.env.VITE_STRIPE_CUSTOMER_ID

      if (!stripeSecretKey) {
        showToast('error', 'Configuration Error', 'Stripe API key not configured.\nPlease add VITE_STRIPE_SECRET_KEY to your .env.local file.')
        return
      }

      if (!stripeCustomerId) {
        showToast('error', 'Configuration Error', 'Stripe Customer ID not configured.\nPlease add VITE_STRIPE_CUSTOMER_ID to your .env.local file.')
        return
      }

      console.log('🔄 Syncing invoices for customer:', stripeCustomerId)
      console.log('📄 Fetching all pages of invoices from Stripe...')

      // Fetch ALL invoices from Stripe with pagination
      let allStripeInvoices: any[] = []
      let hasMore = true
      let startingAfter: string | undefined = undefined
      let pageCount = 0

      while (hasMore) {
        pageCount++
        const url = new URL('https://api.stripe.com/v1/invoices')
        url.searchParams.append('customer', stripeCustomerId)
        url.searchParams.append('limit', '100') // Max per page
        if (startingAfter) {
          url.searchParams.append('starting_after', startingAfter)
        }

        console.log(`📖 Fetching page ${pageCount}...`)

        const response = await fetch(url.toString(), {
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`
          }
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(`Stripe API error: ${errorData.error?.message || 'Unknown error'}`)
        }

        const pageData = await response.json()
        allStripeInvoices.push(...pageData.data)

        console.log(`  ✓ Page ${pageCount}: ${pageData.data.length} invoice(s)`)

        hasMore = pageData.has_more
        if (hasMore && pageData.data.length > 0) {
          startingAfter = pageData.data[pageData.data.length - 1].id
        }
      }

      console.log(`📊 Total: ${allStripeInvoices.length} invoice(s) found in Stripe across ${pageCount} page(s)`)

      // Log invoice details for debugging
      allStripeInvoices.forEach(inv => {
        console.log(`  - Invoice ${inv.number || inv.id}: $${(inv.amount_due / 100).toFixed(2)} (${inv.status})`)
      })

      let updatedCount = 0
      let skippedCount = 0
      let importedCount = 0

      // Get current user for tenant_id
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
      const tenantId = currentUser.tenant_id || 'medex'

      // Update status for existing invoices, import new ones
      for (const stripeInvoice of allStripeInvoices) {
        const existingInvoice = invoices.find(inv => inv.stripe_invoice_id === stripeInvoice.id)

        if (existingInvoice) {
          if (existingInvoice.status !== stripeInvoice.status) {
            console.log(`📝 Updating invoice ${stripeInvoice.number}: ${existingInvoice.status} → ${stripeInvoice.status}`)

            const result = await updateInvoiceStatus(
              existingInvoice.id!,
              stripeInvoice.status as Invoice['status']
            )

            if (result.success) {
              updatedCount++
            }
          } else {
            skippedCount++
          }
        } else {
          // Invoice exists in Stripe but not locally - import it
          console.log(`📥 Importing invoice ${stripeInvoice.number || stripeInvoice.id} from Stripe...`)

          // Parse dates from metadata or use invoice dates
          const dateRangeStart = stripeInvoice.metadata?.date_range_start
            ? new Date(stripeInvoice.metadata.date_range_start).toLocaleDateString()
            : new Date(stripeInvoice.created * 1000).toLocaleDateString()

          const dateRangeEnd = stripeInvoice.metadata?.date_range_end
            ? new Date(stripeInvoice.metadata.date_range_end).toLocaleDateString()
            : new Date(stripeInvoice.created * 1000).toLocaleDateString()

          const invoiceData: InvoiceData = {
            invoice_number: stripeInvoice.number || stripeInvoice.id,
            customer_email: stripeInvoice.customer_email || stripeCustomerId,
            customer_name: stripeInvoice.customer_name || 'Stripe Customer',
            date_range: `${dateRangeStart} - ${dateRangeEnd}`,
            total_amount: stripeInvoice.amount_due / 100, // Convert from cents
            currency: stripeInvoice.currency.toUpperCase(),
            status: stripeInvoice.status as Invoice['status'],
            stripe_invoice_id: stripeInvoice.id,
            stripe_invoice_url: stripeInvoice.hosted_invoice_url || '',
            pdf_download_url: stripeInvoice.invoice_pdf || null,
            call_count: parseInt(stripeInvoice.metadata?.total_calls || '0'),
            call_cost: 0, // Not stored separately in Stripe
            sms_count: parseInt(stripeInvoice.metadata?.total_chats || '0'),
            sms_cost: 0, // Not stored separately in Stripe
            tenant_id: tenantId,
            due_date: stripeInvoice.due_date ? new Date(stripeInvoice.due_date * 1000).toISOString() : undefined,
            paid_at: stripeInvoice.status_transitions?.paid_at
              ? new Date(stripeInvoice.status_transitions.paid_at * 1000).toISOString()
              : undefined,
            metadata: stripeInvoice.metadata
          }

          const result = await saveInvoiceToDatabase(invoiceData)

          if (result.success) {
            importedCount++
            console.log(`  ✅ Imported invoice ${stripeInvoice.number}`)
          } else {
            console.error(`  ❌ Failed to import invoice ${stripeInvoice.number}:`, result.error)
          }
        }
      }

      // Reload invoices to show updated and imported invoices
      await loadInvoices()

      console.log(`✅ Sync complete: ${updatedCount} updated, ${skippedCount} unchanged, ${importedCount} imported`)

      const message = `${allStripeInvoices.length} invoice(s) found in Stripe\n${updatedCount} updated • ${skippedCount} up to date${importedCount > 0 ? `\n✨ ${importedCount} new invoice(s) imported` : ''}`

      showToast('success', 'Sync Complete', message, 7000)
    } catch (error) {
      console.error('❌ Error syncing from Stripe:', error)
      showToast('error', 'Sync Failed', `${error instanceof Error ? error.message : 'Unknown error'}\n\nCheck console for details.`, 8000)
    } finally {
      setSyncing(false)
    }
  }

  const exportToCSV = () => {
    if (filteredInvoices.length === 0) {
      showToast('warning', 'No Data', 'No invoices available to export.', 3000)
      return
    }

    // CSV headers
    const headers = [
      'Invoice Number',
      'Customer Name',
      'Customer Email',
      'Date Range',
      'Amount',
      'Currency',
      'Status',
      'Call Count',
      'Call Cost',
      'SMS Count',
      'SMS Cost',
      'Created At',
      'Stripe Invoice URL',
      'PDF Download URL'
    ]

    // CSV rows
    const rows = filteredInvoices.map(invoice => [
      invoice.invoice_number,
      invoice.customer_name,
      invoice.customer_email,
      invoice.date_range,
      invoice.total_amount.toFixed(2),
      invoice.currency.toUpperCase(),
      invoice.status,
      invoice.call_count,
      invoice.call_cost.toFixed(2),
      invoice.sms_count,
      invoice.sms_cost.toFixed(2),
      format(new Date(invoice.created_at), 'yyyy-MM-dd HH:mm:ss'),
      invoice.stripe_invoice_url,
      invoice.pdf_download_url || ''
    ])

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    const filename = `invoices_${format(new Date(), 'yyyy-MM-dd')}.csv`
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    showToast('success', 'Export Complete', `Downloaded ${filteredInvoices.length} invoice(s) to ${filename}`, 4000)
  }

  // Filter invoices
  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customer_name.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter

    return matchesSearch && matchesStatus
  })

  // Calculate summary stats
  const totalInvoices = filteredInvoices.length
  const paidInvoices = filteredInvoices.filter((i) => i.status === 'paid').length
  const openInvoices = filteredInvoices.filter((i) => i.status === 'open').length
  const totalPaid = filteredInvoices
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + i.total_amount, 0)

  return (
    <>
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Invoice History</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              View and manage all generated invoices
            </p>
          </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={loadInvoices}
            disabled={loading || syncing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh invoice list"
          >
            <RefreshCwIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={syncFromStripe}
            disabled={loading || syncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Sync invoice statuses from Stripe"
          >
            {syncing ? (
              <Loader2Icon className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCcw className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{syncing ? 'Syncing...' : 'Sync from Stripe'}</span>
          </button>

          <button
            onClick={exportToCSV}
            disabled={loading || filteredInvoices.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Export to CSV"
          >
            <DownloadIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by invoice number, email, or customer name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="open">Open</option>
          <option value="paid">Paid</option>
          <option value="void">Void</option>
          <option value="uncollectible">Uncollectible</option>
        </select>
      </div>

      {/* Invoice Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <Loader2Icon className="inline-block animate-spin w-8 h-8 text-blue-600 mb-2" />
            <p className="text-gray-600 dark:text-gray-400">Loading invoices...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-8 text-center">
            <FileTextIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">
              {searchTerm || statusFilter !== 'all'
                ? 'No invoices match your filters'
                : 'No invoices generated yet'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Invoice #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Date Range
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredInvoices.map((invoice) => {
                  const StatusIcon = statusIcons[invoice.status]

                  return (
                    <tr
                      key={invoice.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {invoice.invoice_number}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {invoice.customer_name}
                          </div>
                          <div className="text-gray-500 dark:text-gray-400">
                            {invoice.customer_email}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {invoice.date_range}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {invoice.currency.toUpperCase()} ${invoice.total_amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                            statusColors[invoice.status]
                          }`}
                        >
                          <StatusIcon className="w-3.5 h-3.5" />
                          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {format(new Date(invoice.created_at), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <a
                            href={invoice.stripe_invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                          >
                            View Invoice
                          </a>
                          {invoice.pdf_download_url && (
                            <>
                              <span className="text-gray-300 dark:text-gray-600">|</span>
                              <a
                                href={invoice.pdf_download_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 text-sm font-medium"
                              >
                                Download PDF
                              </a>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {filteredInvoices.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <div className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-1">
              Total Invoices
            </div>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {totalInvoices}
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
            <div className="text-sm text-green-700 dark:text-green-300 font-medium mb-1">Paid</div>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {paidInvoices}
            </div>
          </div>

          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
            <div className="text-sm text-orange-700 dark:text-orange-300 font-medium mb-1">
              Open
            </div>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {openInvoices}
            </div>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
            <div className="text-sm text-purple-700 dark:text-purple-300 font-medium mb-1">
              Total Paid
            </div>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              CAD ${totalPaid.toFixed(2)}
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
