"use client"

import { useEffect, useRef, useState } from "react"

export function CustomCursor() {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const positionRef = useRef({ x: -100, y: -100 })
  const innerPositionRef = useRef({ x: -100, y: -100 })
  const targetPositionRef = useRef({ x: -100, y: -100 })
  const isPointerRef = useRef(false)
  const [isFinePointer, setIsFinePointer] = useState(false)

  useEffect(() => {
    const pointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)')
    const updatePointerType = () => setIsFinePointer(pointerQuery.matches)

    updatePointerType()
    pointerQuery.addEventListener('change', updatePointerType)
    return () => pointerQuery.removeEventListener('change', updatePointerType)
  }, [])

  useEffect(() => {
    if (!isFinePointer) return

    let animationFrameId: number
    const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor

    const updateCursor = () => {
      innerPositionRef.current.x = lerp(innerPositionRef.current.x, targetPositionRef.current.x, 0.35)
      innerPositionRef.current.y = lerp(innerPositionRef.current.y, targetPositionRef.current.y, 0.35)
      positionRef.current.x = lerp(positionRef.current.x, targetPositionRef.current.x, 0.2)
      positionRef.current.y = lerp(positionRef.current.y, targetPositionRef.current.y, 0.2)

      if (outerRef.current && innerRef.current) {
        const scale = isPointerRef.current ? 1.5 : 1
        const innerScale = isPointerRef.current ? 0.5 : 1
        outerRef.current.style.transform = `translate3d(${positionRef.current.x}px, ${positionRef.current.y}px, 0) scale(${scale})`
        innerRef.current.style.transform = `translate3d(${innerPositionRef.current.x}px, ${innerPositionRef.current.y}px, 0) scale(${innerScale})`
      }

      animationFrameId = requestAnimationFrame(updateCursor)
    }

    const handleMouseMove = (event: MouseEvent) => {
      targetPositionRef.current = { x: event.clientX, y: event.clientY }
      const target = event.target as HTMLElement
      isPointerRef.current =
        window.getComputedStyle(target).cursor === 'pointer' || target.tagName === 'BUTTON' || target.tagName === 'A'
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    animationFrameId = requestAnimationFrame(updateCursor)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      cancelAnimationFrame(animationFrameId)
    }
  }, [isFinePointer])

  if (!isFinePointer) return null

  return (
    <>
      <div
        ref={outerRef}
        className="pointer-events-none fixed z-50 mix-blend-difference will-change-transform"
        style={{ contain: 'layout style paint', left: '-8px', top: '-8px' }}
      >
        <div className="h-4 w-4 rounded-full border-2 border-white transition-transform duration-150" />
      </div>
      <div
        ref={innerRef}
        className="pointer-events-none fixed z-50 mix-blend-difference will-change-transform"
        style={{ contain: 'layout style paint', left: '-4px', top: '-4px' }}
      >
        <div className="h-2 w-2 rounded-full bg-white transition-transform duration-150" />
      </div>
    </>
  )
}
