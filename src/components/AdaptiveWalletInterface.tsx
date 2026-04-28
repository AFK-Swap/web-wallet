'use client'

import React, { useState, useEffect } from 'react'
import { MobileInterface } from './MobileInterface'
import { CommandSimulator } from './CommandSimulator'

type WalletMode = 'web' | 'mobile'

interface AdaptiveWalletInterfaceProps {
  children: React.ReactNode // Web interface content
}

export function AdaptiveWalletInterface({ children }: AdaptiveWalletInterfaceProps) {
  const [currentMode, setCurrentMode] = useState<WalletMode>('web')
  const [showCommands, setShowCommands] = useState(false)

  useEffect(() => {
    // Check initial mode from API
    checkCurrentMode()
    
    // Poll for mode changes every 2 seconds
    const interval = setInterval(checkCurrentMode, 2000)
    return () => clearInterval(interval)
  }, [])

  const checkCurrentMode = async () => {
    try {
      const response = await fetch('/api/wallet/mode')
      const data = await response.json()
      if (data.success && data.mode !== currentMode) {
        setCurrentMode(data.mode)
        console.log(`Mode switched to: ${data.mode}`)
      }
    } catch (error) {
      console.error('Error checking wallet mode:', error)
    }
  }

  const switchMode = async (newMode: WalletMode) => {
    try {
      const response = await fetch('/api/wallet/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode })
      })
      
      const data = await response.json()
      if (data.success) {
        setCurrentMode(newMode)
        console.log(`Switched to ${newMode} mode`)
      }
    } catch (error) {
      console.error('Error switching mode:', error)
    }
  }

  return (
    <div className="relative">
      {/* Mode Indicator */}
      <div className="fixed top-4 left-4 z-40">
        <div className="flex items-center space-x-2 bg-vr-bg-surface backdrop-blur-sm border border-subtle rounded-lg px-3 py-2">
          <div className={`w-2 h-2 rounded-full ${
            currentMode === 'web' ? 'bg-blue-400' : 'bg-green-400'
          }`}></div>
          <span className="text-sm font-medium">
            {currentMode === 'web' ? '🌐 Web Mode' : '📱 Mobile Mode'}
          </span>
        </div>
      </div>

      {/* Quick Mode Switch */}
      <div className="fixed top-4 right-4 z-40 flex items-center space-x-2">
        <button
          onClick={() => switchMode(currentMode === 'web' ? 'mobile' : 'web')}
          className="bg-vr-bg-surface backdrop-blur-sm border border-subtle rounded-lg px-3 py-2 hover:bg-opacity-80 transition-colors text-sm"
        >
          {currentMode === 'web' ? '📱 Switch to Mobile' : '🌐 Switch to Web'}
        </button>
        <button
          onClick={() => setShowCommands(true)}
          className="bg-accent text-primary rounded-lg px-3 py-2 hover:bg-accent-hover transition-colors text-sm"
        >
          🎮 Commands
        </button>
      </div>

      {/* Content based on mode */}
      {currentMode === 'web' ? (
        // Web mode - show the original VR interface
        <div className="web-mode">
          {children}
        </div>
      ) : (
        // Mobile mode - show QR interface
        <div className="mobile-mode">
          <MobileInterface onSwitchToWeb={() => switchMode('web')} />
        </div>
      )}

      {/* Command Simulator */}
      {showCommands && (
        <CommandSimulator />
      )}

      {/* Minecraft Integration Info */}
      <div className="fixed bottom-4 left-4 z-40">
        <div className="bg-vr-bg-surface backdrop-blur-sm border border-subtle rounded-lg px-3 py-2 max-w-xs">
          <div className="text-xs space-y-1">
            <div className="font-medium text-accent">🎮 Minecraft Commands:</div>
            <div className="text-muted">
              <code>/wallet web</code> - Switch to web mode
            </div>
            <div className="text-muted">
              <code>/wallet mobile</code> - Switch to mobile mode
            </div>
            <div className="text-muted">
              <code>/wallet status</code> - Show status
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}