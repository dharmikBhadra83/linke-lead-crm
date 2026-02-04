'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { LayoutDashboard, BarChart3, LogOut, X, Menu, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SidebarProps {
  user: {
    id: string
    username: string
    role: string
  } | null
  onLogout: () => void
  isOpen?: boolean
  onToggle?: (isOpen: boolean) => void
}

export function Sidebar({ user, onLogout, isOpen: controlledIsOpen, onToggle }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [internalIsOpen, setInternalIsOpen] = useState(true)
  
  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen
  const setIsOpen = (value: boolean) => {
    if (onToggle) {
      onToggle(value)
    } else {
      setInternalIsOpen(value)
    }
  }

  const tasksLabel = user?.role === 'admin' ? 'Add Task' : 'MY TASK'
  const menuItems = [
    {
      label: tasksLabel,
      icon: ClipboardList,
      path: '/dashboard/tasks',
      active: pathname === '/dashboard/tasks',
    },
    {
      label: 'Dashboard',
      icon: BarChart3,
      path: '/dashboard/performance',
      active: pathname === '/dashboard/performance',
    },
    {
      label: 'Leads',
      icon: LayoutDashboard,
      path: '/dashboard',
      active: pathname === '/dashboard',
    },
  ]

  return (
    <>
      {/* Mobile/Desktop Toggle Button */}
      {!isOpen && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed left-4 top-4 z-50 bg-card border border-border shadow-lg hover:bg-accent"
          onClick={() => setIsOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'flex flex-col h-screen bg-card border-r border-border transition-all duration-300 ease-in-out fixed left-0 top-0 z-40',
          isOpen ? 'w-64' : 'w-0 -translate-x-full overflow-hidden'
        )}
      >
        {/* Logo/Header */}
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">Linke CRM</h1>
            {user && (
              <p className="text-sm text-muted-foreground mt-1">
                {user.username}
                <span className="ml-2 text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                  {user.role}
                </span>
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <Button
                key={item.path}
                variant={item.active ? 'secondary' : 'ghost'}
                className={cn(
                  'w-full justify-start',
                  item.active && 'bg-secondary text-secondary-foreground'
                )}
                onClick={() => router.push(item.path)}
              >
                <Icon className="mr-2 h-5 w-5" />
                {item.label}
              </Button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <Button
            variant="ghost"
            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onLogout}
          >
            <LogOut className="mr-2 h-5 w-5" />
            Logout
          </Button>
        </div>
      </div>
    </>
  )
}

