import React from 'react'
import { clsx } from 'clsx'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export const Card: React.FC<CardProps> = ({ className, children, ...props }) => {
  return (
    <div
      className={clsx(
        'card-base',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export const CardHeader: React.FC<CardProps> = ({ className, ...props }) => (
  <div
    className={clsx('flex flex-col space-y-1.5 p-6', className)}
    {...props}
  />
)

export const CardTitle: React.FC<CardProps> = ({ className, ...props }) => (
  <h3
    className={clsx(
      'text-2xl font-semibold leading-none tracking-tight',
      className
    )}
    {...props}
  />
)

export const CardDescription: React.FC<CardProps> = ({ className, ...props }) => (
  <p
    className={clsx('text-sm text-fg-muted', className)}
    {...props}
  />
)

export const CardContent: React.FC<CardProps> = ({ className, ...props }) => (
  <div className={clsx('p-6 pt-0', className)} {...props} />
)

export const CardFooter: React.FC<CardProps> = ({ className, ...props }) => (
  <div
    className={clsx('flex items-center p-6 pt-0', className)}
    {...props}
  />
)