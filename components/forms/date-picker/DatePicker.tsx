'use client'

import * as React from 'react'
import * as Popover from '@radix-ui/react-popover'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  X,
  CalendarDays,
  ArrowRight
} from 'lucide-react'
import { cn, getLocalDateString } from '@/lib/utils'
import { Button } from '@/components/ui'
import { Input } from '@/components/ui'
import { Dropdown } from '@/components'
import { MONTHS, WEEKDAYS, PERIOD_OPTIONS, TIME_OPTIONS, getDaysInMonth, getFirstDayOfMonth } from './shared-utils'

export interface DateRange {
  from?: Date
  to?: Date
}

export interface DatePickerProps {
  value?: Date | DateRange | string
  onChange?: (date: Date | DateRange | string | undefined) => void
  mode?: 'single' | 'range'
  placeholder?: string
  label?: string
  error?: string
  disabled?: boolean
  minDate?: Date
  maxDate?: Date
  className?: string
  showTime?: boolean
  showFromTo?: boolean // NEW: Show From/To display for range mode
  returnFormat?: 'date' | 'string' // NEW: Return Date object or YYYY-MM-DD string
  /** Show calendar inline without trigger/popover */
  inline?: boolean
  /** Render just a calendar icon button as the trigger (for use inside search bars) */
  iconOnly?: boolean
  /** Alignment of the popover relative to the trigger */
  popoverAlign?: 'start' | 'center' | 'end'
  presets?: Array<{
    label: string
    value: Date | DateRange
  }>
}

// ============================================
// DatePicker Component (Single/Range dates without time)
// ============================================

export function DatePicker({
  value,
  onChange,
  mode = 'single',
  placeholder = 'Select date...',
  label,
  error,
  disabled = false,
  minDate,
  maxDate,
  className,
  showTime = false,
  showFromTo = false,
  returnFormat = 'date',
  inline = false,
  iconOnly = false,
  popoverAlign,
  presets
}: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [currentMonth, setCurrentMonth] = React.useState(new Date())
  const [secondMonth, setSecondMonth] = React.useState(() => {
    const next = new Date()
    next.setMonth(next.getMonth() + 1)
    return next
  })
  const [selectedRange, setSelectedRange] = React.useState<DateRange>(() => {
    if (mode === 'range' && value && typeof value === 'object' && 'from' in value) {
      return { from: (value as DateRange).from, to: (value as DateRange).to }
    }
    return {}
  })

  // Sync selectedRange from external value prop changes (e.g. default dates set by parent)
  React.useEffect(() => {
    if (mode !== 'range') return
    if (value && typeof value === 'object' && 'from' in value) {
      const v = value as DateRange
      setSelectedRange(prev => {
        if (prev.from?.getTime() === v.from?.getTime() && prev.to?.getTime() === v.to?.getTime()) {
          return prev
        }
        return { from: v.from, to: v.to }
      })
    }
  }, [value, mode])
  const [tempTime, setTempTime] = React.useState({ hours: 12, minutes: 0 })
  const [fromTime, setFromTime] = React.useState({ hours: 9, minutes: 0, period: 'AM' as 'AM' | 'PM' })
  const [toTime, setToTime] = React.useState({ hours: 6, minutes: 0, period: 'PM' as 'AM' | 'PM' })
  const [rangeStart, setRangeStart] = React.useState<Date | null>(null)
  const [showMonthYearScroller, setShowMonthYearScroller] = React.useState(false)
  const [selectedTime, setSelectedTime] = React.useState<string>('')
  const [selectedPeriod, setSelectedPeriod] = React.useState<string>('')
  const [hoveredDate, setHoveredDate] = React.useState<Date | null>(null)
  const [inputValue, setInputValue] = React.useState('')
  const [focusedDate, setFocusedDate] = React.useState<Date | null>(null)

  const containerRef = React.useRef<HTMLDivElement>(null)
  const yearScrollerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLDivElement>(null)
  const inputWrapperRef = React.useRef<HTMLDivElement>(null)
  const calendarRef = React.useRef<HTMLDivElement>(null)

  // Helper to convert date based on returnFormat
  const convertDate = (date: Date | undefined): Date | string | undefined => {
    if (!date) return undefined
    return returnFormat === 'string' ? getLocalDateString(date) : date
  }

  const convertDateRange = (range: DateRange): DateRange => {
    if (returnFormat === 'date') return range
    // For string format, we keep it as DateRange for now since it's more complex
    // Users can destructure and convert if needed
    return range
  }


  // Auto-select today's date for single mode on mount
  React.useEffect(() => {
    if (mode === 'single' && !value && onChange) {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
      onChange(today)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]) // Run when mode changes

  // Scroll to current year when month/year scroller opens
  React.useEffect(() => {
    if (showMonthYearScroller && yearScrollerRef.current) {
      const currentYear = new Date().getFullYear()
      const yearElement = yearScrollerRef.current.querySelector(`[data-year="${currentYear}"]`)
      if (yearElement) {
        yearElement.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    }
  }, [showMonthYearScroller])

  // Note: Radix Popover handles click-outside automatically via onOpenChange
  // We only need to prevent closing when interacting with nested Radix portals (like Dropdowns)

  // Normalize date to midnight local time (removes time component)
  const normalizeDateToMidnight = (date: Date): Date => {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
  }

  const formatDate = (date: Date) => {
    const day = date.getDate().toString().padStart(2, '0')
    const month = MONTHS[date.getMonth()].slice(0, 3)
    const year = date.getFullYear()
    return `${day} ${month}, ${year}`
  }

  const formatDateShort = (date?: Date) => {
    if (!date) return '--'
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatDisplayValue = () => {
    if (!value) return ''

    if (mode === 'single' && value instanceof Date) {
      return showTime
        ? `${formatDate(value)} ${value.toLocaleTimeString('en-GB', {
            hour: '2-digit', minute: '2-digit', hour12: false
          })}`
        : formatDate(value)
    }

    if (mode === 'range' && typeof value === 'object' && !Array.isArray(value)) {
      const { from, to } = value as DateRange
      if (from && to) {
        return `${formatDate(from)} → ${formatDate(to)}`
      }
      if (from) {
        // Only show the from date, let placeholder handle the rest
        return `${formatDate(from)} → `
      }
    }

    return ''
  }

  const getPlaceholder = () => {
    if (mode === 'range') {
      if (typeof value === 'object' && 'from' in value) {
        const { from, to } = value as DateRange
        if (from && !to) {
          return 'Start Date → End Date'
        }
      }
      return 'Start Date → End Date'
    }
    return placeholder
  }

  // Parse date from string input (supports multiple formats)
  const parseDate = (str: string): Date | null => {
    if (!str) return null

    // Try parsing common date formats
    // Format 1: "DD MMM, YYYY" (e.g., "1 Oct, 2025")
    const format1 = /(\d{1,2})\s+([a-zA-Z]{3}),?\s+(\d{4})/
    const match1 = str.match(format1)
    if (match1) {
      const day = parseInt(match1[1])
      const monthStr = match1[2]
      const year = parseInt(match1[3])
      const monthIndex = MONTHS.findIndex(m => m.toLowerCase().startsWith(monthStr.toLowerCase()))
      if (monthIndex !== -1) {
        return new Date(year, monthIndex, day, 0, 0, 0, 0)
      }
    }

    // Format 2: "DD/MM/YYYY" or "DD-MM-YYYY"
    const format2 = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/
    const match2 = str.match(format2)
    if (match2) {
      const day = parseInt(match2[1])
      const month = parseInt(match2[2]) - 1 // 0-indexed
      const year = parseInt(match2[3])
      return new Date(year, month, day, 0, 0, 0, 0)
    }

    // Format 3: ISO format or native Date parsing
    const date = new Date(str)
    if (!isNaN(date.getTime())) {
      return date
    }

    return null
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)

    // Auto-add arrow separator when typing a complete date in range mode
    if (mode === 'range') {
      // Check if user just typed a complete date pattern (e.g., "1 Jan, 2025 ")
      // Pattern: digits, space, 3+ letters, optional comma, space, 4 digits, space
      const completePattern = /^\d{1,2}\s+[a-zA-Z]{3,}\,?\s+\d{4}\s+$/
      if (completePattern.test(newValue) && !newValue.includes('→')) {
        // Auto-add arrow and space
        setInputValue(newValue.trim() + ' → ')
      }
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleInputBlur()
      setIsOpen(false)
    } else if (e.key === 'Escape') {
      setInputValue(formatDisplayValue())
      setIsOpen(false)
    } else if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
      // Stop propagation to prevent grid's Ctrl+A from triggering
      e.stopPropagation()
    }
  }

  const handleInputBlur = () => {
    const newValue = inputValue.trim()
    if (!newValue) return

    if (mode === 'single') {
      const parsedDate = parseDate(newValue)
      if (parsedDate && !isDateDisabled(parsedDate)) {
        onChange?.(convertDate(parsedDate))
      } else {
        // Reset to previous valid value if parsing fails
        setInputValue(formatDisplayValue())
      }
    } else if (mode === 'range') {
      // Parse range format "DD MMM, YYYY → DD MMM, YYYY"
      const parts = newValue.split('→').map(s => s.trim())
      if (parts.length === 2) {
        let fromDate = parseDate(parts[0])
        let toDate = parseDate(parts[1])

        // Auto-swap if dates are in reverse order
        if (fromDate && toDate && toDate < fromDate) {
          [fromDate, toDate] = [toDate, fromDate]
        }

        if (fromDate && toDate && !isDateDisabled(fromDate) && !isDateDisabled(toDate)) {
          onChange?.({ from: fromDate, to: toDate })
        } else if (fromDate && !isDateDisabled(fromDate)) {
          onChange?.({ from: fromDate })
        } else {
          // Reset to previous valid value if parsing fails
          setInputValue(formatDisplayValue())
        }
      } else if (parts.length === 1) {
        const fromDate = parseDate(parts[0])
        if (fromDate && !isDateDisabled(fromDate)) {
          onChange?.({ from: fromDate })
        } else {
          // Reset to previous valid value if parsing fails
          setInputValue(formatDisplayValue())
        }
      }
    }
  }

  // Sync inputValue with value prop
  React.useEffect(() => {
    setInputValue(formatDisplayValue())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const isDateDisabled = (date: Date) => {
    if (minDate && date < minDate) return true
    if (maxDate && date > maxDate) return true
    return false
  }

  const isDateSelected = (date: Date) => {
    if (mode === 'single' && value instanceof Date) {
      return date.toDateString() === value.toDateString()
    }

    if (mode === 'range' && typeof value === 'object' && 'from' in value) {
      const { from, to } = value as DateRange
      if (from && to) {
        // Compare date strings to ensure same day comparison (ignore time)
        const dateStr = date.toDateString()
        const fromStr = from.toDateString()
        const toStr = to.toDateString()
        const dateTime = new Date(dateStr).getTime()
        const fromTime = new Date(fromStr).getTime()
        const toTime = new Date(toStr).getTime()
        return dateTime >= fromTime && dateTime <= toTime
      }
      if (from) {
        return date.toDateString() === from.toDateString()
      }
    }

    return false
  }

  const isDateInRange = (date: Date) => {
    if (mode !== 'range' || !value || typeof value !== 'object' || !('from' in value)) return false

    const { from, to } = value as DateRange

    // ONLY show hover preview when selecting range (not for finalized ranges)
    // This is for the preview effect when from is selected but to is not yet
    if (from && !to && hoveredDate) {
      const minDate = from < hoveredDate ? from : hoveredDate
      const maxDate = from < hoveredDate ? hoveredDate : from
      const dateTime = date.getTime()
      const minTime = minDate.getTime()
      const maxTime = maxDate.getTime()
      return dateTime >= minTime && dateTime <= maxTime
    }

    // Don't return true for finalized ranges - let isDateSelected handle that
    return false
  }

  const handleDateClick = (date: Date) => {
    if (isDateDisabled(date)) return

    if (mode === 'single') {
      if (showTime) {
        const newDate = new Date(date)
        newDate.setHours(tempTime.hours)
        newDate.setMinutes(tempTime.minutes)
        onChange?.(convertDate(newDate))
      } else {
        // Normalize to midnight local time to avoid timezone issues
        const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
        onChange?.(convertDate(normalizedDate))
      }
      setIsOpen(false)
      return
    }

    if (mode === 'range') {
      const currentValue = (value as DateRange) || {}
      
      if (!currentValue.from || (currentValue.from && currentValue.to)) {
        // Start new range
        setSelectedRange({ from: date })
        setRangeStart(date)
        onChange?.({ from: date })
      } else if (currentValue.from && !currentValue.to) {
        // Complete range
        const from = currentValue.from
        const to = date
        
        if (date >= from) {
          setSelectedRange({ from, to })
          onChange?.({ from, to })
        } else {
          setSelectedRange({ from: date, to: from })
          onChange?.({ from: date, to: from })
        }
        setRangeStart(null)
        setIsOpen(false)
      }
    }
  }

  // Keyboard navigation for calendar
  const handleCalendarKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) return

    const currentFocus = focusedDate || (mode === 'single' && value instanceof Date ? value : new Date())
    let newFocus: Date | null = null

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault()
        newFocus = new Date(currentFocus)
        newFocus.setDate(newFocus.getDate() - 1)
        break
      case 'ArrowRight':
        e.preventDefault()
        newFocus = new Date(currentFocus)
        newFocus.setDate(newFocus.getDate() + 1)
        break
      case 'ArrowUp':
        e.preventDefault()
        newFocus = new Date(currentFocus)
        newFocus.setDate(newFocus.getDate() - 7)
        break
      case 'ArrowDown':
        e.preventDefault()
        newFocus = new Date(currentFocus)
        newFocus.setDate(newFocus.getDate() + 7)
        break
      case 'Home':
        e.preventDefault()
        newFocus = new Date(currentFocus.getFullYear(), currentFocus.getMonth(), 1)
        break
      case 'End':
        e.preventDefault()
        newFocus = new Date(currentFocus.getFullYear(), currentFocus.getMonth() + 1, 0)
        break
      case 'PageUp':
        e.preventDefault()
        newFocus = new Date(currentFocus)
        newFocus.setMonth(newFocus.getMonth() - 1)
        break
      case 'PageDown':
        e.preventDefault()
        newFocus = new Date(currentFocus)
        newFocus.setMonth(newFocus.getMonth() + 1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (!isDateDisabled(currentFocus)) {
          handleDateClick(currentFocus)
        }
        return
    }

    if (newFocus && !isDateDisabled(newFocus)) {
      setFocusedDate(newFocus)
      setCurrentMonth(newFocus)
    }
  }, [isOpen, focusedDate, mode, value])

  const calculateQuickRange = (time: string, period: string): DateRange => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()
    const currentQuarter = Math.floor(currentMonth / 3)

    let from: Date
    let to: Date

    switch (period) {
      case 'Day':
        if (time === 'This') {
          // Today
          from = now
          to = now
        } else if (time === 'Last') {
          // Yesterday
          const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          from = yesterday
          to = yesterday
        } else { // Next
          // Tomorrow
          const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
          from = tomorrow
          to = tomorrow
        }
        break

      case 'Week':
        const dayOfWeek = now.getDay()
        if (time === 'This') {
          // This week: from start of week to today
          from = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000)
          to = now
        } else if (time === 'Last') {
          // Last week: full week
          from = new Date(now.getTime() - (dayOfWeek + 7) * 24 * 60 * 60 * 1000)
          to = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000)
        } else { // Next
          // Next week: full week
          from = new Date(now.getTime() + (7 - dayOfWeek) * 24 * 60 * 60 * 1000)
          to = new Date(now.getTime() + (14 - dayOfWeek) * 24 * 60 * 60 * 1000)
        }
        break

      case 'Month':
        if (time === 'This') {
          // This month: from 1st to today
          from = new Date(currentYear, currentMonth, 1)
          to = now
        } else if (time === 'Last') {
          // Last month: full month
          from = new Date(currentYear, currentMonth - 1, 1)
          to = new Date(currentYear, currentMonth, 0)
        } else { // Next
          // Next month: full month
          from = new Date(currentYear, currentMonth + 1, 1)
          to = new Date(currentYear, currentMonth + 2, 0)
        }
        break

      case 'Quarter':
        if (time === 'This') {
          // This quarter: from start to today
          from = new Date(currentYear, currentQuarter * 3, 1)
          to = now
        } else if (time === 'Last') {
          // Last quarter: full quarter
          const lastQuarter = currentQuarter - 1
          const lastQuarterYear = lastQuarter < 0 ? currentYear - 1 : currentYear
          const lastQuarterMonth = lastQuarter < 0 ? 9 : lastQuarter * 3
          from = new Date(lastQuarterYear, lastQuarterMonth, 1)
          to = new Date(lastQuarterYear, lastQuarterMonth + 3, 0)
        } else { // Next
          // Next quarter: full quarter
          const nextQuarter = currentQuarter + 1
          const nextQuarterYear = nextQuarter > 3 ? currentYear + 1 : currentYear
          const nextQuarterMonth = nextQuarter > 3 ? 0 : nextQuarter * 3
          from = new Date(nextQuarterYear, nextQuarterMonth, 1)
          to = new Date(nextQuarterYear, nextQuarterMonth + 3, 0)
        }
        break

      case 'Year':
        if (time === 'This') {
          // This year: from Jan 1 to today
          from = new Date(currentYear, 0, 1)
          to = now
        } else if (time === 'Last') {
          // Last year: full year
          from = new Date(currentYear - 1, 0, 1)
          to = new Date(currentYear - 1, 11, 31)
        } else { // Next
          // Next year: full year
          from = new Date(currentYear + 1, 0, 1)
          to = new Date(currentYear + 1, 11, 31)
        }
        break

      default:
        from = now
        to = now
    }

    return { from, to }
  }

  const handleQuickSelect = () => {
    const range = calculateQuickRange(selectedTime, selectedPeriod)
    onChange?.(range)
    setIsOpen(false)
  }

  const handleLastMonthClick = () => {
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth()
    const range: DateRange = {
      from: new Date(currentYear, currentMonth - 1, 1),
      to: new Date(currentYear, currentMonth, 0)
    }
    onChange?.(range)
    setIsOpen(false)
  }

  // Shared Quick Select component for range mode (used in both inline and popover)
  const renderQuickSelect = (closeOnSelect: boolean = true) => (
    <div className="mt-3 pt-3 border-t border-[rgb(var(--bd-default))]" onClick={(e) => e.stopPropagation()}>
      <h4 className="text-xs font-semibold text-[rgb(var(--fg-muted))] mb-2">Quick Select</h4>
      <div className="flex flex-nowrap gap-2 items-center overflow-x-auto pb-1" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const now = new Date()
            const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0)
            onChange?.({ from: yesterday, to: yesterday })
            if (closeOnSelect) setIsOpen(false)
          }}
          className="h-7 px-3 text-xs font-semibold hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--color-primary))] whitespace-nowrap"
        >
          Yesterday
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const now = new Date()
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
            onChange?.({ from: today, to: today })
            if (closeOnSelect) setIsOpen(false)
          }}
          className="h-7 px-3 text-xs font-semibold hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--color-primary))] whitespace-nowrap"
        >
          Today
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const now = new Date()
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
            const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0)
            onChange?.({ from: sevenDaysAgo, to: today })
            if (closeOnSelect) setIsOpen(false)
          }}
          className="h-7 px-3 text-xs font-semibold hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--color-primary))] whitespace-nowrap"
        >
          Last 7 Days
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const now = new Date()
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
            const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0)
            onChange?.({ from: thirtyDaysAgo, to: today })
            if (closeOnSelect) setIsOpen(false)
          }}
          className="h-7 px-3 text-xs font-semibold hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--color-primary))] whitespace-nowrap"
        >
          Last 30 Days
        </Button>
        <div className="h-5 w-px bg-[rgb(var(--bd-default))]" />
        <Dropdown
          value={selectedTime}
          onValueChange={(val) => {
            setSelectedTime(val as string)
            if (val && selectedPeriod) {
              const range = calculateQuickRange(val as string, selectedPeriod)
              onChange?.(range)
              if (range.from && range.to) {
                setCurrentMonth(new Date(range.from))
                setSecondMonth(new Date(range.to))
              }
              if (closeOnSelect) setIsOpen(false)
            }
          }}
          options={TIME_OPTIONS.map(opt => ({ value: opt, label: opt }))}
          placeholder="Time"
          autoWidth
          searchable={false}
          triggerClassName="!h-7 text-xs font-semibold"
        />
        <Dropdown
          value={selectedPeriod}
          onValueChange={(val) => {
            setSelectedPeriod(val as string)
            if (selectedTime && val) {
              const range = calculateQuickRange(selectedTime, val as string)
              onChange?.(range)
              if (range.from && range.to) {
                setCurrentMonth(new Date(range.from))
                setSecondMonth(new Date(range.to))
              }
              if (closeOnSelect) setIsOpen(false)
            }
          }}
          options={PERIOD_OPTIONS.map(opt => ({ value: opt, label: opt }))}
          placeholder="Period"
          autoWidth
          searchable={false}
          triggerClassName="!h-7 text-xs font-semibold"
        />
      </div>
    </div>
  )

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth)
    newMonth.setMonth(newMonth.getMonth() + (direction === 'next' ? 1 : -1))
    setCurrentMonth(newMonth)

    // Sync second month for range mode
    if (mode === 'range') {
      const newSecondMonth = new Date(newMonth)
      newSecondMonth.setMonth(newSecondMonth.getMonth() + 1)
      setSecondMonth(newSecondMonth)
    }
  }

  // Navigate first calendar independently
  const navigateFirstCalendar = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth)
    newMonth.setMonth(newMonth.getMonth() + (direction === 'next' ? 1 : -1))
    setCurrentMonth(newMonth)
  }

  // Navigate second calendar independently
  const navigateSecondCalendar = (direction: 'prev' | 'next') => {
    const newMonth = new Date(secondMonth)
    newMonth.setMonth(newMonth.getMonth() + (direction === 'next' ? 1 : -1))
    setSecondMonth(newMonth)
  }

  const handleTodayClick = () => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    setCurrentMonth(today)
    if (mode === 'single') {
      onChange?.(convertDate(today))
      setIsOpen(false)
    }
  }

  const handleMonthYearSelect = (year: number, month: number) => {
    const newMonth = new Date(year, month, 1)
    setCurrentMonth(newMonth)
    setShowMonthYearScroller(false)
  }

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear()
    const startYear = currentYear - 50
    const endYear = currentYear + 10
    const years: number[] = []
    for (let year = startYear; year <= endYear; year++) {
      years.push(year)
    }
    return years
  }

  const renderCalendarDays = (monthToRender: Date) => {
    const daysInMonth = getDaysInMonth(monthToRender)
    const firstDayOfMonth = getFirstDayOfMonth(monthToRender)
    const days: React.ReactElement[] = []

    // Empty cells for days before month starts
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(
        <div
          key={`empty-${i}`}
          className="h-7 w-7"
        />
      )
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(monthToRender.getFullYear(), monthToRender.getMonth(), day)
      const isSelected = isDateSelected(date)
      const isInRange = isDateInRange(date)
      const isDisabled = isDateDisabled(date)
      const isToday = date.toDateString() === new Date().toDateString()
      const isFocused = focusedDate && date.toDateString() === focusedDate.toDateString()

      days.push(
        <button
          key={day}
          onMouseEnter={() => mode === 'range' && !isDisabled && setHoveredDate(date)}
          onMouseLeave={() => mode === 'range' && setHoveredDate(null)}
          className={cn(
            'h-7 w-7 rounded text-[11px] font-medium transition-all duration-200 ease-out',
            'text-[rgb(var(--fg-default))]', // Default text color for all dates
            !isSelected && !isDisabled && 'hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--fg-default))] hover:shadow-sm',
            isSelected && 'bg-[rgb(var(--color-primary))] !text-white shadow-md hover:brightness-110',
            isInRange && !isSelected && 'bg-[rgb(var(--bg-subtle))] text-[rgb(var(--fg-default))]',
            isToday && !isSelected && 'text-[rgb(var(--color-primary))] font-bold border border-[rgb(var(--color-primary))]',
            isFocused && !isSelected && 'ring-2 ring-[rgb(var(--color-primary))] ring-offset-1',
            isDisabled && 'text-[rgb(var(--fg-disabled))] cursor-not-allowed hover:bg-transparent hover:text-[rgb(var(--fg-disabled))] hover:shadow-none'
          )}
          onClick={() => handleDateClick(date)}
          disabled={isDisabled}
        >
          {day}
        </button>
      )
    }

    return days
  }

  const renderSingleCalendar = (monthToRender: Date, showMonthNavigation: boolean = false, isFirst: boolean = false) => {
    return (
      <div className="flex-1">
        {/* Month header for individual calendar with navigation */}
        {showMonthNavigation && (
          <div className="flex items-center justify-center gap-2 mb-1.5">
            {/* Left arrow - both calendars */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => isFirst ? navigateFirstCalendar('prev') : navigateSecondCalendar('prev')}
              className="h-6 w-6 p-0 hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--color-primary))] transition-all duration-200"
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>

            {/* Month/Year - Clickable */}
            <button
              onClick={() => setShowMonthYearScroller(true)}
              className="text-xs font-semibold text-[rgb(var(--fg-default))] hover:text-[rgb(var(--color-primary))] transition-colors duration-200 cursor-pointer"
            >
              {MONTHS[monthToRender.getMonth()]} {monthToRender.getFullYear()}
            </button>

            {/* Right arrow - both calendars */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => isFirst ? navigateFirstCalendar('next') : navigateSecondCalendar('next')}
              className="h-6 w-6 p-0 hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--color-primary))] transition-all duration-200"
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Weekday headers - more compact */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map(day => (
            <div
              key={day}
              className="h-6 w-6 flex items-center justify-center font-semibold text-[rgb(var(--fg-muted))] bg-[rgb(var(--bg-subtle))] rounded text-[10px]"
            >
              {day.charAt(0)}
            </div>
          ))}
        </div>

        {/* Calendar days - more compact */}
        <div className="grid grid-cols-7 gap-1">
          {renderCalendarDays(monthToRender)}
        </div>
      </div>
    )
  }

  // Inline mode - render calendar directly without popover
  if (inline) {
    return (
      <div className={cn('relative w-full', className)} ref={containerRef}>
        {label && (
          <label className="block text-sm font-medium text-[rgb(var(--fg-muted))] mb-2">
            {label}
          </label>
        )}

        <div
          ref={calendarRef}
          className={cn(
            "bg-[rgb(var(--bg-surface))] rounded-xl border border-[rgb(var(--bd-default))]",
            mode === 'range' ? 'p-2' : 'p-3'
          )}
          onKeyDown={handleCalendarKeyDown}
          tabIndex={-1}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {mode === 'single' && (
                <Button variant="ghost" size="sm" onClick={handleTodayClick} className="text-xs px-2 py-1 h-6 font-medium text-[rgb(var(--color-primary))] hover:bg-[rgb(var(--bg-hover))]">Today</Button>
              )}
            </div>
            {mode === 'single' && (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigateMonth('prev')} className="h-6 w-6 p-0"><ChevronLeft className="h-3 w-3" /></Button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowMonthYearScroller(!showMonthYearScroller)} className="text-sm px-2 py-0.5 font-bold text-[rgb(var(--fg-default))] hover:text-[rgb(var(--color-primary))] rounded-lg hover:bg-[rgb(var(--bg-hover))] whitespace-nowrap">
                  {MONTHS[currentMonth.getMonth()].slice(0, 3)} {currentMonth.getFullYear()}
                </motion.button>
                <Button variant="ghost" size="sm" onClick={() => navigateMonth('next')} className="h-6 w-6 p-0"><ChevronRight className="h-3 w-3" /></Button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => { if (mode === 'range') { setSelectedRange({}); onChange?.({ from: undefined, to: undefined }) } else { onChange?.(convertDate(undefined)) }; setSelectedTime(''); setSelectedPeriod(''); setInputValue('') }} className="text-xs px-2 py-1 h-6 font-medium text-red-500 hover:bg-red-50">Clear</Button>
            </div>
          </div>

          <div className="flex flex-col">
            {mode === 'range' ? (
              <div className="flex flex-col sm:flex-row gap-3">
                {renderSingleCalendar(currentMonth, true, true)}
                <div className="hidden sm:block w-px bg-[rgb(var(--bd-default))] my-1" />
                <div className="sm:hidden h-px bg-[rgb(var(--bd-default))] mx-1" />
                {renderSingleCalendar(secondMonth, true, false)}
              </div>
            ) : (
              <div className="flex-1">
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {WEEKDAYS.map(day => (<div key={day} className="h-8 w-8 flex items-center justify-center font-semibold text-[rgb(var(--fg-muted))] bg-[rgb(var(--bg-subtle))] rounded-lg text-xs">{day.charAt(0)}</div>))}
                </div>
                <div className="grid grid-cols-7 gap-2">{renderCalendarDays(currentMonth)}</div>
              </div>
            )}
            {mode === 'range' && renderQuickSelect(false)}
          </div>

          <AnimatePresence>
            {showMonthYearScroller && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.2 }} className="absolute inset-0 bg-[rgb(var(--bg-surface))] rounded-xl z-10 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-[rgb(var(--fg-default))]">Select Date</h4>
                  <Button variant="ghost" size="sm" onClick={() => setShowMonthYearScroller(false)} className="h-6 w-6 p-0"><X className="h-3 w-3" /></Button>
                </div>
                <div ref={yearScrollerRef} className="max-h-[calc(100%-60px)] overflow-y-auto space-y-4">
                  {generateYearOptions().reverse().map((year) => (
                    <div key={year} className="space-y-2" data-year={year}>
                      <div className="text-xs font-semibold text-[rgb(var(--fg-muted))] sticky top-0 bg-[rgb(var(--bg-surface))] py-1">{year}</div>
                      <div className="grid grid-cols-3 gap-2">
                        {MONTHS.map((month, monthIndex) => {
                          const isSelected = currentMonth.getFullYear() === year && currentMonth.getMonth() === monthIndex
                          return (<motion.button key={`${year}-${monthIndex}`} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => handleMonthYearSelect(year, monthIndex)} className={cn('p-2 text-xs font-medium rounded-lg', isSelected ? 'bg-[rgb(var(--color-primary))] text-[rgb(var(--color-primary-foreground))] shadow-md' : 'hover:bg-[rgb(var(--bg-hover))] text-[rgb(var(--fg-default))]')}>{month.slice(0, 3)}</motion.button>)
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    )
  }

  // Default popover mode
  return (
    <div className={cn('relative w-full', className)} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-[rgb(var(--fg-muted))] mb-2">
          {label}
        </label>
      )}

      <Popover.Root open={!disabled && isOpen} onOpenChange={(open) => !disabled && setIsOpen(open)}>
        <Popover.Trigger asChild disabled={disabled}>
          {iconOnly ? (
            <button
              type="button"
              className={cn(
                'relative flex items-center gap-1 text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg-default))] transition-colors p-0.5 flex-shrink-0',
                (selectedRange.from || selectedRange.to) && 'text-[rgb(var(--color-primary))]',
                className
              )}
              title={selectedRange.from || selectedRange.to
                ? `Date filter: ${selectedRange.from ? new Date(selectedRange.from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}${selectedRange.to ? ` – ${new Date(selectedRange.to).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}`
                : 'Select date range'}
            >
              <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="hidden sm:inline text-xs">
                {selectedRange.from || selectedRange.to
                  ? `${selectedRange.from ? new Date(selectedRange.from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : ''}${selectedRange.to ? ` – ${new Date(selectedRange.to).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}` : ''}`
                  : 'Date'}
              </span>
              {(selectedRange.from || selectedRange.to) && (
                <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-[rgb(var(--color-primary))] ring-1 ring-[rgb(var(--bg-surface))]" />
              )}
            </button>
          ) : (
          <div className="relative" ref={inputWrapperRef}>
            <Input
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              placeholder={getPlaceholder()}
              disabled={disabled}
              error={error}
              className={cn(
                'pl-2 pr-9 text-xs w-full',
                error && 'border-red-300'
              )}
              onFocus={() => !disabled && setIsOpen(true)}
              rightIcon={Calendar}
              onRightIconClick={() => !disabled && setIsOpen(!isOpen)}
            />
          </div>
          )}
        </Popover.Trigger>

        <Popover.Portal container={typeof document !== 'undefined' ? document.body : undefined}>
          <Popover.Content
            ref={calendarRef}
            className={cn(
              "z-[300] bg-[rgb(var(--bg-surface))] rounded-xl shadow-2xl border border-[rgb(var(--bd-default))] backdrop-blur-sm",
              "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
              "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
              mode === 'range' ? 'w-[95vw] sm:w-auto sm:min-w-[580px] p-2' : 'w-[95vw] sm:w-auto sm:min-w-[280px] p-3',
              'max-w-[calc(100vw-2rem)]'
            )}
            side="bottom"
            align={popoverAlign ?? (mode === 'range' ? 'end' : 'start')}
            sideOffset={8}
            avoidCollisions={true}
            collisionPadding={16}
            sticky="always"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onKeyDown={handleCalendarKeyDown}
            tabIndex={-1}
            onInteractOutside={(e) => {
              // Prevent closing when interacting with nested Radix portals (like Dropdowns)
              const target = e.target as Element
              if (target?.closest('[data-radix-popper-content-wrapper]')) {
                e.preventDefault()
              }
            }}
            style={{
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.05)'
            }}
          >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                {/* Left side - Only show Today for single mode */}
                <div className="flex items-center gap-2">
                  {mode === 'single' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleTodayClick}
                      className="text-xs px-2 py-1 h-6 font-medium text-[rgb(var(--color-primary))] hover:bg-[rgb(var(--bg-hover))] transition-all duration-200"
                    >
                      Today
                    </Button>
                  )}
                </div>

                {/* Center - Show navigation only in single mode */}
                {mode === 'single' && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigateMonth('prev')}
                      className="h-6 w-6 p-0 hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--color-primary))] transition-all duration-200"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </Button>

                    {/* Unified Month/Year Selector */}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowMonthYearScroller(!showMonthYearScroller)}
                      className="text-sm px-2 py-0.5 font-bold text-[rgb(var(--fg-default))] hover:text-[rgb(var(--color-primary))] transition-colors duration-200 rounded-lg hover:bg-[rgb(var(--bg-hover))] whitespace-nowrap"
                    >
                      {MONTHS[currentMonth.getMonth()].slice(0, 3)} {currentMonth.getFullYear()}
                    </motion.button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigateMonth('next')}
                      className="h-6 w-6 p-0 hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--color-primary))] transition-all duration-200"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                {/* Right side - Clear and Close buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (mode === 'range') {
                        setSelectedRange({})
                        onChange?.({ from: undefined, to: undefined })
                      } else {
                        onChange?.(convertDate(undefined))
                      }
                      setSelectedTime('')
                      setSelectedPeriod('')
                      setInputValue('')
                    }}
                    className="text-xs px-2 py-1 h-6 font-medium text-red-500 hover:bg-red-50 transition-all duration-200"
                  >
                    Clear
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                    className="h-6 w-6 p-0 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-col">
                {/* Calendar - Show dual calendars for range mode, single for single mode */}
                {mode === 'range' ? (
                  <div className="flex gap-3">
                    {/* First Calendar */}
                    {renderSingleCalendar(currentMonth, true, true)}

                    {/* Separator */}
                    <div className="w-px bg-[rgb(var(--bd-default))] my-1" />

                    {/* Second Calendar */}
                    {renderSingleCalendar(secondMonth, true, false)}
                  </div>
                ) : (
                  <div className="flex-1">
                    {/* Weekday headers */}
                    <div className="grid grid-cols-7 gap-2 mb-2">
                      {WEEKDAYS.map(day => (
                        <div
                          key={day}
                          className="h-8 w-8 flex items-center justify-center font-semibold text-[rgb(var(--fg-muted))] bg-[rgb(var(--bg-subtle))] rounded-lg text-xs"
                        >
                          {day.charAt(0)}
                        </div>
                      ))}
                    </div>

                    {/* Calendar days */}
                    <div className="grid grid-cols-7 gap-2">
                      {renderCalendarDays(currentMonth)}
                    </div>
                  </div>
                )}

                {/* Quick Select for Single Mode - Only show when NOT using time */}
                {mode === 'single' && !showTime && (
                  <div className="mt-3 pt-3 border-t border-[rgb(var(--bd-default))]">
                    <h4 className="text-xs font-medium text-[rgb(var(--fg-muted))] mb-2">Quick Select</h4>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTodayClick}
                        className="flex-1 h-6 text-xs hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--color-primary))]"
                      >
                        Today
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const now = new Date()
                          const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0)
                          onChange?.(convertDate(yesterday))
                          setIsOpen(false)
                        }}
                        className="flex-1 h-6 text-xs hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--color-primary))]"
                      >
                        Yesterday
                      </Button>
                    </div>
                  </div>
                )}

                {/* Time Picker for Single Mode with showTime - From/To time inputs with AM/PM */}
                {mode === 'single' && showTime && (
                  <div className="mt-3 pt-3 border-t border-[rgb(var(--bd-default))]">
                    <h4 className="text-xs font-medium text-[rgb(var(--fg-muted))] mb-2">Time</h4>
                    <div className="flex items-center gap-3">
                      {/* From Time */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-[rgb(var(--fg-muted))]">From</span>
                        <div className="flex items-center gap-1 px-2 border border-[rgb(var(--bd-default))] rounded h-7 bg-[rgb(var(--bg-subtle))]">
                          <Clock className="h-3 w-3 text-[rgb(var(--fg-muted))]" />
                          <input
                            type="number"
                            min="1"
                            max="12"
                            value={fromTime.hours.toString().padStart(2, '0')}
                            onChange={(e) => {
                              const val = Math.min(12, Math.max(1, parseInt(e.target.value) || 1))
                              setFromTime(prev => ({ ...prev, hours: val }))
                            }}
                            className="w-6 text-center text-xs bg-transparent text-[rgb(var(--fg-default))] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="text-[rgb(var(--fg-muted))] text-xs">:</span>
                          <input
                            type="number"
                            min="0"
                            max="59"
                            value={fromTime.minutes.toString().padStart(2, '0')}
                            onChange={(e) => {
                              const val = Math.min(59, Math.max(0, parseInt(e.target.value) || 0))
                              setFromTime(prev => ({ ...prev, minutes: val }))
                            }}
                            className="w-6 text-center text-xs bg-transparent text-[rgb(var(--fg-default))] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            onClick={() => setFromTime(prev => ({ ...prev, period: prev.period === 'AM' ? 'PM' : 'AM' }))}
                            className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[rgb(var(--color-primary))]/10 text-[rgb(var(--color-primary))] hover:bg-[rgb(var(--color-primary))]/20 transition-colors"
                          >
                            {fromTime.period}
                          </button>
                        </div>
                      </div>

                      <ArrowRight className="h-3 w-3 text-[rgb(var(--fg-muted))]" />

                      {/* To Time */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-[rgb(var(--fg-muted))]">To</span>
                        <div className="flex items-center gap-1 px-2 border border-[rgb(var(--bd-default))] rounded h-7 bg-[rgb(var(--bg-subtle))]">
                          <Clock className="h-3 w-3 text-[rgb(var(--fg-muted))]" />
                          <input
                            type="number"
                            min="1"
                            max="12"
                            value={toTime.hours.toString().padStart(2, '0')}
                            onChange={(e) => {
                              const val = Math.min(12, Math.max(1, parseInt(e.target.value) || 1))
                              setToTime(prev => ({ ...prev, hours: val }))
                            }}
                            className="w-6 text-center text-xs bg-transparent text-[rgb(var(--fg-default))] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="text-[rgb(var(--fg-muted))] text-xs">:</span>
                          <input
                            type="number"
                            min="0"
                            max="59"
                            value={toTime.minutes.toString().padStart(2, '0')}
                            onChange={(e) => {
                              const val = Math.min(59, Math.max(0, parseInt(e.target.value) || 0))
                              setToTime(prev => ({ ...prev, minutes: val }))
                            }}
                            className="w-6 text-center text-xs bg-transparent text-[rgb(var(--fg-default))] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            onClick={() => setToTime(prev => ({ ...prev, period: prev.period === 'AM' ? 'PM' : 'AM' }))}
                            className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[rgb(var(--color-primary))]/10 text-[rgb(var(--color-primary))] hover:bg-[rgb(var(--color-primary))]/20 transition-colors"
                          >
                            {toTime.period}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Quick Select for Range Mode */}
                {mode === 'range' && renderQuickSelect(true)}
              </div>



              {/* Unified Month/Year Scroller (OTIF-style) */}
              <AnimatePresence>
                {showMonthYearScroller && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 bg-[rgb(var(--bg-surface))] rounded-xl z-10 p-6"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-semibold text-[rgb(var(--fg-default))]">Select Date</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowMonthYearScroller(false)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Scrollable year/month list */}
                    <div ref={yearScrollerRef} className="max-h-[calc(100%-60px)] overflow-y-auto space-y-4">
                      {generateYearOptions().reverse().map((year) => (
                        <div key={year} className="space-y-2" data-year={year}>
                          <div className="text-xs font-semibold text-[rgb(var(--fg-muted))] sticky top-0 bg-[rgb(var(--bg-surface))] py-1">
                            {year}
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {MONTHS.map((month, monthIndex) => {
                              const isSelected = currentMonth.getFullYear() === year && currentMonth.getMonth() === monthIndex
                              return (
                                <motion.button
                                  key={`${year}-${monthIndex}`}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => handleMonthYearSelect(year, monthIndex)}
                                  className={cn(
                                    'p-2 text-xs font-medium rounded-lg transition-all duration-200',
                                    isSelected
                                      ? 'bg-[rgb(var(--color-primary))] text-[rgb(var(--color-primary-foreground))] shadow-md'
                                      : 'hover:bg-[rgb(var(--bg-hover))] text-[rgb(var(--fg-default))]'
                                  )}
                                >
                                  {month.slice(0, 3)}
                                </motion.button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}

// ============================================
// DateTimePicker Component (Single date WITH time)
// ============================================

