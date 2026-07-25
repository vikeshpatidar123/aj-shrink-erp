'use client'

import * as React from 'react'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── PageLoading (Newton's Cradle) ──────────────────────────────────────

export interface PageLoadingProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  color?: string
  speed?: string
}

const PageLoading = React.forwardRef<HTMLDivElement, PageLoadingProps>(
  ({ className, size = 'md', text, color = '#003366', speed = '1.4', ...props }, ref) => {
    const [isClient, setIsClient] = React.useState(false)

    const sizeMapping = {
      sm: '48',
      md: '64',
      lg: '78'
    }

    React.useEffect(() => {
      setIsClient(true)

      const loadNewtonsCradle = async () => {
        try {
          const { newtonsCradle } = await import('ldrs')
          newtonsCradle.register()
        } catch (error) {
          console.error('Failed to load NewtonsCradle:', error)
        }
      }

      loadNewtonsCradle()
    }, [])

    if (!isClient) {
      return (
        <div
          ref={ref}
          className={cn('flex flex-col items-center justify-center space-y-3', className)}
          {...props}
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[rgb(var(--fg-default))]"></div>
          {text && <span className="text-sm text-[rgb(var(--fg-muted))] font-medium">{text}</span>}
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className={cn('flex flex-col items-center justify-center space-y-3', className)}
        {...props}
      >
        <l-newtons-cradle
          size={sizeMapping[size]}
          speed={speed}
          color={color}
        />
        {text && <span className="text-sm text-[rgb(var(--fg-muted))] font-medium">{text}</span>}
      </div>
    )
  }
)

PageLoading.displayName = 'PageLoading'

export { PageLoading }

// ── Loading (spinner / pendulum / pulse / dots / cradle variants) ──────

export interface LoadingProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  text?: string
  variant?: 'spinner' | 'cradle' | 'pendulum' | 'pulse' | 'dots'
  color?: string
}

const Loading = React.forwardRef<HTMLDivElement, LoadingProps>(
  ({ className, size = 'md', text, variant = 'spinner', color = 'text-blue-600', ...props }, ref) => {
    const sizeClasses = {
      sm: 'h-4 w-4',
      md: 'h-6 w-6',
      lg: 'h-8 w-8',
      xl: 'h-12 w-12'
    }

    const textSizes = {
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base',
      xl: 'text-lg'
    }

    if (variant === 'cradle') {
      return (
        <PageLoading
          ref={ref}
          size={size === 'xl' ? 'lg' : size}
          text={text}
          className={className}
          {...props}
        />
      )
    }

    const renderVariant = () => {
      switch (variant) {
        case 'pendulum':
          return (
            <div className={cn('relative', sizeClasses[size], color)}>
              <div className="absolute inset-0 border-2 border-current rounded-full opacity-20"></div>
              <div className="absolute top-1/2 left-1/2 w-0.5 h-1/2 bg-current origin-top animate-[pendulum_1s_ease-in-out_infinite]"></div>
              <div className="absolute bottom-0 left-1/2 w-1 h-1 bg-current rounded-full transform -translate-x-1/2 animate-[pendulum_1s_ease-in-out_infinite]"></div>
            </div>
          )

        case 'pulse':
          return (
            <div className={cn('rounded-full bg-current animate-pulse opacity-75', sizeClasses[size], color)}></div>
          )

        case 'dots':
          return (
            <div className={cn('flex space-x-0.5', color)}>
              <div className={cn('rounded-full bg-current w-1.5 h-1.5 animate-bounce')} style={{ animationDelay: '0ms', animationDuration: '0.6s' }}></div>
              <div className={cn('rounded-full bg-current w-1.5 h-1.5 animate-bounce')} style={{ animationDelay: '100ms', animationDuration: '0.6s' }}></div>
              <div className={cn('rounded-full bg-current w-1.5 h-1.5 animate-bounce')} style={{ animationDelay: '200ms', animationDuration: '0.6s' }}></div>
            </div>
          )

        default: // spinner
          return (
            <Loader2 className={cn('animate-spin', sizeClasses[size], color)} />
          )
      }
    }

    return (
      <div
        ref={ref}
        className={cn('flex flex-col items-center justify-center gap-2', className)}
        {...props}
      >
        {renderVariant()}
        {text && (
          <span className={cn('font-medium opacity-80', textSizes[size], color)}>
            {text}
          </span>
        )}
      </div>
    )
  }
)

Loading.displayName = 'Loading'

export { Loading }

// ── LoadingStates (pre-configured for ERP scenarios) ───────────────────

export const LoadingStates = {
  Saving: () => <Loading variant="pendulum" text="Saving..." color="text-green-600" />,
  Loading: () => <Loading variant="spinner" text="Loading..." color="text-blue-600" />,
  Processing: () => <Loading variant="dots" text="Processing..." color="text-blue-600" />,

  Calculating: () => <Loading variant="pendulum" text="Calculating..." color="text-purple-600" />,
  Generating: () => <Loading variant="spinner" text="Generating plan..." color="text-indigo-600" />,
  Validating: () => <Loading variant="pulse" text="Validating..." color="text-amber-600" />,

  Exporting: () => <Loading variant="dots" text="Exporting..." color="text-orange-600" />,
  Importing: () => <Loading variant="spinner" text="Importing..." color="text-teal-600" />,
  Syncing: () => <Loading variant="pendulum" text="Syncing..." color="text-cyan-600" />,

  Connecting: () => <Loading variant="pulse" text="Connecting..." color="text-gray-600" />,
  Authenticating: () => <Loading variant="spinner" text="Authenticating..." color="text-slate-600" />,
  SigningIn: () => <PageLoading size="md" text="Signing in..." color="white" />,

  Inline: ({ size = 'sm' }: { size?: 'sm' | 'md' }) => <Loading variant="spinner" size={size} />,
  InlinePendulum: ({ size = 'sm' }: { size?: 'sm' | 'md' }) => <Loading variant="pendulum" size={size} />,
  InlineCradle: ({ size = 'sm' }: { size?: 'sm' | 'md' }) => <PageLoading size={size} />
}

// ── OptionalLogo — only renders after confirming the image loads ──────
function OptionalLogo({ src, className }: { src: string; className?: string }) {
  const [loaded, setLoaded] = useState(false)
  React.useEffect(() => {
    const img = new Image()
    img.onload = () => setLoaded(true)
    img.src = src
  }, [src])
  if (!loaded) return null
  return <img src={src} alt="" className={className} />
}

// ── LoadingOverlay (full-page blocking overlay) ────────────────────────

export function LoadingOverlay({
  isVisible,
  text = "Loading...",
  variant = "pendulum",
  size = "lg"
}: {
  isVisible: boolean
  text?: string
  variant?: LoadingProps['variant']
  size?: LoadingProps['size']
}) {
  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[300]">
      <div className="bg-[rgb(var(--bg-surface))] rounded-xl p-8 shadow-2xl flex flex-col items-center gap-4">
        <OptionalLogo src="/app/loading-logo.png" className="h-20 w-20 rounded-xl object-contain" />
        <Loading variant={variant} size={size} text={text} />
      </div>
    </div>
  )
}

// ── NavigationProgress (route change overlay with progress bar) ────────
// Uses pure CSS animations — no library imports, renders instantly on refresh

export function NavigationProgress() {
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const pathname = usePathname()

  useEffect(() => {
    setIsLoading(true)
    setProgress(0)

    const timer1 = setTimeout(() => setProgress(30), 100)
    const timer2 = setTimeout(() => setProgress(60), 250)
    const timer3 = setTimeout(() => setProgress(90), 400)
    const timer4 = setTimeout(() => {
      setProgress(100)
      setTimeout(() => {
        setIsLoading(false)
        setProgress(0)
      }, 200)
    }, 600)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
      clearTimeout(timer4)
    }
  }, [pathname])

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] pointer-events-none bg-black/20 backdrop-blur-sm flex items-center justify-center"
        >
          <div className="bg-[rgb(var(--bg-surface))] px-12 py-10 rounded-2xl shadow-2xl border border-[rgb(var(--bd-default))]">
            <div className="flex flex-col items-center gap-5">
              {/* Logo — large, with gentle pulse animation (pure CSS, instant) */}
              <div className="animate-pulse">
                <OptionalLogo src="/app/loading-logo.png" className="h-32 w-32 rounded-2xl object-contain drop-shadow-lg" />
              </div>

              {/* Three bouncing dots — pure CSS, no library needed */}
              <div className="flex items-center gap-1.5">
                <div
                  className="h-2.5 w-2.5 rounded-full bg-[rgb(var(--color-primary))] animate-bounce"
                  style={{ animationDelay: '0ms', animationDuration: '0.8s' }}
                />
                <div
                  className="h-2.5 w-2.5 rounded-full bg-[rgb(var(--color-primary))] animate-bounce"
                  style={{ animationDelay: '150ms', animationDuration: '0.8s' }}
                />
                <div
                  className="h-2.5 w-2.5 rounded-full bg-[rgb(var(--color-primary))] animate-bounce"
                  style={{ animationDelay: '300ms', animationDuration: '0.8s' }}
                />
              </div>

              {/* Progress Bar */}
              <div className="w-48">
                <div className="h-0.5 bg-[rgb(var(--bg-subtle))] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-[rgb(var(--color-primary))]"
                    initial={{ width: '0%' }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
