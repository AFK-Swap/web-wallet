'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { VRButton } from '@/components/VRButton'
import { VRCard } from '@/components/VRCard'
import { StatusIndicator } from '@/components/StatusIndicator'
import { LoginForm } from '@/components/LoginForm'
import { DIDCommConnection } from '@/components/DIDCommConnection'
import { MinecraftConnection } from '@/components/MinecraftConnection'
import { VRWalletAgent } from '@/lib/wallet-agent'
import { authenticateUser, registerUser, getUserCredentials, storeCredential } from '@/lib/couchdb-auth'
import { deriveEncryptionKey, decryptCredential, encryptCredential } from '@/lib/encryption'
import { walletAgentEndpoints } from '@/lib/wallet-config'
import type { WalletStats } from '@/lib/types'

export default function Dashboard() {
  const [walletAgent] = useState(() => VRWalletAgent.getInstance())
  const [stats, setStats] = useState<WalletStats>({
    connections: 0,
    credentials: 0,
    proofs: 0,
    isInitialized: false,
    isConnected: false
  })
  const [notificationCount, setNotificationCount] = useState(0)
  const [isInitializing, setIsInitializing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(true) // Bypassed for development
  const [user, setUser] = useState<{ username: string; password: string } | null>({ username: 'dev-user', password: 'dev-pass' })
  const [loading, setLoading] = useState(false)
  const [showDIDCommConnection, setShowDIDCommConnection] = useState(false)
  const [showMinecraftConnection, setShowMinecraftConnection] = useState(false)
  const [showMinecraftInvitation, setShowMinecraftInvitation] = useState(false)
  const [invitationUrl, setInvitationUrl] = useState('')
  const [invitationLoading, setInvitationLoading] = useState(false)
  const [activeConnections, setActiveConnections] = useState<string[]>([])

  // Load saved session on component mount - BYPASSED FOR DEVELOPMENT
  useEffect(() => {
    // const savedSession = localStorage.getItem('ssi_wallet_session')
    const savedConnections = localStorage.getItem('web_wallet_connections')

    // Authentication bypassed - always authenticated in dev mode
    // if (savedSession) {
    //   try {
    //     const session = JSON.parse(savedSession)
    //     if (session.username && session.password && session.expiresAt > Date.now()) {
    //       setUser({ username: session.username, password: session.password })
    //       setIsAuthenticated(true)
    //     } else {
    //       // Session expired, clear it
    //       localStorage.removeItem('ssi_wallet_session')
    //     }
    //   } catch (error) {
    //     console.error('Failed to load saved session:', error)
    //     localStorage.removeItem('ssi_wallet_session')
    //   }
    // }

    // Load saved connections
    if (savedConnections) {
      try {
        const connections = JSON.parse(savedConnections)
        setActiveConnections(connections)
      } catch (error) {
        console.error('Failed to load saved connections:', error)
      }
    }

  }, [])

  useEffect(() => {
    loadWalletStats()
    loadNotificationCount()
    // Poll for updates every 3 seconds (more frequent for better UX)
    const interval = setInterval(() => {
      loadWalletStats()
      loadNotificationCount()
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const loadWalletStats = async () => {
    try {
      // Get credentials from Alice storage via API
      const response = await fetch('/api/credentials')
      const result = await response.json()
      
      const credentialCount = result.success ? result.count : 0
      
      setStats({
        connections: activeConnections.length,
        credentials: credentialCount,
        proofs: 0, // Will implement later
        isInitialized: true,
        isConnected: activeConnections.length > 0
      })
    } catch (error) {
      console.error('Failed to load wallet stats:', error)
      setError(error instanceof Error ? error.message : 'Unknown error')
    }
  }

  const loadNotificationCount = async () => {
    try {
      // Get notifications from API
      const response = await fetch('/api/notifications')
      if (response.ok) {
        const data = await response.json()
        const pendingNotifications = (data.notifications || []).filter(
          (notification: any) => notification.status === 'pending'
        )
        const currentCount = notificationCount
        const newCount = pendingNotifications.length
        setNotificationCount(newCount)
        
        if (newCount !== currentCount) {
          console.log(`🔔 [Notifications] Count updated: ${currentCount} → ${newCount}`)
        }
      }
    } catch (error) {
      console.error('Failed to load notification count:', error)
    }
  }

  const handleLogin = async (username: string, password: string): Promise<boolean> => {
    setLoading(true)
    try {
      const success = await authenticateUser(username, password)
      if (success) {
        setUser({ username, password })
        setIsAuthenticated(true)
        setError(null)
        
        // Save session to localStorage (expires in 24 hours)
        const session = {
          username,
          password,
          expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        }
        localStorage.setItem('ssi_wallet_session', JSON.stringify(session))
        
        
        return true
      }
      return false
    } catch (error) {
      console.error('Login error:', error)
      return false
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (username: string, password: string): Promise<boolean> => {
    setLoading(true)
    try {
      const success = await registerUser(username, password)
      if (success) {
        return true
      }
      return false
    } catch (error) {
      console.error('Registration error:', error)
      return false
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setUser(null)
    setStats({
      connections: 0,
      credentials: 0,
      proofs: 0,
      isInitialized: false,
      isConnected: false
    })
    setNotificationCount(0)
    setError(null)
    setActiveConnections([])
    
    // Clear saved session and connections
    localStorage.removeItem('ssi_wallet_session')
    localStorage.removeItem('web_wallet_connections')
    
    // Clear any polling intervals
    activeConnections.forEach(connectionId => {
      const pollIntervalId = localStorage.getItem(`polling_${connectionId}`)
      if (pollIntervalId) {
        clearInterval(parseInt(pollIntervalId))
        localStorage.removeItem(`polling_${connectionId}`)
      }
    })
  }

  const handleDIDCommConnection = (connectionId: string) => {
    setActiveConnections(prev => [...prev, connectionId])
    localStorage.setItem('web_wallet_connections', JSON.stringify([...activeConnections, connectionId]))
    setShowDIDCommConnection(false)
    console.log('DIDComm connection established:', connectionId)
    // Credential polling disabled - SSI tutorial interface handles credential issuance
    // startCredentialPolling(connectionId)
    console.log('Note: Credential polling disabled to prevent duplicates - SSI tutorial handles issuance')
  }

  const handleAcceptMinecraftInvitation = async () => {
    console.log('🎮 [DEBUG] Process Invitation button clicked!')
    console.log('🎮 [DEBUG] Invitation URL:', invitationUrl.trim())
    alert('🎮 Button clicked! Check console for details.')
    
    if (!invitationUrl.trim()) {
      console.log('🎮 [DEBUG] No invitation URL provided')
      alert('❌ Please paste an invitation URL first')
      return
    }

    console.log('🎮 [DEBUG] Setting invitation loading to true')
    setInvitationLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/accept-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitationUrl: invitationUrl.trim(),
          username: 'alice' // Use default username since no authentication needed with Alice storage
        })
      })

      const result = await response.json()

      if (result.success) {
        console.log('✅ Minecraft invitation processed:', result.data?.minecraftCommand)
        
        // Show success message with Minecraft command
        alert(`Success! Use this command in Minecraft:\n\n${result.data?.minecraftCommand || 'Command not available'}`)
        
        setInvitationUrl('')
        setShowMinecraftInvitation(false)
        
      } else {
        throw new Error(result.error || 'Failed to process invitation')
      }
    } catch (error) {
      console.error('❌ Accept invitation error:', error)
      setError(error instanceof Error ? error.message : 'Failed to accept invitation')
    } finally {
      setInvitationLoading(false)
    }
  }

  const startCredentialPolling = async (connectionId: string) => {
    if (!user) return

    console.log('Starting credential polling for connection:', connectionId)
    
    const pollForCredentials = async () => {
      try {
        // Check for any credential records for this connection from ACA-Py
        const response = await fetch(walletAgentEndpoints.credentialRecords())
        
        if (response.ok) {
          const data = await response.json()
          const records = data.results || []
          
          // Filter for records from our connection that have offers (regardless of auto-accept state)
          const connectionRecords = records.filter(record => 
            record.cred_ex_record?.connection_id === connectionId &&
            record.cred_ex_record?.cred_offer &&
            // Accept credentials in any state that indicates an offer was made
            ['offer-sent', 'request-sent', 'credential-issued', 'done'].includes(record.cred_ex_record?.state) &&
            !localStorage.getItem(`processed_${record.cred_ex_record.cred_ex_id}`)
          )
          
          for (const record of connectionRecords) {
            console.log('Found credential record:', record.cred_ex_record.cred_ex_id)
            
            // Check server-side credential tracking to prevent cross-session duplicates
            try {
              const trackingResponse = await fetch(`/api/credential-tracking?connectionId=${connectionId}&credentialType=john-doe-identity`)
              const trackingData = await trackingResponse.json()
              
              if (trackingData.success && trackingData.alreadyIssued) {
                console.log(`✅ John Doe credential already processed for connection ${connectionId} at ${trackingData.issuedAt}`)
                console.log('Skipping duplicate credential processing via web wallet polling')
                localStorage.setItem(`processed_${record.cred_ex_record.cred_ex_id}`, 'true')
                continue
              }
            } catch (error) {
              console.error('❌ Error checking credential tracking:', error)
              // Continue with local duplicate check as fallback
            }
            
            // Fallback: Create a unique hash of the credential content to prevent duplicate processing
            const credentialPreview = record.cred_ex_record.cred_offer?.credential_preview || {}
            const attributes = credentialPreview.attributes || []
            const contentHash = btoa(JSON.stringify(attributes.map(attr => `${attr.name}:${attr.value}`).sort().join('|')))
            
            // Check if we've already processed this exact credential content
            const contentKey = `content_${connectionId}_${contentHash}`
            if (localStorage.getItem(contentKey)) {
              console.log('⚠️ Skipping duplicate credential content:', record.cred_ex_record.cred_ex_id)
              localStorage.setItem(`processed_${record.cred_ex_record.cred_ex_id}`, 'true')
              continue
            }
            
            await handleCredentialOffer(record.cred_ex_record)
            
            // Record the credential processing in server-side tracking
            try {
              await fetch('/api/credential-tracking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  connectionId: connectionId,
                  credentialType: 'john-doe-identity',
                  exchangeId: record.cred_ex_record.cred_ex_id
                })
              })
              console.log(`✅ Recorded credential processing for connection ${connectionId}`)
            } catch (error) {
              console.error('❌ Error recording credential tracking:', error)
            }
            
            // Mark both the exchange ID and content as processed
            localStorage.setItem(`processed_${record.cred_ex_record.cred_ex_id}`, 'true')
            localStorage.setItem(contentKey, 'true')
          }
        }

        // Check for proof requests requiring manual approval
        const proofResponse = await fetch(walletAgentEndpoints.proofRecords())
        if (proofResponse.ok) {
          const proofData = await proofResponse.json()
          const proofRecords = proofData.results || []
          
          // Filter for proof requests from our connection that need manual approval
          const connectionProofRequests = proofRecords.filter(record => 
            record.connection_id === connectionId &&
            record.role === 'prover' &&
            record.initiator === 'external' &&
            record.state === 'request-received' &&
            !localStorage.getItem(`processed_proof_${record.pres_ex_id}`)
          )
          
          for (const proofRecord of connectionProofRequests) {
            console.log('Found proof request requiring manual approval:', proofRecord.pres_ex_id)
            await handleProofRequest(proofRecord)
            localStorage.setItem(`processed_proof_${proofRecord.pres_ex_id}`, 'true')
          }
        }
        
      } catch (error) {
        console.error('Error polling for credentials and proof requests:', error)
      }
    }

    // Poll every 3 seconds for new credential offers
    const pollInterval = setInterval(pollForCredentials, 3000)
    
    // Stop polling after 10 minutes to avoid memory leaks
    setTimeout(() => {
      clearInterval(pollInterval)
      console.log('Stopped credential polling for connection:', connectionId)
    }, 600000)
    
    // Store the interval ID for cleanup
    localStorage.setItem(`polling_${connectionId}`, pollInterval.toString())
  }

  const handleCredentialOffer = async (offer: any) => {
    if (!user) return

    try {
      console.log('Processing credential offer:', offer)
      
      // Extract credential preview from the ACA-Py record
      const credentialPreview = offer.cred_offer?.credential_preview || {}
      const attributes = credentialPreview.attributes || []

      // Create notification for the credential offer
      const notification = {
        id: `credential-offer-${offer.cred_ex_id}`,
        type: 'credential-offer',
        title: 'New Credential Offer',
        message: 'You have received a credential offer via DIDComm',
        timestamp: new Date().toISOString(),
        credentialData: {
          credentialPreview: {
            attributes: attributes
          }
        },
        status: 'pending',
        exchangeId: offer.cred_ex_id,
        connectionId: offer.connection_id
      }

      // Store notification
      await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notification)
      })

      console.log('Credential offer notification created')
      
      // Refresh notification count immediately
      await loadNotificationCount()

    } catch (error) {
      console.error('Error handling credential offer:', error)
    }
  }

  const handleProofRequest = async (proofRecord: any) => {
    if (!user) return

    try {
      console.log('Processing proof request:', proofRecord.pres_ex_id)
      
      // Extract proof request details
      const proofRequest = proofRecord.pres_request || {}
      const requestedAttributes = proofRecord.by_format?.pres_request?.indy?.requested_attributes || {}
      const requestedPredicates = proofRecord.by_format?.pres_request?.indy?.requested_predicates || {}

      // Only create notifications for new proof requests requiring manual approval
      const title = 'New Proof Request'
      const message = 'Server is requesting proof of your credentials'
      const status = 'pending'

      // Create notification for the proof request
      const notification = {
        id: `proof-request-${proofRecord.pres_ex_id}`,
        type: 'proof-request',
        title: title,
        message: message,
        timestamp: new Date().toISOString(),
        proofData: {
          proofName: proofRecord.by_format?.pres_request?.indy?.name || 'Verification Request',
          requestedAttributes: Object.keys(requestedAttributes),
          requestedPredicates: Object.keys(requestedPredicates),
          connectionId: proofRecord.connection_id,
          state: proofRecord.state
        },
        status: status,
        exchangeId: proofRecord.pres_ex_id,
        connectionId: proofRecord.connection_id
      }

      // Store notification
      await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notification)
      })

      console.log('Proof request notification created')
      
      // Refresh notification count immediately
      await loadNotificationCount()

    } catch (error) {
      console.error('Error handling proof request:', error)
    }
  }

  const initializeWallet = async () => {
    setIsInitializing(true)
    setError(null)
    
    try {
      await walletAgent.initialize()
      await loadWalletStats()
    } catch (error) {
      console.error('Failed to initialize wallet:', error)
      setError(error instanceof Error ? error.message : 'Failed to initialize wallet')
    } finally {
      setIsInitializing(false)
    }
  }

  const getConnectionStatus = (): 'online' | 'offline' | 'pending' => {
    if (isInitializing) return 'pending'
    if (!stats.isInitialized) return 'offline'
    return stats.isConnected ? 'online' : 'offline'
  }

  const getStatusLabel = (): string => {
    if (isInitializing) return 'Initializing...'
    if (!stats.isInitialized) return 'Not initialized'
    return stats.isConnected ? 'Connected' : 'Ready'
  }

  // Authentication required - show login form if not authenticated
  return !isAuthenticated ? (
    <LoginForm 
      onLogin={handleLogin} 
      onRegister={handleRegister} 
      loading={loading}
    />
  ) : (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #0f0f0f 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      {/* Header */}
      <header style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '80px',
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 40px',
        transition: 'all 0.3s ease'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer',
          transition: 'transform 0.3s ease'
        }}
        onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
        onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
        >
          <div style={{
            width: '50px',
            height: '50px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
              <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#667eea', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: '#764ba2', stopOpacity: 1 }} />
                </linearGradient>
              </defs>
              <rect x="10" y="25" width="15" height="50" fill="url(#grad1)" transform="rotate(-15 17.5 50)" />
              <rect x="35" y="15" width="15" height="70" fill="url(#grad1)" />
              <rect x="60" y="25" width="15" height="50" fill="url(#grad1)" transform="rotate(15 67.5 50)" />
              <circle cx="50" cy="50" r="45" fill="none" stroke="url(#grad1)" strokeWidth="2" opacity="0.5" />
            </svg>
          </div>
          <div style={{
            color: 'white',
            fontSize: '24px',
            fontWeight: 600,
            letterSpacing: '-0.5px'
          }}>
            SSI Web Wallet
          </div>
        </div>
        
        <button
          onClick={handleLogout}
          style={{
            color: 'rgba(255, 255, 255, 0.8)',
            textDecoration: 'none',
            fontSize: '16px',
            fontWeight: 500,
            transition: 'all 0.3s ease',
            position: 'relative',
            padding: '8px 16px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '6px'
          }}
          onMouseEnter={(e) => {
            e.target.style.color = 'white'
            e.target.style.transform = 'translateY(-2px)'
            e.target.style.background = 'rgba(255, 255, 255, 0.1)'
          }}
          onMouseLeave={(e) => {
            e.target.style.color = 'rgba(255, 255, 255, 0.8)'
            e.target.style.transform = 'translateY(0)'
            e.target.style.background = 'none'
          }}
        >
          {user?.username} • Logout
        </button>
      </header>

      <div style={{ paddingTop: '80px', padding: '20px' }}>

        {/* Error State */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            borderRadius: '1rem',
            padding: '2rem',
            marginBottom: '2rem',
            backdropFilter: 'blur(10px)'
          }}>
            <div className="text-center">
              <h3 className="text-xl font-semibold text-red-400 mb-4">Error</h3>
              <p className="text-gray-300 mb-6">{error}</p>
              <button
                onClick={() => setError(null)}
                style={{
                  background: 'linear-gradient(45deg, #dc2626, #991b1b)',
                  border: 'none',
                  borderRadius: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Initialization State */}
        {!stats.isInitialized && !error && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '1rem',
            padding: '3rem',
            textAlign: 'center',
            marginBottom: '2rem',
            maxWidth: '32rem',
            margin: '0 auto'
          }}>
            <h2 className="text-2xl font-bold text-white mb-6">Initialize Wallet</h2>
            <p className="text-gray-400 mb-8">
              Set up your secure digital identity wallet to begin managing credentials and verifications.
            </p>
            <button
              onClick={initializeWallet}
              disabled={isInitializing}
              style={{
                background: 'linear-gradient(45deg, #00ff88, #0099ff)',
                border: 'none',
                borderRadius: '0.5rem',
                padding: '1rem 2rem',
                color: '#000',
                cursor: isInitializing ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '1.1rem',
                width: '100%',
                opacity: isInitializing ? 0.5 : 1
              }}
            >
              {isInitializing ? 'Initializing...' : 'Initialize Wallet'}
            </button>
          </div>
        )}

        {/* Main Content - Only show if initialized */}
        {stats.isInitialized && (
          <>
            {/* App Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '30px',
              maxWidth: '1200px',
              margin: '120px auto',
              padding: '0 40px',
              perspective: '1200px'
            }}>
              
              {/* Notifications App */}
              <Link href="/notifications" style={{ textDecoration: 'none' }}>
                <div style={{
                  position: 'relative',
                  cursor: 'pointer',
                  width: '100%',
                  aspectRatio: '1',
                  transformStyle: 'preserve-3d',
                  transition: 'all 0.6s cubic-bezier(0.23, 1, 0.320, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-20px) rotateX(5deg) rotateY(5deg)'
                  e.currentTarget.style.filter = 'drop-shadow(0 25px 35px rgba(0, 0, 0, 0.5))'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) rotateX(0) rotateY(0)'
                  e.currentTarget.style.filter = 'drop-shadow(0 15px 25px rgba(0, 0, 0, 0.3))'
                }}
                >
                  {notificationCount > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '-8px',
                      background: 'linear-gradient(135deg, #ff416c, #ff4b2b)',
                      color: 'white',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      zIndex: 10,
                      boxShadow: '0 4px 15px rgba(255, 65, 108, 0.4)',
                      animation: 'pulse 2s infinite'
                    }}>
                      {notificationCount}
                    </div>
                  )}
                  <div style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '20px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 15px 25px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.08)'
                    e.target.style.borderColor = 'rgba(102, 126, 234, 0.5)'
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.05)'
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                  }}
                  >
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1))',
                      opacity: 0,
                      transition: 'opacity 0.3s ease'
                    }}
                    onMouseEnter={(e) => e.target.style.opacity = '1'}
                    onMouseLeave={(e) => e.target.style.opacity = '0'}
                    />
                    <svg style={{ width: '48px', height: '48px', color: 'white', marginBottom: '12px', opacity: 0.9 }} fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
                    </svg>
                    <span style={{
                      color: 'white',
                      fontSize: '16px',
                      fontWeight: 600,
                      textAlign: 'center',
                      letterSpacing: '-0.3px'
                    }}>
                      Notifications
                    </span>
                  </div>
                </div>
              </Link>

              {/* Helper function for creating app cards */}
              {(() => {
                const createAppCard = (href, onClick, icon, title, subtitle, hasGradient = false) => {
                  const Card = ({ children }) => (
                    <div style={{
                      position: 'relative',
                      cursor: 'pointer',
                      width: '100%',
                      aspectRatio: '1',
                      transformStyle: 'preserve-3d',
                      transition: 'all 0.6s cubic-bezier(0.23, 1, 0.320, 1)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-20px) rotateX(5deg) rotateY(5deg)'
                      e.currentTarget.style.filter = 'drop-shadow(0 25px 35px rgba(0, 0, 0, 0.5))'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0) rotateX(0) rotateY(0)'
                      e.currentTarget.style.filter = 'drop-shadow(0 15px 25px rgba(0, 0, 0, 0.3))'
                    }}
                    onClick={onClick}
                    >
                      <div style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '20px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 15px 25px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = 'rgba(255, 255, 255, 0.08)'
                        e.target.style.borderColor = 'rgba(102, 126, 234, 0.5)'
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'rgba(255, 255, 255, 0.05)'
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                      }}
                      >
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: hasGradient ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1))' : 'linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1))',
                          opacity: 0,
                          transition: 'opacity 0.3s ease'
                        }}
                        onMouseEnter={(e) => e.target.style.opacity = '1'}
                        onMouseLeave={(e) => e.target.style.opacity = '0'}
                        />
                        {icon}
                        <span style={{
                          color: 'white',
                          fontSize: '16px',
                          fontWeight: 600,
                          textAlign: 'center',
                          letterSpacing: '-0.3px',
                          marginBottom: subtitle ? '4px' : '0'
                        }}>
                          {title}
                        </span>
                        {subtitle && (
                          <span style={{
                            color: 'rgba(255, 255, 255, 0.7)',
                            fontSize: '12px',
                            fontWeight: 400,
                            textAlign: 'center'
                          }}>
                            {subtitle}
                          </span>
                        )}
                      </div>
                    </div>
                  );

                  return href ? (
                    <Link href={href} style={{ textDecoration: 'none' }} key={title}>
                      <Card />
                    </Link>
                  ) : (
                    <Card key={title} />
                  );
                };

                return [
                  createAppCard(
                    '/credentials',
                    null,
                    <svg style={{ width: '48px', height: '48px', color: 'white', marginBottom: '12px', opacity: 0.9 }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v8H4V6z" clipRule="evenodd"/>
                      <path d="M4 8h12v2H4V8z"/>
                    </svg>,
                    'Credentials',
                    `${stats.credentials} stored`
                  ),
                  createAppCard(
                    null,
                    () => setShowDIDCommConnection(true),
                    <svg style={{ width: '48px', height: '48px', color: 'white', marginBottom: '12px', opacity: 0.9 }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd"/>
                    </svg>,
                    'Connect',
                    stats.isConnected ? 'Online' : 'DIDcomm'
                  )
                ];
              })()}

            </div>

          </>
        )}


        {/* Footer */}
        <footer style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          textAlign: 'center',
          padding: '16px',
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div className="flex items-center justify-center space-x-6 text-sm text-gray-500 mb-2">
            <span>Aries Framework</span>
            <span>•</span>
            <span>DIDComm Protocol</span>
            <span>•</span>
            <span>W3C Standards</span>
          </div>
          <p className="text-xs text-gray-600">
            Secure • Private • Decentralized
          </p>
        </footer>
      </div>

      {/* DIDComm Connection Modal */}
      {showDIDCommConnection && (
        <DIDCommConnection 
          onConnectionEstablished={handleDIDCommConnection}
          onClose={() => setShowDIDCommConnection(false)}
        />
      )}

      {/* Minecraft Connection Modal */}
      {showMinecraftConnection && (
        <MinecraftConnection 
          username={user?.username || "user"}
          onClose={() => setShowMinecraftConnection(false)}
        />
      )}
    </div>
  )
}