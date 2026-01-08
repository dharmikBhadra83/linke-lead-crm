import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface CalendarProps {
  className?: string
  classNames?: {
    months?: string
    month?: string
    month_caption?: string
    month_name?: string
    weekdays?: string
    weekday?: string
    week?: string
    day?: string
  }
  mode?: "single"
  date?: Date
  defaultDate?: Date
  onDateChange?: (date: Date | undefined) => void
  disabled?: (date: Date) => boolean
  maxDate?: Date
  minDate?: Date
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

function isSameMonth(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth()
  )
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  })
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function Calendar({
  className,
  classNames,
  mode,
  date,
  defaultDate,
  onDateChange,
  disabled,
  maxDate,
  minDate,
  ...props
}: CalendarProps) {
  const [currentDate, setCurrentDate] = React.useState<Date>(
    date || defaultDate || new Date()
  )
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    date || defaultDate
  )

  React.useEffect(() => {
    if (date) {
      setCurrentDate(date)
      setSelectedDate(date)
    }
  }, [date])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const handleDateClick = (day: number) => {
    const newDate = new Date(year, month, day)
    
    if (disabled && disabled(newDate)) return
    if (maxDate && newDate > maxDate) return
    if (minDate && newDate < minDate) return

    setSelectedDate(newDate)
    onDateChange?.(newDate)
  }

  const isDateDisabled = (day: number): boolean => {
    const checkDate = new Date(year, month, day)
    if (disabled && disabled(checkDate)) return true
    if (maxDate && checkDate > maxDate) return true
    if (minDate && checkDate < minDate) return true
    return false
  }

  const isDateSelected = (day: number): boolean => {
    if (!selectedDate) return false
    const checkDate = new Date(year, month, day)
    return isSameDay(checkDate, selectedDate)
  }

  const isToday = (day: number): boolean => {
    const today = new Date()
    const checkDate = new Date(year, month, day)
    return isSameDay(checkDate, today)
  }

  const days: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) {
    days.push(null)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day)
  }

  return (
    <div className={cn("p-3", className)} {...props}>
      <div className={cn("flex flex-col space-y-4", classNames?.months)}>
        <div className={cn("space-y-4", classNames?.month)}>
          <div className={cn("flex items-center justify-between", classNames?.month_caption)}>
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevMonth}
              className="h-7 w-7"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className={cn("font-semibold", classNames?.month_name)}>
              {formatDate(currentDate)}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextMonth}
              className="h-7 w-7"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            <div className={cn("grid grid-cols-7 gap-1", classNames?.weekdays)}>
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className={cn(
                    "text-center text-sm font-medium text-muted-foreground",
                    classNames?.weekday
                  )}
                >
                  {day}
                </div>
              ))}
            </div>
            <div className={cn("grid grid-cols-7 gap-1", classNames?.week)}>
              {days.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} className="h-9" />
                }
                const isSelected = isDateSelected(day)
                const isDisabled = isDateDisabled(day)
                const isTodayDate = isToday(day)

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDateClick(day)}
                    disabled={isDisabled}
                    className={cn(
                      "h-9 w-9 rounded-md text-sm font-normal transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus:bg-accent focus:text-accent-foreground focus:outline-none",
                      isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                      isTodayDate && !isSelected && "bg-accent text-accent-foreground",
                      isDisabled && "opacity-50 cursor-not-allowed",
                      classNames?.day
                    )}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

