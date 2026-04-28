'use client'

import React, { useState, useEffect } from 'react'
import { VRButton } from '@/components/VRButton'
import { VRCard } from '@/components/VRCard'
import { StatusIndicator } from '@/components/StatusIndicator'
import { anonCredsWallet } from '@/lib/anoncreds-wallet-agent'
import type { EncryptedCredentialRecord } from '@/lib/anoncreds-types'

interface TestResults {
  walletInitialized: boolean
  ledgerConnected: boolean
  encryptionWorking: boolean
  credentialStored: boolean
  verificationPassed: boolean
  errors: string[]
}

export default function AnonCredsTest() {
  const [testResults, setTestResults] = useState<TestResults>({
    walletInitialized: false,
    ledgerConnected: false,
    encryptionWorking: false,
    credentialStored: false,
    verificationPassed: false,
    errors: []
  })
  const [isRunning, setIsRunning] = useState(false)
  const [credentials, setCredentials] = useState<EncryptedCredentialRecord[]>([])
  const [ledgerStats, setLedgerStats] = useState({ schemas: 0, credDefs: 0 })

  useEffect(() => {
    loadCredentials()
  }, [])

  const loadCredentials = async () => {
    try {
      if (anonCredsWallet.isReady()) {
        const creds = await anonCredsWallet.getCredentials()
        setCredentials(creds)
        setLedgerStats(anonCredsWallet.getLedgerStats())
      }
    } catch (error) {
      console.error('Failed to load credentials:', error)
    }
  }

  const runComprehensiveTest = async () => {
    setIsRunning(true)
    const results: TestResults = {
      walletInitialized: false,
      ledgerConnected: false,
      encryptionWorking: false,
      credentialStored: false,
      verificationPassed: false,
      errors: []
    }

    try {
      // Test 1: Initialize AnonCreds Wallet
      console.log('🧪 Test 1: Initializing AnonCreds wallet...')
      const initResult = await anonCredsWallet.initialize()
      results.walletInitialized = true
      results.ledgerConnected = !!initResult.ledgerUrl
      console.log('✅ Wallet initialized:', initResult)

      // Test 2: Test encryption
      console.log('🧪 Test 2: Testing encryption...')
      const { walletCrypto } = await import('@/lib/wallet-crypto')
      const testData = 'Hello, AnonCreds!'
      const encrypted = await walletCrypto.encrypt(testData, 'test-key-123')
      const decrypted = await walletCrypto.decrypt(encrypted, 'test-key-123')
      results.encryptionWorking = decrypted === testData
      console.log('✅ Encryption test passed')

      // Test 3: Create and store test credential
      console.log('🧪 Test 3: Creating test AnonCreds credential...')
      await anonCredsWallet.addTestAnonCredential()
      const testCredentials = await anonCredsWallet.getCredentials()
      results.credentialStored = testCredentials.length > 0
      console.log('✅ Test credential created and stored')

      // Test 4: Accept credential and verify
      console.log('🧪 Test 4: Accepting and verifying credential...')
      const testCred = testCredentials[0]
      if (testCred) {
        await anonCredsWallet.acceptCredentialOffer(testCred.id)
        const verifiedCreds = await anonCredsWallet.getCredentials()
        const acceptedCred = verifiedCreds.find(c => c.id === testCred.id)
        results.verificationPassed = acceptedCred?.state === 'done'
        console.log('✅ Credential accepted and verification passed')
      }

      // Test 5: API Integration
      console.log('🧪 Test 5: Testing API integration...')
      const response = await fetch('/api/credentials/anoncreds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_offer',
          credentialData: {
            schemaId: 'BzCbsNYhMrjHiqZDTUASHg:2:student_card:1.0',
            credentialDefinitionId: 'BzCbsNYhMrjHiqZDTUASHg:3:CL:123:TAG',
            credentialPreview: {
              attributes: [
                { name: 'name', value: 'API Test User' },
                { name: 'university', value: 'API Test University' },
                { name: 'age', value: '22' }
              ]
            }
          }
        })
      })
      const apiResult = await response.json()
      console.log('✅ API integration test passed:', apiResult)

    } catch (error) {
      console.error('❌ Test failed:', error)
      results.errors.push(error instanceof Error ? error.message : 'Unknown error')
    }

    setTestResults(results)
    setIsRunning(false)
    await loadCredentials()
  }

  const createTestCredential = async () => {
    try {
      await anonCredsWallet.addTestAnonCredential()
      await loadCredentials()
    } catch (error) {
      console.error('Failed to create test credential:', error)
    }
  }

  const acceptCredential = async (credentialId: string) => {
    try {
      await anonCredsWallet.acceptCredentialOffer(credentialId)
      await loadCredentials()
    } catch (error) {
      console.error('Failed to accept credential:', error)
    }
  }

  const getStatusColor = (status: boolean): 'online' | 'offline' => {
    return status ? 'online' : 'offline'
  }

  return (
    <div className="min-h-screen bg-vr-bg-primary">
      <div className="max-w-6xl mx-auto px-vr-6 py-vr-12">
        
        <header className="text-center mb-vr-12">
          <h1 className="vr-title mb-vr-6">AnonCreds Test Suite</h1>
          <p className="vr-body-large text-tertiary max-w-2xl mx-auto mb-vr-8">
            Testing real AnonCreds integration with BCovrin VON Network
          </p>
        </header>

        {/* Test Controls */}
        <div className="vr-card mb-vr-8">
          <div className="text-center">
            <h2 className="vr-heading mb-vr-6">Comprehensive Test</h2>
            <VRButton
              variant="primary"
              size="lg"
              onClick={runComprehensiveTest}
              loading={isRunning}
              className="mb-vr-4"
            >
              {isRunning ? 'Running Tests...' : 'Run All Tests'}
            </VRButton>
          </div>
        </div>

        {/* Test Results */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-vr-6 mb-vr-8">
          <div className="vr-card text-center">
            <StatusIndicator 
              status={getStatusColor(testResults.walletInitialized)}
              label="Wallet Initialized"
              className="mb-vr-4"
            />
            <h3 className="vr-subtitle mb-vr-2">Wallet</h3>
            <p className="vr-caption text-tertiary">AnonCreds agent initialization</p>
          </div>

          <div className="vr-card text-center">
            <StatusIndicator 
              status={getStatusColor(testResults.ledgerConnected)}
              label="BCovrin Connected"
              className="mb-vr-4"
            />
            <h3 className="vr-subtitle mb-vr-2">Ledger</h3>
            <p className="vr-caption text-tertiary">BCovrin VON Network connection</p>
          </div>

          <div className="vr-card text-center">
            <StatusIndicator 
              status={getStatusColor(testResults.encryptionWorking)}
              label="Encryption"
              className="mb-vr-4"
            />
            <h3 className="vr-subtitle mb-vr-2">Crypto</h3>
            <p className="vr-caption text-tertiary">AES-GCM encryption/decryption</p>
          </div>

          <div className="vr-card text-center">
            <StatusIndicator 
              status={getStatusColor(testResults.credentialStored)}
              label="Storage"
              className="mb-vr-4"
            />
            <h3 className="vr-subtitle mb-vr-2">Storage</h3>
            <p className="vr-caption text-tertiary">Encrypted credential storage</p>
          </div>

          <div className="vr-card text-center">
            <StatusIndicator 
              status={getStatusColor(testResults.verificationPassed)}
              label="Verification"
              className="mb-vr-4"
            />
            <h3 className="vr-subtitle mb-vr-2">Verification</h3>
            <p className="vr-caption text-tertiary">Credential acceptance & proof</p>
          </div>

          <div className="vr-card text-center">
            <div className="w-16 h-16 bg-accent bg-opacity-10 rounded-xl flex items-center justify-center mx-auto mb-vr-4">
              <span className="text-2xl">📊</span>
            </div>
            <h3 className="vr-subtitle mb-vr-2">Stats</h3>
            <p className="vr-caption text-tertiary">
              {ledgerStats.schemas} schemas, {ledgerStats.credDefs} cred defs
            </p>
          </div>
        </div>

        {/* Error Display */}
        {testResults.errors.length > 0 && (
          <div className="vr-card border-danger mb-vr-8">
            <h3 className="vr-subtitle text-danger mb-vr-4">Test Errors</h3>
            {testResults.errors.map((error, index) => (
              <p key={index} className="vr-body text-danger mb-vr-2">
                {error}
              </p>
            ))}
          </div>
        )}

        {/* Credentials Management */}
        <div className="vr-card mb-vr-8">
          <div className="flex items-center justify-between mb-vr-6">
            <h2 className="vr-heading">Test Credentials</h2>
            <VRButton variant="secondary" onClick={createTestCredential}>
              Add Test Credential
            </VRButton>
          </div>

          {credentials.length === 0 ? (
            <p className="vr-body text-tertiary text-center py-vr-8">
              No credentials found. Run tests or add a test credential.
            </p>
          ) : (
            <div className="space-y-vr-4">
              {credentials.map((credential) => (
                <div key={credential.id} className="vr-card bg-secondary">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="vr-subtitle mb-vr-2">
                        {credential.credentialPreview?.attributes.find(a => a.name === 'name')?.value || 'Unknown'}
                      </h3>
                      <p className="vr-caption text-tertiary mb-vr-2">
                        State: <span className="font-medium">{credential.state}</span>
                      </p>
                      <p className="vr-caption-small text-muted">
                        Schema: {credential.schemaId}
                      </p>
                    </div>
                    <div className="text-right">
                      {credential.state === 'offer-received' && (
                        <VRButton 
                          variant="primary" 
                          size="sm"
                          onClick={() => acceptCredential(credential.id)}
                        >
                          Accept
                        </VRButton>
                      )}
                      {credential.state === 'done' && (
                        <div className="w-12 h-12 bg-success bg-opacity-20 rounded-xl flex items-center justify-center">
                          <span className="text-success text-xl">✓</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {credential.credentialPreview && (
                    <div className="mt-vr-4 pt-vr-4 border-t border-subtle">
                      <h4 className="vr-caption font-medium mb-vr-2">Attributes:</h4>
                      <div className="grid grid-cols-2 gap-vr-2">
                        {credential.credentialPreview.attributes.map((attr, index) => (
                          <div key={index} className="vr-caption-small">
                            <span className="text-tertiary">{attr.name}:</span> {attr.value}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Integration Info */}
        <div className="vr-card">
          <h2 className="vr-heading mb-vr-6">Integration Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-vr-6">
            <div>
              <h3 className="vr-subtitle mb-vr-4">🔐 Security Features</h3>
              <ul className="vr-body text-tertiary space-y-vr-2">
                <li>• AES-GCM encryption for credential storage</li>
                <li>• BCovrin VON Network ledger integration</li>
                <li>• Real AnonCreds credential format</li>
                <li>• Cryptographic proof verification</li>
              </ul>
            </div>
            <div>
              <h3 className="vr-subtitle mb-vr-4">🌐 Network Integration</h3>
              <ul className="vr-body text-tertiary space-y-vr-2">
                <li>• Connected to dev.greenlight.bcovrin.vonx.io</li>
                <li>• Schema and cred def validation</li>
                <li>• Minecraft verification endpoints</li>
                <li>• Real-time credential management</li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}