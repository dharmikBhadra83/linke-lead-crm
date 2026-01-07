'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Calendar } from 'lucide-react'

interface User {
  id: string
  username: string
  role: string
}

interface PerformanceData {
  date: string
  userId: string
  username: string
  total: number
  requested: number
  texted: number
  replied: number
  meetingBooked: number
  closed: number
  junk: number
  conversionRate: number
}

// Elegant premium color palette for multi-user support
const USER_COLORS = [
  '#059669', // Emerald
  '#4338ca', // Indigo
  '#d97706', // Amber
  '#4f46e5', // Royal Blue
  '#9333ea', // Deep Purple
  '#ec4899', // Hot Pink
  '#06b6d4', // Cyan
  '#f43f5e', // Rose
  '#84cc16', // Lime
  '#14b8a6', // Teal
]

export default function PerformanceDashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date()
    date.setDate(1) // First day of current month
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [chartLoading, setChartLoading] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  const checkSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session')
      const data = await response.json()

      if (!response.ok || !data.user) {
        router.push('/login')
        return
      }

      setUser(data.user)
    } catch (error) {
      router.push('/login')
    }
  }, [router])

  const fetchPerformanceData = useCallback(async () => {
    if (!startDate || !endDate) return

    setChartLoading(true)
    try {
      const response = await fetch(
        `/api/performance?startDate=${startDate}&endDate=${endDate}`
      )
      const data = await response.json()

      if (!response.ok) {
        console.error('Error fetching performance data:', data.error)
        return
      }

      setPerformanceData(data.data || [])
      setUsers(data.users || [])
    } catch (error) {
      console.error('Error fetching performance data:', error)
    } finally {
      setChartLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => {
    checkSession().then(() => {
      setLoading(false)
    })
  }, [checkSession])

  useEffect(() => {
    if (!loading && user) {
      fetchPerformanceData()
    }
  }, [loading, user, fetchPerformanceData])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }



  // Custom tool-tip component matching the reference image with theme support
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card p-5 border border-border rounded-2xl shadow-2xl min-w-[240px] relative overflow-hidden backdrop-blur-md">
          <div className="flex justify-between items-start mb-4">
            <p className="text-muted-foreground text-sm font-semibold">{label}</p>
            <div className="flex items-center gap-1 bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full text-[10px] font-bold">
              <span>↗</span>
              <span>72%</span>
            </div>
          </div>
          <div className="space-y-3">
            {payload.map((entry: any, index: number) => (
              <div key={`item-${index}`} className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-muted-foreground text-xs font-bold leading-none">{entry.name}</span>
                </div>
                <span className="text-foreground text-sm font-black leading-none">{entry.value.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )
    }
    return null
  }

  // Get all unique dates for X-axis
  const allDates = Array.from(
    new Set(performanceData.map((d) => d.date))
  ).sort()

  // Format dates for display
  const formattedDates = allDates.map((date) =>
    new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  )

  // Prepare data for recharts (one entry per date with all users' conversion rates)
  const rechartsData = allDates.map((date) => {
    const entry: Record<string, string | number> = {
      date: new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      fullDate: date,
    }

    users.forEach((user) => {
      const userDataPoint = performanceData.find(
        (d) => d.userId === user.id && d.date === date
      )
      // Use the conversion rate if available, otherwise 0
      // We use user.id as key to be safer with special characters
      entry[user.id] = userDataPoint?.conversionRate ?? 0
    })

    return entry
  })


  // Calculate top performers
  const topPerformers = users
    .map((user) => {
      const userData = performanceData.filter((d) => d.userId === user.id)
      const latestData = userData[userData.length - 1]
      if (!latestData) return null

      return {
        username: user.username,
        conversionRate: latestData.conversionRate,
        total: latestData.total,
        meetingBooked: latestData.meetingBooked,
      }
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => b.conversionRate - a.conversionRate)
    .slice(0, 2)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        user={user}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onToggle={setSidebarOpen}
      />

      <div
        className={`flex-1 transition-all duration-300 overflow-y-auto h-full ${
          sidebarOpen ? 'ml-64' : 'ml-0'
        }`}
      >
        <div className="p-6 space-y-6 w-full max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Performance Dashboard</h1>
              <p className="text-muted-foreground mt-1">
                Track outreach performance metrics over time
              </p>
            </div>
            <ThemeToggle />
          </div>

          {/* Date Filters - Proper Monochrome Styling */}
          <Card className="border-2 border-slate-900 dark:border-slate-100 shadow-none bg-white dark:bg-black rounded-3xl overflow-hidden transition-all duration-300">
            <CardHeader className="bg-slate-900 dark:bg-slate-100 py-6">
              <CardTitle className="flex items-center gap-2 text-white dark:text-black text-lg font-black tracking-tight uppercase">
                <Calendar className="h-5 w-5" />
                Select Date Range
              </CardTitle>
              <CardDescription className="text-slate-400 dark:text-slate-600 font-medium">
                Results limited to dates up to today
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row gap-8 items-end">
                <div className="flex-1 w-full space-y-3">
                  <Label htmlFor="startDate" className="text-xs font-black uppercase tracking-widest text-slate-500">Starting From</Label>
                  <Input
                    id="startDate"
                    type="date"
                    max={today}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="border-2 border-slate-900 dark:border-slate-100 focus-visible:ring-0 focus-visible:border-slate-400 bg-transparent rounded-xl h-14 font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex-1 w-full space-y-3">
                  <Label htmlFor="endDate" className="text-xs font-black uppercase tracking-widest text-slate-500">Ending To</Label>
                  <Input
                    id="endDate"
                    type="date"
                    max={today}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="border-2 border-slate-900 dark:border-slate-100 focus-visible:ring-0 focus-visible:border-slate-400 bg-transparent rounded-xl h-14 font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <Button 
                  onClick={fetchPerformanceData} 
                  disabled={chartLoading}
                  className="w-full md:w-auto bg-slate-900 dark:bg-slate-100 text-white dark:text-black hover:bg-slate-800 dark:hover:bg-slate-200 h-14 px-10 font-black uppercase tracking-widest transition-all rounded-xl active:scale-95 disabled:opacity-30"
                >
                  {chartLoading ? <Spinner className="h-4 w-4" /> : 'Apply Filter'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Top Performers */}
          {topPerformers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top Outreach Performers This Month</CardTitle>
                <CardDescription>
                  Performance metrics from {new Date(startDate).toLocaleDateString()} to{' '}
                  {new Date(endDate).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topPerformers.map((performer, index) => (
                    <div
                      key={performer.username}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{
                            backgroundColor: USER_COLORS[index % USER_COLORS.length],
                          }}
                        />
                        <span className="font-medium">{performer.username}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {performer.conversionRate.toFixed(2)}%
                        </div>
                        <div className="text-sm text-muted-foreground">
                          = ({performer.meetingBooked} meetings / {performer.total} total) × 100
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Elegant Performance Overview Chart */}
          <Card className="shadow-2xl border-border rounded-3xl overflow-hidden bg-white dark:bg-card chart-fade-in">
            <CardHeader className="p-8 pb-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-foreground">Performance Overview</CardTitle>
                  <CardDescription className="text-muted-foreground text-sm mt-1">
                    Sales and advertising metrics breakdown
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {chartLoading ? (
                <div className="flex items-center justify-center h-96">
                  <Spinner />
                </div>
              ) : rechartsData.length === 0 ? (
                <div className="flex items-center justify-center h-96 text-muted-foreground">
                  No data available for the selected date range
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={500}>
                  <AreaChart 
                    data={rechartsData}
                    margin={{ top: 40, right: 30, left: 10, bottom: 20 }}
                  >
                    <defs>
                      {users.map((user, index) => {
                        const color = USER_COLORS[index % USER_COLORS.length]
                        return (
                          <linearGradient key={`gradient-${user.id}`} id={`color-${user.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={color} stopOpacity={0}/>
                          </linearGradient>
                        )
                      })}
                    </defs>
                    <CartesianGrid vertical={true} horizontal={false} strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 500 }}
                      stroke="#94a3b8"
                      axisLine={{ stroke: '#94a3b8', strokeWidth: 3 }}
                      tickLine={{ stroke: '#94a3b8', strokeWidth: 2 }}
                      dy={10}
                    />
                    <YAxis
                      domain={[-20, 110]}
                      ticks={[0, 20, 40, 60, 80, 100]}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 500 }}
                      tickFormatter={(value) => `${value}%`}
                      stroke="#94a3b8"
                      axisLine={{ stroke: '#94a3b8', strokeWidth: 3 }}
                      tickLine={{ stroke: '#94a3b8', strokeWidth: 2 }}
                      dx={-10}
                    />
                    <Tooltip
                      content={<CustomTooltip />}
                      cursor={{ stroke: '#4f46e5', strokeWidth: 2, strokeDasharray: '4 4' }}
                    />
                    <Legend 
                      verticalAlign="bottom"
                      align="center"
                      wrapperStyle={{ paddingTop: '40px' }}
                      iconType="circle"
                      iconSize={8}
                    />
                    {users.map((user, index) => {
                      const color = USER_COLORS[index % USER_COLORS.length]
                      const dataKey = user.id
                      
                      return (
                        <Area
                          key={`area-${user.id}`}
                          type="monotone"
                          dataKey={dataKey}
                          stroke={color}
                          strokeWidth={3.5}
                          fillOpacity={1}
                          fill={`url(#color-${user.id})`}
                          name={user.username}
                          connectNulls={true}
                          baseValue={0}
                          animationDuration={2500}
                          animationEasing="ease-in-out"
                          activeDot={{ r: 7, stroke: 'var(--background)', strokeWidth: 3, fill: color }}
                        />
                      )
                    })}
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Performance Table */}
          {performanceData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Detailed Performance Metrics</CardTitle>
                <CardDescription>
                  Breakdown by user and date
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-2 font-medium">Date</th>
                        <th className="text-left p-2 font-medium">User</th>
                        <th className="text-right p-2 font-medium">Total</th>
                        <th className="text-right p-2 font-medium">Requested</th>
                        <th className="text-right p-2 font-medium">Texted</th>
                        <th className="text-right p-2 font-medium">Replied</th>
                        <th className="text-right p-2 font-medium">Meeting Booked</th>
                        <th className="text-right p-2 font-medium">Closed</th>
                        <th className="text-right p-2 font-medium">Junk</th>
                        <th className="text-right p-2 font-medium">Conversion Rate (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performanceData
                        .sort((a, b) => {
                          const dateCompare = a.date.localeCompare(b.date)
                          if (dateCompare !== 0) return dateCompare
                          return a.username.localeCompare(b.username)
                        })
                        .map((data, index) => (
                          <tr
                            key={`${data.userId}-${data.date}`}
                            className="border-b border-border hover:bg-secondary/50"
                          >
                            <td className="p-2">
                              {new Date(data.date).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                              })}
                            </td>
                            <td className="p-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{
                                    backgroundColor:
                                      USER_COLORS[
                                        users.findIndex((u) => u.id === data.userId) %
                                          USER_COLORS.length
                                      ],
                                  }}
                                />
                                {data.username}
                              </div>
                            </td>
                            <td className="text-right p-2">{data.total}</td>
                            <td className="text-right p-2">{data.requested}</td>
                            <td className="text-right p-2">{data.texted}</td>
                            <td className="text-right p-2">{data.replied}</td>
                            <td className="text-right p-2">{data.meetingBooked}</td>
                            <td className="text-right p-2">{data.closed}</td>
                            <td className="text-right p-2">{data.junk}</td>
                            <td className="text-right p-2 font-medium">
                              {data.conversionRate.toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

