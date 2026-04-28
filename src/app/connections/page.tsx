'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { VRButton } from '@/components/VRButton'
import { VRCard } from '@/components/VRCard'
import { StatusIndicator } from '@/components/StatusIndicator'
import { VRWalletAgent } from '@/lib/wallet-agent'
import type { ConnectionRecord } from '@/lib/types'

export default function ConnectionsPage() {
  const [walletAgent] = useState(() => VRWalletAgent.getInstance())
  const [connections, setConnections] = useState<ConnectionRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadConnections()
  }, [])

  const loadConnections = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      if (!walletAgent.isReady()) {
        await walletAgent.initialize()
      }
      
      const conns = await walletAgent.getConnections()
      setConnections(conns)
    } catch (error) {
      console.error('Failed to load connections:', error)
      setError(error instanceof Error ? error.message : 'Failed to load connections')
    } finally {
      setIsLoading(false)
    }
  }

  const getConnectionStatus = (state: string): 'online' | 'offline' | 'pending' => {
    switch (state) {
      case 'completed':
      case 'response-sent':
        return 'online'
      case 'invitation-sent':
      case 'request-received':
      case 'request-sent':
        return 'pending'
      default:
        return 'offline'
    }
  }

  const getConnectionStatusText = (state: string): string => {
    switch (state) {
      case 'completed':
        return 'Connected'
      case 'response-sent':
        return 'Response Sent'
      case 'invitation-sent':
        return 'Invitation Sent'
      case 'request-received':
        return 'Request Received'
      case 'request-sent':
        return 'Request Sent'
      case 'abandoned':
        return 'Abandoned'
      default:
        return state.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }
  }

  const activeConnections = connections.filter(conn => 
    conn.state === 'completed' || conn.state === 'response-sent'
  )

  const pendingConnections = connections.filter(conn => 
    ['invitation-sent', 'request-received', 'request-sent'].includes(conn.state)
  )

  const otherConnections = connections.filter(conn => 
    !['completed', 'response-sent', 'invitation-sent', 'request-received', 'request-sent'].includes(conn.state)
  )

  if (isLoading) {
    return (
      <div className="min-h-screen bg-vr-bg p-vr-6">
        <div className="max-w-4xl mx-auto">
          <VRCard title="Loading Connections">
            <div className="text-center py-8">
              <div className="vr-spinner mx-auto mb-4" />
              <p className="vr-body text-vr-text-dim">Loading your connections...</p>
            </div>
          </VRCard>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-vr-bg p-vr-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="vr-title text-vr-primary">My Connections</h1>
            <p className="vr-subtitle text-vr-text-dim">
              Manage your wallet connections and relationships
            </p>
          </div>
          
          <div className="space-x-4">
            <Link href="/receive">
              <VRButton variant="primary" size="lg">
                New Connection
              </VRButton>
            </Link>
            
            <Link href="/">
              <VRButton variant="outline" size="lg">
                Dashboard
              </VRButton>
            </Link>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <VRCard className="border-vr-danger">
            <div className="text-center space-y-4">
              <h3 className="vr-subtitle text-vr-danger">Error</h3>
              <p className="vr-body text-vr-text">{error}</p>
              <VRButton variant="danger" onClick={() => setError(null)}>
                Dismiss
              </VRButton>
            </div>
          </VRCard>
        )}

        {/* Connection Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <VRCard title="Active Connections" className="border-vr-success">
            <div className="text-center">
              <div className="text-4xl font-bold text-vr-success mb-2">
                {activeConnections.length}
              </div>
              <p className="vr-body text-vr-text-dim">
                Ready for credential exchange
              </p>
            </div>
          </VRCard>

          <VRCard title="Pending Connections" className="border-vr-warning">
            <div className="text-center">
              <div className="text-4xl font-bold text-vr-warning mb-2">
                {pendingConnections.length}
              </div>
              <p className="vr-body text-vr-text-dim">
                Waiting for completion
              </p>
            </div>
          </VRCard>

          <VRCard title="Total Connections" className="border-vr-accent">
            <div className="text-center">
              <div className="text-4xl font-bold text-vr-accent mb-2">
                {connections.length}
              </div>
              <p className="vr-body text-vr-text-dim">
                All connection records
              </p>
            </div>
          </VRCard>
        </div>

        {/* Active Connections */}
        {activeConnections.length > 0 && (
          <div className="space-y-4">
            <h2 className="vr-heading text-vr-success">
              Active Connections ({activeConnections.length})
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {activeConnections.map((connection) => (
                <VRCard
                  key={connection.id}
                  title={connection.theirLabel || 'Unknown Entity'}
                  subtitle={`ID: ${connection.id.substring(0, 8)}...`}
                  className="border-vr-success"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <StatusIndicator 
                        status={getConnectionStatus(connection.state)}
                        label={getConnectionStatusText(connection.state)}
                      />
                      <span className="vr-caption text-vr-text-dim">
                        {new Date(connection.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <div className="vr-card p-4 space-y-2">
                      {connection.theirDid && (
                        <div>
                          <p className="vr-caption text-vr-text-dim">Their DID:</p>
                          <p className="vr-caption font-mono text-vr-text break-all">
                            {connection.theirDid}
                          </p>
                        </div>
                      )}
                      
                      {connection.myDid && (
                        <div>
                          <p className="vr-caption text-vr-text-dim">My DID:</p>
                          <p className="vr-caption font-mono text-vr-text break-all">
                            {connection.myDid}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex space-x-3">
                      <VRButton variant="outline" size="sm" className="flex-1">
                        View Details
                      </VRButton>
                      <VRButton variant="secondary" size="sm" className="flex-1">
                        Send Message
                      </VRButton>
                    </div>
                  </div>
                </VRCard>
              ))}
            </div>
          </div>
        )}

        {/* Pending Connections */}
        {pendingConnections.length > 0 && (
          <div className="space-y-4">
            <h2 className="vr-heading text-vr-warning">
              Pending Connections ({pendingConnections.length})
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {pendingConnections.map((connection) => (
                <VRCard
                  key={connection.id}
                  title={connection.theirLabel || 'Establishing Connection...'}
                  subtitle={`ID: ${connection.id.substring(0, 8)}...`}
                  className="border-vr-warning"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <StatusIndicator 
                        status={getConnectionStatus(connection.state)}
                        label={getConnectionStatusText(connection.state)}
                      />
                      <span className="vr-caption text-vr-text-dim">
                        {new Date(connection.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <div className="vr-card p-4">
                      <p className="vr-body text-vr-text-dim">
                        This connection is still being established. It may take a moment to complete the handshake process.
                      </p>
                    </div>
                    
                    <VRButton 
                      variant="outline" 
                      size="sm" 
                      onClick={loadConnections}
                      className="w-full"
                    >
                      Refresh Status
                    </VRButton>
                  </div>
                </VRCard>
              ))}
            </div>
          </div>
        )}

        {/* Other Connections */}
        {otherConnections.length > 0 && (
          <div className="space-y-4">
            <h2 className="vr-heading text-vr-text-dim">
              Other Connections ({otherConnections.length})
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {otherConnections.map((connection) => (
                <VRCard
                  key={connection.id}
                  title={connection.theirLabel || 'Connection'}
                  subtitle={`ID: ${connection.id.substring(0, 8)}...`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <StatusIndicator 
                        status={getConnectionStatus(connection.state)}
                        label={getConnectionStatusText(connection.state)}
                      />
                      <span className="vr-caption text-vr-text-dim">
                        {new Date(connection.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </VRCard>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {connections.length === 0 && (
          <VRCard title="No Connections">
            <div className="text-center space-y-6">
              <p className="vr-body text-vr-text-dim">
                You don't have any connections yet. Create your first connection to start exchanging credentials.
              </p>
              
              <Link href="/receive">
                <VRButton variant="primary" size="xl">
                  Create Your First Connection
                </VRButton>
              </Link>
            </div>
          </VRCard>
        )}

        {/* Help Information */}
        <VRCard title="About Connections">
          <div className="space-y-4">
            <div className="vr-card p-4">
              <h4 className="vr-subtitle text-vr-accent mb-3">What are connections?</h4>
              <p className="vr-body text-vr-text-dim">
                Connections are secure communication channels between your wallet and other entities (like credential issuers or verifiers). They enable privacy-preserving exchange of credentials and proofs.
              </p>
            </div>
            
            <div className="vr-card p-4">
              <h4 className="vr-subtitle text-vr-accent mb-3">Connection states explained:</h4>
              <ul className="space-y-2 vr-body text-vr-text-dim">
                <li><strong className="text-vr-success">Connected:</strong> Ready for credential exchange</li>
                <li><strong className="text-vr-warning">Pending:</strong> Connection handshake in progress</li>
                <li><strong className="text-vr-text-dim">Other:</strong> Inactive or error states</li>
              </ul>
            </div>
          </div>
        </VRCard>
      </div>
    </div>
  )
}