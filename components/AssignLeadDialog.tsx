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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface User {
  id: string
  username: string
  role: string
}

interface AssignLeadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  leadId: string
  currentAssignedTo?: {
    id: string
    username: string
  } | null
}

export function AssignLeadDialog({
  open,
  onOpenChange,
  onSuccess,
  leadId,
  currentAssignedTo,
}: AssignLeadDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [outreachUsers, setOutreachUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      fetchOutreachUsers()
      // Set current assigned user if exists
      setSelectedUserId(currentAssignedTo?.id || '')
    }
  }, [open, currentAssignedTo])

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
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assignedToId: selectedUserId || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to assign lead')
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Lead</DialogTitle>
          <DialogDescription>
            Select an outreach user to assign this lead to, or leave unassigned.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {currentAssignedTo && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-medium text-foreground">
                Currently assigned to: <strong>{currentAssignedTo.username}</strong>
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="assignedTo">Assign To</Label>
            <Select
              value={selectedUserId || 'unassigned'}
              onValueChange={(value) => setSelectedUserId(value === 'unassigned' ? '' : value)}
              disabled={loading || loadingUsers}
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
            <p className="text-xs text-muted-foreground">
              Select "Unassigned" to remove the current assignment
            </p>
          </div>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={loading || loadingUsers}>
            {loading ? 'Assigning...' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

