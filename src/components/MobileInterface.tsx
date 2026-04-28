'use client'

import React, { useEffect, useState } from 'react'
import { VRButton } from '@/components/VRButton'

interface QRCodeProps {
  data: string
  size?: number
}

function QRCodeDisplay({ data, size = 200 }: QRCodeProps) {
  const [qrCode, setQrCode] = useState<string>('')

  useEffect(() => {
    // Simple QR code generation using QR-server API
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&bgcolor=0f0f0f&color=ffffff`
    setQrCode(qrUrl)
  }, [data, size])

  return (
    <div className="flex flex-col items-center space-y-4">
      {qrCode && (
        <div className="p-4 bg-white rounded-xl">
          <img 
            src={qrCode} 
            alt="QR Code" 
            className="block"
            width={size}
            height={size}
          />
        </div>
      )}
    </div>
  )
}

interface MobileInterfaceProps {
  onSwitchToWeb: () => void
}

export function MobileInterface({ onSwitchToWeb }: MobileInterfaceProps) {
  const [connectionStatus, setConnectionStatus] = useState<'waiting' | 'connected' | 'error'>('waiting')
  const [notifications, setNotifications] = useState<any[]>([])
  const [credentials, setCredentials] = useState<any[]>([])
  const [qrData, setQrData] = useState<string>('')
  
  // Generate fresh invitation for mobile app
  useEffect(() => {
    generateInvitation()
  }, [])
  
  const generateInvitation = async () => {
    try {
      const response = await fetch('/api/connections/create-invitation', { method: 'POST' })
      const data = await response.json()
      if (data.success) {
        setQrData(data.invitationUrl)
      }
    } catch (error) {
      console.error('Error generating invitation:', error)
      setConnectionStatus('error')
    }
  }

  useEffect(() => {
    // Load current wallet data
    loadWalletData()
    
    // Poll for updates every 3 seconds
    const interval = setInterval(loadWalletData, 3000)
    return () => clearInterval(interval)
  }, [])

  const loadWalletData = async () => {
    try {
      // Load notifications
      const notifResponse = await fetch('/api/notifications')
      const notifData = await notifResponse.json()
      if (notifData.success) {
        setNotifications(notifData.notifications)
      }

      // Load credentials
      const credResponse = await fetch('/api/credentials')
      const credData = await credResponse.json()
      if (credData.success) {
        setCredentials(credData.credentials)
      }
    } catch (error) {
      console.error('Error loading wallet data:', error)
    }
  }

  const handleQRScan = () => {
    // Simulate QR scan success
    setConnectionStatus('connected')
    setTimeout(() => {
      setConnectionStatus('waiting')
    }, 5000)
  }

  return (
    <div className="min-h-screen bg-vr-bg-primary">
      <div className="max-w-md mx-auto px-6 py-8">
        
        {/* Header */}
        <header className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <span className="text-3xl">📱</span>
            <h1 className="vr-title">Mobile Mode</h1>
          </div>
          <p className="vr-body text-tertiary">
            Scan QR codes with your mobile SSI wallet app
          </p>
        </header>

        {/* Mode Switch */}
        <div className="mb-8">
          <VRButton 
            variant="outline" 
            onClick={onSwitchToWeb}
            className="w-full"
          >
            🌐 Switch to Web Mode
          </VRButton>
        </div>

        {/* Connection Status */}
        <div className="mb-8">
          <div className={`vr-card text-center p-6 ${
            connectionStatus === 'connected' ? 'border-success' : 
            connectionStatus === 'error' ? 'border-danger' : 'border-accent'
          }`}>
            <div className="text-4xl mb-4">
              {connectionStatus === 'waiting' && '🔍'}
              {connectionStatus === 'connected' && '✅'}
              {connectionStatus === 'error' && '❌'}
            </div>
            <h3 className="vr-subtitle mb-2">
              {connectionStatus === 'waiting' && 'Waiting for Mobile Connection'}
              {connectionStatus === 'connected' && 'Mobile App Connected!'}
              {connectionStatus === 'error' && 'Connection Error'}
            </h3>
            <p className="vr-caption text-tertiary">
              {connectionStatus === 'waiting' && 'Scan the QR code below with your mobile SSI wallet'}
              {connectionStatus === 'connected' && 'Your mobile app is now connected and synchronized'}
              {connectionStatus === 'error' && 'Please try scanning the QR code again'}
            </p>
          </div>
        </div>

        {/* QR Code Section */}
        <div className="mb-8">
          <div className="vr-card text-center p-6">
            <h3 className="vr-subtitle mb-4">Connection QR Code</h3>
            
            {qrData ? (
              <QRCodeDisplay 
                data={qrData}
                size={200}
              />
            ) : (
              <div className="w-50 h-50 bg-surface rounded-xl flex items-center justify-center">
                <span className="text-tertiary">Generating QR code...</span>
              </div>
            )}
            
            <div className="mt-4 space-y-2">
              <p className="vr-caption text-tertiary">
                Scan with your existing mobile SSI wallet app
              </p>
              
              <div className="mt-4 space-y-2">
                <button 
                  onClick={generateInvitation}
                  className="vr-btn vr-btn-outline vr-btn-sm"
                >
                  🔄 Generate New QR Code
                </button>
                <button 
                  onClick={handleQRScan}
                  className="vr-btn vr-btn-ghost vr-btn-sm"
                >
                  ✅ Simulate Mobile Connection
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Wallet Status */}
        <div className="space-y-4">
          <div className="vr-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="vr-subtitle">📊 Wallet Status</h4>
              <div className="w-3 h-3 bg-success rounded-full"></div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-accent">{credentials.length}</div>
                <p className="vr-caption text-tertiary">Credentials</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-accent">{notifications.length}</div>
                <p className="vr-caption text-tertiary">Notifications</p>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          {notifications.length > 0 && (
            <div className="vr-card p-4">
              <h4 className="vr-subtitle mb-3">🔔 Recent Activity</h4>
              <div className="space-y-2">
                {notifications.slice(0, 3).map((notification) => (
                  <div key={notification.id} className="flex items-center space-x-3 p-2 bg-surface rounded">
                    <span className="text-lg">
                      {notification.type === 'credential-offer' ? '📜' : '🔍'}
                    </span>
                    <div className="flex-1">
                      <p className="vr-caption font-medium">{notification.title}</p>
                      <p className="text-xs text-tertiary">{notification.message}</p>
                    </div>
                    <span className="px-2 py-1 bg-accent bg-opacity-20 text-accent text-xs rounded">
                      {notification.status}
                    </span>
                  </div>
                ))}
              </div>
              <p className="vr-caption text-tertiary mt-3">
                💡 Handle these actions in your mobile app
              </p>
            </div>
          )}

          {/* Instructions */}
          <div className="vr-card p-4 bg-warning bg-opacity-10 border-warning border-opacity-20">
            <h4 className="vr-subtitle text-warning mb-3">📋 How to Use Mobile Mode</h4>
            <ol className="space-y-2 text-sm text-warning">
              <li>1. Open your mobile SSI wallet app</li>
              <li>2. Scan the QR code above</li>
              <li>3. Handle credentials and proofs on your phone</li>
              <li>4. View status updates here in Minecraft</li>
            </ol>
          </div>
        </div>

      </div>
    </div>
  )
}