'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { VRButton } from '@/components/VRButton'
import { VRCard } from '@/components/VRCard'
import { VRWalletAgent } from '@/lib/wallet-agent'
import { deriveEncryptionKey, decryptAttributeValue } from '@/lib/encryption'

interface Notification {
  id: string
  type: 'credential-offer' | 'proof-request' | 'credential-share'
  title: string
  message: string
  timestamp: string
  credentialData?: any
  proofRequestData?: any
  rawMessage?: any
  status: 'pending' | 'accepted' | 'declined'
  connectionId?: string
}


// Helper function to detect base64-encoded encrypted values
function isBase64Encrypted(value: string): boolean {
  try {
    const decodedValue = atob(value);
    const parsedValue = JSON.parse(decodedValue);
    return parsedValue && parsedValue.encrypted_data && parsedValue.iv;
  } catch (e) {
    return false;
  }
}

// Helper function to detect any encrypted value format
function isEncryptedValue(value: string): boolean {
  // Check for base64 encrypted format
  if (isBase64Encrypted(value)) return true;
  
  // Check for direct JSON encrypted format
  try {
    const parsedValue = JSON.parse(value);
    return parsedValue && parsedValue.encrypted_data && parsedValue.iv;
  } catch (e) {
    return false;
  }
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedProofRequest, setExpandedProofRequest] = useState<string | null>(null)
  const [selectedCredential, setSelectedCredential] = useState<{ [key: string]: string }>({})
  const [user, setUser] = useState<{ username: string; password: string } | null>(null)
  const [decryptedAttributes, setDecryptedAttributes] = useState<{ [notificationId: string]: { [attributeName: string]: string } }>({})

  useEffect(() => {
    // Load saved session on component mount
    const savedSession = localStorage.getItem('ssi_wallet_session')
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession)
        if (session.username && session.password && session.expiresAt > Date.now()) {
          setUser({ username: session.username, password: session.password })
        } else {
          // Session expired, clear it but don't redirect
          localStorage.removeItem('ssi_wallet_session')
        }
      } catch (error) {
        console.error('Failed to load saved session:', error)
        localStorage.removeItem('ssi_wallet_session')
      }
    }
    
    loadNotifications()

    // DISABLED: Auto-poll for proof requests every 5 seconds
    // const interval = setInterval(loadNotifications, 5000)
    // return () => clearInterval(interval)
  }, [])

  // Decrypt attributes when user logs in and notifications are loaded
  useEffect(() => {
    if (user && notifications.length > 0) {
      decryptNotificationAttributes()
    }
  }, [user, notifications])

  const decryptNotificationAttributes = async () => {
    if (!user) return
    
    try {
      const encryptionKey = await deriveEncryptionKey(user.password, user.username)
      const newDecryptedAttributes: { [notificationId: string]: { [attributeName: string]: string } } = {}
      
      for (const notification of notifications) {
        if (notification.type === 'credential-offer' && notification.credentialData?.credentialPreview?.attributes) {
          const decryptedAttrs: { [attributeName: string]: string } = {}
          
          for (const attr of notification.credentialData.credentialPreview.attributes) {
            // Try to decrypt with wallet password - if it fails, show the encrypted value as-is
            if (isEncryptedValue(attr.value)) {
              try {
                console.log(`🔓 Attempting to decrypt ${attr.name} with wallet password`)
                const decryptedValue = await decryptAttributeValue(attr.value, encryptionKey)
                if (decryptedValue !== '[DECRYPTION FAILED]') {
                  decryptedAttrs[attr.name] = decryptedValue
                  console.log(`✅ Successfully decrypted ${attr.name}: ${decryptedValue}`)
                } else {
                  // Show that this is issuer-encrypted data we can't decrypt
                  decryptedAttrs[attr.name] = '[ISSUER ENCRYPTED - cannot decrypt with wallet key]'
                  console.log(`⚠️ ${attr.name} is encrypted by issuer, cannot decrypt with wallet key`)
                }
              } catch (error) {
                console.error(`❌ Failed to decrypt ${attr.name}:`, error.message)
                decryptedAttrs[attr.name] = '[ISSUER ENCRYPTED - decryption failed]'
              }
            } else {
              // Not encrypted, use original value (like issuer_did)
              decryptedAttrs[attr.name] = attr.value
              console.log(`📄 ${attr.name} is plain text: ${attr.value}`)
            }
          }
          
          newDecryptedAttributes[notification.id] = decryptedAttrs
        }
      }
      
      setDecryptedAttributes(newDecryptedAttributes)
    } catch (error) {
      console.error('Failed to decrypt notification attributes:', error)
    }
  }

  const loadNotifications = async () => {
    try {
      console.log('📱 Loading notifications from web wallet API');

      // DISABLED: Poll API no longer used - notifications are created on connection establishment
      // try {
      //   console.log('🔄 Calling poll-proof-requests API...');
      //   const pollResponse = await fetch('/api/poll-proof-requests');
      //   console.log(`📡 Poll API response status: ${pollResponse.status}`);
      //
      //   if (!pollResponse.ok) {
      //     const errorText = await pollResponse.text();
      //     console.error(`❌ Poll API failed: ${pollResponse.status} - ${errorText}`);
      //   } else {
      //     const pollData = await pollResponse.json();
      //     console.log(`✅ Poll API response:`, pollData);
      //     if (pollData.success && pollData.newNotifications > 0) {
      //       console.log(`🔍 Found ${pollData.newNotifications} new proof requests from Alice ACA-Py`);
      //     }
      //   }
      // } catch (error) {
      //   console.error('❌ Failed to poll proof requests:', error);
      // }

      // Load notifications directly from the web wallet API
      const response = await fetch('/api/notifications');
      const data = await response.json();
      
      if (data.success && data.notifications) {
        const notificationList = data.notifications.map((notification: any) => ({
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          timestamp: notification.timestamp,
          credentialData: notification.credentialData,
          proofRequestData: notification.proofRequestData,
          status: notification.status || 'pending'
        }));
        
        setNotifications(notificationList);
        
        console.log(`📱 Loaded ${notificationList.length} notifications from API`);
      } else {
        console.log('📱 No notifications found in API response');
        setNotifications([]);
      }
      
    } catch (error) {
      console.error('Failed to load notifications:', error)
      setNotifications([]);
    } finally {
      setLoading(false)
    }
  }


  const handleAccept = async (notification: Notification) => {
    try {
      if (notification.type === 'credential-share') {
        // For credential-share notifications, find the latest proof request and share credentials
        console.log('📤 Finding latest proof request to share credentials...');

        try {
          // Get the latest proof request from Alice
          const proofRecordsResponse = await fetch('http://localhost:8031/present-proof-2.0/records');
          if (!proofRecordsResponse.ok) {
            throw new Error('Failed to fetch proof requests from Alice');
          }

          const proofRecordsData = await proofRecordsResponse.json();
          const proofRecords = proofRecordsData.results || [];

          // Filter for pending proof requests on this connection
          const pendingProofs = proofRecords.filter((record: any) =>
            record.state === 'request-received' &&
            record.connection_id === notification.connectionId
          );

          if (pendingProofs.length === 0) {
            // Try all pending proofs if connection-specific search fails
            const allPendingProofs = proofRecords.filter((record: any) =>
              record.state === 'request-received'
            );

            if (allPendingProofs.length === 0) {
              alert('No pending proof requests found. Please wait for the verifier to send a request.');
              return;
            }

            // Use the most recent proof request
            const latestProof = allPendingProofs.sort((a: any, b: any) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];

            console.log(`Using latest proof request: ${latestProof.pres_ex_id}`);

            // Share credentials
            const shareResponse = await fetch('/api/respond-to-proof', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ pres_ex_id: latestProof.pres_ex_id })
            });

            if (shareResponse.ok) {
              console.log('✅ Credentials shared successfully');

              // Remove notification
              setNotifications(prev => prev.filter(n => n.id !== notification.id));
              alert('Credentials shared successfully!');
            } else {
              const error = await shareResponse.json();
              throw new Error(error.error || 'Failed to share credentials');
            }
          } else {
            // Use the most recent proof request for this connection
            const latestProof = pendingProofs.sort((a: any, b: any) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];

            console.log(`Sharing credentials for proof request: ${latestProof.pres_ex_id}`);

            // Share credentials
            const shareResponse = await fetch('/api/respond-to-proof', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ pres_ex_id: latestProof.pres_ex_id })
            });

            if (shareResponse.ok) {
              console.log('✅ Credentials shared successfully');

              // Remove notification
              setNotifications(prev => prev.filter(n => n.id !== notification.id));
              alert('Credentials shared successfully!');
            } else {
              const error = await shareResponse.json();
              throw new Error(error.error || 'Failed to share credentials');
            }
          }
        } catch (error) {
          console.error('❌ Failed to share credentials:', error);
          alert(`Failed to share credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else if (notification.type === 'proof-request' && notification.proofRequestData?.pres_ex_id) {
        // For proof requests, use the direct ACA-Py response API
        console.log('🔐 Responding to proof request directly via Alice ACA-Py');
        
        const response = await fetch('/api/respond-to-proof', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pres_ex_id: notification.proofRequestData.pres_ex_id,
            approve: true,
            preparedRequest: notification.proofRequestData.preparedRequest
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('✅ Proof response sent successfully:', result);
          
          // Update local state
          setNotifications(prev => 
            prev.map(n => n.id === notification.id ? { ...n, status: 'accepted' } : n)
          );
          
          // Auto-remove after a short delay
          setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== notification.id));
          }, 3000);
        } else {
          const error = await response.json();
          console.error('❌ Failed to respond to proof request:', error);
          alert(`Failed to respond to proof request: ${error.error}`);
        }
      } else {
        // For credential offers, use the existing API
        const requestBody: any = { 
          action: 'accept',
          userSession: user ? { username: user.username, password: user.password } : null
        };
        if (notification.type === 'proof-request' && selectedCredential[notification.id]) {
          requestBody.credentialId = selectedCredential[notification.id];
        }
        
        const response = await fetch(`/api/notifications/${notification.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        });
        
        if (response.ok) {
          const result = await response.json();
          
          // Update local state
          setNotifications(prev => 
            prev.map(n => n.id === notification.id ? { ...n, status: 'accepted' } : n)
          );
          
          console.log(`${notification.type === 'proof-request' ? 'Proof request' : 'Credential offer'} accepted`);
          
          // If backend signals auto-removal, set up frontend removal as well
          if (result.autoRemove) {
            setTimeout(() => {
              setNotifications(prev => prev.filter(n => n.id !== notification.id));
            }, 2500); // Slightly longer than backend to ensure consistency
          }
        }
      }
    } catch (error) {
      console.error('Failed to accept notification:', error);
    }
  }

  const handleReject = async (notification: Notification) => {
    try {
      // For credential-share notifications, just remove from UI
      if (notification.type === 'credential-share') {
        console.log(`🚫 Canceling credential-share notification: ${notification.id}`);
        setNotifications(prev => prev.filter(n => n.id !== notification.id));
        return;
      }

      console.log(`🚫 Declining notification: ${notification.id}`);
      const response = await fetch(`/api/notifications/${notification.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'decline',
          userSession: user ? { username: user.username, password: user.password } : null
        })
      })

      console.log(`📡 Decline response status: ${response.status}`);

      if (response.ok) {
        const result = await response.json()
        console.log(`📦 Decline response data:`, result);

        // Update local state first to show declined status
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, status: 'declined' } : n)
        )

        console.log(`${notification.type === 'proof-request' ? 'Proof request' : 'Credential offer'} declined`)

        // If backend signals auto-removal, set up frontend removal as well
        if (result.autoRemove) {
          console.log(`⏱️ Scheduling notification removal in 2.5 seconds`);
          setTimeout(() => {
            console.log(`🗑️ Removing notification ${notification.id} from UI`);
            setNotifications(prev => prev.filter(n => n.id !== notification.id))
          }, 2500) // Slightly longer than backend to ensure consistency
        } else {
          console.warn(`⚠️ Backend did not signal autoRemove, notification will not be removed automatically`);
        }
      } else {
        console.error(`❌ Failed to decline notification: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to decline notification:', error)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'credential-offer':
        return '📜'
      case 'proof-request':
        return '🔍'
      case 'credential-share':
        return '🔗'
      default:
        return '📋'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'text-success'
      case 'declined':
        return 'text-danger'
      default:
        return 'text-accent'
    }
  }

  const formatCredentialData = (credentialData: any) => {
    if (!credentialData || Object.keys(credentialData).length === 0) {
      return 'No credential details available'
    }
    
    return Object.entries(credentialData)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ')
  }

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
          }}>Loading notifications...</p>
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
          }}>Notifications</h1>
        </div>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.7 }}>
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '14px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>Manage your credential offers and proof requests</span>
        </div>
      </div>
      
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '120px 30px 60px',
        position: 'relative'
      }}>

        {/* Notifications List */}
        {notifications.length === 0 ? (
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
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="#00ff7f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="#00ff7f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
            }}>No Notifications</h2>
            <p style={{
              fontSize: '16px',
              color: 'rgba(255, 255, 255, 0.7)',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              lineHeight: '1.6',
              maxWidth: '400px',
              margin: '0 auto'
            }}>
              You don't have any pending credential offers or proof requests. 
              Notifications will appear here when issuers send you credentials.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            {notifications.map((notification) => (
              <div key={notification.id} style={{
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '24px',
                padding: '30px',
                transformStyle: 'preserve-3d',
                transition: 'all 0.6s cubic-bezier(0.23, 1, 0.320, 1)',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px) rotateX(2deg) rotateY(2deg)'
                e.currentTarget.style.boxShadow = '0 25px 50px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 255, 127, 0.2)'
                e.currentTarget.style.borderColor = 'rgba(0, 255, 127, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) rotateX(0) rotateY(0)'
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', flexGrow: 1 }}>
                    <div style={{ flexShrink: 0 }}>
                      <div style={{
                        width: '60px',
                        height: '60px',
                        background: 'rgba(0, 255, 127, 0.1)',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid rgba(0, 255, 127, 0.2)',
                        backdropFilter: 'blur(10px)'
                      }}>
                        {notification.type === 'credential-offer' ? (
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#00ff7f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <polyline points="14,2 14,8 20,8" stroke="#00ff7f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <line x1="16" y1="13" x2="8" y2="13" stroke="#00ff7f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <line x1="16" y1="17" x2="8" y2="17" stroke="#00ff7f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <polyline points="10,9 9,9 8,9" stroke="#00ff7f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        ) : notification.type === 'credential-share' ? (
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="#00ff7f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="#00ff7f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        ) : (
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                            <circle cx="11" cy="11" r="8" stroke="#00ff7f" strokeWidth="2"/>
                            <path d="m21 21-4.35-4.35" stroke="#00ff7f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ flexGrow: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '12px' }}>
                        <h3 style={{
                          fontSize: '20px',
                          fontWeight: '600',
                          color: '#ffffff',
                          fontFamily: 'system-ui, -apple-system, sans-serif',
                          margin: 0
                        }}>{notification.title}</h3>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: '500',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          border: '1px solid',
                          ...(notification.status === 'accepted' ? {
                            color: '#00ff7f',
                            backgroundColor: 'rgba(0, 255, 127, 0.1)',
                            borderColor: 'rgba(0, 255, 127, 0.3)'
                          } : notification.status === 'declined' ? {
                            color: '#ff6b6b',
                            backgroundColor: 'rgba(255, 107, 107, 0.1)',
                            borderColor: 'rgba(255, 107, 107, 0.3)'
                          } : {
                            color: '#ffd93d',
                            backgroundColor: 'rgba(255, 217, 61, 0.1)',
                            borderColor: 'rgba(255, 217, 61, 0.3)'
                          })
                        }}>
                          {notification.status}
                        </span>
                      </div>
                      
                      <p style={{
                        fontSize: '16px',
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        lineHeight: '1.5',
                        margin: '0 0 12px 0'
                      }}>
                        {notification.message}
                      </p>
                      
                      {/* Credential Offer Details */}
                      {notification.type === 'credential-offer' && notification.credentialData?.credentialPreview?.attributes && (
                        <div style={{
                          background: 'rgba(0, 255, 127, 0.05)',
                          border: '1px solid rgba(0, 255, 127, 0.2)',
                          borderRadius: '16px',
                          padding: '20px',
                          marginBottom: '20px'
                        }}>
                          <h4 style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#00ff7f',
                            fontFamily: 'system-ui, -apple-system, sans-serif',
                            margin: '0 0 12px 0'
                          }}>Credential Details:</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {notification.credentialData.credentialPreview.attributes.map((attr: any, index: number) => {
                              // Check if we have a decrypted value for this attribute
                              const decryptedValue = decryptedAttributes[notification.id]?.[attr.name]
                              const displayValue = decryptedValue !== undefined ? decryptedValue : attr.value
                              const wasEncrypted = isEncryptedValue(attr.value)
                              const wasDecrypted = wasEncrypted && decryptedValue && decryptedValue !== '[ENCRYPTED]' && decryptedValue !== '[ISSUER ENCRYPTED]'
                              const isPlainValue = attr.name === 'issuer_did' || !wasEncrypted
                              
                              return (
                                <div key={`${attr.name}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                                  <span style={{
                                    color: 'rgba(255, 255, 255, 0.7)',
                                    textTransform: 'capitalize',
                                    fontFamily: 'system-ui, -apple-system, sans-serif'
                                  }}>{attr.name}:</span>
                                  <div style={{ textAlign: 'right' }}>
                                    <span style={{
                                      color: '#ffffff',
                                      fontWeight: '500',
                                      fontFamily: 'system-ui, -apple-system, sans-serif'
                                    }}>{displayValue}</span>
                                    {wasDecrypted && (
                                      <div style={{
                                        fontSize: '12px',
                                        color: '#00ff7f',
                                        marginTop: '4px',
                                        fontFamily: 'system-ui, -apple-system, sans-serif'
                                      }}>
                                        🔓 Decrypted
                                      </div>
                                    )}
                                    {wasEncrypted && !wasDecrypted && (
                                      <div style={{
                                        fontSize: '12px',
                                        color: '#ffd93d',
                                        marginTop: '4px',
                                        fontFamily: 'system-ui, -apple-system, sans-serif'
                                      }}>
                                        🔒 Encrypted
                                      </div>
                                    )}
                                    {isPlainValue && (
                                      <div style={{
                                        fontSize: '12px',
                                        color: '#6eb5ff',
                                        marginTop: '4px',
                                        fontFamily: 'system-ui, -apple-system, sans-serif'
                                      }}>
                                        📄 Plain text
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          {user && Object.keys(decryptedAttributes[notification.id] || {}).length > 0 && (
                            <div style={{
                              marginTop: '15px',
                              padding: '12px',
                              background: 'rgba(0, 255, 127, 0.1)',
                              borderRadius: '12px',
                              border: '1px solid rgba(0, 255, 127, 0.2)'
                            }}>
                              <div style={{
                                fontSize: '12px',
                                color: '#00ff7f',
                                fontFamily: 'system-ui, -apple-system, sans-serif'
                              }}>
                                🔐 Values decrypted with your password - only you can read this data
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Proof Request Details */}
                      {notification.type === 'proof-request' && notification.proofRequestData && (
                        <div className="mb-vr-4">
                          <button
                            onClick={() => setExpandedProofRequest(
                              expandedProofRequest === notification.id ? null : notification.id
                            )}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: '8px',
                              padding: '8px 12px',
                              color: 'rgba(255, 255, 255, 0.8)',
                              fontSize: '14px',
                              fontWeight: '500',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              fontFamily: 'system-ui, -apple-system, sans-serif'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.background = 'rgba(255, 255, 255, 0.08)'
                              e.target.style.borderColor = 'rgba(102, 126, 234, 0.3)'
                              e.target.style.color = 'white'
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = 'rgba(255, 255, 255, 0.05)'
                              e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                              e.target.style.color = 'rgba(255, 255, 255, 0.8)'
                            }}
                          >
                            <span style={{
                              fontSize: '12px',
                              transition: 'transform 0.2s ease',
                              transform: expandedProofRequest === notification.id ? 'rotate(90deg)' : 'rotate(0deg)'
                            }}>
                              ▶
                            </span>
                            <span>View requested information</span>
                          </button>
                          
                          {expandedProofRequest === notification.id && (
                            <div style={{
                              marginTop: '12px',
                              background: 'rgba(255, 255, 255, 0.03)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '12px',
                              padding: '16px',
                              backdropFilter: 'blur(10px)'
                            }}>
                              <h4 style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                color: 'rgba(255, 255, 255, 0.9)',
                                marginBottom: '12px',
                                fontFamily: 'system-ui, -apple-system, sans-serif'
                              }}>Requested Information:</h4>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {(notification.proofRequestData.proofRequest?.requested_attributes || notification.proofRequestData.requested_attributes) && 
                                 Object.entries(notification.proofRequestData.proofRequest?.requested_attributes || notification.proofRequestData.requested_attributes || {}).map(([key, attr]: [string, any]) => (
                                   <div key={key} style={{
                                     display: 'flex',
                                     alignItems: 'center',
                                     justifyContent: 'space-between',
                                     padding: '8px 12px',
                                     background: 'rgba(255, 255, 255, 0.05)',
                                     borderRadius: '8px',
                                     border: '1px solid rgba(255, 255, 255, 0.05)'
                                   }}>
                                     <span style={{
                                       color: 'rgba(255, 255, 255, 0.7)',
                                       fontSize: '13px',
                                       fontWeight: '500',
                                       textTransform: 'capitalize',
                                       fontFamily: 'system-ui, -apple-system, sans-serif'
                                     }}>{attr.name}:</span>
                                     <span style={{
                                       padding: '4px 8px',
                                       borderRadius: '6px',
                                       fontSize: '11px',
                                       fontWeight: '600',
                                       background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.15), rgba(118, 75, 162, 0.15))',
                                       color: 'rgba(102, 126, 234, 0.9)',
                                       border: '1px solid rgba(102, 126, 234, 0.2)',
                                       fontFamily: 'system-ui, -apple-system, sans-serif'
                                     }}>
                                       Requested
                                     </span>
                                   </div>
                                 ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <p style={{
                        fontSize: '14px',
                        color: 'rgba(255, 255, 255, 0.5)',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        margin: '15px 0 0 0'
                      }}>
                        {new Date(notification.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {notification.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '12px', marginLeft: '20px' }}>
                      <button
                        onClick={() => handleReject(notification)}
                        style={{
                          padding: '8px 16px',
                          background: 'rgba(255, 107, 107, 0.1)',
                          border: '1px solid rgba(255, 107, 107, 0.3)',
                          borderRadius: '12px',
                          color: '#ff6b6b',
                          fontSize: '14px',
                          fontWeight: '500',
                          fontFamily: 'system-ui, -apple-system, sans-serif',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 107, 107, 0.2)'
                          e.currentTarget.style.transform = 'translateY(-2px)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 107, 107, 0.1)'
                          e.currentTarget.style.transform = 'translateY(0)'
                        }}
                      >
                        {notification.type === 'credential-share' ? 'Cancel' : notification.type === 'proof-request' ? 'Cancel' : 'Reject'}
                      </button>
                      
                      {/* Show Accept/Share button for all notifications */}
                      <button
                          onClick={() => handleAccept(notification)}
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
                          {notification.type === 'credential-share' ? 'Share' : notification.type === 'proof-request' ? 'Share Info' : 'Accept'}
                        </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}