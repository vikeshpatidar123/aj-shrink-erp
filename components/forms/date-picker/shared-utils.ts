// ============================================
// Shared Utility Functions for DatePicker Components
// ============================================

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const PERIOD_OPTIONS = ['Day', 'Week', 'Month', 'Quarter', 'Year']
export const TIME_OPTIONS = ['Last', 'This', 'Next']

// Helper to get days in a month
export const getDaysInMonth = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

// Helper to get first day of month (0-6, where 0 is Sunday)
export const getFirstDayOfMonth = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
}
