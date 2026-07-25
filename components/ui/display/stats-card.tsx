import * as React from "react"
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card } from "./card"

export interface StatsCardProps {
  title: string
  value: string | number
  icon?: LucideIcon
  trend?: {
    value: number
    direction: 'up' | 'down'
    label?: string
  }
  description?: string
  className?: string
  variant?: 'default' | 'accent' | 'warning' | 'error'
}

const iconVariants = {
  default: "bg-primary text-white",
  accent: "bg-accent text-white", 
  warning: "bg-warning text-white",
  error: "bg-error text-white"
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  description,
  className,
  variant = 'default'
}: StatsCardProps) {
  const TrendIcon = trend?.direction === 'up' ? TrendingUp : TrendingDown
  const trendColor = trend?.direction === 'up' ? 'text-success' : 'text-error'

  return (
    <Card className={cn("p-6 min-h-[140px] w-full", className)}>
      <div className="flex items-start gap-4">
        {Icon && (
          <div className={cn(
            "flex-shrink-0 p-3 rounded-lg",
            iconVariants[variant]
          )}>
            <Icon className="h-6 w-6" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline flex-wrap gap-2">
            <p className="text-2xl font-semibold text-fg-default truncate">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>

            {trend && (
              <div className={cn(
                "flex items-center text-sm font-semibold",
                trendColor
              )}>
                <TrendIcon className="h-4 w-4 flex-shrink-0" />
                <span className="ml-1">
                  {Math.abs(trend.value)}%
                  {trend.label && ` ${trend.label}`}
                </span>
              </div>
            )}
          </div>

          <p className="text-sm font-medium text-fg-muted mt-2 line-clamp-2">
            {title}
          </p>

          {description && (
            <p className="text-sm text-fg-subtle mt-1 line-clamp-1">
              {description}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

// Grid layout for multiple stats cards
export interface StatsGridProps {
  children: React.ReactNode
  columns?: 1 | 2 | 3 | 4
  className?: string
}

export function StatsGrid({
  children,
  columns = 4,
  className
}: StatsGridProps) {
  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
  }

  return (
    <div className={cn(
      "grid gap-4 sm:gap-6 w-full",
      gridCols[columns],
      className
    )}>
      {children}
    </div>
  )
}