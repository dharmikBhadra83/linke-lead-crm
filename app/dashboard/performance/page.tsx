'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Calendar as CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DateTime } from 'luxon'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// Helper function to format date
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

interface User {
  id: string
  username: string
  role: string
}

interface PerformanceData {
  date: string
  userId: string
  username: string
  leadsCreated: number // Number of leads created on this date
}

interface AverageData {
  userId: string
  username: string
  total: number
  meetingBooked: number
  conversionRate: number
}

interface UserPerformanceData {
  name: string
  totalLeads: number
  requested: number
  texted: number
  firstFollowup: number
  secondFollowup: number
  replied: number
  meetingBooked: number
  closed: number
  junk: number
  requestedToTexted: number
  textedToFirstFollowup: number
  firstFollowupToSecondFollowup: number
  secondFollowupToReplied: number
  repliedToMeeting: number
  meetingToClosed: number
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

// Get consistent color for a user based on their ID
function getUserColor(userId: string, allUsers: Array<{ id: string }>): string {
  const userIndex = allUsers.findIndex(u => u.id === userId)
  return USER_COLORS[userIndex % USER_COLORS.length]
}

export default function PerformanceDashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [averageData, setAverageData] = useState<AverageData[]>([])
  const [startDate, setStartDate] = useState<Date | undefined>(() => {
    const date = new Date()
    date.setDate(1) // First day of current month
    return date
  })
  const [endDate, setEndDate] = useState<Date | undefined>(() => {
    return new Date()
  })
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [chartLoading, setChartLoading] = useState(false)
  const [userPerformanceData, setUserPerformanceData] = useState<UserPerformanceData[]>([])
  const [aggregateData, setAggregateData] = useState<UserPerformanceData | null>(null)
  const [userDataLoading, setUserDataLoading] = useState(false)

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

    // Use Luxon for consistent date formatting
    const startDateStr = DateTime.fromJSDate(startDate).toISODate() || ''
    const endDateStr = DateTime.fromJSDate(endDate).toISODate() || ''
    
    if (!startDateStr || !endDateStr) return

    setChartLoading(true)
    try {
      // Fetch graph data for the chart
      const [graphResponse, averageResponse] = await Promise.all([
        fetch(`/api/performance/graph?startDate=${startDateStr}&endDate=${endDateStr}`),
        fetch(`/api/performance/average?startDate=${startDateStr}&endDate=${endDateStr}`),
      ])

      const graphData = await graphResponse.json()
      const averageDataResult = await averageResponse.json()

      if (!graphResponse.ok) {
        console.error('Error fetching graph data:', graphData.error)
        return
      }

      if (!averageResponse.ok) {
        console.error('Error fetching average data:', averageDataResult.error)
      }

      setPerformanceData(graphData.data || [])
      setUsers(graphData.users || [])
      setAverageData(averageDataResult.data || [])
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

  // Fetch user performance data with date filter
  const fetchUserPerformanceData = useCallback(async () => {
    if (!startDate || !endDate) return
    
    setUserDataLoading(true)
    try {
      // Use Luxon for consistent date formatting
      const startDateStr = DateTime.fromJSDate(startDate).toISODate() || ''
      const endDateStr = DateTime.fromJSDate(endDate).toISODate() || ''
      
      if (!startDateStr || !endDateStr) {
        console.error('Invalid date format')
        return
      }

      const response = await fetch(`/api/performance/users?startDate=${startDateStr}&endDate=${endDateStr}`)
      const result = await response.json()

      if (!response.ok) {
        console.error('Error fetching user performance data:', result.error)
        return
      }

      setUserPerformanceData(result.data || [])
      setAggregateData(result.aggregate || null)
    } catch (error) {
      console.error('Error fetching user performance data:', error)
    } finally {
      setUserDataLoading(false)
    }
  }, [startDate, endDate])

  // Only fetch data on initial load, not when dates change
  useEffect(() => {
    if (!loading && user && startDate && endDate) {
      fetchPerformanceData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]) // Removed startDate, endDate, fetchPerformanceData from dependencies

  // Fetch user performance data when dates change or on initial load
  useEffect(() => {
    if (!loading && user && startDate && endDate) {
      fetchUserPerformanceData()
    }
  }, [loading, user, startDate, endDate, fetchUserPerformanceData])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }



  // Custom tooltip showing daily data: total assigned and meeting booked for that day
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Find the date from the payload
      const dateStr = payload[0]?.payload?.fullDate
      
      return (
        <div className="bg-card p-5 border border-border rounded-2xl shadow-2xl min-w-[240px] relative overflow-hidden backdrop-blur-md">
          <div className="flex justify-between items-start mb-4">
            <p className="text-muted-foreground text-sm font-semibold">{label}</p>
          </div>
                  <div className="space-y-3">
            {payload.map((entry: any, index: number) => {
              // Find the user data for this date
              const userData = performanceData.find(
                (d) => d.userId === entry.dataKey && d.date === dateStr
              )
              
              return (
                <div key={`item-${index}`} className="space-y-1">
                  <div className="flex items-center justify-between gap-6">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="text-muted-foreground text-xs font-bold leading-none">{entry.name}</span>
                    </div>
                    <span className="text-foreground text-sm font-black leading-none">{entry.value} leads</span>
                  </div>
                  {userData && (
                    <div className="text-xs text-muted-foreground pl-7">
                      {userData.leadsCreated} lead{userData.leadsCreated !== 1 ? 's' : ''} created on this date
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )
    }
    return null
  }

  // Generate all dates from startDate to endDate for the X-axis using Luxon
  // This ensures the graph shows exactly the selected date range
  // Use useMemo to recalculate when startDate or endDate changes
  const finalDates = useMemo(() => {
    const dates: string[] = []
    if (startDate && endDate) {
      // Convert JavaScript Date to Luxon DateTime
      const start = DateTime.fromJSDate(startDate).startOf('day')
      const end = DateTime.fromJSDate(endDate).startOf('day')
      
      // Calculate number of days
      const daysDiff = end.diff(start, 'days').days
      
      // Generate all dates in the range (inclusive)
      for (let i = 0; i <= daysDiff; i++) {
        const currentDate = start.plus({ days: i })
        const dateStr = currentDate.toISODate()
        if (dateStr) {
          dates.push(dateStr)
        }
      }
    } else {
      // Fallback: use dates from API if startDate/endDate not available
      dates.push(...Array.from(new Set(performanceData.map((d) => d.date))).sort())
    }
    return dates
  }, [startDate, endDate, performanceData])

  // Format dates for display
  const formattedDates = finalDates.map((date: string) =>
    new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  )

  // Prepare data for recharts (one entry per date with all users' leads created)
  const rechartsData = finalDates.map((date: string) => {
    const entry: Record<string, string | number> = {
      date: new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      fullDate: date,
    }

    users.forEach((user) => {
      const userDataPoint = performanceData.find(
        (d) => d.userId === user.id && d.date === date
      )
      // Use the leads created count if available, otherwise 0
      // We use user.id as key to be safer with special characters
      entry[user.id] = userDataPoint?.leadsCreated ?? 0
    })

    return entry
  })


  // Use average data for top performers
  // Include userId to ensure consistent color mapping
  const topPerformers = averageData
    .map((data) => {
      const user = users.find(u => u.username === data.username)
      return {
        username: data.username,
        userId: user?.id || '',
        conversionRate: data.conversionRate,
        total: data.total,
        meetingBooked: data.meetingBooked,
      }
    })
    .filter(p => p.userId) // Only include performers with valid user IDs
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

          {/* Date Filters - Black, White, Grey Styling */}
          <Card className="border-2 border-black dark:border-white shadow-lg bg-white dark:bg-black rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl">
            <CardHeader className="bg-black dark:bg-white py-5 border-b border-black dark:border-white">
              <CardTitle className="flex items-center gap-3 text-white dark:text-black text-lg font-bold">
                <div className="p-2 bg-white dark:bg-black rounded-lg border-2 border-white dark:border-black">
                  <CalendarIcon className="h-5 w-5 text-black dark:text-white" />
                </div>
                <span>Select Date Range</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 bg-white dark:bg-black">
              <div className="flex flex-col md:flex-row gap-6 items-end">
                <div className="flex-1 w-full space-y-2">
                  <Label className="text-sm font-semibold text-black dark:text-white">Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left h-12 border-2 border-black dark:border-white focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:border-gray-500 bg-white dark:bg-black rounded-lg font-medium text-black dark:text-white shadow-sm hover:bg-gray-100 dark:hover:bg-gray-900 transition-all",
                          !startDate && "text-gray-500 dark:text-gray-400"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-black dark:text-white" />
                        {startDate ? formatDate(startDate) : <span className="text-gray-400">Select start date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 shadow-xl border-2 border-black dark:border-white rounded-xl overflow-hidden bg-white dark:bg-black" align="start">
                      <CalendarComponent
                        date={startDate}
                        onDateChange={setStartDate}
                        maxDate={endDate || new Date()}
                        disabled={(date) => date > new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex-1 w-full space-y-2">
                  <Label className="text-sm font-semibold text-black dark:text-white">End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left h-12 border-2 border-black dark:border-white focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:border-gray-500 bg-white dark:bg-black rounded-lg font-medium text-black dark:text-white shadow-sm hover:bg-gray-100 dark:hover:bg-gray-900 transition-all",
                          !endDate && "text-gray-500 dark:text-gray-400"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-black dark:text-white" />
                        {endDate ? formatDate(endDate) : <span className="text-gray-400">Select end date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 shadow-xl border-2 border-black dark:border-white rounded-xl overflow-hidden bg-white dark:bg-black" align="start">
                      <CalendarComponent
                        date={endDate}
                        onDateChange={setEndDate}
                        maxDate={new Date()}
                        minDate={startDate}
                        disabled={(date) => date > new Date() || (startDate ? date < startDate : false)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <Button 
                  onClick={fetchPerformanceData} 
                  disabled={chartLoading || !startDate || !endDate}
                  className="w-full md:w-auto bg-black dark:bg-white text-white dark:text-black hover:bg-gray-900 dark:hover:bg-gray-100 h-12 px-8 font-semibold transition-all rounded-lg shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border-2 border-black dark:border-white"
                >
                  {chartLoading ? (
                    <>
                      <Spinner className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      <CalendarIcon className="h-4 w-4" />
                      <span>Apply Filter</span>
                    </>
                  )}
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
                  Performance metrics from {startDate ? startDate.toLocaleDateString() : 'N/A'} to{' '}
                  {endDate ? endDate.toLocaleDateString() : 'N/A'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topPerformers.map((performer, index) => {
                    const color = getUserColor(performer.userId, users)
                    return (
                      <div
                        key={performer.username}
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{
                              backgroundColor: color,
                            }}
                          />
                          <span className="font-medium">{performer.username}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">
                            {performer.conversionRate.toFixed(3)}%
                          </div>
                          <div className="text-sm text-muted-foreground">
                            = ({performer.meetingBooked} meetings / {performer.total} total) × 100
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}


          {/* Elegant Performance Overview Chart */}
          <Card className="shadow-2xl border-border rounded-3xl overflow-hidden bg-white dark:bg-card chart-fade-in">
            <CardHeader className="p-8 pb-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-foreground">Leads Created Per Day</CardTitle>
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
                    margin={{ top: 40, right: 30, left: 20, bottom: 20 }}
                  >
                    <defs>
                      {users.map((user) => {
                        const color = getUserColor(user.id, users)
                        return (
                          <linearGradient key={`gradient-${user.id}`} id={`color-${user.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={color} stopOpacity={0}/>
                          </linearGradient>
                        )
                      })}
                    </defs>
                    <CartesianGrid horizontal={false} stroke="#eee" strokeDasharray="5 5" /> 
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 500 }}
                      stroke="#94a3b8"
                      axisLine={{ stroke: '#94a3b8', strokeWidth: 3 }}
                      tickLine={{ stroke: '#94a3b8', strokeWidth: 2 }}
                      dy={10}
                    />
                    <YAxis
                      domain={[-5, 100]}
                      ticks={[0, 20, 40, 60, 80, 100]}
                      allowDecimals={false}
                      interval={0}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 500 }}
                      tickFormatter={(value) => value >= 0 ? `${value}%` : ''}
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
                    {users.map((user) => {
                      const color = getUserColor(user.id, users)
                      const dataKey = user.id
                      
                      return (
                        <Area
                          key={`area-${user.id}`}
                          type="monotone"
                          dataKey={dataKey}
                          stroke={color}
                          strokeWidth={3.5}
                          fillOpacity={0.6}
                          fill={`url(#color-${user.id})`}
                          name={user.username}
                          connectNulls={true}
                          baseValue={0}
                          stackId={undefined}
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

   {/* User Performance Table */}
   <Card className="shadow-2xl border-border rounded-3xl overflow-hidden bg-white dark:bg-card">
            <CardHeader className="p-8 pb-0">
              <CardTitle className="text-2xl font-bold text-foreground">User Performance Metrics</CardTitle>
              <CardDescription className="text-muted-foreground">
                Detailed performance breakdown for each user
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              {userDataLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Spinner className="h-8 w-8" />
                </div>
              ) : userPerformanceData.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-muted-foreground">No user performance data available</p>
                </div>
              ) : (
                <div className="border rounded-lg border-border overflow-hidden">
                  <div className="overflow-x-auto w-full">
                    <Table className="w-full" style={{ minWidth: '2400px' }}>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="min-w-[160px] whitespace-nowrap font-semibold">Name</TableHead>
                          <TableHead className="min-w-[120px] whitespace-nowrap font-semibold">Total Leads</TableHead>
                          <TableHead className="min-w-[120px] whitespace-nowrap font-semibold">Requested</TableHead>
                          <TableHead className="min-w-[120px] whitespace-nowrap font-semibold">Texted</TableHead>
                          <TableHead className="min-w-[140px] whitespace-nowrap font-semibold">First Follow-up</TableHead>
                          <TableHead className="min-w-[150px] whitespace-nowrap font-semibold">Second Follow-up</TableHead>
                          <TableHead className="min-w-[120px] whitespace-nowrap font-semibold">Replied</TableHead>
                          <TableHead className="min-w-[140px] whitespace-nowrap font-semibold">Meeting Booked</TableHead>
                          <TableHead className="min-w-[120px] whitespace-nowrap font-semibold">Closed</TableHead>
                          <TableHead className="min-w-[120px] whitespace-nowrap font-semibold">Junk</TableHead>
                          <TableHead className="min-w-[160px] whitespace-nowrap font-semibold">Requested → Texted (%)</TableHead>
                          <TableHead className="min-w-[180px] whitespace-nowrap font-semibold">Texted → First Follow-up (%)</TableHead>
                          <TableHead className="min-w-[200px] whitespace-nowrap font-semibold">First Follow-up → Second Follow-up (%)</TableHead>
                          <TableHead className="min-w-[200px] whitespace-nowrap font-semibold">Second Follow-up → Replied (%)</TableHead>
                          <TableHead className="min-w-[160px] whitespace-nowrap font-semibold">Replied → Meeting (%)</TableHead>
                          <TableHead className="min-w-[160px] whitespace-nowrap font-semibold">Meeting → Closed (%)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userPerformanceData.map((user: UserPerformanceData, index: number) => (
                          <TableRow key={user.name}>
                            <TableCell className="font-medium">{user.name}</TableCell>
                            <TableCell>{user.totalLeads}</TableCell>
                            <TableCell>{user.requested}</TableCell>
                            <TableCell>{user.texted}</TableCell>
                            <TableCell>{user.firstFollowup}</TableCell>
                            <TableCell>{user.secondFollowup}</TableCell>
                            <TableCell>{user.replied}</TableCell>
                            <TableCell>{user.meetingBooked}</TableCell>
                            <TableCell>{user.closed}</TableCell>
                            <TableCell>{user.junk}</TableCell>
                            <TableCell>{user.requestedToTexted.toFixed(3)}%</TableCell>
                            <TableCell>{user.textedToFirstFollowup.toFixed(3)}%</TableCell>
                            <TableCell>{user.firstFollowupToSecondFollowup.toFixed(3)}%</TableCell>
                            <TableCell>{user.secondFollowupToReplied.toFixed(3)}%</TableCell>
                            <TableCell>{user.repliedToMeeting.toFixed(3)}%</TableCell>
                            <TableCell>{user.meetingToClosed.toFixed(3)}%</TableCell>
                          </TableRow>
                        ))}
                        {aggregateData && (
                          <TableRow className="bg-muted/30 font-bold">
                            <TableCell className="font-bold">{aggregateData.name}</TableCell>
                            <TableCell className="font-bold">{aggregateData.totalLeads}</TableCell>
                            <TableCell className="font-bold">{aggregateData.requested}</TableCell>
                            <TableCell className="font-bold">{aggregateData.texted}</TableCell>
                            <TableCell className="font-bold">{aggregateData.firstFollowup}</TableCell>
                            <TableCell className="font-bold">{aggregateData.secondFollowup}</TableCell>
                            <TableCell className="font-bold">{aggregateData.replied}</TableCell>
                            <TableCell className="font-bold">{aggregateData.meetingBooked}</TableCell>
                            <TableCell className="font-bold">{aggregateData.closed}</TableCell>
                            <TableCell className="font-bold">{aggregateData.junk}</TableCell>
                            <TableCell className="font-bold">{aggregateData.requestedToTexted.toFixed(3)}%</TableCell>
                            <TableCell className="font-bold">{aggregateData.textedToFirstFollowup.toFixed(3)}%</TableCell>
                            <TableCell className="font-bold">{aggregateData.firstFollowupToSecondFollowup.toFixed(3)}%</TableCell>
                            <TableCell className="font-bold">{aggregateData.secondFollowupToReplied.toFixed(3)}%</TableCell>
                            <TableCell className="font-bold">{aggregateData.repliedToMeeting.toFixed(3)}%</TableCell>
                            <TableCell className="font-bold">{aggregateData.meetingToClosed.toFixed(3)}%</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

