import React from 'react'
import { cn } from '@/lib/utils'

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    /**
     * Width of the skeleton (can be CSS value like '100%', '200px', etc.)
     */
    width?: string | number
    /**
     * Height of the skeleton (can be CSS value like '40px', '2rem', etc.)
     */
    height?: string | number
    /**
     * Border radius variant
     */
    variant?: 'default' | 'rounded' | 'circular'
    /**
     * Animation type
     */
    animation?: 'pulse' | 'wave' | 'none'
}

/**
 * Skeleton component for loading states
 * Provides visual placeholder while content is loading
 * 
 * @example
 * // Basic usage
 * <Skeleton width="100%" height="40px" />
 * 
 * // Circular avatar skeleton
 * <Skeleton width="48px" height="48px" variant="circular" />
 * 
 * // Multiple skeletons for form fields
 * <div className="space-y-3">
 *   <Skeleton width="100%" height="40px" />
 *   <Skeleton width="100%" height="40px" />
 *   <Skeleton width="60%" height="40px" />
 * </div>
 */
export function Skeleton({
    width = '100%',
    height = '1rem',
    variant = 'default',
    animation = 'pulse',
    className,
    style,
    ...props
}: SkeletonProps) {
    const widthValue = typeof width === 'number' ? `${width}px` : width
    const heightValue = typeof height === 'number' ? `${height}px` : height

    return (
        <div
            className={cn(
                // Base styles
                'bg-[rgb(var(--bg-subtle))]',
                // Variant styles
                variant === 'circular' && 'rounded-full',
                variant === 'rounded' && 'rounded-md',
                variant === 'default' && 'rounded',
                // Animation styles
                animation === 'pulse' && 'animate-pulse',
                animation === 'wave' && 'animate-shimmer bg-gradient-to-r from-[rgb(var(--bg-subtle))] via-[rgb(var(--bg-hover))] to-[rgb(var(--bg-subtle))] bg-[length:200%_100%]',
                className
            )}
            style={{
                width: widthValue,
                height: heightValue,
                ...style
            }}
            {...props}
        />
    )
}

/**
 * Skeleton for text lines
 */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
    return (
        <div className={cn('space-y-2', className)}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    width={i === lines - 1 ? '60%' : '100%'}
                    height="1rem"
                />
            ))}
        </div>
    )
}

/**
 * Skeleton for form fields (matching your modal layout)
 */
export function SkeletonFormFields({ count = 8, columns = 4 }: { count?: number; columns?: number }) {
    return (
        <div className={`grid grid-cols-12 gap-3`}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className={`col-span-12 md:col-span-6 lg:col-span-${12 / columns} space-y-2`}>
                    {/* Label skeleton */}
                    <Skeleton width="40%" height="14px" />
                    {/* Input skeleton */}
                    <Skeleton width="100%" height="40px" />
                </div>
            ))}
        </div>
    )
}
