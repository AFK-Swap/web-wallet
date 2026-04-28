'use client'

import React, { useState } from 'react'

interface MinecraftConnectionProps {
  username: string
  onClose: () => void
}

export function MinecraftConnection({ username, onClose }: MinecraftConnectionProps) {
  const [invitationUrl, setInvitationUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleAcceptInvitation = async () => {
    if (!invitationUrl.trim()) {
      setError('Please paste an invitation URL')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/accept-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitationUrl: invitationUrl.trim(),
          username: username || 'alice'
        })
      })

      const result = await response.json()

      if (result.success) {
        setSuccess(`Connection established successfully! Minecraft command: ${result.data?.minecraftCommand || 'Connection established'}`)
        setInvitationUrl('')
      } else {
        throw new Error(result.error || 'Failed to accept invitation')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation')
      console.error('Accept invitation error:', err)
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setInvitationUrl('')
    setError(null)
    setSuccess(null)
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
              <svg width="32" height="32" viewBox="0 0 20 20" fill="none">
                <path fillRule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clipRule="evenodd" fill="#00ff7f"/>
                <path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V9a1 1 0 00-1-1h-1v4a2 2 0 01-2 2H4.5a1.5 1.5 0 010-3H11V7z" fill="#00ff7f"/>
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
              }}>Minecraft Connection</h2>
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
              Paste the connection invitation URL you received from Minecraft to establish a secure connection with your wallet.
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
                  color: '#00ff7f',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  margin: 0
                }}>
                  Connection Invitation URL
                </label>
                <button
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText()
                      setInvitationUrl(text)
                      setError(null)
                    } catch (err) {
                      setError('Failed to paste from clipboard. Please paste manually.')
                      console.error('Clipboard paste error:', err)
                    }
                  }}
                  disabled={loading}
                  style={{
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg, #00d4aa 0%, #00ff7f 100%)',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#000000',
                    fontSize: '14px',
                    fontWeight: '600',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 12px rgba(0, 212, 170, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.transform = 'scale(1.05)'
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 212, 170, 0.4)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.currentTarget.style.transform = 'scale(1)'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 212, 170, 0.3)'
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
                placeholder="Paste your Minecraft connection invitation URL here..."
                disabled={loading}
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

            {error && (
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
                }}>{error}</p>
              </div>
            )}

            {success && (
              <div style={{
                marginBottom: '20px',
                padding: '16px',
                background: 'rgba(0, 255, 127, 0.1)',
                border: '1px solid rgba(0, 255, 127, 0.3)',
                borderRadius: '16px'
              }}>
                <p style={{
                  color: '#00ff7f',
                  fontSize: '14px',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  margin: 0
                }}>{success}</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleAcceptInvitation}
                disabled={loading || !invitationUrl.trim()}
                style={{
                  flex: 1,
                  padding: '14px 24px',
                  background: loading || !invitationUrl.trim() 
                    ? 'rgba(255, 255, 255, 0.1)' 
                    : 'linear-gradient(135deg, #00ff7f 0%, #00d4aa 100%)',
                  border: 'none',
                  borderRadius: '16px',
                  color: loading || !invitationUrl.trim() ? 'rgba(255, 255, 255, 0.5)' : '#000000',
                  fontSize: '16px',
                  fontWeight: '600',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  cursor: loading || !invitationUrl.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: loading || !invitationUrl.trim() 
                    ? 'none' 
                    : '0 8px 20px rgba(0, 255, 127, 0.3)'
                }}
                onMouseEnter={(e) => {
                  if (!loading && invitationUrl.trim()) {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 12px 25px rgba(0, 255, 127, 0.4)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading && invitationUrl.trim()) {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 255, 127, 0.3)'
                  }
                }}
              >
                {loading ? 'Connecting...' : 'Establish Connection'}
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
                <li style={{ marginBottom: '8px' }}>Get the connection invitation URL from Minecraft</li>
                <li style={{ marginBottom: '8px' }}>Paste the URL in the text box above</li>
                <li style={{ marginBottom: '8px' }}>Click "Establish Connection" to connect</li>
                <li style={{ marginBottom: '8px' }}>Wait for the success confirmation</li>
                <li>Check your Notifications tab for credential offers and proof requests</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}