'use client'

import React, { useEffect, useRef } from 'react'
import { VRCard } from './VRCard'
import { VRButton } from './VRButton'

interface QRCodeDisplayProps {
  data: string
  title?: string
  subtitle?: string
  size?: number
  onCopy?: () => void
  className?: string
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  data,
  title = "Scan QR Code",
  subtitle,
  size = 256,
  onCopy,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const generateQRCode = async () => {
      if (!canvasRef.current || !data) return

      try {
        // Dynamic import for client-side only
        const QRCode = (await import('qrcode')).default
        
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        
        if (!ctx) return

        // Set canvas size
        canvas.width = size
        canvas.height = size

        // Generate QR code
        await QRCode.toCanvas(canvas, data, {
          width: size,
          margin: 2,
          color: {
            dark: '#00ff41',  // VR green
            light: '#000000'  // Black background
          },
          errorCorrectionLevel: 'M'
        })

      } catch (error) {
        console.error('Failed to generate QR code:', error)
        
        // Fallback: Draw error message
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        
        if (ctx && canvas) {
          canvas.width = size
          canvas.height = size
          
          ctx.fillStyle = '#1a1a1a'
          ctx.fillRect(0, 0, size, size)
          
          ctx.fillStyle = '#ff4444'
          ctx.font = '16px monospace'
          ctx.textAlign = 'center'
          ctx.fillText('QR Error', size / 2, size / 2)
        }
      }
    }

    generateQRCode()
  }, [data, size])

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(data)
      onCopy?.()
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  return (
    <VRCard
      title={title}
      subtitle={subtitle}
      className={`text-center ${className}`}
    >
      <div className="space-y-6">
        <div className="flex justify-center">
          <div className="vr-card p-4 bg-black">
            <canvas
              ref={canvasRef}
              className="block max-w-full h-auto"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
        </div>
        
        <div className="space-y-3">
          <p className="vr-caption text-vr-text-dim">
            Scan with your mobile wallet or share the connection URL
          </p>
          
          <VRButton
            variant="outline"
            size="md"
            onClick={handleCopyToClipboard}
            className="w-full"
          >
            Copy Connection URL
          </VRButton>
        </div>
        
        {data && (
          <details className="vr-card p-4">
            <summary className="vr-caption text-vr-accent cursor-pointer">
              Raw Data (Click to expand)
            </summary>
            <div className="mt-3 p-3 bg-black rounded border-2 border-vr-border">
              <code className="vr-caption text-vr-text break-all font-mono">
                {data.length > 200 ? `${data.substring(0, 200)}...` : data}
              </code>
            </div>
          </details>
        )}
      </div>
    </VRCard>
  )
}