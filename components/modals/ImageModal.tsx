'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui'
import { Button } from '@/components/ui'
import { Download, Printer, Copy, Maximize2, FileImage, File, X, Minus, Plus, Maximize } from 'lucide-react'
import { jsPDF } from 'jspdf'
import 'svg2pdf.js'
import { useLanguage } from '@/contexts/LanguageContext'

export interface ImageModalDetail {
  label: string
  value: string | number
}

interface ImageModalProps {
  // Required
  title?: string
  children: React.ReactNode

  // Preview mode (optional) - if provided, shows preview that opens to modal
  preview?: React.ReactNode
  previewClassName?: string
  previewContainerClassName?: string

  // Modal control (optional) - for external control
  isOpen?: boolean
  onClose?: () => void

  // Optional metadata for modal header
  details?: ImageModalDetail[]

  // Callbacks
  onPreviewClick?: () => void

  // PDF mode (optional) - if true, shows PDF viewer instead of SVG export options
  isPdfMode?: boolean
  pdfUrl?: string
  onDownloadPdf?: () => void

  // Clean mode (optional) - hides header and footer, shows only content
  cleanMode?: boolean

  // Zoom/Pan mode (optional) - enables PDF-like zoom and pan for SVG content
  enableZoom?: boolean
  viewBoxWidthMM?: number
  viewBoxHeightMM?: number

  // Export filename (optional) - intelligent naming for exported files
  // e.g., "ClientName_JobName_KeyLine" - extension is added automatically
  exportFilename?: string

  // Extra export buttons (optional) - custom export actions rendered in the export toolbar
  extraExportButtons?: React.ReactNode
}

// ─── Zoom constants ───
const MIN_SCALE = 0.25
const MAX_SCALE = 5.0
const ZOOM_STEP = 0.25
// Physical zoom presets are defined inside the component (PHYSICAL_PRESETS)
// since they depend on container width for scale conversion

export function ImageModal({
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  title,
  children,
  preview,
  previewClassName = '',
  previewContainerClassName = '',
  details,
  onPreviewClick,
  isPdfMode = false,
  pdfUrl,
  onDownloadPdf,
  cleanMode = false,
  enableZoom = false,
  viewBoxWidthMM,
  viewBoxHeightMM,
  exportFilename,
  extraExportButtons
}: ImageModalProps) {
  const { t } = useLanguage()
  const contentRef = useRef<HTMLDivElement>(null)
  const [internalIsOpen, setInternalIsOpen] = useState(false)

  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen
  const setIsOpen = controlledOnClose ? (open: boolean) => !open && controlledOnClose() : setInternalIsOpen

  // Determine if zoom should be active
  const isZoomMode = enableZoom && !isPdfMode && !cleanMode

  // ─── Adaptive modal width based on SVG aspect ratio ───
  const [computedModalWidth, setComputedModalWidth] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (!isZoomMode || !viewBoxWidthMM || !viewBoxHeightMM || !isOpen) {
      setComputedModalWidth(undefined)
      return
    }

    const compute = () => {
      const viewportH = window.innerHeight
      const viewportW = window.innerWidth
      const modalH = viewportH * 0.9
      // Header ~44px + Details ~36px + Footer ~52px + padding ~20px = ~152px chrome
      const chromeH = 152
      const contentH = modalH - chromeH
      const aspect = viewBoxWidthMM / viewBoxHeightMM
      const idealContentW = contentH * aspect
      // Add padding (48px sides) and clamp between 40vw and 92vw
      const minW = viewportW * 0.4
      const maxW = viewportW * 0.92
      const idealModalW = idealContentW + 48
      setComputedModalWidth(Math.max(minW, Math.min(maxW, idealModalW)))
    }

    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [isZoomMode, viewBoxWidthMM, viewBoxHeightMM, isOpen])

  // ─── Zoom state ───
  const [zoomScale, setZoomScale] = useState(1)
  const [showZoomPresets, setShowZoomPresets] = useState(false)

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const zoomPresetsRef = useRef<HTMLDivElement>(null)

  const zoomEnabled = isZoomMode && isOpen

  const clampScale = useCallback((s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s)), [])

  // Apply zoom: center the scroll position after scale change
  const applyZoom = useCallback((newScale: number) => {
    const clamped = clampScale(newScale)
    const container = scrollContainerRef.current
    if (container) {
      const prevScale = zoomScale
      // Remember the center point as a ratio of scroll
      const scrollCenterX = (container.scrollLeft + container.clientWidth / 2) / (container.scrollWidth || 1)
      const scrollCenterY = (container.scrollTop + container.clientHeight / 2) / (container.scrollHeight || 1)

      setZoomScale(clamped)

      // After state update, re-center scroll
      requestAnimationFrame(() => {
        const newScrollWidth = container.scrollWidth
        const newScrollHeight = container.scrollHeight
        container.scrollLeft = scrollCenterX * newScrollWidth - container.clientWidth / 2
        container.scrollTop = scrollCenterY * newScrollHeight - container.clientHeight / 2
      })
    } else {
      setZoomScale(clamped)
    }
  }, [clampScale, zoomScale])

  // Zoom actions
  const zoomIn = useCallback(() => applyZoom(zoomScale + ZOOM_STEP), [zoomScale, applyZoom])
  const zoomOut = useCallback(() => applyZoom(zoomScale - ZOOM_STEP), [zoomScale, applyZoom])

  const fitToPage = useCallback(() => {
    setZoomScale(1)
    const container = scrollContainerRef.current
    if (container) {
      requestAnimationFrame(() => {
        container.scrollLeft = 0
        container.scrollTop = 0
      })
    }
  }, [])

  const setZoomLevel = useCallback((newScale: number) => applyZoom(newScale), [applyZoom])

  // Ctrl+Wheel = zoom, plain wheel = scroll (native)
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || !zoomEnabled) return

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+scroll = zoom
        e.preventDefault()
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
        const newScale = clampScale(zoomScale + delta)

        // Zoom toward cursor
        const rect = container.getBoundingClientRect()
        const cursorXRatio = (e.clientX - rect.left + container.scrollLeft) / (container.scrollWidth || 1)
        const cursorYRatio = (e.clientY - rect.top + container.scrollTop) / (container.scrollHeight || 1)

        setZoomScale(newScale)

        requestAnimationFrame(() => {
          container.scrollLeft = cursorXRatio * container.scrollWidth - (e.clientX - rect.left)
          container.scrollTop = cursorYRatio * container.scrollHeight - (e.clientY - rect.top)
        })
      }
      // else: plain scroll = native scroll (don't prevent default)
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [zoomEnabled, zoomScale, clampScale])

  // Touch pinch-to-zoom
  const pinchStartRef = useRef({ distance: 0, scale: 1 })

  const getTouchDistance = (touches: TouchList) => {
    if (touches.length < 2) return 0
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || !zoomEnabled) return

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        pinchStartRef.current = { distance: getTouchDistance(e.touches), scale: zoomScale }
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        const distance = getTouchDistance(e.touches)
        const pinchRatio = distance / pinchStartRef.current.distance
        const newScale = clampScale(pinchStartRef.current.scale * pinchRatio)
        setZoomScale(newScale)
      }
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: false })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
    }
  }, [zoomEnabled, zoomScale, clampScale])

  // Reset zoom when modal opens
  useEffect(() => {
    if (isOpen) {
      setZoomScale(1)
      setShowZoomPresets(false)
      const container = scrollContainerRef.current
      if (container) {
        requestAnimationFrame(() => {
          container.scrollLeft = 0
          container.scrollTop = 0
        })
      }
    }
  }, [isOpen])

  // Track the rendered SVG base width (at zoomScale=1) for mm scale calculation
  const [svgBaseWidth, setSvgBaseWidth] = useState(0)
  const zoomScaleRef = useRef(zoomScale)
  zoomScaleRef.current = zoomScale

  useEffect(() => {
    if (!isZoomMode || !isOpen) return

    let observer: ResizeObserver | null = null

    const measure = () => {
      const svg = contentRef.current?.querySelector('svg')
      if (svg) {
        // getBoundingClientRect includes CSS transform, so divide out current zoom
        setSvgBaseWidth(svg.getBoundingClientRect().width / zoomScaleRef.current)
      } else {
        const container = scrollContainerRef.current
        if (container) {
          setSvgBaseWidth(container.getBoundingClientRect().width)
        }
      }
    }

    const setup = () => {
      const container = scrollContainerRef.current
      if (!container) return

      observer = new ResizeObserver(() => measure())
      observer.observe(container)
      measure()
    }

    // Defer to next frame so the dialog content is fully rendered
    const raf = requestAnimationFrame(setup)

    return () => {
      cancelAnimationFrame(raf)
      observer?.disconnect()
    }
  }, [isZoomMode, isOpen])

  // Close zoom presets dropdown on outside click
  useEffect(() => {
    if (!showZoomPresets) return
    const handleClickOutside = (e: MouseEvent) => {
      if (zoomPresetsRef.current && !zoomPresetsRef.current.contains(e.target as Node)) {
        setShowZoomPresets(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showZoomPresets])

  // ─── Physical scale calculations ───
  // 96 CSS px per inch = 3.7795 CSS px per mm (standard screen)
  const PX_PER_MM_REAL = 96 / 25.4

  // How many CSS px currently represent 1mm of the diagram
  const pxPerMM = viewBoxWidthMM && svgBaseWidth > 0
    ? (svgBaseWidth / viewBoxWidthMM) * zoomScale
    : 0

  // Physical zoom %: 100% means 1mm on screen = 1mm real
  const physicalPercent = pxPerMM > 0 ? Math.round((pxPerMM / PX_PER_MM_REAL) * 100) : Math.round(zoomScale * 100)

  // mm scale display
  const mmScale = pxPerMM > 0 ? pxPerMM.toFixed(1) : null

  // Convert a desired physical % back to CSS zoomScale
  const physicalPercentToScale = useCallback((percent: number) => {
    if (!viewBoxWidthMM || svgBaseWidth <= 0) return percent / 100
    const targetPxPerMM = (percent / 100) * PX_PER_MM_REAL
    return targetPxPerMM / (svgBaseWidth / viewBoxWidthMM)
  }, [viewBoxWidthMM, svgBaseWidth])

  // Physical-scale presets (what the user sees as %)
  const PHYSICAL_PRESETS = [10, 25, 50, 75, 100, 150, 200, 300, 500]

  const handlePreviewClick = () => {
    if (onPreviewClick) {
      onPreviewClick()
    } else {
      setIsOpen(true)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
  }

  // Build export filename: uses exportFilename prop if provided, otherwise falls back to title
  const getExportName = (extension: string) => {
    const base = exportFilename || title || 'export'
    // Sanitize: replace unsafe chars, collapse spaces/underscores
    const sanitized = base.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_').replace(/_+/g, '_').trim()
    return `${sanitized}.${extension}`
  }

  // Clone SVG and strip dimension arrows for clean exports
  const getCleanSvg = (): SVGSVGElement | null => {
    const svgElement = contentRef.current?.querySelector('svg')
    if (!svgElement) return null
    const clone = svgElement.cloneNode(true) as SVGSVGElement
    clone.querySelectorAll('[data-dimension]').forEach(el => el.remove())
    return clone
  }

  const exportAsPNG = async () => {
    if (!contentRef.current) return

    try {
      const clonedSvg = getCleanSvg()
      if (!clonedSvg) return

      const viewBox = clonedSvg.getAttribute('viewBox')
      let width = 800
      let height = 600

      if (viewBox) {
        const parts = viewBox.split(' ')
        width = parseFloat(parts[2]) || 800
        height = parseFloat(parts[3]) || 600
      } else {
        width = parseFloat(clonedSvg.getAttribute('width') || '800')
        height = parseFloat(clonedSvg.getAttribute('height') || '600')
      }

      clonedSvg.setAttribute('width', String(width * 2))
      clonedSvg.setAttribute('height', String(height * 2))

      const canvas = document.createElement('canvas')
      canvas.width = width * 2
      canvas.height = height * 2
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const svgData = new XMLSerializer().serializeToString(clonedSvg)
      const base64Data = btoa(unescape(encodeURIComponent(svgData)))
      const dataUrl = `data:image/svg+xml;base64,${base64Data}`

      const img = new Image()
      img.crossOrigin = 'anonymous'

      img.onload = () => {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        canvas.toBlob((blob) => {
          if (blob) {
            const downloadUrl = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.download = getExportName('png')
            link.href = downloadUrl
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(downloadUrl)
          }
        }, 'image/png')
      }

      img.onerror = (err) => {
        console.error('Error loading SVG image:', err)
      }

      img.src = dataUrl
    } catch (error) {
      console.error('Error exporting PNG:', error)
    }
  }

  const exportAsSVG = () => {
    if (!contentRef.current) return

    try {
      const cleanSvg = getCleanSvg()
      if (!cleanSvg) return

      const svgData = new XMLSerializer().serializeToString(cleanSvg)
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.download = getExportName('svg')
      link.href = url
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting SVG:', error)
    }
  }

  const exportAsPDF = async () => {
    if (!contentRef.current) return

    try {
      const svgElement = getCleanSvg()
      if (!svgElement) return

      const viewBox = svgElement.getAttribute('viewBox')
      let svgWidth = 800
      let svgHeight = 600

      if (viewBox) {
        const parts = viewBox.split(' ')
        svgWidth = parseFloat(parts[2]) || 800
        svgHeight = parseFloat(parts[3]) || 600
      } else {
        const widthAttr = svgElement.getAttribute('width')
        const heightAttr = svgElement.getAttribute('height')
        if (widthAttr) svgWidth = parseFloat(widthAttr)
        if (heightAttr) svgHeight = parseFloat(heightAttr)
      }

      const isLandscape = svgWidth > svgHeight
      const orientation = isLandscape ? 'landscape' : 'portrait'

      const pdf = new jsPDF({
        orientation: orientation as 'landscape' | 'portrait',
        unit: 'pt',
        format: 'a4'
      })

      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()

      const margin = 40
      const availableWidth = pdfWidth - (margin * 2)
      const availableHeight = pdfHeight - (margin * 2)

      const scaleX = availableWidth / svgWidth
      const scaleY = availableHeight / svgHeight
      const pdfScale = Math.min(scaleX, scaleY)

      const scaledWidth = svgWidth * pdfScale
      const scaledHeight = svgHeight * pdfScale
      const x = (pdfWidth - scaledWidth) / 2
      const y = (pdfHeight - scaledHeight) / 2

      if (title) {
        pdf.setFontSize(14)
        pdf.setTextColor(30, 41, 59)
        pdf.text(title, pdfWidth / 2, 25, { align: 'center' })
      }

      // @ts-ignore - svg2pdf.js adds this method to jsPDF
      await pdf.svg(svgElement, {
        x: x,
        y: title ? y + 10 : y,
        width: scaledWidth,
        height: scaledHeight
      })

      const filename = getExportName('pdf')
      pdf.save(filename)
    } catch (error) {
      console.error('Error exporting vector PDF:', error)
    }
  }

  const handlePrint = async () => {
    if (!contentRef.current) return

    try {
      const svgElement = getCleanSvg()
      if (!svgElement) return

      const viewBox = svgElement.getAttribute('viewBox')
      let svgWidth = 800
      let svgHeight = 600

      if (viewBox) {
        const parts = viewBox.split(' ')
        svgWidth = parseFloat(parts[2]) || 800
        svgHeight = parseFloat(parts[3]) || 600
      } else {
        const widthAttr = svgElement.getAttribute('width')
        const heightAttr = svgElement.getAttribute('height')
        if (widthAttr) svgWidth = parseFloat(widthAttr)
        if (heightAttr) svgHeight = parseFloat(heightAttr)
      }

      const isLandscape = svgWidth > svgHeight
      const orientation = isLandscape ? 'landscape' : 'portrait'

      const pdf = new jsPDF({
        orientation: orientation as 'landscape' | 'portrait',
        unit: 'pt',
        format: 'a4'
      })

      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()

      const margin = 40
      const availableWidth = pdfWidth - (margin * 2)
      const availableHeight = pdfHeight - (margin * 2)

      const scaleX = availableWidth / svgWidth
      const scaleY = availableHeight / svgHeight
      const pdfScale = Math.min(scaleX, scaleY)

      const scaledWidth = svgWidth * pdfScale
      const scaledHeight = svgHeight * pdfScale
      const x = (pdfWidth - scaledWidth) / 2
      const y = (pdfHeight - scaledHeight) / 2

      if (title) {
        pdf.setFontSize(14)
        pdf.setTextColor(30, 41, 59)
        pdf.text(title, pdfWidth / 2, 25, { align: 'center' })
      }

      // @ts-ignore - svg2pdf.js adds this method to jsPDF
      await pdf.svg(svgElement, {
        x: x,
        y: title ? y + 10 : y,
        width: scaledWidth,
        height: scaledHeight
      })

      pdf.autoPrint()
      const pdfBlob = pdf.output('blob')
      const pdfBlobUrl = URL.createObjectURL(pdfBlob)
      const printWindow = window.open(pdfBlobUrl, '_blank')

      if (printWindow) {
        printWindow.onload = () => {
          setTimeout(() => URL.revokeObjectURL(pdfBlobUrl), 1000)
        }
      }
    } catch (error) {
      console.error('Error printing vector PDF:', error)
    }
  }

  const copyToClipboard = async () => {
    if (!contentRef.current) return

    try {
      const clonedSvg = getCleanSvg()
      if (!clonedSvg) return

      const viewBox = clonedSvg.getAttribute('viewBox')
      let width = 800
      let height = 600

      if (viewBox) {
        const parts = viewBox.split(' ')
        width = parseFloat(parts[2]) || 800
        height = parseFloat(parts[3]) || 600
      } else {
        width = parseFloat(clonedSvg.getAttribute('width') || '800')
        height = parseFloat(clonedSvg.getAttribute('height') || '600')
      }

      clonedSvg.setAttribute('width', String(width * 2))
      clonedSvg.setAttribute('height', String(height * 2))

      const canvas = document.createElement('canvas')
      canvas.width = width * 2
      canvas.height = height * 2
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const svgData = new XMLSerializer().serializeToString(clonedSvg)
      const base64Data = btoa(unescape(encodeURIComponent(svgData)))
      const dataUrl = `data:image/svg+xml;base64,${base64Data}`

      const img = new Image()
      img.crossOrigin = 'anonymous'

      img.onload = async () => {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        canvas.toBlob(async (blob) => {
          if (blob) {
            try {
              await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
              ])
              alert('Copied to clipboard!')
            } catch (err) {
              console.error('Failed to copy:', err)
            }
          }
        }, 'image/png')
      }

      img.onerror = (err) => {
        console.error('Error loading SVG for clipboard:', err)
      }

      img.src = dataUrl
    } catch (error) {
      console.error('Error copying to clipboard:', error)
    }
  }

  const toggleFullScreen = () => {
    // Prefer the scroll container (zoom mode) for proper background,
    // fall back to content ref for non-zoom mode
    const target = scrollContainerRef.current || contentRef.current
    if (!target) return

    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      target.requestFullscreen()
    }
  }

  // ─── Zoom button styles ───
  const zoomBtnBase = 'flex items-center justify-center h-7 px-2 rounded text-xs font-medium transition-colors select-none'
  const zoomBtn = `${zoomBtnBase} text-[rgb(var(--fg-default))] hover:bg-[rgb(var(--bg-subtle))] disabled:opacity-40 disabled:cursor-not-allowed`
  const zoomBtnActive = `${zoomBtnBase} bg-[rgb(var(--bg-subtle))] text-[rgb(var(--fg-default))] hover:bg-[rgb(var(--bd-default))]`

  return (
    <>
      {/* Preview Container (if preview prop provided) */}
      {preview && (
        <div
          className={`border border-[rgb(var(--bd-default))] rounded bg-[rgb(var(--bg-surface))] h-full flex items-center justify-center transition-all cursor-pointer hover:shadow-lg ${previewContainerClassName}`}
          onClick={handlePreviewClick}
        >
          <div className={previewClassName}>{preview}</div>
        </div>
      )}

      {/* Full-Size Modal */}
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent
          className={`flex flex-col p-0 bg-[rgb(var(--bg-surface))] z-[100] overflow-hidden ${
            isPdfMode || cleanMode
              ? 'w-[70vw] max-w-[70vw] h-[98vh]'
              : isZoomMode
                ? 'h-[90vh] max-w-[92vw]'
                : 'w-auto max-w-[95vw] max-h-[95vh]'
          }`}
          style={isZoomMode && computedModalWidth ? { width: `${computedModalWidth}px` } : undefined}
          hideCloseButton
        >
          {/* Header */}
          {cleanMode ? (
            <DialogTitle className="sr-only">{title || 'Preview'}</DialogTitle>
          ) : (
            <DialogHeader className="px-4 md:px-6 py-2.5 border-b border-[rgb(var(--bd-default))] flex-shrink-0 bg-[rgb(var(--bg-surface))]">
              <div className="flex items-center justify-between gap-3">
                <DialogTitle className="flex-shrink-0">{title}</DialogTitle>

                {/* Zoom controls in header */}
                {isZoomMode && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Zoom: [-] % [+] */}
                    <button className={zoomBtn} onClick={zoomOut} disabled={zoomScale <= MIN_SCALE} title={t('Zoom Out')}>
                      <Minus className="h-3.5 w-3.5" />
                    </button>

                    <div className="relative" ref={zoomPresetsRef}>
                      <button
                        className={`${zoomBtnActive} min-w-[3.5rem] gap-1`}
                        onClick={() => setShowZoomPresets(!showZoomPresets)}
                        title={t('Zoom Level')}
                      >
                        {physicalPercent}%
                      </button>

                      {showZoomPresets && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-[rgb(var(--bg-surface))] border border-[rgb(var(--bd-default))] rounded-md shadow-lg z-50 py-1 min-w-[5rem]">
                          {PHYSICAL_PRESETS.map((preset) => (
                            <button
                              key={preset}
                              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[rgb(var(--bg-subtle))] transition-colors ${
                                physicalPercent === preset
                                  ? 'text-[rgb(var(--color-primary))] font-medium'
                                  : 'text-[rgb(var(--fg-default))]'
                              }`}
                              onClick={() => { setZoomLevel(physicalPercentToScale(preset)); setShowZoomPresets(false) }}
                            >
                              {preset}%
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button className={zoomBtn} onClick={zoomIn} disabled={zoomScale >= MAX_SCALE} title={t('Zoom In')}>
                      <Plus className="h-3.5 w-3.5" />
                    </button>

                    <div className="w-px h-4 bg-[rgb(var(--bd-default))] mx-1" />

                    {/* View actions */}
                    <button className={zoomBtn} onClick={fitToPage} title={t('Fit to Page')}>
                      <Maximize className="h-3.5 w-3.5" />
                      <span className="ml-1 hidden sm:inline">{t('Fit Page')}</span>
                    </button>

                    <button className={zoomBtn} onClick={toggleFullScreen} title={t('Full Screen')}>
                      <Maximize2 className="h-3.5 w-3.5" />
                      <span className="ml-1 hidden sm:inline">{t('Full Screen')}</span>
                    </button>

                    {/* Scale info */}
                    {mmScale && (
                      <>
                        <div className="w-px h-4 bg-[rgb(var(--bd-default))] mx-1" />
                        <span className="flex items-center h-7 text-[0.65rem] text-[rgb(var(--fg-muted))] select-none whitespace-nowrap">
                          1mm = {mmScale}px
                        </span>
                      </>
                    )}
                  </div>
                )}

                <button
                  onClick={handleClose}
                  className="flex-shrink-0 rounded-sm opacity-70 ring-offset-[rgb(var(--bg-surface))] transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))] focus:ring-offset-2"
                >
                  <X className="h-4 w-4 text-[rgb(var(--color-icon))]" />
                  <span className="sr-only">Close</span>
                </button>
              </div>
            </DialogHeader>
          )}

          {/* Details Section */}
          {!cleanMode && details && details.length > 0 && (
            <div className="px-6 py-2 bg-[rgb(var(--bg-subtle))] border-b border-[rgb(var(--bd-default))] flex-shrink-0">
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-[rgb(var(--fg-default))]">
                {details.map((detail, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <span className="font-medium text-[rgb(var(--fg-muted))]">{detail.label}:</span>
                    <span className="font-normal">{detail.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Content Area */}
          {isPdfMode && pdfUrl ? (
            <div className="flex-1 bg-[rgb(var(--bg-subtle))] overflow-hidden p-0" style={{ minHeight: 0 }}>
              <embed
                src={pdfUrl}
                type="application/pdf"
                className="w-full h-full"
                style={{ border: 'none' }}
              />
            </div>
          ) : isZoomMode ? (
            // Zoomable SVG Mode - uses native overflow scroll + CSS scale for zoom
            <div
              ref={scrollContainerRef}
              className="flex-1 bg-[rgb(var(--bg-subtle))] overflow-auto relative"
              style={{ minHeight: 0 }}
            >
              {/* Scaled content wrapper - width/height sized to create scrollable overflow */}
              <div
                style={{
                  width: zoomScale <= 1 ? '100%' : `${zoomScale * 100}%`,
                  height: zoomScale <= 1 ? '100%' : `${zoomScale * 100}%`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '100%'
                }}
              >
                <div
                  ref={contentRef}
                  style={{
                    transform: `scale(${zoomScale})`,
                    transformOrigin: 'center center',
                    transition: 'transform 0.15s ease-out',
                    width: zoomScale > 1 ? `${100 / zoomScale}%` : '100%',
                    height: zoomScale > 1 ? `${100 / zoomScale}%` : '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem'
                  }}
                >
                  {children}
                </div>
              </div>
            </div>
          ) : (
            // Image/SVG Mode (no zoom)
            <div
              ref={contentRef}
              className="flex-1 px-6 pb-6 bg-[rgb(var(--bg-surface))] rounded-lg flex items-center justify-center"
              style={{ minHeight: 0 }}
            >
              <div className="w-full h-full flex items-center justify-center bg-[rgb(var(--bg-surface))]">
                {children}
              </div>
            </div>
          )}

          {/* Export Toolbar */}
          {cleanMode ? null : isPdfMode ? (
            <div className="flex items-center justify-end border-t px-6 py-4 gap-2 bg-[rgb(var(--bg-surface))] flex-shrink-0">
              <Button
                variant="action-save"
                size="sm"
                onClick={onDownloadPdf}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between border-t border-[rgb(var(--bd-default))] px-6 py-2.5 bg-[rgb(var(--bg-surface))] flex-shrink-0">
              {/* Download exports */}
              <div className="flex items-center gap-1.5">
                <span className="text-[0.65rem] text-[rgb(var(--fg-muted))] mr-1 hidden sm:inline">{t('Export')}:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportAsPNG}
                  className="flex items-center gap-1.5 h-7 text-xs"
                >
                  <FileImage className="h-3.5 w-3.5" />
                  PNG
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportAsSVG}
                  className="flex items-center gap-1.5 h-7 text-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  SVG
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportAsPDF}
                  className="flex items-center gap-1.5 h-7 text-xs"
                >
                  <File className="h-3.5 w-3.5" />
                  PDF
                </Button>
                {extraExportButtons}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyToClipboard}
                  className="flex items-center gap-1.5 h-7 text-xs"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {t('Copy')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 h-7 text-xs"
                >
                  <Printer className="h-3.5 w-3.5" />
                  {t('Print')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
