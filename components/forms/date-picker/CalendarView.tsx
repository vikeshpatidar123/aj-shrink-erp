'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'
import { MONTHS, WEEKDAYS, getDaysInMonth, getFirstDayOfMonth } from './shared-utils'

export interface CalendarViewProps {
  currentMonth: Date
  selectedDate?: Date | null
  onDateClick: (date: Date) => void
  onMonthChange: (direction: 'prev' | 'next') => void
  isDateDisabled?: (date: Date) => boolean
  isDateSelected?: (date: Date) => boolean
  minDate?: Date
  maxDate?: Date
  showNavigation?: boolean
}

/**
 * Shared Calendar View Component
 * Used by both DatePicker and DateTimePicker to render the calendar grid
 */
export function CalendarView({
  currentMonth,
  selectedDate,
  onDateClick,
  onMonthChange,
  isDateDisabled,
  isDateSelected,
  minDate,
  maxDate,
  showNavigation = true
}: CalendarViewProps) {
  const defaultIsDateDisabled = React.useCallback((date: Date) => {
    if (minDate && date < minDate) return true
    if (maxDate && date > maxDate) return true
    return false
  }, [minDate, maxDate])

  const defaultIsDateSelected = React.useCallback((date: Date) => {
    if (!selectedDate) return false
    return date.toDateString() === selectedDate.toDateString()
  }, [selectedDate])

  const checkDisabled = isDateDisabled || defaultIsDateDisabled
  const checkSelected = isDateSelected || defaultIsDateSelected

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth)
    const firstDayOfMonth = getFirstDayOfMonth(currentMonth)
    const days: React.ReactElement[] = []

    // Empty cells for days before month starts
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="h-8 w-8" />)
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
      const isSelected = checkSelected(date)
      const isDisabled = checkDisabled(date)
      const isToday = date.toDateString() === new Date().toDateString()

      days.push(
        <button
          key={day}
          className={cn(
            'h-8 w-8 rounded-lg text-xs font-medium transition-all duration-200',
            'text-[rgb(var(--fg-default))]',
            !isSelected && !isDisabled && 'hover:bg-[rgb(var(--bg-hover))] hover:shadow-sm',
            isSelected && 'bg-[rgb(var(--color-primary))] !text-white shadow-md',
            isToday && !isSelected && 'text-[rgb(var(--color-primary))] font-bold border border-[rgb(var(--color-primary))]',
            isDisabled && 'text-[rgb(var(--fg-subtle))] cursor-not-allowed hover:bg-transparent'
          )}
          onClick={() => !isDisabled && onDateClick(date)}
          disabled={isDisabled}
        >
          {day}
        </button>
      )
    }

    return days
  }

  return (
    <div>
      {/* Calendar Navigation */}
      {showNavigation && (
        <div className="flex items-center justify-between mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMonthChange('prev')}
            className="h-7 w-7 p-0 hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--color-primary))]"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold text-[rgb(var(--fg-default))]">
            {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMonthChange('next')}
            className="h-7 w-7 p-0 hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--color-primary))]"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAYS.map(day => (
          <div
            key={day}
            className="h-7 w-8 flex items-center justify-center font-semibold text-[rgb(var(--fg-muted))] bg-[rgb(var(--bg-subtle))] rounded text-[10px]"
          >
            {day.charAt(0)}
          </div>
        ))}
      </div>

      {/* Calendar days */}
      <div className="grid grid-cols-7 gap-1">
        {renderCalendarDays()}
      </div>
    </div>
  )
}
