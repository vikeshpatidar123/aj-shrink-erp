'use client'

import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  X, Plus, Trash2, ListFilter, Eye, EyeOff,
  ArrowUpDown, ChevronUp, ChevronDown, Layers,
  Check, XCircle,
} from 'lucide-react'
import { ColumnDef, Table, SortingState, Column } from '@tanstack/react-table'

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui'
import { Button } from '@/components/ui'
import { Input } from '@/components/ui'
import { Label } from '@/components/ui'
import { Dropdown } from '@/components'
import { Badge } from '@/components/ui'
import { Separator } from '@/components/ui'
import { DatePicker, DateRange } from '@/components/forms/date-picker/DatePicker'
import { Footer } from '@/components/layout/footer'
import { useLanguage } from '@/contexts/LanguageContext'

// ─── Types ─────────────────────────────────────────────────────

export interface FilterCondition {
  id: string
  column: string
  operator: string
  value: any
  type: 'string' | 'number' | 'date' | 'boolean' | 'multi-select'
}

type TabId = 'filters' | 'columns' | 'sort'

interface AdvancedFilterModalProps<TData> {
  isOpen: boolean
  onClose: () => void
  onApply: (filters: FilterCondition[]) => void
  columns: ColumnDef<TData>[]
  data: TData[]
  // Columns tab
  table?: Table<TData>
  // Sort tab
  sorting?: SortingState
  onSortingChange?: (sorting: SortingState) => void
  // Grouping
  enableGrouping?: boolean
  grouping?: string[]
  onGroupingChange?: (columnId: string) => void
  onClearGrouping?: () => void
  // Initial tab
  initialTab?: TabId
}

// ─── Operators ─────────────────────────────────────────────────

const STRING_OPERATORS = [
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does not contain' },
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Does not equal' },
  { value: 'starts_with', label: 'Starts with' },
  { value: 'ends_with', label: 'Ends with' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'is_not_empty', label: 'Is not empty' },
]

const NUMBER_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Does not equal' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'greater_than_equal', label: 'Greater than or equal' },
  { value: 'less_than', label: 'Less than' },
  { value: 'less_than_equal', label: 'Less than or equal' },
  { value: 'between', label: 'Between' },
  { value: 'not_between', label: 'Not between' },
]

const DATE_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Does not equal' },
  { value: 'before', label: 'Before' },
  { value: 'after', label: 'After' },
  { value: 'between', label: 'Between' },
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'this_year', label: 'This year' },
]

const BOOLEAN_OPERATORS = [
  { value: 'is_true', label: 'Is true' },
  { value: 'is_false', label: 'Is false' },
]

// ─── Tab definitions ───────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'filters', label: 'Filters', icon: ListFilter },
  { id: 'columns', label: 'Columns', icon: Eye },
  { id: 'sort', label: 'Sort', icon: ArrowUpDown },
]

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export function AdvancedFilterModal<TData>({
  isOpen,
  onClose,
  onApply,
  columns,
  data,
  table,
  sorting = [],
  onSortingChange,
  enableGrouping = false,
  grouping = [],
  onGroupingChange,
  onClearGrouping,
  initialTab = 'filters',
}: AdvancedFilterModalProps<TData>) {
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)
  const [filters, setFilters] = useState<FilterCondition[]>([])
  const [matchType, setMatchType] = useState<'all' | 'any'>('all')

  // Reset tab when modal opens
  React.useEffect(() => {
    if (isOpen) setActiveTab(initialTab)
  }, [isOpen, initialTab])

  // ─── Filterable columns ──────────────────────────────────────

  const filterableColumns = useMemo(() => {
    return columns
      .filter((col) => (col as any).accessorKey || col.id)
      .map((col) => {
        const key = (col as any).accessorKey as string || col.id!
        const sampleValues = data.slice(0, 100).map(row => (row as any)[key]).filter(val => val != null)
        let type: FilterCondition['type'] = 'string'

        if (sampleValues.length > 0) {
          const firstValue = sampleValues[0]
          if (typeof firstValue === 'boolean') type = 'boolean'
          else if (typeof firstValue === 'number') type = 'number'
          else if (firstValue instanceof Date || (typeof firstValue === 'string' && !isNaN(Date.parse(firstValue)))) type = 'date'
        }

        const uniqueValues = [...new Set(sampleValues.map(val => String(val)))].sort()
        let label = key
        if (typeof col.header === 'string') label = col.header

        return { key, label, type, uniqueValues: uniqueValues.slice(0, 50) }
      })
  }, [columns, data])

  // ─── Sortable columns from table ─────────────────────────────

  const sortableColumns = useMemo(() => {
    if (!table) return filterableColumns.map(c => ({ id: c.key, label: c.label }))
    return table.getAllColumns()
      .filter(col => col.getCanSort() && col.id !== 'select' && col.id !== 'actions')
      .map(col => {
        let label = col.id
        if (typeof col.columnDef.header === 'string') label = col.columnDef.header
        return { id: col.id, label }
      })
  }, [table, filterableColumns])

  // ─── Hideable columns from table ─────────────────────────────

  const hideableColumns = useMemo(() => {
    if (!table) return []
    return table.getAllColumns()
      .filter(col => col.getCanHide() && col.id !== 'select')
      .map(col => {
        let label = col.id
        if (typeof col.columnDef.header === 'string') label = col.columnDef.header
        return { id: col.id, label, visible: col.getIsVisible() }
      })
  }, [table, table?.getState().columnVisibility])

  // ─── Groupable columns ───────────────────────────────────────

  const groupableColumns = useMemo(() => {
    if (!table || !enableGrouping) return []
    return table.getAllColumns()
      .filter(col => col.id !== 'select' && col.id !== 'actions' && col.id !== 'expand' && col.getCanGroup?.() !== false)
      .map(col => {
        let label = col.id
        if (typeof col.columnDef.header === 'string') label = col.columnDef.header
        return { id: col.id, label }
      })
  }, [table, enableGrouping])

  // ─── Filter handlers ─────────────────────────────────────────

  const addFilter = () => {
    setFilters([...filters, {
      id: Date.now().toString(),
      column: filterableColumns[0]?.key || '',
      operator: 'contains',
      value: '',
      type: filterableColumns[0]?.type || 'string',
    }])
  }

  const removeFilter = (filterId: string) => setFilters(filters.filter(f => f.id !== filterId))
  const updateFilter = (filterId: string, updates: Partial<FilterCondition>) => setFilters(filters.map(f => f.id === filterId ? { ...f, ...updates } : f))

  const getOperators = (type: FilterCondition['type']) => {
    switch (type) {
      case 'number': return NUMBER_OPERATORS
      case 'date': return DATE_OPERATORS
      case 'boolean': return BOOLEAN_OPERATORS
      default: return STRING_OPERATORS
    }
  }

  // ─── Sort handlers ────────────────────────────────────────────

  const handleSort = (columnId: string) => {
    if (!onSortingChange) return
    const existing = sorting.find(s => s.id === columnId)
    if (existing) {
      if (existing.desc) {
        // desc → remove
        onSortingChange(sorting.filter(s => s.id !== columnId))
      } else {
        // asc → desc
        onSortingChange(sorting.map(s => s.id === columnId ? { ...s, desc: true } : s))
      }
    } else {
      // add asc
      onSortingChange([{ id: columnId, desc: false }])
    }
  }

  const clearSort = () => onSortingChange?.([])

  // ─── Render value input ───────────────────────────────────────

  const renderValueInput = (filter: FilterCondition) => {
    const columnInfo = filterableColumns.find(col => col.key === filter.column)
    if (!columnInfo) return null

    if (['is_empty', 'is_not_empty', 'is_true', 'is_false', 'last_7_days', 'last_30_days', 'this_month', 'this_year'].includes(filter.operator)) {
      return null
    }

    switch (filter.type) {
      case 'boolean':
        return (
          <Dropdown
            options={[{ value: 'true', label: 'True' }, { value: 'false', label: 'False' }]}
            value={filter.value?.toString()}
            onValueChange={(value) => updateFilter(filter.id, { value: value === 'true' })}
            placeholder={t('Select value')}
          />
        )
      case 'number':
        if (['between', 'not_between'].includes(filter.operator)) {
          return (
            <div className="flex items-center gap-2">
              <Input type="number" placeholder="Min" value={filter.value?.min || ''} onChange={(e) => updateFilter(filter.id, { value: { ...filter.value, min: parseFloat(e.target.value) } })} />
              <span className="text-[rgb(var(--fg-muted))] text-xs">to</span>
              <Input type="number" placeholder="Max" value={filter.value?.max || ''} onChange={(e) => updateFilter(filter.id, { value: { ...filter.value, max: parseFloat(e.target.value) } })} />
            </div>
          )
        }
        return <Input type="number" placeholder={t('Enter value')} value={filter.value || ''} onChange={(e) => updateFilter(filter.id, { value: parseFloat(e.target.value) })} />
      case 'date':
        if (filter.operator === 'between') {
          return <DatePicker mode="range" value={filter.value || {}} onChange={(range) => updateFilter(filter.id, { value: range })} placeholder={t('Select date range...')} showFromTo={true} />
        }
        return <DatePicker mode="single" value={filter.value ? new Date(filter.value) : undefined} onChange={(date) => updateFilter(filter.id, { value: date })} placeholder={t('Select date...')} />
      default:
        if (columnInfo.uniqueValues.length <= 20 && columnInfo.uniqueValues.length > 2) {
          return (
            <Dropdown
              options={columnInfo.uniqueValues.map(v => ({ value: v, label: v }))}
              value={Array.isArray(filter.value) ? filter.value[0] || '' : filter.value || ''}
              onValueChange={(value) => updateFilter(filter.id, { value })}
              placeholder={t('Select value...')}
            />
          )
        }
        return <Input type="text" placeholder={t('Enter value')} value={filter.value || ''} onChange={(e) => updateFilter(filter.id, { value: e.target.value })} />
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] sm:max-h-[85vh] h-[100dvh] sm:h-auto flex flex-col p-0 bg-[rgb(var(--bg-surface))] overflow-hidden border-0 shadow-2xl" hideCloseButton>
        {/* Hidden title for accessibility */}
        <DialogTitle className="sr-only">{t('Table Settings')}</DialogTitle>

        {/* ─── Tab Bar with close button ──────────────────────── */}
        <div className="flex-shrink-0 border-b border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))] flex items-center justify-between pr-2">
          <div className="flex px-2 sm:px-4 gap-0 flex-1">
            {TABS.map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              const badge = tab.id === 'filters' && filters.length > 0 ? filters.length
                : tab.id === 'sort' && sorting.length > 0 ? sorting.length
                : tab.id === 'columns' && hideableColumns.filter(c => !c.visible).length > 0 ? hideableColumns.filter(c => !c.visible).length
                : 0

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-[rgb(var(--color-primary))] text-[rgb(var(--color-primary))]'
                      : 'border-transparent text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg-default))]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t(tab.label)}</span>
                  <span className="sm:hidden">{t(tab.label)}</span>
                  {badge > 0 && (
                    <span className="h-4 min-w-[1rem] px-1 flex items-center justify-center text-[10px] font-bold rounded-full bg-[rgb(var(--color-primary))] text-white">
                      {badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <button onClick={onClose} className="close-btn-md flex-shrink-0" aria-label={t('Close')}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ─── Tab Content ────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'filters' && (
            <FiltersTab
              filters={filters}
              setFilters={setFilters}
              matchType={matchType}
              setMatchType={setMatchType}
              filterableColumns={filterableColumns}
              addFilter={addFilter}
              removeFilter={removeFilter}
              updateFilter={updateFilter}
              getOperators={getOperators}
              renderValueInput={renderValueInput}
              t={t}
            />
          )}

          {activeTab === 'columns' && (
            <ColumnsTab
              hideableColumns={hideableColumns}
              table={table}
              enableGrouping={enableGrouping}
              groupableColumns={groupableColumns}
              grouping={grouping}
              onGroupingChange={onGroupingChange}
              onClearGrouping={onClearGrouping}
              t={t}
            />
          )}

          {activeTab === 'sort' && (
            <SortTab
              sortableColumns={sortableColumns}
              sorting={sorting}
              handleSort={handleSort}
              clearSort={clearSort}
              t={t}
            />
          )}

        </div>

        {/* ─── Footer ─────────────────────────────────────────── */}
        {activeTab === 'filters' && (
          <Footer
            variant="modal"
            gradient={true}
            actions={
              <>
                <Button variant="action-cancel" onClick={onClose} icon={XCircle}>
                  {t('Cancel')}
                </Button>
                <Button
                  variant="action-apply"
                  icon={Check}
                  onClick={() => onApply(filters)}
                  disabled={filters.length === 0}
                >
                  {t('Apply Filters')} ({filters.length})
                </Button>
              </>
            }
          />
        )}

        {activeTab !== 'filters' && (
          <div className="flex-shrink-0 px-4 sm:px-6 py-3 border-t border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-subtle))]">
            <div className="flex justify-end">
              <Button variant="primary" size="sm" onClick={onClose}>
                {t('Done')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════════════════════════
// FILTERS TAB
// ═══════════════════════════════════════════════════════════════

function FiltersTab({
  filters, setFilters, matchType, setMatchType,
  filterableColumns, addFilter, removeFilter, updateFilter,
  getOperators, renderValueInput, t,
}: any) {
  return (
    <div className="px-4 sm:px-6 pt-3 pb-4 space-y-3">
      {/* Quick Filters */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[rgb(var(--fg-muted))] uppercase tracking-wider">{t('Quick Add')}</h3>
          <span className="text-xs text-[rgb(var(--fg-subtle))]">{t('Click column to add filter')}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {filterableColumns.slice(0, 12).map((col: any) => {
            const isActive = filters.some((f: any) => f.column === col.key)
            return (
              <Button
                key={col.key}
                variant={isActive ? 'primary' : 'outline'}
                size="sm"
                onClick={() => {
                  if (!isActive) {
                    setFilters([...filters, {
                      id: Date.now().toString(),
                      column: col.key,
                      operator: col.type === 'string' ? 'contains' : 'equals',
                      value: '',
                      type: col.type,
                    }])
                  }
                }}
                className={`justify-start text-xs h-8 px-2.5 font-medium ${isActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isActive}
              >
                <span className="truncate">{col.label}</span>
              </Button>
            )
          })}
        </div>
      </div>

      <Separator />

      {/* Match Type */}
      <div className="flex items-center gap-3 py-1">
        <span className="text-xs font-semibold text-[rgb(var(--fg-muted))] uppercase tracking-wider">{t('Match')}:</span>
        <Dropdown
          options={[
            { value: 'all', label: 'ALL (AND)' },
            { value: 'any', label: 'ANY (OR)' },
          ]}
          value={matchType}
          onValueChange={(value: any) => setMatchType(value as 'all' | 'any')}
        />
        <span className="text-xs text-[rgb(var(--fg-subtle))]">
          {matchType === 'all' ? t('All must match') : t('At least one')}
        </span>
      </div>

      <Separator />

      {/* Filter Conditions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[rgb(var(--fg-muted))] uppercase tracking-wider">{t('Conditions')}</h3>
          <Button onClick={addFilter} size="sm" variant="outline" className="h-8 text-xs font-medium">
            <Plus className="h-4 w-4 mr-1" />
            {t('Add')}
          </Button>
        </div>
        <div className="space-y-2.5">
          {filters.length === 0 ? (
            <div className="text-center py-8 px-4 border-2 border-dashed border-[rgb(var(--bd-default))] rounded-lg bg-[rgb(var(--bg-subtle))]">
              <p className="text-sm text-[rgb(var(--fg-muted))]">{t('No filters added')}</p>
              <p className="text-xs text-[rgb(var(--fg-subtle))] mt-1">{t('Use Quick Add above or click "Add"')}</p>
            </div>
          ) : (
            filters.map((filter: FilterCondition, index: number) => (
              <motion.div
                key={filter.id}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col sm:grid sm:grid-cols-12 gap-2 sm:gap-2.5 p-3 border border-[rgb(var(--bd-default))] rounded-md bg-[rgb(var(--bg-surface))] hover:border-[rgb(var(--bd-hover))] transition-all"
              >
                {/* AND/OR Connector */}
                <div className="hidden sm:flex col-span-1 items-center justify-center">
                  {index > 0 ? (
                    <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0.5">
                      {matchType.toUpperCase()}
                    </Badge>
                  ) : null}
                </div>

                {/* Mobile: connector badge inline */}
                {index > 0 && (
                  <div className="sm:hidden">
                    <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0.5">
                      {matchType.toUpperCase()}
                    </Badge>
                  </div>
                )}

                {/* Column */}
                <div className="sm:col-span-4">
                  <Label className="text-xs font-medium text-[rgb(var(--fg-muted))] mb-1">{t('Column')}</Label>
                  <Dropdown
                    options={filterableColumns.map((col: any) => ({ value: col.key, label: col.label }))}
                    value={filter.column}
                    onValueChange={(value: any) => {
                      const columnValue = typeof value === 'string' ? value : value[0] || ''
                      const columnInfo = filterableColumns.find((col: any) => col.key === columnValue)
                      updateFilter(filter.id, { column: columnValue, type: columnInfo?.type || 'string', operator: 'contains', value: '' })
                    }}
                    placeholder={t('Select column')}
                  />
                </div>

                {/* Operator */}
                <div className="sm:col-span-3">
                  <Label className="text-xs font-medium text-[rgb(var(--fg-muted))] mb-1">{t('Operator')}</Label>
                  <Dropdown
                    options={getOperators(filter.type)}
                    value={filter.operator}
                    onValueChange={(value: any) => updateFilter(filter.id, { operator: typeof value === 'string' ? value : value[0] || '', value: '' })}
                    placeholder={t('Select')}
                  />
                </div>

                {/* Value */}
                <div className="sm:col-span-3">
                  <Label className="text-xs font-medium text-[rgb(var(--fg-muted))] mb-1">{t('Value')}</Label>
                  {renderValueInput(filter)}
                </div>

                {/* Remove */}
                <div className="sm:col-span-1 flex sm:items-end sm:justify-center sm:pb-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFilter(filter.id)}
                    className="h-8 w-8 p-0 text-[rgb(var(--color-error))] hover:bg-[rgb(var(--color-error))]/10 transition-colors"
                    aria-label={t('Remove filter')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// COLUMNS TAB (Parkbuddy-inspired)
// ═══════════════════════════════════════════════════════════════

function ColumnsTab({
  hideableColumns, table, enableGrouping, groupableColumns,
  grouping, onGroupingChange, onClearGrouping, t,
}: any) {
  return (
    <div className="px-4 sm:px-6 pt-3 pb-4 space-y-4">
      {/* Show / Hide Columns */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-[rgb(var(--fg-muted))] uppercase tracking-wider flex items-center gap-2">
            <Eye className="h-3.5 w-3.5" />
            {t('Show / Hide Columns')}
          </h3>
          {table && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => table.toggleAllColumnsVisible(true)}
                className="text-xs text-[rgb(var(--color-primary))] hover:underline font-medium"
              >
                {t('Show All')}
              </button>
              <span className="text-[rgb(var(--fg-subtle))]">|</span>
              <button
                onClick={() => table.toggleAllColumnsVisible(false)}
                className="text-xs text-[rgb(var(--fg-muted))] hover:underline font-medium"
              >
                {t('Hide All')}
              </button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {hideableColumns.map((col: any) => {
            const isVisible = col.visible
            return (
              <button
                key={col.id}
                onClick={() => table?.getColumn(col.id)?.toggleVisibility()}
                className={`px-3 py-2 text-xs rounded-md border flex items-center gap-2 transition-colors ${
                  isVisible
                    ? 'bg-[rgb(var(--color-success))]/10 text-[rgb(var(--color-success))] border-[rgb(var(--color-success))]/30'
                    : 'bg-[rgb(var(--bg-subtle))] text-[rgb(var(--fg-muted))] border-[rgb(var(--bd-default))]'
                }`}
              >
                {isVisible ? <Eye className="h-3 w-3 flex-shrink-0" /> : <EyeOff className="h-3 w-3 flex-shrink-0" />}
                <span className="truncate">{col.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Column Reorder */}
      {table && (
        <>
          <Separator />
          <div>
            <h3 className="text-xs font-semibold text-[rgb(var(--fg-muted))] uppercase tracking-wider flex items-center gap-2 mb-2">
              <ArrowUpDown className="h-3.5 w-3.5" />
              {t('Rearrange Columns')}
            </h3>
            <ColumnReorderList table={table} t={t} />
          </div>
        </>
      )}

      {/* Grouping */}
      {enableGrouping && groupableColumns.length > 0 && onGroupingChange && (
        <>
          <Separator />
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-[rgb(var(--fg-muted))] uppercase tracking-wider flex items-center gap-2">
                <Layers className="h-3.5 w-3.5" />
                {t('Group By')}
                {grouping.length > 0 && (
                  <span className="text-[10px] font-bold bg-[rgb(var(--color-primary))] text-white px-1.5 py-0.5 rounded-full">{grouping.length}</span>
                )}
              </h3>
              {grouping.length > 0 && onClearGrouping && (
                <button onClick={onClearGrouping} className="text-xs text-[rgb(var(--color-error))] hover:underline font-medium">
                  {t('Clear')}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {groupableColumns.map((col: any) => {
                const isGrouped = grouping.includes(col.id)
                return (
                  <button
                    key={col.id}
                    onClick={() => onGroupingChange(col.id)}
                    className={`px-3 py-2 text-xs rounded-md border flex items-center gap-2 transition-colors ${
                      isGrouped
                        ? 'bg-[rgb(var(--color-primary))]/10 text-[rgb(var(--color-primary))] border-[rgb(var(--color-primary))]/30'
                        : 'bg-[rgb(var(--bg-surface))] text-[rgb(var(--fg-default))] border-[rgb(var(--bd-default))] hover:border-[rgb(var(--color-primary))] hover:bg-[rgb(var(--color-primary))]/5'
                    }`}
                  >
                    <Layers className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{col.label}</span>
                    {isGrouped && <Check className="h-3 w-3 ml-auto flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Column Reorder List ────────────────────────────────────────

function ColumnReorderList({ table, t }: { table: any; t: (key: string) => string }) {
  const columnOrder = table.getState().columnOrder as string[]
  const allColumns = table.getAllColumns()

  // Use columnOrder if set, otherwise use natural column order
  const orderedIds = columnOrder.length > 0
    ? columnOrder.filter((id: string) => id !== 'select' && id !== 'actions')
    : allColumns.filter((c: any) => c.id !== 'select' && c.id !== 'actions').map((c: any) => c.id)

  const moveColumn = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...(columnOrder.length > 0 ? columnOrder : allColumns.map((c: any) => c.id))]
    // Find actual positions in the full order (including select/actions)
    const filteredOrder = newOrder.filter(id => id !== 'select' && id !== 'actions')
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= filteredOrder.length) return

    ;[filteredOrder[index], filteredOrder[targetIndex]] = [filteredOrder[targetIndex], filteredOrder[index]]

    // Rebuild full order preserving select/actions positions
    const fullOrder = newOrder.filter(id => id === 'select' || id === 'actions')
    // Insert select at start if present
    const result: string[] = []
    if (newOrder.includes('select')) result.push('select')
    result.push(...filteredOrder)
    if (newOrder.includes('actions')) result.push('actions')

    table.setColumnOrder(result)
  }

  return (
    <div className="border border-[rgb(var(--bd-default))] rounded-md overflow-hidden max-h-[200px] overflow-y-auto">
      {orderedIds.map((columnId: string, index: number) => {
        const col = allColumns.find((c: any) => c.id === columnId)
        if (!col) return null
        let label = col.id
        if (typeof col.columnDef.header === 'string') label = col.columnDef.header
        const isVisible = col.getIsVisible()

        return (
          <div
            key={columnId}
            className={`flex items-center justify-between px-3 py-2 text-xs ${
              index !== orderedIds.length - 1 ? 'border-b border-[rgb(var(--bd-default))]' : ''
            } ${isVisible ? 'bg-[rgb(var(--bg-surface))]' : 'bg-[rgb(var(--bg-subtle))]'}`}
          >
            <span className={`truncate ${isVisible ? 'text-[rgb(var(--fg-default))]' : 'text-[rgb(var(--fg-muted))]'}`}>
              {label}
            </span>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={() => moveColumn(index, 'up')}
                disabled={index === 0}
                className={`p-1 rounded hover:bg-[rgb(var(--bg-hover))] ${index === 0 ? 'opacity-30 cursor-not-allowed' : 'text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg-default))]'}`}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => moveColumn(index, 'down')}
                disabled={index === orderedIds.length - 1}
                className={`p-1 rounded hover:bg-[rgb(var(--bg-hover))] ${index === orderedIds.length - 1 ? 'opacity-30 cursor-not-allowed' : 'text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg-default))]'}`}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <span className="text-[rgb(var(--fg-subtle))] w-5 text-right tabular-nums">{index + 1}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SORT TAB (Parkbuddy-inspired)
// ═══════════════════════════════════════════════════════════════

function SortTab({ sortableColumns, sorting, handleSort, clearSort, t }: any) {
  return (
    <div className="px-4 sm:px-6 pt-3 pb-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[rgb(var(--fg-muted))] uppercase tracking-wider flex items-center gap-2">
          <ArrowUpDown className="h-3.5 w-3.5" />
          {t('Sort By')}
        </h3>
        {sorting.length > 0 && (
          <button onClick={clearSort} className="text-xs text-[rgb(var(--color-error))] hover:underline font-medium">
            {t('Clear')}
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {sortableColumns.map((col: any) => {
          const sortState = sorting.find((s: any) => s.id === col.id)
          const isActive = !!sortState
          return (
            <button
              key={col.id}
              onClick={() => handleSort(col.id)}
              className={`px-3 py-2.5 text-xs rounded-md border text-left flex items-center justify-between transition-colors ${
                isActive
                  ? 'bg-[rgb(var(--color-primary))]/10 text-[rgb(var(--color-primary))] border-[rgb(var(--color-primary))]/30 font-semibold'
                  : 'bg-[rgb(var(--bg-surface))] text-[rgb(var(--fg-default))] border-[rgb(var(--bd-default))] hover:border-[rgb(var(--color-primary))] hover:bg-[rgb(var(--color-primary))]/5'
              }`}
            >
              <span className="truncate">{col.label}</span>
              {isActive && (
                <span className="text-[10px] font-bold ml-1.5 flex-shrink-0">
                  {sortState.desc ? '↓ Z-A' : '↑ A-Z'}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {sorting.length === 0 && (
        <div className="text-center py-6 border-2 border-dashed border-[rgb(var(--bd-default))] rounded-lg bg-[rgb(var(--bg-subtle))]">
          <p className="text-sm text-[rgb(var(--fg-muted))]">{t('No sorting applied')}</p>
          <p className="text-xs text-[rgb(var(--fg-subtle))] mt-1">{t('Tap a column to sort')}</p>
        </div>
      )}
    </div>
  )
}

