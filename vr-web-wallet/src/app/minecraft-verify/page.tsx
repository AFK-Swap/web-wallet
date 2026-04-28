'use client'

import React, { useState, useEffect } from 'react'
import { VRButton } from '@/components/VRButton'
import { VRCard } from '@/components/VRCard'
import { DIDCommConnection } from '@/components/DIDCommConnection'

export default function MinecraftVerify() {
  const [showDIDCommConnection, setShowDIDCommConnection] = useState(false)
  const [verificationConnectionId, setVerificationConnectionId] = useState('')
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'connected' | 'verifying' | 'verified' | 'error'>('idle')
  const [proofRequest, setProofRequest] = useState<any>(null)
  const [verificationResult, setVerificationResult] = useState<any>(null)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (verificationConnectionId) {
      console.log('Starting proof request monitoring for verification connection:', verificationConnectionId)
      startProofRequestMonitoring()
    }
  }, [verificationConnectionId])

  const handleVerificationConnection = (connectionId: string) => {
    console.log('ACME verifier connection established:', connectionId)
    setVerificationConnectionId(connectionId)
    setVerificationStatus('connected')
    setShowDIDCommConnection(false)
  }

  const startProofRequestMonitoring = async () => {
    let attempts = 0
    const maxAttempts = 60 // 2 minutes with 2-second intervals

    const checkForProofRequests = async () => {
      try {
        // Check for proof requests from ACME verifier  
        const response = await fetch(`http://localhost:8031/present-proof/records?connection_id=${verificationConnectionId}`)
        if (!response.ok) {
          throw new Error('Failed to check proof requests')
        }

        const data = await response.json()
        console.log('Proof request check result:', data)

        if (data.results && data.results.length > 0) {
          const latestProofRequest = data.results[data.results.length - 1]
          console.log('Received proof request:', latestProofRequest)
          
          if (latestProofRequest.state === 'request-received') {
            setProofRequest(latestProofRequest)
            setVerificationStatus('verifying')
            await handleProofRequest(latestProofRequest)
            return
          }
        }

        attempts++
        if (attempts < maxAttempts) {
          setTimeout(checkForProofRequests, 2000)
        } else {
          console.log('Proof request monitoring timeout')
        }
      } catch (error) {
        console.error('Error monitoring proof requests:', error)
        setErrorMessage('Failed to monitor proof requests')
        setVerificationStatus('error')
      }
    }

    checkForProofRequests()
  }

  const handleProofRequest = async (proofRequestRecord: any) => {
    try {
      console.log('Processing proof request:', proofRequestRecord)
      setVerificationStatus('verifying')

      // Get available credentials for proof request
      const credentialsResponse = await fetch(`http://localhost:8031/present-proof/records/${proofRequestRecord.pres_ex_id}/credentials`)
      if (!credentialsResponse.ok) {
        throw new Error('Failed to get available credentials')
      }

      const credentialsData = await credentialsResponse.json()
      console.log('Available credentials for proof:', credentialsData)

      if (!credentialsData || credentialsData.length === 0) {
        throw new Error('No credentials available for this proof request')
      }

      // Build proof presentation using first available credential
      const credential = credentialsData[0]
      const presentation = {
        requested_attributes: {},
        requested_predicates: {},
        self_attested_attributes: {}
      }

      // Map requested attributes to credential attributes
      const proofRequest = proofRequestRecord.pres_request
      if (proofRequest.requested_attributes) {
        for (const [key, attr] of Object.entries(proofRequest.requested_attributes as any)) {
          presentation.requested_attributes[key] = {
            cred_id: credential.cred_info.referent,
            revealed: true
          }
        }
      }

      console.log('Sending proof presentation:', presentation)

      // Send proof presentation
      const proofResponse = await fetch(`http://localhost:8031/present-proof/records/${proofRequestRecord.pres_ex_id}/send-presentation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(presentation)
      })

      if (!proofResponse.ok) {
        throw new Error('Failed to send proof presentation')
      }

      const proofResult = await proofResponse.json()
      console.log('Proof presentation sent successfully:', proofResult)
      
      setVerificationResult(proofResult)
      setVerificationStatus('verified')

    } catch (error) {
      console.error('Error handling proof request:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Verification failed')
      setVerificationStatus('error')
    }
  }

  const resetVerification = () => {
    setVerificationConnectionId('')
    setVerificationStatus('idle')
    setProofRequest(null)
    setVerificationResult(null)
    setErrorMessage('')
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <VRCard className="w-full max-w-2xl vr-card-elevated">
        <div className="p-vr-6">
          <div className="text-center mb-vr-6">
            <h1 className="vr-heading mb-vr-2">🎮 Minecraft Verification</h1>
            <p className="vr-body text-tertiary">
              Connect to ACME verifier using invitation URL from Minecraft
            </p>
          </div>

          {verificationStatus === 'idle' && (
            <div className="space-y-vr-4">
              <div className="bg-surface border border-subtle rounded-lg p-vr-4">
                <h3 className="vr-subtitle mb-vr-2">📋 Instructions</h3>
                <ol className="vr-body text-secondary space-y-vr-2 list-decimal list-inside">
                  <li>In Minecraft, type <code className="bg-subtle px-1 rounded">/verify web</code></li>
                  <li>Copy the invitation URL shown in chat</li>
                  <li>Click "Connect to ACME Verifier" below</li>
                  <li>Paste the URL to establish verification connection</li>
                  <li>Your credentials will be automatically verified</li>
                </ol>
              </div>

              <VRButton 
                variant="primary" 
                onClick={() => setShowDIDCommConnection(true)}
                className="w-full"
              >
                🔗 Connect to ACME Verifier
              </VRButton>
            </div>
          )}

          {verificationStatus === 'connected' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-success bg-opacity-10 rounded-xl flex items-center justify-center mx-auto mb-vr-4">
                <span className="text-3xl">🔗</span>
              </div>
              <h3 className="vr-subtitle mb-vr-2">Connected to ACME Verifier</h3>
              <p className="vr-body text-tertiary mb-vr-4">
                Waiting for proof request from verifier...
              </p>
              <div className="animate-pulse flex justify-center space-x-1">
                <div className="rounded-full bg-accent h-2 w-2"></div>
                <div className="rounded-full bg-accent h-2 w-2"></div>
                <div className="rounded-full bg-accent h-2 w-2"></div>
              </div>
            </div>
          )}

          {verificationStatus === 'verifying' && (
            <div className="text-center">
              <div className="vr-spinner mx-auto mb-vr-4"></div>
              <h3 className="vr-subtitle mb-vr-2">Verifying Credentials...</h3>
              <p className="vr-body text-tertiary mb-vr-4">
                Processing proof request and presenting credentials
              </p>
              {proofRequest && (
                <div className="bg-surface border border-subtle rounded-lg p-vr-4 text-left">
                  <h4 className="vr-body-small font-medium mb-vr-2">Proof Request:</h4>
                  <p className="vr-body-small text-secondary">
                    {proofRequest.pres_request?.name || 'Credential Verification'}
                  </p>
                </div>
              )}
            </div>
          )}

          {verificationStatus === 'verified' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-success bg-opacity-10 rounded-xl flex items-center justify-center mx-auto mb-vr-4">
                <span className="text-3xl">✅</span>
              </div>
              <h3 className="vr-subtitle mb-vr-2">Verification Complete!</h3>
              <p className="vr-body text-tertiary mb-vr-4">
                Your credentials have been successfully verified
              </p>
              {verificationResult && (
                <div className="bg-surface border border-subtle rounded-lg p-vr-4 mb-vr-4 text-left">
                  <h4 className="vr-body-small font-medium mb-vr-2">Verification Details:</h4>
                  <pre className="vr-body-small text-secondary overflow-auto">
                    {JSON.stringify(verificationResult, null, 2)}
                  </pre>
                </div>
              )}
              <VRButton variant="primary" onClick={resetVerification}>
                Verify Again
              </VRButton>
            </div>
          )}

          {verificationStatus === 'error' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-danger bg-opacity-10 rounded-xl flex items-center justify-center mx-auto mb-vr-4">
                <span className="text-3xl">❌</span>
              </div>
              <h3 className="vr-subtitle mb-vr-2">Verification Failed</h3>
              <p className="vr-body text-tertiary mb-vr-4">{errorMessage}</p>
              <div className="flex gap-vr-3">
                <VRButton variant="outline" onClick={resetVerification}>
                  Start Over
                </VRButton>
                <VRButton variant="primary" onClick={() => setShowDIDCommConnection(true)}>
                  Try Connection Again
                </VRButton>
              </div>
            </div>
          )}
        </div>
      </VRCard>

      {showDIDCommConnection && (
        <DIDCommConnection
          onConnectionEstablished={handleVerificationConnection}
          onClose={() => setShowDIDCommConnection(false)}
        />
      )}
    </div>
  )
}

