'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { VRButton } from '@/components/VRButton'
import { VRCard } from '@/components/VRCard'
import { QRCodeDisplay } from '@/components/QRCodeDisplay'
import { StatusIndicator } from '@/components/StatusIndicator'
import { VRWalletAgent } from '@/lib/wallet-agent'
import type { InvitationData, WalletEvent } from '@/lib/types'

export default function ReceivePage() {
  const [walletAgent] = useState(() => VRWalletAgent.getInstance())
  const [invitation, setInvitation] = useState<InvitationData | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'waiting' | 'connected'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)

  useEffect(() => {
    // Set up event listener for connection events
    const handleWalletEvent = (event: WalletEvent) => {
      if (event.type === 'connection') {
        if (event.data.status === 'initialized') {
          // Wallet initialized
        } else if (event.data.state === 'completed') {
          setConnectionStatus('connected')
        } else if (event.data.state === 'invitation-sent' || event.data.state === 'request-received') {
          setConnectionStatus('waiting')
        }
      }
    }

    walletAgent.addEventListener(handleWalletEvent)

    return () => {
      walletAgent.removeEventListener(handleWalletEvent)
    }
  }, [walletAgent])

  const generateInvitation = async () => {
    setIsGenerating(true)
    setError(null)
    setConnectionStatus('idle')
    
    try {
      if (!walletAgent.isReady()) {
        await walletAgent.initialize()
      }
      
      const invitationData = await walletAgent.createInvitation()
      setInvitation(invitationData)
      setConnectionStatus('waiting')
    } catch (error) {
      console.error('Failed to generate invitation:', error)
      setError(error instanceof Error ? error.message : 'Failed to generate invitation')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopySuccess = () => {
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 3000)
  }

  const resetInvitation = () => {
    setInvitation(null)
    setConnectionStatus('idle')
    setError(null)
    setCopySuccess(false)
  }

  const getStatusIndicator = () => {
    switch (connectionStatus) {
      case 'waiting':
        return <StatusIndicator status="pending" label="Waiting for connection..." />
      case 'connected':
        return <StatusIndicator status="online" label="Connected! You can now receive credentials." />
      default:
        return <StatusIndicator status="offline" label="Ready to generate invitation" />
    }
  }

  return (
    <div className="min-h-screen bg-vr-bg p-vr-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="vr-title text-vr-primary">Receive Credential</h1>
          <p className="vr-subtitle text-vr-text-dim">
            Generate a connection invitation to receive credentials from an issuer
          </p>
          
          <div className="flex justify-center">
            {getStatusIndicator()}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-center space-x-4">
          <Link href="/">
            <VRButton variant="outline" size="md">
              Dashboard
            </VRButton>
          </Link>
          <Link href="/credentials">
            <VRButton variant="outline" size="md">
              My Credentials
            </VRButton>
          </Link>
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

        {/* Copy Success Message */}
        {copySuccess && (
          <VRCard className="border-vr-success">
            <div className="text-center">
              <p className="vr-body text-vr-success">
                ✓ Connection URL copied to clipboard!
              </p>
            </div>
          </VRCard>
        )}

        {/* Connection Success */}
        {connectionStatus === 'connected' && (
          <VRCard className="border-vr-success">
            <div className="text-center space-y-4">
              <h3 className="vr-subtitle text-vr-success">Connection Established!</h3>
              <p className="vr-body text-vr-text">
                You are now connected to the issuer. You can receive credentials from them.
              </p>
              <div className="space-x-4">
                <Link href="/credentials">
                  <VRButton variant="primary" size="lg">
                    View My Credentials
                  </VRButton>
                </Link>
                <VRButton variant="outline" size="lg" onClick={resetInvitation}>
                  Generate New Invitation
                </VRButton>
              </div>
            </div>
          </VRCard>
        )}

        {/* Generate Invitation */}
        {!invitation && connectionStatus !== 'connected' && (
          <VRCard title="Generate Connection Invitation">
            <div className="text-center space-y-6">
              <p className="vr-body text-vr-text-dim">
                Click below to generate a QR code and connection URL that credential issuers can use to connect with your wallet.
              </p>
              
              <div className="space-y-4">
                <VRButton
                  variant="primary"
                  size="xl"
                  onClick={generateInvitation}
                  loading={isGenerating}
                  className="w-full"
                >
                  Generate Invitation
                </VRButton>
                
                <p className="vr-caption text-vr-text-dim">
                  This will create a secure connection that allows issuers to send you verifiable credentials.
                </p>
              </div>
            </div>
          </VRCard>
        )}

        {/* Display Invitation */}
        {invitation && connectionStatus !== 'connected' && (
          <div className="space-y-6">
            <QRCodeDisplay
              data={invitation.invitationUrl}
              title="Connection Invitation"
              subtitle="Share this QR code or URL with the credential issuer"
              onCopy={handleCopySuccess}
            />
            
            <VRCard title="Instructions">
              <div className="space-y-4">
                <div className="vr-card p-4">
                  <h4 className="vr-subtitle text-vr-primary mb-3">How to use:</h4>
                  <ol className="space-y-2 vr-body text-vr-text-dim">
                    <li>1. Share the QR code above with the credential issuer</li>
                    <li>2. Or copy and send them the connection URL</li>
                    <li>3. Wait for them to scan/use the invitation</li>
                    <li>4. Once connected, they can send you credentials</li>
                  </ol>
                </div>
                
                <div className="flex space-x-3">
                  <VRButton
                    variant="outline"
                    size="md"
                    onClick={resetInvitation}
                    className="flex-1"
                  >
                    Generate New
                  </VRButton>
                  
                  <VRButton
                    variant="secondary"
                    size="md"
                    onClick={() => navigator.clipboard.writeText(invitation.invitationUrl).then(handleCopySuccess)}
                    className="flex-1"
                  >
                    Copy URL
                  </VRButton>
                </div>
              </div>
            </VRCard>
          </div>
        )}

        {/* Help Information */}
        <VRCard title="Need Help?">
          <div className="space-y-4">
            <div className="vr-card p-4">
              <h4 className="vr-subtitle text-vr-accent mb-3">What are verifiable credentials?</h4>
              <p className="vr-body text-vr-text-dim">
                Verifiable credentials are digital certificates that prove information about you (like your identity, qualifications, or memberships) in a secure, privacy-preserving way.
              </p>
            </div>
            
            <div className="vr-card p-4">
              <h4 className="vr-subtitle text-vr-accent mb-3">How does this work?</h4>
              <p className="vr-body text-vr-text-dim">
                When you share your invitation with an issuer, they can establish a secure connection with your wallet. This allows them to send you credentials that you can later use to prove information about yourself to verifiers.
              </p>
            </div>
          </div>
        </VRCard>
      </div>
    </div>
  )
}