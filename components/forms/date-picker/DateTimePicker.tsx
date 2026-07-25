'use client'

import * as React from 'react'
import * as Popover from '@radix-ui/react-popover'
import {
  Calendar,
  ChevronLeft,
  Clock,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'
import { Input } from '@/components/ui'
import { CalendarView } from './CalendarView'
import { MONTHS } from './shared-utils'

export interface DateTimePickerProps {
  value?: Date | string
  onChange?: (date: Date | string | undefined) => void
  placeholder?: string
  label?: string
  error?: string
  disabled?: boolean
  minDate?: Date
  maxDate?: Date
  className?: string
  returnFormat?: 'date' | 'string' // Return Date object or ISO string
  timeFormat?: '12h' | '24h' // 12-hour or 24-hour format
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = 'Select date & time...',
  label,
  error,
  disabled = false,
  minDate,
  maxDate,
  className,
  returnFormat = 'date',
  timeFormat = '24h'
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null)
  const [hours, setHours] = React.useState(12)
  const [minutes, setMinutes] = React.useState(0)
  const [period, setPeriod] = React.useState<'AM' | 'PM'>('PM')
  const [inputValue, setInputValue] = React.useState('')

  // Initialize from value prop
  React.useEffect(() => {
    if (value) {
      const date = typeof value === 'string' ? new Date(value) : value
      setSelectedDate(date)

      const hrs = date.getHours()
      const mins = date.getMinutes()

      if (timeFormat === '12h') {
        setHours(hrs === 0 ? 12 : hrs > 12 ? hrs - 12 : hrs)
        setPeriod(hrs >= 12 ? 'PM' : 'AM')
      } else {
        setHours(hrs)
      }
      setMinutes(mins)
      setInputValue(formatDisplayValue(date))
    }
  }, [value, timeFormat])

  // Helper to convert date based on returnFormat
  const convertDate = (date: Date | undefined): Date | string | undefined => {
    if (!date) return undefined
    return returnFormat === 'string' ? date.toISOString() : date
  }

  const formatDisplayValue = (date: Date) => {
    const day = date.getDate().toString().padStart(2, '0')
    const month = MONTHS[date.getMonth()].slice(0, 3)
    const year = date.getFullYear()

    let timeStr = ''
    const hrs = date.getHours()
    const mins = date.getMinutes()

    if (timeFormat === '12h') {
      const displayHrs = hrs === 0 ? 12 : hrs > 12 ? hrs - 12 : hrs
      const ampm = hrs >= 12 ? 'PM' : 'AM'
      timeStr = `${displayHrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')} ${ampm}`
    } else {
      timeStr = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
    }

    return `${day} ${month}, ${year} ${timeStr}`
  }

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
  }

  const handleMonthChange = (direction: 'prev' | 'next') => {
    const newMonth = new Date(selectedDate || new Date())
    newMonth.setMonth(newMonth.getMonth() + (direction === 'next' ? 1 : -1))
    setSelectedDate(newMonth)
  }

  const handleApply = () => {
    if (!selectedDate) return

    const finalDate = new Date(selectedDate)

    // Set time based on format
    if (timeFormat === '12h') {
      let hrs = hours
      if (period === 'PM' && hours !== 12) hrs += 12
      if (period === 'AM' && hours === 12) hrs = 0
      finalDate.setHours(hrs, minutes, 0, 0)
    } else {
      finalDate.setHours(hours, minutes, 0, 0)
    }

    onChange?.(convertDate(finalDate))
    setInputValue(formatDisplayValue(finalDate))
    setIsOpen(false)
  }

  const handleClear = () => {
    setSelectedDate(null)
    setInputValue('')
    onChange?.(convertDate(undefined))
  }

  const handleNow = () => {
    const now = new Date()
    setSelectedDate(now)

    const hrs = now.getHours()
    const mins = now.getMinutes()

    if (timeFormat === '12h') {
      setHours(hrs === 0 ? 12 : hrs > 12 ? hrs - 12 : hrs)
      setPeriod(hrs >= 12 ? 'PM' : 'AM')
    } else {
      setHours(hrs)
    }
    setMinutes(mins)

    onChange?.(convertDate(now))
    setInputValue(formatDisplayValue(now))
    setIsOpen(false)
  }

  const renderTimeInput = (value: number, onChange: (val: number) => void, max: number, label: string) => (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={() => onChange(value === max ? 0 : value + 1)}
        className="h-6 w-full flex items-center justify-center text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--color-primary))] hover:bg-[rgb(var(--bg-hover))] rounded transition-colors active:scale-95"
        aria-label={`Increase ${label}`}
      >
        <ChevronLeft className="h-4 w-4 rotate-90" />
      </button>
      <div className="flex flex-col items-center">
        <input
          type="number"
          min="0"
          max={max}
          value={value.toString().padStart(2, '0')}
          onChange={(e) => {
            const val = parseInt(e.target.value) || 0
            if (val >= 0 && val <= max) onChange(val)
          }}
          onWheel={(e) => {
            e.preventDefault()
            const delta = e.deltaY < 0 ? 1 : -1
            const newValue = value + delta
            if (newValue < 0) onChange(max)
            else if (newValue > max) onChange(0)
            else onChange(newValue)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              onChange(value === max ? 0 : value + 1)
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              onChange(value === 0 ? max : value - 1)
            }
          }}
          className="w-14 text-center text-lg font-semibold border border-[rgb(var(--bd-default))] rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))] focus:border-transparent transition-all hover:border-[rgb(var(--color-primary))]"
          aria-label={label}
        />
        <span className="text-[10px] text-[rgb(var(--fg-muted))] mt-0.5">{label}</span>
      </div>
      <button
        onClick={() => onChange(value === 0 ? max : value - 1)}
        className="h-6 w-full flex items-center justify-center text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--color-primary))] hover:bg-[rgb(var(--bg-hover))] rounded transition-colors active:scale-95"
        aria-label={`Decrease ${label}`}
      >
        <ChevronLeft className="h-4 w-4 -rotate-90" />
      </button>
    </div>
  )

  return (
    <div className={cn('relative w-full', className)}>
      {label && (
        <label className="block text-sm font-medium text-[rgb(var(--fg-default))] mb-2">
          {label}
        </label>
      )}

      <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger asChild>
          <div className="relative">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={placeholder}
              disabled={disabled}
              error={error}
              className={cn('pl-2 pr-9 text-xs w-full', error && 'border-red-300')}
              onFocus={() => !disabled && setIsOpen(true)}
              rightIcon={Calendar}
              onRightIconClick={() => !disabled && setIsOpen(!isOpen)}
              readOnly
            />
          </div>
        </Popover.Trigger>

        <Popover.Portal container={typeof document !== 'undefined' ? document.body : undefined}>
          <Popover.Content
            className={cn(
              'z-[300] bg-white rounded-xl shadow-2xl border border-gray-200/50 backdrop-blur-sm',
              'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
              'w-[95vw] sm:w-[380px] max-w-[calc(100vw-2rem)] p-3 sm:p-4'
            )}
            side="bottom"
            align="start"
            sideOffset={8}
            avoidCollisions={true}
            collisionPadding={16}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[rgb(var(--color-primary))]" />
                <span className="text-sm font-semibold text-[rgb(var(--fg-default))]">
                  Select Date & Time
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-6 w-6 p-0 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>

            {/* Calendar View (shared component) */}
            <CalendarView
              currentMonth={selectedDate || new Date()}
              selectedDate={selectedDate}
              onDateClick={handleDateClick}
              onMonthChange={handleMonthChange}
              minDate={minDate}
              maxDate={maxDate}
              showNavigation={true}
            />

            {/* Time Picker Section */}
            <div className="border-t border-[rgb(var(--bd-default))] pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-[rgb(var(--color-primary))]" />
                <span className="text-sm font-semibold text-[rgb(var(--fg-default))]">Time</span>
              </div>

              <div className="flex items-center justify-center gap-2">
                {/* Hours */}
                {renderTimeInput(
                  hours,
                  setHours,
                  timeFormat === '12h' ? 12 : 23,
                  'Hours'
                )}

                <span className="text-2xl font-bold text-[rgb(var(--fg-muted))] mb-5">:</span>

                {/* Minutes */}
                {renderTimeInput(
                  minutes,
                  setMinutes,
                  59,
                  'Mins'
                )}

                {/* AM/PM for 12h format */}
                {timeFormat === '12h' && (
                  <>
                    <div className="w-px h-16 bg-[rgb(var(--bd-default))] mx-2" />
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => setPeriod('AM')}
                        className={cn(
                          'px-3 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200',
                          period === 'AM'
                            ? 'bg-[rgb(var(--color-primary))] text-white shadow-md'
                            : 'bg-[rgb(var(--bg-subtle))] text-[rgb(var(--fg-default))] hover:bg-[rgb(var(--bg-hover))]'
                        )}
                      >
                        AM
                      </button>
                      <button
                        onClick={() => setPeriod('PM')}
                        className={cn(
                          'px-3 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200',
                          period === 'PM'
                            ? 'bg-[rgb(var(--color-primary))] text-white shadow-md'
                            : 'bg-[rgb(var(--bg-subtle))] text-[rgb(var(--fg-default))] hover:bg-[rgb(var(--bg-hover))]'
                        )}
                      >
                        PM
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[rgb(var(--bd-default))]">
              <Button
                variant="outline"
                size="sm"
                onClick={handleNow}
                className="flex-1 text-xs font-medium hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--color-primary))]"
              >
                Now
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                className="flex-1 text-xs font-medium text-red-500 hover:bg-red-50 hover:text-red-600"
              >
                Clear
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleApply}
                disabled={!selectedDate}
                className="flex-1 text-xs font-medium"
              >
                Apply
              </Button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
