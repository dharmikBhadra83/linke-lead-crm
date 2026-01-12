'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Sidebar } from '@/components/Sidebar'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LeadFormDialog } from '@/components/LeadFormDialog'
import { LEAD_STATUS_LABELS, LEAD_STATUSES, SYSTEMS, SYSTEM_LABELS } from '@/lib/constants'
import { ChevronDown } from 'lucide-react'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

interface Lead {
  id: string
  name: string
  email: string | null
  company: string | null
  profileUrl: string | null
  postUrl: string | null
  website: string | null
  status: string
  system: string
  notes: string | null
  assignedToId: string | null
  assignedTo: {
    id: string
    username: string
  } | null
  textedAt: string | null
  firstFollowupAt: string | null
  secondFollowupAt: string | null
  repliedAt: string | null
  meetingBookedAt: string | null
  commentedAt: string | null
  lastStatusUpdater: {
    id: string
    username: string
  } | null
  lastStatusUpdatedAt: string | null
  createdAt: string
  updatedAt: string
}

interface StatusHistory {
  id: string
  oldStatus: string | null
  newStatus: string
  reason: string | null
  createdAt: string
  user: {
    id: string
    username: string
  }
}

interface User {
  id: string
  username: string
  role: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [filter, setFilter] = useState<string>('all')
  const [systemFilter, setSystemFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('')
  const [appliedDateFilter, setAppliedDateFilter] = useState<string>('')
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set())
  const [appliedStatuses, setAppliedStatuses] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<{
    page: number
    limit: number
    total: number
    totalPages: number
  } | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [assigningLeadId, setAssigningLeadId] = useState<string | null>(null)
  const [outreachUsers, setOutreachUsers] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [viewingHistory, setViewingHistory] = useState<{
    lead: Lead
    history: StatusHistory[]
  } | null>(null)
  const [fileInputRef, setFileInputRef] = useState<HTMLInputElement | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [popoverOpen, setPopoverOpen] = useState(false)

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

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (systemFilter && systemFilter !== 'all') params.append('system', systemFilter)
      params.append('page', page.toString())
      params.append('limit', '15')

      // Use date filter API if date filter is applied (separate from other filters)
      if (appliedDateFilter) {
        params.append('date', appliedDateFilter)
        if (appliedStatuses.size > 0) {
          params.append('statuses', Array.from(appliedStatuses).join(','))
        }
        const response = await fetch(`/api/leads/date-filter?${params.toString()}`)
        const data = await response.json()
        if (response.ok) {
          setLeads(data.leads || [])
          setPagination(data.pagination)
        }
        return
      }

      // Use separate APIs for status and action filters (existing functionality)
      let apiUrl = '/api/leads'
      if (filter && filter !== 'all') {
        // Use action API when action filter is selected
        apiUrl = '/api/leads/action'
        params.append('filter', filter)
      } else if (statusFilter && statusFilter !== 'all') {
        // Use status API when status filter is selected
        apiUrl = '/api/leads/status'
        params.append('status', statusFilter)
      }

      const response = await fetch(`${apiUrl}?${params.toString()}`)
      const data = await response.json()

      if (response.ok) {
        setLeads(data.leads || [])
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Error fetching leads:', error)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, filter, systemFilter, appliedDateFilter, appliedStatuses, page])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  // Handle filter changes - reset the other filter when one is selected
  useEffect(() => {
    if (user) {
      // When applied date filter is set, reset status and action filters (date filter takes priority)
      if (appliedDateFilter) {
        setStatusFilter('all')
        setFilter('all')
      }
      // When status filter changes to non-"all", reset action filter and applied date filter
      else if (statusFilter && statusFilter !== 'all') {
        setFilter('all')
        setAppliedDateFilter('')
        setAppliedStatuses(new Set())
        setDateFilter('')
        setSelectedStatuses(new Set())
      }
    }
  }, [statusFilter, appliedDateFilter, user])

  useEffect(() => {
    if (user) {
      // When action filter changes to non-"all", reset status filter and applied date filter
      if (filter && filter !== 'all') {
        setStatusFilter('all')
        setAppliedDateFilter('')
        setAppliedStatuses(new Set())
        setDateFilter('')
        setSelectedStatuses(new Set())
      }
    }
  }, [filter, user])

  const handleApplyDateFilter = () => {
    setAppliedDateFilter(dateFilter)
    setAppliedStatuses(new Set(selectedStatuses))
    setPopoverOpen(false)
    setPage(1) // Reset to first page when applying filter
  }

  const handleClearDateFilter = () => {
    setDateFilter('')
    setSelectedStatuses(new Set())
    setAppliedDateFilter('')
    setAppliedStatuses(new Set())
    setPopoverOpen(false)
    setPage(1) // Reset to first page when clearing filter
  }

  useEffect(() => {
    if (user) {
      fetchLeads()
    }
  }, [user, search, statusFilter, filter, appliedDateFilter, appliedStatuses, fetchLeads])

  useEffect(() => {
    if (user) {
      fetchLeads()
    }
  }, [page, user, fetchLeads])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const handleClaim = async (leadId: string) => {
    try {
      const response = await fetch(`/api/leads/${leadId}/claim`, {
        method: 'POST',
      })

      if (response.ok) {
        fetchLeads()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to claim lead')
      }
    } catch (error) {
      console.error('Error claiming lead:', error)
      alert('Failed to claim lead')
    }
  }

  const handleAssignClick = async (leadId: string) => {
    // Find the lead to get current assignment
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return

    setAssigningLeadId(leadId)
    setSelectedUserId(lead.assignedTo?.id || '')
    
    // Fetch outreach users
    await fetchOutreachUsers()
  }

  const fetchOutreachUsers = async () => {
    try {
      setLoadingUsers(true)
      const response = await fetch('/api/users?role=outreach')
      const data = await response.json()

      if (response.ok) {
        setOutreachUsers(data.users || [])
      }
    } catch (error) {
      console.error('Error fetching outreach users:', error)
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleAssign = async () => {
    if (!assigningLeadId) return

    try {
      const response = await fetch(`/api/leads/${assigningLeadId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assignedToId: selectedUserId,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        fetchLeads()
        setAssigningLeadId(null)
        setSelectedUserId('')
      } else {
        alert(data.error || 'Failed to assign lead')
      }
    } catch (error) {
      console.error('Error assigning lead:', error)
      alert('Failed to assign lead')
    }
  }

  const handleDelete = async (leadId: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return

    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchLeads()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to delete lead')
      }
    } catch (error) {
      console.error('Error deleting lead:', error)
      alert('Failed to delete lead')
    }
  }

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/leads/${leadId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newStatus }),
      })

      const data = await response.json()

      if (response.ok) {
        fetchLeads()
      } else {
        console.error('Status change error:', data)
        alert(data.error || data.message || 'Failed to change status')
      }
    } catch (error: any) {
      console.error('Error changing status:', error)
      alert(error.message || 'Failed to change status')
    }
  }

  const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/leads/import', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        alert(`Successfully imported ${data.created} leads. ${data.skipped} skipped.`)
        fetchLeads()
        if (fileInputRef) fileInputRef.value = ''
      } else {
        alert(data.error || 'Failed to import CSV')
      }
    } catch (error) {
      console.error('Error importing CSV:', error)
      alert('Failed to import CSV')
    }
  }

  const handleViewHistory = async (lead: Lead) => {
    try {
      const response = await fetch(`/api/leads/${lead.id}`)
      const data = await response.json()

      if (response.ok) {
        setViewingHistory({
          lead: data.lead,
          history: data.lead.statusHistory || [],
        })
      }
    } catch (error) {
      console.error('Error fetching history:', error)
    }
  }

  const canAddLead = user?.role === 'admin' || user?.role === 'lead_gen'
  const canImportCSV = user?.role === 'admin' || user?.role === 'lead_gen'
  const canEdit = (lead: Lead) => {
    if (user?.role === 'admin') return true
    if (user?.role === 'lead_gen' && !lead.assignedToId) return true
    if (user?.role === 'outreach' && lead.assignedToId === user.id) return true
    return false
  }
  const canDelete = user?.role === 'admin'
  const canChangeStatus = (lead: Lead) => {
    if (user?.role === 'admin') return true
    if (user?.role === 'lead_gen' && !lead.assignedToId) return false
    if (user?.role === 'outreach' && lead.assignedToId === user.id) return true
    return false
  }

  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size="lg" className="text-primary" />
      </div>
    )
  }

  return (
    <div className="flex h-screen max-h-screen overflow-hidden bg-background">
      <Sidebar user={user} onLogout={handleLogout} isOpen={sidebarOpen} onToggle={setSidebarOpen} />
      
      <div className="flex-1 flex flex-col overflow-hidden transition-all duration-300">
        {/* Top Header */}
        <div className={cn(
          "border-b border-border bg-card py-4 flex justify-between items-center gap-4 transition-all duration-300",
          sidebarOpen ? "px-6" : "pl-20 pr-6"
        )}>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground truncate">Leads Dashboard</h1>
            <p className="text-sm text-muted-foreground truncate">Manage and track your leads</p>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            {canAddLead && (
              <Button onClick={() => setShowAddDialog(true)}>Add Lead</Button>
            )}
            {canImportCSV && (
              <>
                <input
                  ref={setFileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleCSVImport}
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef?.click()}
                >
                  Import CSV
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="p-6">
            <Card>
              <CardContent className="p-6">
              <div className="space-y-4">
              {/* Filters */}
              <div className="flex gap-4 flex-wrap items-center">
                <Input
                  placeholder="Search by name, email, or company..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="max-w-sm"
                />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {LEAD_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {LEAD_STATUS_LABELS[status as keyof typeof LEAD_STATUS_LABELS]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Leads</SelectItem>
                    <SelectItem value="unclaimed">1. Unclaimed</SelectItem>
                    <SelectItem value="texted_old">2. Texted 4 days ago</SelectItem>
                    <SelectItem value="first_followup_old">3. First Follow-up 4 days ago</SelectItem>
                    <SelectItem value="replied_old">4. Replied 6 days ago</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={systemFilter} onValueChange={setSystemFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="System" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Systems</SelectItem>
                    {SYSTEMS.map((system) => (
                      <SelectItem key={system} value={system}>
                        {SYSTEM_LABELS[system as keyof typeof SYSTEM_LABELS]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[220px] justify-between text-left font-normal">
                      <span className="truncate">
                        {appliedDateFilter ? (
                          <>
                            {new Date(appliedDateFilter).toLocaleDateString()}
                            {appliedStatuses.size > 0 && ` (${appliedStatuses.size} status${appliedStatuses.size > 1 ? 'es' : ''})`}
                          </>
                        ) : (
                          <span>Filter by Date & Status</span>
                        )}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-96" align="start">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="date-filter" className="text-sm font-medium">Select Date</Label>
                        <Input
                          id="date-filter"
                          type="date"
                          value={dateFilter}
                          onChange={(e) => setDateFilter(e.target.value)}
                          className="w-full h-10 px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          style={{
                            colorScheme: 'dark',
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Select Statuses (Optional)</Label>
                        <div className="border rounded-md p-3 bg-muted/30">
                          <div className="grid grid-cols-2 gap-3 max-h-[280px] overflow-y-auto">
                            {LEAD_STATUSES.map((status) => (
                              <div key={status} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`status-${status}`}
                                  checked={selectedStatuses.has(status)}
                                  onCheckedChange={(checked) => {
                                    const newStatuses = new Set(selectedStatuses)
                                    if (checked) {
                                      newStatuses.add(status)
                                    } else {
                                      newStatuses.delete(status)
                                    }
                                    setSelectedStatuses(newStatuses)
                                  }}
                                />
                                <Label
                                  htmlFor={`status-${status}`}
                                  className="text-sm font-normal cursor-pointer flex-1"
                                >
                                  {LEAD_STATUS_LABELS[status as keyof typeof LEAD_STATUS_LABELS]}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleClearDateFilter}
                          className="flex-1"
                        >
                          Clear
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleApplyDateFilter}
                          className="flex-1"
                          disabled={!dateFilter}
                        >
                          Apply Filter
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Leads Table */}
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Spinner size="lg" className="text-primary" />
                </div>
              ) : leads.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-muted-foreground">No leads found</p>
                </div>
              ) : (
                <div className="border rounded-lg border-border overflow-hidden">
                  <div className="overflow-x-auto w-full">
                    <Table className="w-full" style={{ minWidth: '1900px' }}>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="min-w-[160px] whitespace-nowrap font-semibold">Name</TableHead>
                          <TableHead className="min-w-[200px] whitespace-nowrap font-semibold">Email</TableHead>
                          <TableHead className="min-w-[160px] whitespace-nowrap font-semibold">Company</TableHead>
                          <TableHead className="min-w-[160px] whitespace-nowrap font-semibold">Status</TableHead>
                          <TableHead className="min-w-[140px] whitespace-nowrap font-semibold">Assigned To</TableHead>
                          <TableHead className="min-w-[130px] whitespace-nowrap font-semibold">Texted</TableHead>
                          <TableHead className="min-w-[150px] whitespace-nowrap font-semibold">First Follow-up</TableHead>
                          <TableHead className="min-w-[160px] whitespace-nowrap font-semibold">Second Follow-up</TableHead>
                          <TableHead className="min-w-[130px] whitespace-nowrap font-semibold">Replied</TableHead>
                          <TableHead className="min-w-[150px] whitespace-nowrap font-semibold">Meeting Booked</TableHead>
                          <TableHead className="min-w-[150px] whitespace-nowrap font-semibold">Commented</TableHead>
                          <TableHead className="min-w-[150px] whitespace-nowrap font-semibold">Last Updated By</TableHead>
                          <TableHead className="min-w-[120px] whitespace-nowrap font-semibold">Created</TableHead>
                          <TableHead className="min-w-[200px] whitespace-nowrap font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                    <TableBody>
                      {leads.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium">{lead.name}</TableCell>
                          <TableCell>{lead.email || '-'}</TableCell>
                          <TableCell>{lead.company || '-'}</TableCell>
                          <TableCell>
                            {canChangeStatus(lead) ? (
                              <Select
                                value={lead.status}
                                onValueChange={(value) =>
                                  handleStatusChange(lead.id, value)
                                }
                              >
                                <SelectTrigger className="w-[150px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {LEAD_STATUSES.map((status) => (
                                    <SelectItem key={status} value={status}>
                                      {LEAD_STATUS_LABELS[status as keyof typeof LEAD_STATUS_LABELS]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">
                                {LEAD_STATUS_LABELS[lead.status as keyof typeof LEAD_STATUS_LABELS] || lead.status}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {lead.assignedTo ? lead.assignedTo.username : (
                              <span className="text-gray-400">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {lead.textedAt ? (
                              <span className="text-sm text-gray-700">
                                {new Date(lead.textedAt).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {lead.firstFollowupAt ? (
                              <span className="text-sm text-gray-700">
                                {new Date(lead.firstFollowupAt).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {lead.secondFollowupAt ? (
                              <span className="text-sm text-gray-700">
                                {new Date(lead.secondFollowupAt).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {lead.repliedAt ? (
                              <span className="text-sm text-gray-700">
                                {new Date(lead.repliedAt).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {lead.meetingBookedAt ? (
                              <span className="text-sm text-gray-700">
                                {new Date(lead.meetingBookedAt).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {lead.commentedAt ? (
                              <span className="text-sm text-gray-700">
                                {new Date(lead.commentedAt).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {lead.lastStatusUpdater ? (
                              <div className="text-sm">
                                <div className="font-medium">{lead.lastStatusUpdater.username}</div>
                                {lead.lastStatusUpdatedAt && (
                                  <div className="text-xs text-gray-500">
                                    {new Date(lead.lastStatusUpdatedAt).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(lead.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {!lead.assignedTo &&
                                (user?.role === 'outreach' || user?.role === 'admin') && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleClaim(lead.id)}
                                  >
                                    Claim
                                  </Button>
                                )}
                              {user?.role === 'admin' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAssignClick(lead.id)}
                                >
                                  Assign
                                </Button>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="sm" variant="outline">
                                    ⋮
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  {canEdit(lead) && (
                                    <DropdownMenuItem
                                      onClick={() => setEditingLead(lead)}
                                    >
                                      Edit
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => handleViewHistory(lead)}
                                  >
                                    View History
                                  </DropdownMenuItem>
                                  {canDelete && (
                                    <DropdownMenuItem
                                      onClick={() => handleDelete(lead.id)}
                                      className="text-red-600"
                                    >
                                      Delete
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="mt-6 space-y-2">
                  <div className="text-sm text-muted-foreground text-center">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} leads
                  </div>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e: React.MouseEvent) => {
                            e.preventDefault()
                            if (page > 1 && !loading) setPage(p => p - 1)
                          }}
                          className={page === 1 || loading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        let pageNum: number
                        if (pagination.totalPages <= 5) {
                          pageNum = i + 1
                        } else if (page <= 3) {
                          pageNum = i + 1
                        } else if (page >= pagination.totalPages - 2) {
                          pageNum = pagination.totalPages - 4 + i
                        } else {
                          pageNum = page - 2 + i
                        }
                        return (
                          <PaginationItem key={pageNum}>
                            <PaginationLink
                              href="#"
                              onClick={(e: React.MouseEvent) => {
                                e.preventDefault()
                                if (!loading) setPage(pageNum)
                              }}
                              isActive={page === pageNum}
                              className={loading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      })}
                      {pagination.totalPages > 5 && page < pagination.totalPages - 2 && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e: React.MouseEvent) => {
                            e.preventDefault()
                            if (page < pagination.totalPages && !loading) setPage(p => p + 1)
                          }}
                          className={page === pagination.totalPages || loading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
              </div>
            </CardContent>
          </Card>
          </div>
        </div>
      </div>

      {/* Add Lead Dialog */}
      <LeadFormDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={fetchLeads}
        isAdmin={user?.role === 'admin'}
      />

      {/* Edit Lead Dialog */}
      {editingLead && (
        <LeadFormDialog
          open={!!editingLead}
          onOpenChange={(open) => !open && setEditingLead(null)}
          onSuccess={() => {
            fetchLeads()
            setEditingLead(null)
          }}
          leadId={editingLead.id}
          isAdmin={user?.role === 'admin'}
          initialData={{
            name: editingLead.name,
            email: editingLead.email || '',
            company: editingLead.company || '',
            profileUrl: editingLead.profileUrl || '',
            postUrl: editingLead.postUrl || '',
            website: editingLead.website || '',
            status: editingLead.status,
            notes: editingLead.notes || '',
            assignedToId: editingLead.assignedTo?.id || null,
          }}
        />
      )}

      {/* Assign Lead Dialog */}
      <Dialog open={!!assigningLeadId} onOpenChange={(open) => !open && setAssigningLeadId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Lead</DialogTitle>
            <DialogDescription>
              Select an outreach user to assign this lead to, or leave unassigned.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="assignedTo">Assign To</Label>
              <Select
                value={selectedUserId || 'unassigned'}
                onValueChange={(value) => setSelectedUserId(value === 'unassigned' ? '' : value)}
                disabled={loadingUsers}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select outreach user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {outreachUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {assigningLeadId && (() => {
              const lead = leads.find(l => l.id === assigningLeadId)
              return lead?.assignedTo && (
                <p className="text-sm text-gray-500">
                  Currently assigned to: <strong>{lead.assignedTo.username}</strong>
                </p>
              )
            })()}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAssigningLeadId(null)
                setSelectedUserId('')
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={loadingUsers}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status History Dialog */}
      {viewingHistory && (
        <Dialog open={!!viewingHistory} onOpenChange={() => setViewingHistory(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Status History - {viewingHistory.lead.name}</DialogTitle>
              <DialogDescription>
                Complete audit trail of status changes
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto">
              {viewingHistory.history.length === 0 ? (
                <p className="text-gray-500">No status history available</p>
              ) : (
                <div className="space-y-4">
                  {viewingHistory.history.map((entry) => (
                    <div
                      key={entry.id}
                      className="border-l-2 border-blue-500 pl-4 py-2"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">
                            {entry.oldStatus
                              ? `${LEAD_STATUS_LABELS[entry.oldStatus as keyof typeof LEAD_STATUS_LABELS]} → ${LEAD_STATUS_LABELS[entry.newStatus as keyof typeof LEAD_STATUS_LABELS]}`
                              : `Set to ${LEAD_STATUS_LABELS[entry.newStatus as keyof typeof LEAD_STATUS_LABELS]}`}
                          </p>
                          {entry.reason && (
                            <p className="text-sm text-gray-600 mt-1">
                              Reason: {entry.reason}
                            </p>
                          )}
                        </div>
                        <div className="text-right text-sm text-gray-500">
                          <p>{entry.user.username}</p>
                          <p>
                            {new Date(entry.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
