import React from 'react'
import { clsx } from 'clsx'

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode
}

export const Label: React.FC<LabelProps> = ({
  className,
  children,
  ...props
}) => {
  return (
    <label
      className={clsx(
        'block text-xs font-medium text-[rgb(var(--fg-default))] mb-1',
        className
      )}
      {...props}
    >
      {children}
    </label>
  )
}