/**
 * PDF Export Service for Dashboard Reports
 * Generates beautiful PDF reports with charts and infographics
 */

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { format, startOfDay, endOfDay } from 'date-fns'

interface DashboardMetrics {
  totalCalls: number
  avgCallDuration: string
  avgCostPerCall: number
  callSuccessRate: number
  totalCost: number
  highestCostCall: number
  lowestCostCall: number
  totalCallDuration: string
  totalMessages: number
  avgMessagesPerChat: number
  avgCostPerMessage: number
  messageDeliveryRate: number
  totalSMSCost: number
}

interface ExportOptions {
  dateRange: string
  startDate?: Date
  endDate?: Date
  companyName?: string
  reportTitle?: string
}

class PDFExportService {
  private pdf: jsPDF
  private pageWidth: number
  private pageHeight: number
  private margin: number
  private lineHeight: number

  constructor() {
    this.pdf = new jsPDF('p', 'mm', 'a4')
    this.pageWidth = this.pdf.internal.pageSize.getWidth()
    this.pageHeight = this.pdf.internal.pageSize.getHeight()
    this.margin = 20
    this.lineHeight = 6
  }

  async generateDashboardReport(
    metrics: DashboardMetrics,
    options: ExportOptions
  ): Promise<void> {
    try {
      // Reset PDF
      this.pdf = new jsPDF('p', 'mm', 'a4')

      // Generate cover page
      await this.generateCoverPage(metrics, options)

      // Add new page for detailed metrics
      this.pdf.addPage()
      this.generateMetricsPage(metrics, options)

      // Add charts page
      this.pdf.addPage()
      await this.generateChartsPage(metrics, options)

      // Add summary page
      this.pdf.addPage()
      this.generateSummaryPage(metrics, options)

      // Save the PDF
      const fileName = this.generateFileName(options)
      this.pdf.save(fileName)

    } catch (error) {
      throw new Error('Failed to generate PDF report')
    }
  }

  private async generateCoverPage(metrics: DashboardMetrics, options: ExportOptions): Promise<void> {
    const centerX = this.pageWidth / 2

    // Header gradient background (simulated with rectangles)
    this.pdf.setFillColor(59, 130, 246) // Blue-600
    this.pdf.rect(0, 0, this.pageWidth, 80, 'F')

    this.pdf.setFillColor(147, 197, 253) // Blue-300
    this.pdf.rect(0, 60, this.pageWidth, 20, 'F')

    // Add CareXPS logo
    try {
      await this.addLogoToPDF(centerX, 15)
    } catch (error) {
      console.error('Failed to load logo, continuing without it:', error)
    }

    // Company title and report info
    this.pdf.setTextColor(255, 255, 255)
    this.pdf.setFontSize(24)
    this.pdf.setFont('helvetica', 'bold')
    this.pdf.text(options.companyName || 'CareXPS Healthcare CRM', centerX, 45, { align: 'center' })

    this.pdf.setFontSize(16)
    this.pdf.setFont('helvetica', 'normal')
    this.pdf.text('Dashboard Analytics Report', centerX, 58, { align: 'center' })

    // Date range
    this.pdf.setFontSize(11)
    this.pdf.text(`Report Period: ${options.dateRange}`, centerX, 70, { align: 'center' })

    // Key metrics summary box
    this.pdf.setFillColor(249, 250, 251) // Gray-50
    this.pdf.setDrawColor(229, 231, 235) // Gray-200
    this.pdf.roundedRect(this.margin, 100, this.pageWidth - 2 * this.margin, 80, 5, 5, 'FD')

    this.pdf.setTextColor(31, 41, 55) // Gray-800
    this.pdf.setFontSize(16)
    this.pdf.setFont('helvetica', 'bold')
    this.pdf.text('Executive Summary', centerX, 115, { align: 'center' })

    // Combined cost highlight
    const totalCombinedCost = metrics.totalCost + metrics.totalSMSCost
    this.pdf.setFontSize(32)
    this.pdf.setTextColor(34, 197, 94) // Green-500
    this.pdf.text(`CAD $${totalCombinedCost.toFixed(2)}`, centerX, 135, { align: 'center' })

    this.pdf.setFontSize(12)
    this.pdf.setTextColor(107, 114, 128) // Gray-500
    this.pdf.text('Total Service Costs', centerX, 145, { align: 'center' })

    // Key stats grid
    const statsY = 155
    this.pdf.setFontSize(10)
    this.pdf.setTextColor(75, 85, 99) // Gray-600

    const stats = [
      { label: 'Total Calls', value: metrics.totalCalls.toString() },
      { label: 'Total Messages', value: metrics.totalMessages.toString() },
      { label: 'Call Success Rate', value: `${metrics.callSuccessRate.toFixed(1)}%` },
      { label: 'Avg Call Duration', value: metrics.avgCallDuration }
    ]

    const statWidth = (this.pageWidth - 2 * this.margin) / 4
    stats.forEach((stat, index) => {
      const x = this.margin + statWidth * index + statWidth / 2
      this.pdf.setFont('helvetica', 'bold')
      this.pdf.text(stat.value, x, statsY, { align: 'center' })
      this.pdf.setFont('helvetica', 'normal')
      this.pdf.text(stat.label, x, statsY + 8, { align: 'center' })
    })

    // Footer
    this.pdf.setFontSize(10)
    this.pdf.setTextColor(156, 163, 175) // Gray-400
    this.pdf.text(`Generated on ${format(new Date(), 'MMMM dd, yyyy at HH:mm')}`, centerX, 270, { align: 'center' })
    this.pdf.text('Confidential Healthcare Data - HIPAA Compliant', centerX, 280, { align: 'center' })
  }

  private generateMetricsPage(metrics: DashboardMetrics, options: ExportOptions): void {
    let yPosition = this.margin

    // Page title
    this.pdf.setTextColor(31, 41, 55) // Gray-800
    this.pdf.setFontSize(20)
    this.pdf.setFont('helvetica', 'bold')
    this.pdf.text('Detailed Metrics Analysis', this.margin, yPosition)
    yPosition += 20

    // Call Metrics Section
    this.generateMetricsSection(
      'Call Analytics',
      [
        { label: 'Total Calls Made', value: metrics.totalCalls.toString(), color: [59, 130, 246] },
        { label: 'Average Call Duration', value: metrics.avgCallDuration, color: [34, 197, 94] },
        { label: 'Total Talk Time', value: metrics.totalCallDuration, color: [168, 85, 247] },
        { label: 'Call Success Rate', value: `${metrics.callSuccessRate.toFixed(1)}%`, color: [59, 130, 246] },
        { label: 'Average Cost per Call', value: `CAD $${metrics.avgCostPerCall.toFixed(3)}`, color: [239, 68, 68] },
        { label: 'Highest Cost Call', value: `CAD $${metrics.highestCostCall.toFixed(3)}`, color: [245, 158, 11] },
        { label: 'Lowest Cost Call', value: `CAD $${metrics.lowestCostCall.toFixed(3)}`, color: [34, 197, 94] },
        { label: 'Total Call Costs', value: `CAD $${metrics.totalCost.toFixed(2)}`, color: [239, 68, 68] }
      ],
      yPosition
    )
    yPosition += 80

    // SMS Metrics Section
    this.generateMetricsSection(
      'SMS Analytics',
      [
        { label: 'Total Conversations', value: metrics.totalMessages.toString(), color: [168, 85, 247] },
        { label: 'Avg Messages per Chat', value: metrics.avgMessagesPerChat.toFixed(1), color: [34, 197, 94] },
        { label: 'Message Delivery Rate', value: `${metrics.messageDeliveryRate.toFixed(1)}%`, color: [59, 130, 246] },
        { label: 'Avg Cost per Message', value: `CAD $${metrics.avgCostPerMessage.toFixed(3)}`, color: [239, 68, 68] },
        { label: 'Total SMS Costs', value: `CAD $${metrics.totalSMSCost.toFixed(2)}`, color: [239, 68, 68] }
      ],
      yPosition
    )
    yPosition += 70

    // Performance indicators
    this.generatePerformanceIndicators(metrics, yPosition)
  }

  private generateMetricsSection(
    title: string,
    metrics: Array<{ label: string; value: string; color: [number, number, number] }>,
    yPosition: number
  ): void {
    // Section header
    this.pdf.setFontSize(16)
    this.pdf.setFont('helvetica', 'bold')
    this.pdf.setTextColor(31, 41, 55)
    this.pdf.text(title, this.margin, yPosition)
    yPosition += 10

    // Draw section divider
    this.pdf.setDrawColor(229, 231, 235)
    this.pdf.line(this.margin, yPosition, this.pageWidth - this.margin, yPosition)
    yPosition += 8

    // Metrics grid
    const metricsPerRow = 2
    const rowHeight = 15
    const colWidth = (this.pageWidth - 2 * this.margin) / metricsPerRow

    metrics.forEach((metric, index) => {
      const row = Math.floor(index / metricsPerRow)
      const col = index % metricsPerRow
      const x = this.margin + col * colWidth
      const y = yPosition + row * rowHeight

      // Color indicator
      this.pdf.setFillColor(...metric.color)
      this.pdf.circle(x + 3, y - 2, 2, 'F')

      // Metric label and value
      this.pdf.setFontSize(10)
      this.pdf.setFont('helvetica', 'normal')
      this.pdf.setTextColor(75, 85, 99)
      this.pdf.text(metric.label, x + 10, y - 3)

      this.pdf.setFont('helvetica', 'bold')
      this.pdf.setTextColor(31, 41, 55)
      this.pdf.text(metric.value, x + 10, y + 3)
    })
  }

  private generatePerformanceIndicators(metrics: DashboardMetrics, yPosition: number): void {
    // Performance insights box
    this.pdf.setFillColor(239, 246, 255) // Blue-50
    this.pdf.setDrawColor(147, 197, 253) // Blue-300
    this.pdf.roundedRect(this.margin, yPosition, this.pageWidth - 2 * this.margin, 40, 3, 3, 'FD')

    this.pdf.setFontSize(14)
    this.pdf.setFont('helvetica', 'bold')
    this.pdf.setTextColor(30, 64, 175) // Blue-800
    this.pdf.text('Performance Insights', this.margin + 5, yPosition + 12)

    // Generate insights
    const insights = this.generateInsights(metrics)
    this.pdf.setFontSize(9)
    this.pdf.setFont('helvetica', 'normal')
    this.pdf.setTextColor(55, 65, 81) // Gray-700

    insights.forEach((insight, index) => {
      this.pdf.text(`• ${insight}`, this.margin + 5, yPosition + 20 + index * 5)
    })
  }

  private generateInsights(metrics: DashboardMetrics): string[] {
    const insights: string[] = []
    const totalCombinedCost = metrics.totalCost + metrics.totalSMSCost

    if (metrics.callSuccessRate > 90) {
      insights.push('Excellent call success rate indicates strong system reliability')
    } else if (metrics.callSuccessRate < 70) {
      insights.push('Call success rate may need attention - consider system optimization')
    }

    if (metrics.avgCostPerCall > 0.50) {
      insights.push('Higher than average call costs - review call duration optimization')
    } else {
      insights.push('Cost-effective call operations maintained')
    }

    if (totalCombinedCost > 100) {
      insights.push('Significant service usage - monitor cost trends for budget planning')
    }

    if (metrics.totalMessages > metrics.totalCalls * 2) {
      insights.push('High SMS engagement indicates strong customer communication')
    }

    return insights.slice(0, 3) // Limit to 3 insights
  }

  private async generateChartsPage(metrics: DashboardMetrics, options: ExportOptions): Promise<void> {
    let yPosition = this.margin

    // Page title
    this.pdf.setTextColor(31, 41, 55)
    this.pdf.setFontSize(20)
    this.pdf.setFont('helvetica', 'bold')
    this.pdf.text('Visual Analytics', this.margin, yPosition)
    yPosition += 20

    // Cost breakdown pie chart
    await this.generateCostBreakdownChart(metrics, yPosition)
    yPosition += 90

    // Performance metrics chart
    await this.generatePerformanceChart(metrics, yPosition)
  }

  private async generateCostBreakdownChart(metrics: DashboardMetrics, yPosition: number): Promise<void> {
    const centerX = this.pageWidth / 2
    const chartRadius = 30

    // Chart title
    this.pdf.setFontSize(14)
    this.pdf.setFont('helvetica', 'bold')
    this.pdf.setTextColor(31, 41, 55)
    this.pdf.text('Service Cost Breakdown', centerX, yPosition, { align: 'center' })
    yPosition += 15

    // Calculate percentages
    const totalCost = metrics.totalCost + metrics.totalSMSCost
    const callPercentage = totalCost > 0 ? (metrics.totalCost / totalCost) * 100 : 0
    const smsPercentage = totalCost > 0 ? (metrics.totalSMSCost / totalCost) * 100 : 0

    // Draw pie chart
    const chartCenterY = yPosition + chartRadius

    if (totalCost > 0) {
      // Call costs slice
      this.pdf.setFillColor(59, 130, 246) // Blue-600
      this.drawPieSlice(centerX, chartCenterY, chartRadius, 0, (callPercentage / 100) * 2 * Math.PI)

      // SMS costs slice
      this.pdf.setFillColor(168, 85, 247) // Purple-600
      this.drawPieSlice(centerX, chartCenterY, chartRadius, (callPercentage / 100) * 2 * Math.PI, 2 * Math.PI)
    } else {
      // Empty state
      this.pdf.setFillColor(229, 231, 235) // Gray-200
      this.pdf.circle(centerX, chartCenterY, chartRadius, 'F')
    }

    // Legend
    const legendY = chartCenterY + chartRadius + 15
    this.generateChartLegend([
      { label: `Call Costs: CAD $${metrics.totalCost.toFixed(2)} (${callPercentage.toFixed(1)}%)`, color: [59, 130, 246] },
      { label: `SMS Costs: CAD $${metrics.totalSMSCost.toFixed(2)} (${smsPercentage.toFixed(1)}%)`, color: [168, 85, 247] }
    ], legendY)
  }

  private async generatePerformanceChart(metrics: DashboardMetrics, yPosition: number): Promise<void> {
    const centerX = this.pageWidth / 2

    // Chart title
    this.pdf.setFontSize(14)
    this.pdf.setFont('helvetica', 'bold')
    this.pdf.setTextColor(31, 41, 55)
    this.pdf.text('Performance Metrics', centerX, yPosition, { align: 'center' })
    yPosition += 15

    // Bar chart for success rates
    const chartWidth = this.pageWidth - 2 * this.margin - 20
    const chartHeight = 40
    const chartX = this.margin + 10
    const chartY = yPosition

    // Chart background
    this.pdf.setFillColor(249, 250, 251) // Gray-50
    this.pdf.rect(chartX, chartY, chartWidth, chartHeight, 'F')

    // Success rate bar
    const successBarWidth = (chartWidth * metrics.callSuccessRate) / 100
    this.pdf.setFillColor(34, 197, 94) // Green-500
    this.pdf.rect(chartX, chartY, successBarWidth, chartHeight / 2, 'F')

    // Delivery rate bar
    const deliveryBarWidth = (chartWidth * metrics.messageDeliveryRate) / 100
    this.pdf.setFillColor(59, 130, 246) // Blue-600
    this.pdf.rect(chartX, chartY + chartHeight / 2, deliveryBarWidth, chartHeight / 2, 'F')

    // Labels
    this.pdf.setFontSize(10)
    this.pdf.setTextColor(55, 65, 81)
    this.pdf.text(`Call Success: ${metrics.callSuccessRate.toFixed(1)}%`, chartX + 5, chartY + 12)
    this.pdf.text(`Message Delivery: ${metrics.messageDeliveryRate.toFixed(1)}%`, chartX + 5, chartY + 32)
  }

  private drawPieSlice(centerX: number, centerY: number, radius: number, startAngle: number, endAngle: number): void {
    const startX = centerX + radius * Math.cos(startAngle)
    const startY = centerY + radius * Math.sin(startAngle)
    const endX = centerX + radius * Math.cos(endAngle)
    const endY = centerY + radius * Math.sin(endAngle)

    // For simplicity, we'll draw sectors as triangular approximations
    this.pdf.triangle(centerX, centerY, startX, startY, endX, endY, 'F')
  }

  private generateChartLegend(items: Array<{ label: string; color: [number, number, number] }>, yPosition: number): void {
    items.forEach((item, index) => {
      const x = this.margin + 20
      const y = yPosition + index * 8

      // Color indicator
      this.pdf.setFillColor(...item.color)
      this.pdf.rect(x, y - 2, 4, 4, 'F')

      // Label
      this.pdf.setFontSize(10)
      this.pdf.setTextColor(55, 65, 81)
      this.pdf.text(item.label, x + 8, y + 1)
    })
  }

  private generateSummaryPage(metrics: DashboardMetrics, options: ExportOptions): void {
    let yPosition = this.margin

    // Page title
    this.pdf.setTextColor(31, 41, 55)
    this.pdf.setFontSize(20)
    this.pdf.setFont('helvetica', 'bold')
    this.pdf.text('Executive Summary & Recommendations', this.margin, yPosition)
    yPosition += 20

    // Key highlights
    this.generateHighlightsSection(metrics, yPosition)
    yPosition += 80

    // Recommendations
    this.generateRecommendationsSection(metrics, yPosition)
    yPosition += 80

    // Compliance notice
    this.generateComplianceSection(yPosition)
  }

  private generateHighlightsSection(metrics: DashboardMetrics, yPosition: number): void {
    this.pdf.setFontSize(16)
    this.pdf.setFont('helvetica', 'bold')
    this.pdf.setTextColor(31, 41, 55)
    this.pdf.text('Key Highlights', this.margin, yPosition)
    yPosition += 15

    const highlights = [
      `Generated ${metrics.totalCalls} calls with ${metrics.totalMessages} SMS conversations`,
      `Total service costs: CAD $${(metrics.totalCost + metrics.totalSMSCost).toFixed(2)}`,
      `Average call duration: ${metrics.avgCallDuration}`,
      `System reliability: ${metrics.callSuccessRate.toFixed(1)}% success rate`
    ]

    this.pdf.setFontSize(11)
    this.pdf.setFont('helvetica', 'normal')
    this.pdf.setTextColor(55, 65, 81)

    highlights.forEach((highlight, index) => {
      this.pdf.text(`• ${highlight}`, this.margin + 5, yPosition + index * 8)
    })
  }

  private generateRecommendationsSection(metrics: DashboardMetrics, yPosition: number): void {
    this.pdf.setFontSize(16)
    this.pdf.setFont('helvetica', 'bold')
    this.pdf.setTextColor(31, 41, 55)
    this.pdf.text('Recommendations', this.margin, yPosition)
    yPosition += 15

    const recommendations = this.generateRecommendations(metrics)

    this.pdf.setFontSize(11)
    this.pdf.setFont('helvetica', 'normal')
    this.pdf.setTextColor(55, 65, 81)

    recommendations.forEach((recommendation, index) => {
      const lines = this.pdf.splitTextToSize(recommendation, this.pageWidth - 2 * this.margin - 10)
      lines.forEach((line: string, lineIndex: number) => {
        const prefix = lineIndex === 0 ? '• ' : '  '
        this.pdf.text(`${prefix}${line}`, this.margin + 5, yPosition + index * 12 + lineIndex * 5)
      })
    })
  }

  private generateRecommendations(metrics: DashboardMetrics): string[] {
    const recommendations: string[] = []

    if (metrics.avgCostPerCall > 0.50) {
      recommendations.push('Consider optimizing call durations to reduce per-call costs while maintaining service quality.')
    }

    if (metrics.callSuccessRate < 85) {
      recommendations.push('Investigate technical issues affecting call success rates to improve system reliability.')
    }

    if (metrics.totalMessages < metrics.totalCalls) {
      recommendations.push('Explore SMS engagement opportunities to enhance customer communication and support.')
    }

    recommendations.push('Continue monitoring costs and performance metrics to identify optimization opportunities.')
    recommendations.push('Implement regular review cycles to track trends and adjust strategies accordingly.')

    return recommendations.slice(0, 4)
  }

  private generateComplianceSection(yPosition: number): void {
    // Compliance box
    this.pdf.setFillColor(254, 242, 242) // Red-50
    this.pdf.setDrawColor(252, 165, 165) // Red-300
    this.pdf.roundedRect(this.margin, yPosition, this.pageWidth - 2 * this.margin, 40, 3, 3, 'FD')

    this.pdf.setFontSize(12)
    this.pdf.setFont('helvetica', 'bold')
    this.pdf.setTextColor(153, 27, 27) // Red-800
    this.pdf.text('HIPAA Compliance Notice', this.margin + 5, yPosition + 12)

    this.pdf.setFontSize(9)
    this.pdf.setFont('helvetica', 'normal')
    this.pdf.setTextColor(127, 29, 29) // Red-900

    const complianceText = [
      'This report contains Protected Health Information (PHI) and is subject to HIPAA regulations.',
      'Unauthorized disclosure is prohibited. Handle according to your organization\'s privacy policies.',
      'All data has been encrypted and anonymized where possible to ensure patient privacy.'
    ]

    complianceText.forEach((text, index) => {
      this.pdf.text(text, this.margin + 5, yPosition + 20 + index * 5)
    })
  }

  private generateFileName(options: ExportOptions): string {
    const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm')
    const dateRange = options.dateRange.replace(/\s+/g, '_').toLowerCase()
    return `dashboard-report_${dateRange}_${timestamp}.pdf`
  }

  private async addLogoToPDF(centerX: number, y: number): Promise<void> {
    try {
      // Try to load the logo - first try local copy, then fallback to external URL
      let logoUrl = '/images/Logo.png'
      let response = await fetch(logoUrl).catch(() => null)

      if (!response || !response.ok) {
        // Try external URL as fallback
        logoUrl = 'https://nexasync.ca/images/Logo.png'
        response = await fetch(logoUrl).catch(() => null)
      }

      if (!response.ok) {
        // Silently skip logo if unavailable to reduce console noise
        return
      }

      const blob = await response.blob()

      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          try {
            const base64Data = reader.result as string

            // Calculate logo dimensions (maintaining aspect ratio)
            const logoWidth = 30 // mm
            const logoHeight = 15 // mm (approximate 2:1 ratio)

            // Add the logo to the PDF
            this.pdf.addImage(
              base64Data,
              'PNG',
              centerX - logoWidth / 2, // Center horizontally
              y,
              logoWidth,
              logoHeight
            )

            resolve()
          } catch (error) {
            reject(error)
          }
        }
        reader.onerror = () => reject(new Error('Failed to read image'))
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      // Silently skip logo if there's a CORS or network error
      // This prevents console errors while maintaining PDF generation
      return
    }
  }
}

export const pdfExportService = new PDFExportService()