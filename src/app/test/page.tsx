'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { VRButton } from '@/components/VRButton'
import { VRCard } from '@/components/VRCard'
import { VRWalletAgent } from '@/lib/wallet-agent'

export default function TestPage() {
  const [walletAgent] = useState(() => VRWalletAgent.getInstance())
  const [message, setMessage] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const showMessage = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 5000)
  }

  const handleInitializeWallet = async () => {
    setIsLoading(true)
    try {
      await walletAgent.initialize()
      showMessage('✓ Wallet initialized successfully!')
    } catch (error) {
      showMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSimulateConnection = async () => {
    setIsLoading(true)
    try {
      await walletAgent.simulateConnectionComplete()
      showMessage('✓ Connection established!')
    } catch (error) {
      showMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddTestCredential = async () => {
    setIsLoading(true)
    try {
      await walletAgent.addTestCredential()
      showMessage('✓ Test credential offer added!')
    } catch (error) {
      showMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddProofRequest = async () => {
    setIsLoading(true)
    try {
      await walletAgent.addTestProofRequest()
      showMessage('✓ Test proof request added!')
    } catch (error) {
      showMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearStorage = async () => {
    setIsLoading(true)
    try {
      // Clear IndexedDB
      const request = indexedDB.deleteDatabase('VRWalletDB')
      request.onsuccess = () => {
        // Clear localStorage
        localStorage.removeItem('vr-wallet-id')
        localStorage.removeItem('vr-wallet-key')
        showMessage('✓ All wallet data cleared!')
        window.location.reload()
      }
      request.onerror = () => {
        showMessage('❌ Error clearing storage')
      }
    } catch (error) {
      showMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-vr-bg p-vr-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="vr-title text-vr-primary">Test & Demo Mode</h1>
          <p className="vr-subtitle text-vr-text-dim">
            Manual API testing and wallet simulation
          </p>
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
              Credentials
            </VRButton>
          </Link>
          <Link href="/proofs">
            <VRButton variant="outline" size="md">
              Proofs
            </VRButton>
          </Link>
        </div>

        {/* Status Message */}
        {message && (
          <VRCard className={message.includes('✓') ? 'border-vr-success' : 'border-vr-danger'}>
            <div className="text-center">
              <p className={`vr-body ${message.includes('✓') ? 'text-vr-success' : 'text-vr-danger'}`}>
                {message}
              </p>
            </div>
          </VRCard>
        )}

        {/* Wallet Initialization */}
        <VRCard title="1. Initialize Wallet">
          <div className="space-y-4">
            <p className="vr-body text-vr-text-dim">
              Initialize the wallet to start testing. This sets up browser storage and wallet identity.
            </p>
            <VRButton
              variant="primary"
              size="lg"
              onClick={handleInitializeWallet}
              loading={isLoading}
              className="w-full"
            >
              Initialize Wallet
            </VRButton>
          </div>
        </VRCard>

        {/* Connection Simulation */}
        <VRCard title="2. Simulate Connection">
          <div className="space-y-4">
            <p className="vr-body text-vr-text-dim">
              Simulate establishing a connection with an issuer/verifier. This creates a mock connection for testing.
            </p>
            <VRButton
              variant="secondary"
              size="lg"
              onClick={handleSimulateConnection}
              loading={isLoading}
              className="w-full"
            >
              Establish Test Connection
            </VRButton>
          </div>
        </VRCard>

        {/* Credential Testing */}
        <VRCard title="3. Test Credential Reception">
          <div className="space-y-4">
            <p className="vr-body text-vr-text-dim">
              Add a mock credential offer to test the credential acceptance workflow.
            </p>
            <VRButton
              variant="primary"
              size="lg"
              onClick={handleAddTestCredential}
              loading={isLoading}
              className="w-full"
            >
              Add Test Credential Offer
            </VRButton>
          </div>
        </VRCard>

        {/* Proof Testing */}
        <VRCard title="4. Test Proof Requests">
          <div className="space-y-4">
            <p className="vr-body text-vr-text-dim">
              Add a mock proof request to test the verification response workflow.
            </p>
            <VRButton
              variant="primary"
              size="lg"
              onClick={handleAddProofRequest}
              loading={isLoading}
              className="w-full"
            >
              Add Test Proof Request
            </VRButton>
          </div>
        </VRCard>

        {/* Testing Instructions */}
        <VRCard title="Testing Instructions">
          <div className="space-y-4">
            <div className="vr-card p-4">
              <h4 className="vr-subtitle text-vr-accent mb-3">Testing Workflow:</h4>
              <ol className="space-y-2 vr-body text-vr-text-dim">
                <li>1. Initialize the wallet</li>
                <li>2. Simulate a connection establishment</li>
                <li>3. Add test credential offers and accept them</li>
                <li>4. Add test proof requests and respond to them</li>
                <li>5. Navigate between pages to see the data persist</li>
              </ol>
            </div>
            
            <div className="vr-card p-4">
              <h4 className="vr-subtitle text-vr-accent mb-3">What this simulates:</h4>
              <ul className="space-y-2 vr-body text-vr-text-dim">
                <li>• Credential issuers sending credential offers</li>
                <li>• Verifiers sending proof requests</li>
                <li>• User accepting/declining credentials</li>
                <li>• User responding to verification requests</li>
                <li>• Data persistence across browser sessions</li>
              </ul>
            </div>
          </div>
        </VRCard>

        {/* Real-world Integration */}
        <VRCard title="Real-world Integration">
          <div className="space-y-4">
            <div className="vr-card p-4">
              <h4 className="vr-subtitle text-vr-accent mb-3">Connecting to your ACA-Py setup:</h4>
              <p className="vr-body text-vr-text-dim mb-3">
                This wallet generates DIDComm-compatible invitations and can work with your existing ACA-Py infrastructure:
              </p>
              <ul className="space-y-2 vr-body text-vr-text-dim">
                <li>• Use the "Receive Credential" page to generate QR codes</li>
                <li>• Share these QR codes with your ACA-Py issuer</li>
                <li>• The wallet stores data in browser IndexedDB</li>
                <li>• Invitation URLs follow DIDComm standards</li>
              </ul>
            </div>
            
            <div className="vr-card p-4">
              <h4 className="vr-subtitle text-vr-accent mb-3">Next Steps:</h4>
              <p className="vr-body text-vr-text-dim">
                After testing the basic functionality, you can integrate this wallet with your Minecraft VR system by adding API endpoints that your VR environment can call to check credential status and verification results.
              </p>
            </div>
          </div>
        </VRCard>

        {/* Reset */}
        <VRCard title="Reset Wallet" className="border-vr-danger">
          <div className="space-y-4">
            <p className="vr-body text-vr-text-dim">
              Clear all wallet data and start fresh. This will delete all connections, credentials, and proofs.
            </p>
            <VRButton
              variant="danger"
              size="lg"
              onClick={handleClearStorage}
              loading={isLoading}
              className="w-full"
            >
              Clear All Wallet Data
            </VRButton>
          </div>
        </VRCard>
      </div>
    </div>
  )
}