'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { VRButton } from '@/components/VRButton'

interface Credential {
  id: string
  type: string
  issuer: string
  issuedDate: string
  attributes: { [key: string]: any }
  credentialDefinitionId?: string
  source?: string
  connectionId?: string
  displayName?: string
  hidden?: boolean
}

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loading, setLoading] = useState(true)
  const [editingCredential, setEditingCredential] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [showHidden, setShowHidden] = useState(false)
  const [hiddenCount, setHiddenCount] = useState(0)

  useEffect(() => {
    loadCredentials()
  }, [showHidden])

  const loadCredentials = async () => {
    try {
      setLoading(true)
      // Get credentials directly from Alice storage via web wallet API
      const response = await fetch(`/api/credentials?includeHidden=${showHidden}`)
      const result = await response.json()
      
      if (result.success) {
        // Transform Alice credentials to match UI format
        const formattedCredentials = result.credentials.map((cred: any) => ({
          id: cred.referent,
          type: `${cred.name || 'Unknown'} - ${cred.degree || 'Credential'}`,
          issuer: 'University/Organization',
          issuedDate: cred.retrieved_at || new Date().toISOString(),
          attributes: cred.attributes,
          credentialDefinitionId: cred.cred_def_id || '',
          source: 'alice_storage',
          connectionId: '',
          displayName: `${cred.name || 'Unknown'} ${cred.degree || 'Credential'}`,
          hidden: cred.hidden || false
        }))
        
        setCredentials(formattedCredentials)
        setHiddenCount(result.hiddenCount || 0)
      } else {
        console.error('Failed to load credentials:', result.error)
        setCredentials([])
        setHiddenCount(0)
      }
    } catch (error) {
      console.error('Failed to load credentials:', error)
      setCredentials([])
      setHiddenCount(0)
    } finally {
      setLoading(false)
    }
  }


  const handleUpdateDisplayName = async (credentialId: string, newName: string) => {
    if (!newName.trim()) return
    
    // For Alice storage, we'll just update local state since Alice doesn't store display names
    setCredentials(prev => prev.map(c => 
      c.id === credentialId 
        ? { ...c, displayName: newName.trim() }
        : c
    ))
    setEditingCredential(null)
    setEditingName('')
    console.log('Credential name updated locally:', credentialId, newName)
  }

  const handleHideCredential = async (credential: Credential) => {
    try {
      const displayName = credential.displayName || credential.type
      
      if (confirm(`Hide "${displayName}" from view?\n\nThe credential will remain safely stored in Alice but won't be visible in this list. You can show hidden credentials using the toggle above.`)) {
        
        const response = await fetch('/api/credentials/hidden', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credentialId: credential.id })
        })
        
        const result = await response.json()
        
        if (result.success) {
          console.log('Credential hidden:', credential.id)
          // Reload credentials to reflect the change
          loadCredentials()
        } else {
          console.error('Failed to hide credential:', result.error)
          alert('Failed to hide credential. Please try again.')
        }
      }
    } catch (error) {
      console.error('Error hiding credential:', error)
      alert('Unable to hide credential.')
    }
  }

  const handleUnhideCredential = async (credential: Credential) => {
    try {
      const displayName = credential.displayName || credential.type
      
      if (confirm(`Unhide "${displayName}"?\n\nThe credential will be visible in the main list again.`)) {
        
        const response = await fetch(`/api/credentials/hidden?id=${credential.id}`, {
          method: 'DELETE'
        })
        
        const result = await response.json()
        
        if (result.success) {
          console.log('Credential unhidden:', credential.id)
          // Reload credentials to reflect the change
          loadCredentials()
        } else {
          console.error('Failed to unhide credential:', result.error)
          alert('Failed to unhide credential. Please try again.')
        }
      }
    } catch (error) {
      console.error('Error unhiding credential:', error)
      alert('Unable to unhide credential.')
    }
  }

  const startEditing = (credential: Credential) => {
    setEditingCredential(credential.id)
    setEditingName(credential.displayName || credential.type)
  }

  const cancelEditing = () => {
    setEditingCredential(null)
    setEditingName('')
  }

  const getCredentialIcon = (type: string) => {
    if (type.toLowerCase().includes('gaming') || type.toLowerCase().includes('vr')) {
      return '🎮'
    } else if (type.toLowerCase().includes('education') || type.toLowerCase().includes('diploma')) {
      return '🎓'
    } else if (type.toLowerCase().includes('identity') || type.toLowerCase().includes('id')) {
      return '🆔'
    } else if (type.toLowerCase().includes('membership')) {
      return '👥'
    }
    return '📜'
  }

  // No authentication needed - Alice storage is used directly

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #0f0f0f 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '3px solid rgba(0, 255, 127, 0.3)',
            borderTop: '3px solid #00ff7f',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <p style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '16px',
            color: 'rgba(255, 255, 255, 0.7)'
          }}>Loading credentials...</p>
        </div>
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `
        }} />
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #0f0f0f 100%)',
      position: 'relative'
    }}>
      {/* Fixed Header */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '80px',
        background: 'rgba(26, 26, 46, 0.9)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 30px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px'
        }}>
          <Link href="/" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            color: '#ffffff',
            textDecoration: 'none',
            fontSize: '14px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            transition: 'all 0.3s ease',
            backdropFilter: 'blur(10px)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 255, 127, 0.1)'
            e.currentTarget.style.borderColor = 'rgba(0, 255, 127, 0.3)'
            e.currentTarget.style.transform = 'translateY(-2px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
            e.currentTarget.style.transform = 'translateY(0)'
          }}>
            ← Back to Wallet
          </Link>
          
          <h1 style={{
            fontSize: '24px',
            fontWeight: '700',
            color: '#ffffff',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            margin: 0
          }}>My Credentials</h1>
        </div>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px'
        }}>
          <div style={{
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '14px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            {credentials.length} credential{credentials.length !== 1 ? 's' : ''}
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.7 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '14px',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>Your verified digital credentials</span>
          </div>
        </div>
      </div>
      
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '120px 30px 60px',
        position: 'relative'
      }}>

        {credentials.length === 0 ? (
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '24px',
            padding: '60px 40px',
            textAlign: 'center',
            transformStyle: 'preserve-3d',
            transition: 'all 0.6s cubic-bezier(0.23, 1, 0.320, 1)'
          }}>
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" style={{ 
              margin: '0 auto 30px',
              opacity: 0.6,
              filter: 'drop-shadow(0 10px 20px rgba(0, 255, 127, 0.3))'
            }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#00ff7f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="14,2 14,8 20,8" stroke="#00ff7f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="16" y1="13" x2="8" y2="13" stroke="#00ff7f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="16" y1="17" x2="8" y2="17" stroke="#00ff7f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h2 style={{
              fontSize: '28px',
              fontWeight: '700',
              color: '#ffffff',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              margin: '0 0 20px 0',
              background: 'linear-gradient(135deg, #00ff7f 0%, #00d4aa 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>No Credentials Yet</h2>
            <p style={{
              fontSize: '16px',
              color: 'rgba(255, 255, 255, 0.7)',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              lineHeight: '1.6',
              maxWidth: '400px',
              margin: '0 auto 30px auto'
            }}>
              You haven't received any credentials yet. Credentials will appear here 
              once you accept them from issuers in your notifications.
            </p>
            <Link href="/notifications" style={{ textDecoration: 'none' }}>
              <button style={{
                padding: '14px 28px',
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
              }}>
                Check Notifications
              </button>
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            {credentials.map((credential) => (
              <div key={credential.id} style={{
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '24px',
                padding: '30px',
                transformStyle: 'preserve-3d',
                transition: 'all 0.6s cubic-bezier(0.23, 1, 0.320, 1)',
                position: 'relative',
                overflow: 'hidden',
                opacity: credential.hidden ? 0.6 : 1,
                ...(credential.hidden && {
                  borderColor: 'rgba(255, 255, 255, 0.05)',
                  background: 'rgba(255, 255, 255, 0.02)'
                })
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px) rotateX(2deg) rotateY(2deg)'
                e.currentTarget.style.boxShadow = '0 25px 50px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 255, 127, 0.2)'
                e.currentTarget.style.borderColor = 'rgba(0, 255, 127, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) rotateX(0) rotateY(0)'
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.borderColor = credential.hidden ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.1)'
              }}>
                {credential.hidden && (
                  <div style={{
                    marginBottom: '20px',
                    padding: '12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    textAlign: 'center',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <span style={{
                      fontSize: '14px',
                      color: 'rgba(255, 255, 255, 0.6)',
                      fontFamily: 'system-ui, -apple-system, sans-serif'
                    }}>🙈 Hidden Credential</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '25px' }}>
                  <div style={{ flexShrink: 0 }}>
                    <div style={{
                      width: '70px',
                      height: '70px',
                      background: 'rgba(0, 255, 127, 0.1)',
                      borderRadius: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(0, 255, 127, 0.2)',
                      backdropFilter: 'blur(10px)'
                    }}>
                      {(() => {
                        const type = credential.type.toLowerCase();
                        if (type.includes('gaming') || type.includes('vr')) {
                          return <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" stroke="#00ff7f" strokeWidth="2"/>
                            <line x1="8" y1="21" x2="16" y2="21" stroke="#00ff7f" strokeWidth="2"/>
                            <line x1="12" y1="17" x2="12" y2="21" stroke="#00ff7f" strokeWidth="2"/>
                          </svg>
                        } else if (type.includes('education') || type.includes('diploma')) {
                          return <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                            <path d="M22 10v6M2 10l10-5 10 5-10 5z" stroke="#00ff7f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M6 12v5c3 3 9 3 12 0v-5" stroke="#00ff7f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        } else if (type.includes('identity') || type.includes('id')) {
                          return <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="#00ff7f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <circle cx="12" cy="7" r="4" stroke="#00ff7f" strokeWidth="2"/>
                          </svg>
                        } else if (type.includes('membership')) {
                          return <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#00ff7f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <circle cx="9" cy="7" r="4" stroke="#00ff7f" strokeWidth="2"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="#00ff7f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="#00ff7f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        } else {
                          return <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#00ff7f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <polyline points="14,2 14,8 20,8" stroke="#00ff7f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <line x1="16" y1="13" x2="8" y2="13" stroke="#00ff7f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <line x1="16" y1="17" x2="8" y2="17" stroke="#00ff7f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        }
                      })()}
                    </div>
                  </div>
                  
                  <div style={{ flexGrow: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '25px' }}>
                      <div style={{ flexGrow: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '12px' }}>
                          {editingCredential === credential.id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexGrow: 1 }}>
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                placeholder="Enter credential name..."
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUpdateDisplayName(credential.id, editingName)
                                  } else if (e.key === 'Escape') {
                                    cancelEditing()
                                  }
                                }}
                                style={{
                                  flexGrow: 1,
                                  padding: '10px 16px',
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  border: '1px solid rgba(255, 255, 255, 0.2)',
                                  borderRadius: '12px',
                                  color: '#ffffff',
                                  fontSize: '16px',
                                  fontFamily: 'system-ui, -apple-system, sans-serif',
                                  outline: 'none',
                                  transition: 'all 0.3s ease'
                                }}
                              />
                              <button
                                onClick={() => handleUpdateDisplayName(credential.id, editingName)}
                                style={{
                                  padding: '8px 12px',
                                  background: 'linear-gradient(135deg, #00ff7f 0%, #00d4aa 100%)',
                                  border: 'none',
                                  borderRadius: '8px',
                                  color: '#000000',
                                  fontSize: '16px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  transition: 'all 0.3s ease'
                                }}
                              >
                                ✓
                              </button>
                              <button
                                onClick={cancelEditing}
                                style={{
                                  padding: '8px 12px',
                                  background: 'rgba(255, 255, 255, 0.1)',
                                  border: '1px solid rgba(255, 255, 255, 0.2)',
                                  borderRadius: '8px',
                                  color: '#ffffff',
                                  fontSize: '16px',
                                  cursor: 'pointer',
                                  transition: 'all 0.3s ease'
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <>
                              <h3 style={{
                                fontSize: '24px',
                                fontWeight: '600',
                                color: '#ffffff',
                                fontFamily: 'system-ui, -apple-system, sans-serif',
                                margin: 0
                              }}>
                                {credential.displayName || credential.type}
                              </h3>
                              <button
                                onClick={() => startEditing(credential)}
                                style={{
                                  padding: '4px 8px',
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'rgba(255, 255, 255, 0.5)',
                                  fontSize: '14px',
                                  cursor: 'pointer',
                                  borderRadius: '6px',
                                  transition: 'all 0.3s ease',
                                  fontFamily: 'system-ui, -apple-system, sans-serif'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = '#00ff7f'
                                  e.currentTarget.style.background = 'rgba(0, 255, 127, 0.1)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)'
                                  e.currentTarget.style.background = 'transparent'
                                }}
                              >
                                ✏️ Edit
                              </button>
                            </>
                          )}
                          {credential.source === 'didcomm' && (
                            <span style={{
                              padding: '4px 12px',
                              background: 'rgba(0, 255, 127, 0.1)',
                              color: '#00ff7f',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '500',
                              fontFamily: 'system-ui, -apple-system, sans-serif',
                              border: '1px solid rgba(0, 255, 127, 0.3)'
                            }}>
                              DIDComm
                            </span>
                          )}
                        </div>
                        {credential.displayName && credential.displayName !== credential.type && (
                          <p style={{
                            fontSize: '14px',
                            color: 'rgba(255, 255, 255, 0.5)',
                            fontFamily: 'system-ui, -apple-system, sans-serif',
                            margin: '0 0 8px 0'
                          }}>
                            Original type: {credential.type}
                          </p>
                        )}
                        <p style={{
                          fontSize: '16px',
                          color: 'rgba(255, 255, 255, 0.7)',
                          fontFamily: 'system-ui, -apple-system, sans-serif',
                          margin: '0 0 8px 0'
                        }}>
                          Issued by: {credential.issuer}
                        </p>
                        <p style={{
                          fontSize: '14px',
                          color: 'rgba(255, 255, 255, 0.5)',
                          fontFamily: 'system-ui, -apple-system, sans-serif',
                          margin: 0
                        }}>
                          {new Date(credential.issuedDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: credential.hidden ? 'rgba(255, 255, 255, 0.3)' : '#00ff7f'
                        }}></div>
                        {credential.hidden ? (
                          <button 
                            onClick={() => handleUnhideCredential(credential)}
                            style={{
                              padding: '8px 16px',
                              background: 'linear-gradient(135deg, #00ff7f 0%, #00d4aa 100%)',
                              border: 'none',
                              borderRadius: '12px',
                              color: '#000000',
                              fontSize: '14px',
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
                            👁️ Unhide
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleHideCredential(credential)}
                            style={{
                              padding: '8px 16px',
                              background: 'rgba(255, 255, 255, 0.1)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              borderRadius: '12px',
                              color: '#ffffff',
                              fontSize: '14px',
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
                            Remove
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{
                      background: 'rgba(0, 255, 127, 0.05)',
                      border: '1px solid rgba(0, 255, 127, 0.2)',
                      borderRadius: '16px',
                      padding: '20px'
                    }}>
                      <h4 style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: '#00ff7f',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        margin: '0 0 15px 0'
                      }}>Attributes</h4>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: '15px'
                      }}>
                        {Object.entries(credential.attributes).map(([key, value]) => (
                          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{
                              color: 'rgba(255, 255, 255, 0.7)',
                              textTransform: 'capitalize',
                              fontFamily: 'system-ui, -apple-system, sans-serif',
                              fontSize: '14px'
                            }}>{key}:</span>
                            <span style={{
                              color: '#ffffff',
                              fontWeight: '500',
                              fontFamily: 'system-ui, -apple-system, sans-serif',
                              fontSize: '14px',
                              textAlign: 'right',
                              maxWidth: '200px',
                              wordBreak: 'break-word'
                            }}>{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {credential.credentialDefinitionId && (
                      <div style={{ marginTop: '20px' }}>
                        <h4 style={{
                          fontSize: '14px',
                          fontWeight: '500',
                          color: 'rgba(255, 255, 255, 0.7)',
                          fontFamily: 'system-ui, -apple-system, sans-serif',
                          margin: '0 0 8px 0'
                        }}>Credential Definition ID</h4>
                        <p style={{
                          fontFamily: 'Monaco, Consolas, monospace',
                          fontSize: '12px',
                          color: 'rgba(255, 255, 255, 0.5)',
                          wordBreak: 'break-all',
                          margin: 0,
                          padding: '8px 12px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '8px',
                          border: '1px solid rgba(255, 255, 255, 0.1)'
                        }}>
                          {credential.credentialDefinitionId}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}