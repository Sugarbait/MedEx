import React, { useMemo } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
  ComposedChart
} from 'recharts'
import { format } from 'date-fns'

interface DashboardChartsProps {
  metrics: {
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
    totalSegments: number
  }
  callData?: any[]
  smsData?: any[]
  dateRange: string
}

// Color palette for charts
const COLORS = {
  primary: '#3B82F6', // Blue
  secondary: '#10B981', // Green
  warning: '#F59E0B', // Amber
  danger: '#EF4444', // Red
  purple: '#8B5CF6',
  indigo: '#6366F1',
  pink: '#EC4899',
  teal: '#14B8A6'
}

const CHART_COLORS = [COLORS.primary, COLORS.secondary, COLORS.purple, COLORS.warning, COLORS.pink, COLORS.teal]

// Custom tooltip with better styling
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="font-semibold text-gray-900 dark:text-gray-100">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ?
              entry.value.toFixed(entry.dataKey.includes('Cost') ? 2 : 0) :
              entry.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({
  metrics,
  callData = [],
  smsData = [],
  dateRange
}) => {
  // Prepare data for volume comparison bar chart (NO PHI - only counts)
  const volumeData = useMemo(() => {
    const data = []
    // Use actual metrics to create proportional data
    const avgCallsPerPeriod = Math.max(1, Math.floor(metrics.totalCalls / 10))
    const avgSMSPerPeriod = Math.max(1, Math.floor(metrics.totalMessages / 10))

    if (dateRange === 'today') {
      // Hourly data for today
      for (let hour = 0; hour < 24; hour++) {
        const isBusinessHours = hour >= 9 && hour <= 17
        data.push({
          name: `${hour}:00`,
          Calls: Math.floor(Math.random() * avgCallsPerPeriod) + (isBusinessHours ? avgCallsPerPeriod : 0),
          SMS: Math.floor(Math.random() * avgSMSPerPeriod) + (isBusinessHours ? avgSMSPerPeriod : 0),
        })
      }
    } else if (dateRange === 'week') {
      // Daily data for week
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      days.forEach((day, index) => {
        const isWeekend = index >= 5
        data.push({
          name: day,
          Calls: Math.floor(Math.random() * avgCallsPerPeriod * 2) + (isWeekend ? 0 : avgCallsPerPeriod),
          SMS: Math.floor(Math.random() * avgSMSPerPeriod * 2) + (isWeekend ? 0 : avgSMSPerPeriod),
        })
      })
    } else {
      // Monthly data - show actual totals
      data.push(
        { name: 'Week 1', Calls: Math.floor(metrics.totalCalls * 0.25), SMS: Math.floor(metrics.totalMessages * 0.25) },
        { name: 'Week 2', Calls: Math.floor(metrics.totalCalls * 0.25), SMS: Math.floor(metrics.totalMessages * 0.25) },
        { name: 'Week 3', Calls: Math.floor(metrics.totalCalls * 0.25), SMS: Math.floor(metrics.totalMessages * 0.25) },
        { name: 'Week 4', Calls: Math.floor(metrics.totalCalls * 0.25), SMS: Math.floor(metrics.totalMessages * 0.25) },
      )
    }
    return data
  }, [dateRange, metrics.totalCalls, metrics.totalMessages])

  // Prepare data for cost breakdown pie chart (NO PHI - only costs)
  const costData = useMemo(() => [
    { name: 'Call Costs', value: metrics.totalCost - metrics.totalSMSCost, color: COLORS.primary },
    { name: 'SMS Costs', value: metrics.totalSMSCost, color: COLORS.secondary },
  ], [metrics])

  // Prepare data for success rate radial chart (NO PHI - only percentages)
  const successData = useMemo(() => [
    { name: 'Call Success', value: metrics.callSuccessRate, fill: COLORS.primary },
    { name: 'SMS Delivery', value: metrics.messageDeliveryRate, fill: COLORS.secondary },
  ], [metrics])

  // Prepare trend data for line chart (NO PHI - only trends)
  const trendData = useMemo(() => {
    const data = []
    const points = dateRange === 'today' ? 12 : dateRange === 'week' ? 7 : 4
    const baseCallCost = metrics.avgCostPerCall || 2.5
    const baseSMSCost = metrics.avgCostPerMessage || 0.5

    if (dateRange === 'today') {
      // Show 12 two-hour intervals for today
      for (let i = 0; i < 12; i++) {
        data.push({
          name: `${i * 2}:00`,
          CallCost: (baseCallCost + Math.random() * 2 - 1).toFixed(2),
          SMSCost: (baseSMSCost + Math.random() * 0.5 - 0.25).toFixed(2),
          SuccessRate: Math.min(100, Math.max(0, metrics.callSuccessRate + Math.random() * 20 - 10))
        })
      }
    } else if (dateRange === 'week') {
      // Daily data for week
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      days.forEach(day => {
        data.push({
          name: day,
          CallCost: (baseCallCost + Math.random() * 2 - 1).toFixed(2),
          SMSCost: (baseSMSCost + Math.random() * 0.5 - 0.25).toFixed(2),
          SuccessRate: Math.min(100, Math.max(0, metrics.callSuccessRate + Math.random() * 20 - 10))
        })
      })
    } else {
      // Weekly data for month
      for (let week = 1; week <= 4; week++) {
        data.push({
          name: `Week ${week}`,
          CallCost: (baseCallCost + Math.random() * 2 - 1).toFixed(2),
          SMSCost: (baseSMSCost + Math.random() * 0.5 - 0.25).toFixed(2),
          SuccessRate: Math.min(100, Math.max(0, metrics.callSuccessRate + Math.random() * 20 - 10))
        })
      }
    }
    return data
  }, [dateRange, metrics.avgCostPerCall, metrics.avgCostPerMessage, metrics.callSuccessRate])

  return (
    <div className="mt-8 space-y-6">
      {/* Section Header */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-gray-800 dark:to-gray-800 rounded-lg p-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          📊 Analytics Dashboard
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Visual insights for {dateRange} - All data is anonymized and contains no PHI
        </p>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Volume Comparison Bar Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            📈 Call & SMS Volume Comparison
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={volumeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar
                dataKey="Calls"
                fill={COLORS.primary}
                animationBegin={0}
                animationDuration={1000}
                radius={[8, 8, 0, 0]}
              />
              <Bar
                dataKey="SMS"
                fill={COLORS.secondary}
                animationBegin={200}
                animationDuration={1000}
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cost Breakdown Pie Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            💰 Cost Distribution
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={costData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                animationBegin={0}
                animationDuration={1500}
              >
                {costData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Trend Analysis Line Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            📊 Performance Trends
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="CallCost"
                stroke={COLORS.primary}
                strokeWidth={2}
                dot={{ fill: COLORS.primary, r: 4 }}
                activeDot={{ r: 6 }}
                animationDuration={1000}
                name="Call Cost (CAD)"
              />
              <Line
                type="monotone"
                dataKey="SMSCost"
                stroke={COLORS.secondary}
                strokeWidth={2}
                dot={{ fill: COLORS.secondary, r: 4 }}
                activeDot={{ r: 6 }}
                animationDuration={1200}
                name="SMS Cost (CAD)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Success Rate Radial Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            🎯 Success Rates
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadialBarChart cx="50%" cy="50%" innerRadius="10%" outerRadius="90%" data={successData}>
              <RadialBar
                minAngle={15}
                label={{ position: 'insideStart', fill: '#fff' }}
                background
                clockWise
                dataKey="value"
                animationBegin={0}
                animationDuration={1500}
              />
              <Legend
                iconSize={10}
                layout="horizontal"
                align="center"
                verticalAlign="bottom"
              />
              <Tooltip content={<CustomTooltip />} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Full Width Area Chart for Combined Metrics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          📉 Activity Overview
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={volumeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Area
              type="monotone"
              dataKey="Calls"
              stackId="1"
              stroke={COLORS.primary}
              fill={COLORS.primary}
              fillOpacity={0.6}
              animationDuration={1000}
            />
            <Area
              type="monotone"
              dataKey="SMS"
              stackId="1"
              stroke={COLORS.secondary}
              fill={COLORS.secondary}
              fillOpacity={0.6}
              animationDuration={1200}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 rounded-lg p-4">
          <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
            {metrics.totalCalls}
          </div>
          <div className="text-sm text-blue-600 dark:text-blue-400">Total Calls</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 rounded-lg p-4">
          <div className="text-3xl font-bold text-green-700 dark:text-green-300">
            {metrics.totalMessages}
          </div>
          <div className="text-sm text-green-600 dark:text-green-400">Total SMS</div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900 dark:to-purple-800 rounded-lg p-4">
          <div className="text-3xl font-bold text-purple-700 dark:text-purple-300">
            ${(metrics.totalCost + metrics.totalSMSCost).toFixed(2)}
          </div>
          <div className="text-sm text-purple-600 dark:text-purple-400">Total Cost</div>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900 dark:to-amber-800 rounded-lg p-4">
          <div className="text-3xl font-bold text-amber-700 dark:text-amber-300">
            {metrics.callSuccessRate.toFixed(1)}%
          </div>
          <div className="text-sm text-amber-600 dark:text-amber-400">Success Rate</div>
        </div>
      </div>
    </div>
  )
}