'use client'

import React, { useState, useEffect } from 'react'
import { walletAgentEndpoints } from '@/lib/wallet-config'

interface DIDCommConnectionProps {
  onConnectionEstablished: (connectionId: string) => void
  onClose: () => void
}

export function DIDCommConnection({ onConnectionEstablished, onClose }: DIDCommConnectionProps) {
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
        console.log('Parsed OOB DIDComm invitation:', decodedInvitation)
        return decodedInvitation
      }
      
      // Try c_i format (connections/1.0 format)
      const ciParam = urlObj.searchParams.get('c_i')
      if (ciParam) {
        const decodedInvitation = JSON.parse(atob(ciParam))
        console.log('Parsed c_i DIDComm invitation:', decodedInvitation)
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
        alias: `web-wallet-${Date.now()}`,
        their_label: 'Web Wallet User'
      }
      
      if (invitation['@type']?.includes('out-of-band')) {
        // Use out-of-band endpoint for newer format
        endpoint = walletAgentEndpoints.receiveOobInvitation()
        requestBody = {
          invitation: invitation,
          auto_accept: false,  // Manual control like mobile wallets
          use_existing_connection: false,
          alias: `web-wallet-${Date.now()}`
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
      console.log('DIDComm connection result:', result)
      
      // Start polling for connection status
      if (result.connection_id) {
        setConnectionId(result.connection_id)
        pollConnectionStatus(result.connection_id)
      } else {
        throw new Error('No connection ID returned')
      }

    } catch (error) {
      console.error('DIDComm connection error:', error)
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

          // Create a notification for credential sharing when connection is established
          try {
            const notificationResponse = await fetch('/api/notifications', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: `share-${connId}-${Date.now()}`,
                type: 'credential-share',
                title: 'Share Credentials',
                message: 'Connection established. Ready to share your credentials.',
                connectionId: connId,
                timestamp: new Date().toISOString(),
                status: 'pending'
              })
            })

            if (notificationResponse.ok) {
              console.log('Created credential share notification')
            }
          } catch (error) {
            console.error('Failed to create notification:', error)
          }

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
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="#00ff7f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="#00ff7f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h2 style={{
                fontSize: '24px',
                fontWeight: '700',
                background: 'linear-gradient(135deg, #00ff7f 0%, #00d4aa 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                margin: 0
              }}>DIDComm Connection</h2>
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

          {connectionStatus === 'idle' && (
            <div>
              <p style={{
                fontSize: '16px',
                color: 'rgba(255, 255, 255, 0.7)',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                lineHeight: '1.6',
                marginBottom: '30px'
              }}>
                Paste the DIDComm invitation URL to establish a secure connection for credential exchange.
              </p>

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#00ff7f',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  marginBottom: '12px'
                }}>
                  DIDComm Invitation URL
                </label>
                <textarea
                  value={invitationUrl}
                  onChange={(e) => setInvitationUrl(e.target.value)}
                  placeholder="Paste your DIDComm invitation URL here (starts with https://...)"
                  disabled={false}
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
                    e.currentTarget.style.borderColor = 'rgba(0, 255, 127, 0.5)'
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 255, 127, 0.1)'
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

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={establishConnection}
                  disabled={!invitationUrl.trim()}
                  style={{
                    flex: 1,
                    padding: '14px 24px',
                    background: !invitationUrl.trim() 
                      ? 'rgba(255, 255, 255, 0.1)' 
                      : 'linear-gradient(135deg, #00ff7f 0%, #00d4aa 100%)',
                    border: 'none',
                    borderRadius: '16px',
                    color: !invitationUrl.trim() ? 'rgba(255, 255, 255, 0.5)' : '#000000',
                    fontSize: '16px',
                    fontWeight: '600',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    cursor: !invitationUrl.trim() ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: !invitationUrl.trim() 
                      ? 'none' 
                      : '0 8px 20px rgba(0, 255, 127, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    if (invitationUrl.trim()) {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 12px 25px rgba(0, 255, 127, 0.4)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (invitationUrl.trim()) {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 255, 127, 0.3)'
                    }
                  }}
                >
                  Establish Connection
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
                background: 'rgba(0, 255, 127, 0.05)',
                border: '1px solid rgba(0, 255, 127, 0.2)',
                borderRadius: '16px'
              }}>
                <h4 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#00ff7f',
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
                  <li style={{ marginBottom: '8px' }}>Get the DIDComm invitation URL from the issuer</li>
                  <li style={{ marginBottom: '8px' }}>Paste the URL in the text box above</li>
                  <li style={{ marginBottom: '8px' }}>Click "Establish Connection" to connect</li>
                  <li style={{ marginBottom: '8px' }}>Wait for the connection to be established</li>
                  <li>Check your Notifications tab for credential offers</li>
                </ol>
              </div>
            </div>
          )}

          {connectionStatus === 'connecting' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '60px',
                height: '60px',
                border: '3px solid rgba(0, 255, 127, 0.3)',
                borderTop: '3px solid #00ff7f',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 30px'
              }}></div>
              <h3 style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#ffffff',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                margin: '0 0 15px 0'
              }}>Establishing Connection...</h3>
              <p style={{
                fontSize: '16px',
                color: 'rgba(255, 255, 255, 0.7)',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                lineHeight: '1.6',
                margin: '0 0 30px 0'
              }}>
                Please wait while we establish a secure DIDComm connection
              </p>
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '8px'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#00ff7f',
                  animation: 'pulse 1.5s infinite',
                  animationDelay: '0s'
                }}></div>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#00ff7f',
                  animation: 'pulse 1.5s infinite',
                  animationDelay: '0.2s'
                }}></div>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#00ff7f',
                  animation: 'pulse 1.5s infinite',
                  animationDelay: '0.4s'
                }}></div>
              </div>
              <style dangerouslySetInnerHTML={{
                __html: `
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                  @keyframes pulse {
                    0%, 100% { opacity: 0.4; transform: scale(0.8); }
                    50% { opacity: 1; transform: scale(1.2); }
                  }
                `
              }} />
            </div>
          )}

          {connectionStatus === 'connected' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '80px',
                height: '80px',
                background: 'rgba(0, 255, 127, 0.1)',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 30px',
                border: '1px solid rgba(0, 255, 127, 0.3)'
              }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="#00ff7f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 style={{
                fontSize: '24px',
                fontWeight: '700',
                color: '#00ff7f',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                margin: '0 0 15px 0'
              }}>Connection Established!</h3>
              <p style={{
                fontSize: '16px',
                color: 'rgba(255, 255, 255, 0.7)',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                lineHeight: '1.6',
                margin: '0 0 30px 0'
              }}>
                DIDComm connection is now active. You can receive credentials securely.
              </p>
              <button
                onClick={onClose}
                style={{
                  padding: '14px 32px',
                  background: 'linear-gradient(135deg, #00ff7f 0%, #00d4aa 100%)',
                  border: 'none',
                  borderRadius: '16px',
                  color: '#000000',
                  fontSize: '16px',
                  fontWeight: '600',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 8px 20px rgba(0, 255, 127, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 12px 25px rgba(0, 255, 127, 0.4)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 255, 127, 0.3)'
                }}
              >
                Continue
              </button>
            </div>
          )}

          {connectionStatus === 'error' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '80px',
                height: '80px',
                background: 'rgba(255, 107, 107, 0.1)',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 30px',
                border: '1px solid rgba(255, 107, 107, 0.3)'
              }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#ff6b6b" strokeWidth="2"/>
                  <line x1="15" y1="9" x2="9" y2="15" stroke="#ff6b6b" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="9" y1="9" x2="15" y2="15" stroke="#ff6b6b" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h3 style={{
                fontSize: '24px',
                fontWeight: '700',
                color: '#ff6b6b',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                margin: '0 0 15px 0'
              }}>Connection Failed</h3>
              <p style={{
                fontSize: '16px',
                color: 'rgba(255, 255, 255, 0.7)',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                lineHeight: '1.6',
                margin: '0 0 30px 0'
              }}>{errorMessage}</p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
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
                  Close
                </button>
                <button
                  onClick={() => setConnectionStatus('idle')}
                  style={{
                    padding: '14px 24px',
                    background: 'linear-gradient(135deg, #00ff7f 0%, #00d4aa 100%)',
                    border: 'none',
                    borderRadius: '16px',
                    color: '#000000',
                    fontSize: '16px',
                    fontWeight: '600',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 15px rgba(0, 255, 127, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 255, 127, 0.4)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 255, 127, 0.3)'
                  }}
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}