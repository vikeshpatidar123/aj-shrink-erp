import React from 'react'
import { Skeleton } from './skeleton'

interface SkeletonTableProps {
    rows?: number
    columns?: number
}

/**
 * Skeleton loading state for DataGrid tables
 * Shows animated placeholder rows while data is loading
 * 
 * @example
 * {loading ? (
 *   <SkeletonTable rows={10} columns={6} />
 * ) : (
 *   <DataGrid data={data} columns={columns} />
 * )}
 */
export function SkeletonTable({ rows = 10, columns = 6 }: SkeletonTableProps) {
    return (
        <div className="w-full border border-[rgb(var(--bd-default))] rounded-lg overflow-hidden bg-[rgb(var(--bg-surface))]">
            {/* Table Header */}
            <div className="grid gap-4 p-4 bg-[rgb(var(--bg-grid-header))] border-b border-[rgb(var(--bd-default))]" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
                {Array.from({ length: columns }).map((_, i) => (
                    <Skeleton key={`header-${i}`} width="80%" height="16px" />
                ))}
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-[rgb(var(--bd-subtle))]">
                {Array.from({ length: rows }).map((_, rowIndex) => (
                    <div
                        key={`row-${rowIndex}`}
                        className="grid gap-4 p-4 hover:bg-[rgb(var(--bg-hover))] transition-colors"
                        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
                    >
                        {Array.from({ length: columns }).map((_, colIndex) => (
                            <Skeleton
                                key={`cell-${rowIndex}-${colIndex}`}
                                width={colIndex === 0 ? '60%' : '90%'}
                                height="14px"
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}
