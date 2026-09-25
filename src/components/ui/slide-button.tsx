import { useState, useRef, useEffect } from 'react'
import {
  Rocket,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface SlideButtonProps {
  onSlideComplete: () => void
  disabled?: boolean
  text?: string
  icon?: React.ReactNode
}

export function SlideButton({
  onSlideComplete,
  disabled = false,
  text = 'Slide to Launch',
  icon = <Rocket className="size-5" />,
}: SlideButtonProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)

  const maxPosition = containerRef.current
    ? containerRef.current.offsetWidth - (buttonRef.current?.offsetWidth || 0)
    : 0

  const handleStart = (clientX: number) => {
    if (disabled || isComplete) return
    setIsDragging(true)
    startXRef.current = clientX - position
  }

  const handleMove = (clientX: number) => {
    if (!isDragging || disabled || isComplete) return

    const newPosition = clientX - startXRef.current
    const clampedPosition = Math.max(0, Math.min(newPosition, maxPosition))
    setPosition(clampedPosition)

    // Check if slide is complete (90% or more)
    if (clampedPosition >= maxPosition * 0.9) {
      setIsComplete(true)
      setIsDragging(false)
      setPosition(maxPosition)
      setTimeout(() => {
        onSlideComplete()
      }, 200)
    }
  }

  const handleEnd = () => {
    if (disabled || isComplete) return
    setIsDragging(false)

    // If not complete, snap back to start
    if (position < maxPosition * 0.9) {
      setPosition(0)
    }
  }

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    handleStart(e.clientX)
  }

  const handleMouseMove = (e: MouseEvent) => {
    handleMove(e.clientX)
  }

  const handleMouseUp = () => {
    handleEnd()
  }

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX)
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX)
    }
  }

  const handleTouchEnd = () => {
    handleEnd()
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.addEventListener('touchmove', handleTouchMove)
      document.addEventListener('touchend', handleTouchEnd)

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.removeEventListener('touchmove', handleTouchMove)
        document.removeEventListener('touchend', handleTouchEnd)
      }
    }
  }, [isDragging, position])

  const progress = maxPosition > 0 ? (position / maxPosition) * 100 : 0

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative h-12 w-full rounded-full bg-gradient-to-r from-primary/20 to-primary/10 overflow-hidden',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {/* Progress background with green gradient */}
      <div
        className="absolute inset-0 transition-all duration-200"
        style={{
          width: `${progress}%`,
          background: `linear-gradient(to right,
            hsl(var(--primary) / 0.3) 0%,
            hsl(142.1 76.2% 36.3% / ${Math.min(progress / 100, 1)}) 100%)`
        }}
      />

      {/* Text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span
          className={cn(
            'text-sm font-medium transition-opacity duration-200',
            progress > 50 ? 'opacity-0' : 'opacity-100',
            isComplete && 'opacity-0'
          )}
        >
          {text}
        </span>
        {isComplete && (
          <span className="text-sm font-medium text-white">Launching...</span>
        )}
      </div>

      {/* Draggable button */}
      <div
        ref={buttonRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className={cn(
          'absolute left-1 top-1 h-10 w-10 rounded-full flex items-center justify-center text-white shadow-lg cursor-grab active:cursor-grabbing transition-transform',
          isDragging && 'scale-110',
          disabled && 'cursor-not-allowed'
        )}
        style={{
          transform: `translateX(${position}px)`,
          transition: isDragging || isComplete ? 'none' : 'transform 0.3s ease-out',
          backgroundColor: `hsl(${220 - (progress * 0.78)}, ${70 + (progress * 0.06)}%, ${50 - (progress * 0.14)}%)`
        }}
      >
        {icon}
      </div>
    </div>
  )
}
