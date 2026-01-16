'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LEAD_STATUS_LABELS, LEAD_STATUSES, SYSTEMS, SYSTEM_LABELS } from '@/lib/constants'

interface LeadFormData {
  name: string
  email: string
  company: string
  profileUrl: string
  postUrl: string
  website: string
  status: string
  system: string
  notes: string
  assignedToId?: string | null
}

interface User {
  id: string
  username: string
  role: string
}

interface LeadFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  leadId?: string
  initialData?: Partial<LeadFormData>
  isAdmin?: boolean
}

export function LeadFormDialog({
  open,
  onOpenChange,
  onSuccess,
  leadId,
  initialData,
  isAdmin = false,
}: LeadFormDialogProps) {
  const [formData, setFormData] = useState<LeadFormData>({
    name: '',
    email: '',
    company: '',
    profileUrl: '',
    postUrl: '',
    website: '',
    status: 'new',
    system: 'linkedin_one',
    notes: '',
    assignedToId: null,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [outreachUsers, setOutreachUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  // Fetch outreach users when dialog opens (admin only)
  useEffect(() => {
    if (open && isAdmin) {
      fetchOutreachUsers()
    }
  }, [open, isAdmin])

  useEffect(() => {
    if (open) {
      if (initialData) {
        // Populate form with initial data when editing
        setFormData({
          name: initialData.name || '',
          email: initialData.email || '',
          company: initialData.company || '',
          profileUrl: initialData.profileUrl || '',
          postUrl: initialData.postUrl || '',
          website: initialData.website || '',
          status: initialData.status || 'new',
          system: initialData.system || 'linkedin_one',
          notes: initialData.notes || '',
          assignedToId: initialData.assignedToId || null,
        })
      } else if (!leadId) {
        // Reset form for new lead
        setFormData({
          name: '',
          email: '',
          company: '',
          profileUrl: '',
          postUrl: '',
          website: '',
          status: 'new',
          system: 'linkedin_one',
          notes: '',
          assignedToId: null,
        })
      }
    }
  }, [initialData, leadId, open])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const url = leadId ? `/api/leads/${leadId}` : '/api/leads'
      const method = leadId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to save lead')
        setLoading(false)
        return
      }

      onSuccess()
      onOpenChange(false)
    } catch (err) {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{leadId ? 'Edit Lead' : 'Add New Lead'}</DialogTitle>
          <DialogDescription>
            {leadId ? 'Update lead information' : 'Create a new lead entry'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  disabled={loading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) =>
                  setFormData({ ...formData, company: e.target.value })
                }
                disabled={loading}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="profileUrl">Profile URL</Label>
                <Input
                  id="profileUrl"
                  type="url"
                  value={formData.profileUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, profileUrl: e.target.value })
                  }
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postUrl">Post URL</Label>
                <Input
                  id="postUrl"
                  type="url"
                  value={formData.postUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, postUrl: e.target.value })
                  }
                  disabled={loading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={formData.website}
                onChange={(e) =>
                  setFormData({ ...formData, website: e.target.value })
                }
                disabled={loading}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value })
                  }
                  disabled={loading}
                >
                  <SelectTrigger>
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="system">System</Label>
                <Select
                  value={formData.system}
                  onValueChange={(value) =>
                    setFormData({ ...formData, system: value })
                  }
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SYSTEMS.map((system) => (
                      <SelectItem key={system} value={system}>
                        {SYSTEM_LABELS[system as keyof typeof SYSTEM_LABELS]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {isAdmin && (
              <div className="space-y-2">
                <Label htmlFor="assignedToId">Assigned To</Label>
                <Select
                  value={formData.assignedToId || 'unassigned'}
                  onValueChange={(value) =>
                    setFormData({ ...formData, assignedToId: value === 'unassigned' ? null : value })
                  }
                  disabled={loading || loadingUsers}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
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
            )}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                disabled={loading}
              />
            </div>
          </div>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded mb-4">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : leadId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

