'use client'

import React, { useState } from 'react'
import { walletAgentEndpoints } from '@/lib/wallet-config'

interface IssuerConnectionProps {
  onConnectionEstablished: (connectionId: string) => void
  onClose: () => void
}

export function IssuerConnection({ onConnectionEstablished, onClose }: IssuerConnectionProps) {
  const [invitationUrl, setInvitationUrl] = useState('')
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [connectionId, setConnectionId] = useState('')


  const parseInvitationUrl = (url: string) => {
    try {
      const urlObj = new URL(url)

      // Try OOB format first (newer format)
      const oobParam = urlObj.searchParams.get('oob')
      if (oobParam) {
        const decodedInvitation = JSON.parse(atob(oobParam))
        console.log('Parsed OOB Issuer invitation:', decodedInvitation)
        return decodedInvitation
      }

      // Try c_i format (connections/1.0 format)
      const ciParam = urlObj.searchParams.get('c_i')
      if (ciParam) {
        const decodedInvitation = JSON.parse(atob(ciParam))
        console.log('Parsed c_i Issuer invitation:', decodedInvitation)
        return decodedInvitation
      }

      throw new Error('No valid invitation parameter found in URL (looking for oob or c_i)')
    } catch (error) {
      console.error('Failed to parse invitation URL:', error)
      throw new Error('Invalid invitation URL format')
    }
  }

  const establishConnection = async () => {
    if (!invitationUrl.trim()) {
      setErrorMessage('Please enter an invitation URL')
      return
    }

    setConnectionStatus('connecting')
    setErrorMessage('')

    try {
      // Parse the invitation URL
      const invitation = parseInvitationUrl(invitationUrl)

      // Web wallet acts as external agent - no auto-accept, manual control like mobile wallets
      let endpoint = walletAgentEndpoints.receiveInvitation()
      let requestBody: any = {
        auto_accept: false,  // Manual control like mobile wallets
        alias: `issuer-connection-${Date.now()}`,
        their_label: 'Credential Issuer'
      }

      if (invitation['@type']?.includes('out-of-band')) {
        // Use out-of-band endpoint for newer format
        endpoint = walletAgentEndpoints.receiveOobInvitation()
        requestBody = {
          invitation: invitation,
          auto_accept: false,  // Manual control like mobile wallets
          use_existing_connection: false,
          alias: `issuer-connection-${Date.now()}`
        }
      } else {
        // Use connections endpoint for connections/1.0 format
        endpoint = walletAgentEndpoints.receiveInvitation()
        requestBody = {
          ...invitation,
          auto_accept: false  // Manual control like mobile wallets
        }
      }

      console.log('Using endpoint:', endpoint)
      console.log('Request body:', requestBody)

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error(`Failed to receive invitation: ${response.statusText}`)
      }

      const result = await response.json()
      console.log('Issuer connection result:', result)

      // Start polling for connection status
      if (result.connection_id) {
        setConnectionId(result.connection_id)
        pollConnectionStatus(result.connection_id)
      } else {
        throw new Error('No connection ID returned')
      }

    } catch (error) {
      console.error('Issuer connection error:', error)
      setConnectionStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Connection failed')
    }
  }

  const pollConnectionStatus = async (connId: string) => {
    let attempts = 0
    const maxAttempts = 30 // 1 minute with 2-second intervals

    const checkStatus = async () => {
      try {
        const response = await fetch(walletAgentEndpoints.connections(connId))
        if (!response.ok) {
          throw new Error('Failed to check connection status')
        }

        const connection = await response.json()
        console.log('Connection status:', connection.state)

        // Handle manual connection acceptance like mobile wallets
        if (connection.state === 'request-received') {
          console.log('Manually accepting connection request...')
          // Accept the connection request manually
          const acceptResponse = await fetch(walletAgentEndpoints.connectionAccept(connId), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          })

          if (!acceptResponse.ok) {
            throw new Error('Failed to accept connection request')
          }
          console.log('Connection request accepted')
          // Continue polling to check if it becomes active
        } else if (connection.state === 'request') {
          console.log('Connection in request state - waiting for other party to accept...')
          // Continue polling - the connection is progressing normally
        } else if (connection.state === 'completed' || connection.state === 'active') {
          setConnectionStatus('connected')

          // NO NOTIFICATION CREATED FOR ISSUER CONNECTIONS
          console.log('✅ Issuer connection established - NO notification created')

          onConnectionEstablished(connId)
          return
        }

        attempts++
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 2000)
        } else {
          throw new Error('Connection timeout - please try again')
        }
      } catch (error) {
        console.error('Status check error:', error)
        setConnectionStatus('error')
        setErrorMessage(error instanceof Error ? error.message : 'Connection failed')
      }
    }

    checkStatus()
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        background: 'rgba(26, 26, 46, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        transformStyle: 'preserve-3d',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ padding: '30px' }}>

          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '30px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h2 style={{
                fontSize: '24px',
                fontWeight: '700',
                background: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                margin: 0
              }}>Connect to Issuer</h2>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '12px',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '20px',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 107, 107, 0.2)'
                e.currentTarget.style.borderColor = 'rgba(255, 107, 107, 0.4)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
              }}
            >
              ×
            </button>
          </div>

          <div>
            <p style={{
              fontSize: '16px',
              color: 'rgba(255, 255, 255, 0.7)',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              lineHeight: '1.6',
              marginBottom: '30px'
            }}>
              Connect to a credential issuer to receive credentials. No notification will be created.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px'
              }}>
                <label style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#4ade80',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  margin: 0
                }}>
                  Issuer Invitation URL
                </label>
                <button
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText()
                      setInvitationUrl(text)
                      setErrorMessage('')
                    } catch (err) {
                      setErrorMessage('Failed to paste from clipboard. Please paste manually.')
                      console.error('Clipboard paste error:', err)
                    }
                  }}
                  disabled={connectionStatus === 'connecting'}
                  style={{
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg, #22c55e 0%, #4ade80 100%)',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#000000',
                    fontSize: '14px',
                    fontWeight: '600',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    cursor: connectionStatus === 'connecting' ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={(e) => {
                    if (connectionStatus !== 'connecting') {
                      e.currentTarget.style.transform = 'scale(1.05)'
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(34, 197, 94, 0.4)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (connectionStatus !== 'connecting') {
                      e.currentTarget.style.transform = 'scale(1)'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.3)'
                    }
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  Paste
                </button>
              </div>
              <textarea
                value={invitationUrl}
                onChange={(e) => setInvitationUrl(e.target.value)}
                placeholder="Paste your issuer invitation URL here (starts with https://...)"
                disabled={connectionStatus === 'connecting'}
                style={{
                  width: '100%',
                  height: '120px',
                  padding: '16px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '16px',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  resize: 'vertical',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(10px)'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.5)'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(74, 222, 128, 0.1)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            {errorMessage && (
              <div style={{
                marginBottom: '20px',
                padding: '16px',
                background: 'rgba(255, 107, 107, 0.1)',
                border: '1px solid rgba(255, 107, 107, 0.3)',
                borderRadius: '16px'
              }}>
                <p style={{
                  color: '#ff6b6b',
                  fontSize: '14px',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  margin: 0
                }}>{errorMessage}</p>
              </div>
            )}

            {connectionStatus === 'connected' && (
              <div style={{
                marginBottom: '20px',
                padding: '16px',
                background: 'rgba(74, 222, 128, 0.1)',
                border: '1px solid rgba(74, 222, 128, 0.3)',
                borderRadius: '16px'
              }}>
                <p style={{
                  color: '#4ade80',
                  fontSize: '14px',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  margin: 0
                }}>✅ Connected to issuer successfully! You can now receive credentials.</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={establishConnection}
                disabled={connectionStatus === 'connecting' || connectionStatus === 'connected' || !invitationUrl.trim()}
                style={{
                  flex: 1,
                  padding: '14px 24px',
                  background: connectionStatus === 'connecting' || connectionStatus === 'connected' || !invitationUrl.trim()
                    ? 'rgba(255, 255, 255, 0.1)'
                    : 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
                  border: 'none',
                  borderRadius: '16px',
                  color: connectionStatus === 'connecting' || connectionStatus === 'connected' || !invitationUrl.trim() ? 'rgba(255, 255, 255, 0.5)' : '#000000',
                  fontSize: '16px',
                  fontWeight: '600',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  cursor: connectionStatus === 'connecting' || connectionStatus === 'connected' || !invitationUrl.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: connectionStatus === 'connecting' || connectionStatus === 'connected' || !invitationUrl.trim()
                    ? 'none'
                    : '0 8px 20px rgba(74, 222, 128, 0.3)'
                }}
                onMouseEnter={(e) => {
                  if (connectionStatus !== 'connecting' && connectionStatus !== 'connected' && invitationUrl.trim()) {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 12px 25px rgba(74, 222, 128, 0.4)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (connectionStatus !== 'connecting' && connectionStatus !== 'connected' && invitationUrl.trim()) {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(74, 222, 128, 0.3)'
                  }
                }}
              >
                {connectionStatus === 'connecting' ? 'Connecting...' : connectionStatus === 'connected' ? 'Connected' : 'Connect to Issuer'}
              </button>

              <button
                onClick={onClose}
                style={{
                  padding: '14px 24px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '16px',
                  color: '#ffffff',
                  fontSize: '16px',
                  fontWeight: '500',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                Cancel
              </button>
            </div>

            {/* Instructions */}
            <div style={{
              marginTop: '30px',
              padding: '20px',
              background: 'rgba(74, 222, 128, 0.05)',
              border: '1px solid rgba(74, 222, 128, 0.2)',
              borderRadius: '16px'
            }}>
              <h4 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#4ade80',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                margin: '0 0 15px 0'
              }}>How to Use:</h4>
              <ol style={{
                listStyle: 'decimal',
                listStylePosition: 'inside',
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '14px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                lineHeight: '1.6',
                margin: 0,
                paddingLeft: '0'
              }}>
                <li style={{ marginBottom: '8px' }}>Get the invitation URL from your credential issuer</li>
                <li style={{ marginBottom: '8px' }}>Paste the URL in the text box above</li>
                <li style={{ marginBottom: '8px' }}>Click "Connect to Issuer"</li>
                <li style={{ marginBottom: '8px' }}>Wait for connection confirmation</li>
                <li>Credentials will be offered to you automatically</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
