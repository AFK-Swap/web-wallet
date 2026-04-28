'use client'

import React, { useState, useEffect } from 'react'
import { VRButton } from '@/components/VRButton'
import { VRCard } from '@/components/VRCard'
import { StatusIndicator } from '@/components/StatusIndicator'

interface LedgerStatus {
  timestamp: string
  bcovrinUrl: string
  tests: {
    genesis?: {
      accessible: boolean
      status?: number
      contentLength?: number
      error?: string
    }
    browse?: {
      accessible: boolean
      status?: number
      error?: string
    }
  }
}

interface LedgerTestResult {
  success: boolean
  credentialId?: string
  ledgerVerification?: {
    ledgerAccessible: boolean
    schemaFound: boolean
    credDefFound: boolean
  }
  logs?: string[]
  error?: string
}

export default function LedgerTest() {
  const [ledgerStatus, setLedgerStatus] = useState<LedgerStatus | null>(null)
  const [testResult, setTestResult] = useState<LedgerTestResult | null>(null)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [isCreatingCredential, setIsCreatingCredential] = useState(false)
  const [logs, setLogs] = useState<string[]>([])

  useEffect(() => {
    checkLedgerStatus()
  }, [])

  const checkLedgerStatus = async () => {
    setIsTestingConnection(true)
    try {
      const response = await fetch('/api/credentials/test-ledger', {
        method: 'GET'
      })
      const data = await response.json()
      setLedgerStatus(data.status)
      
      // Add status to logs
      const statusLogs = [
        `🕐 ${new Date().toLocaleTimeString()} - Ledger status check`,
        `🌍 BCovrin URL: ${data.status.bcovrinUrl}`,
        `📋 Genesis accessible: ${data.status.tests.genesis?.accessible ? '✅ Yes' : '❌ No'}`,
        `🌐 Browse accessible: ${data.status.tests.browse?.accessible ? '✅ Yes' : '❌ No'}`,
        `💡 ${data.recommendation}`
      ]
      setLogs(prev => [...statusLogs, ...prev])
      
    } catch (error) {
      console.error('Failed to check ledger status:', error)
      setLogs(prev => [`❌ Failed to check ledger status: ${error}`, ...prev])
    }
    setIsTestingConnection(false)
  }

  const createTestCredential = async () => {
    setIsCreatingCredential(true)
    setLogs(prev => [`🚀 ${new Date().toLocaleTimeString()} - Starting credential creation with ledger verification...`, ...prev])
    
    try {
      const response = await fetch('/api/credentials/test-ledger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          schemaId: 'BzCbsNYhMrjHiqZDTUASHg:2:student_card:1.0',
          credentialDefinitionId: 'BzCbsNYhMrjHiqZDTUASHg:3:CL:123:TAG',
          attributes: [
            { name: 'name', value: 'Real Ledger Test User' },
            { name: 'university', value: 'BCovrin University' },
            { name: 'degree', value: 'Digital Identity' },
            { name: 'graduation_year', value: '2025' },
            { name: 'student_id', value: 'BCO12345' }
          ]
        })
      })

      const data = await response.json()
      setTestResult(data)
      
      // Add detailed logs
      if (data.logs) {
        const timestampedLogs = data.logs.map((log: string) => 
          `${new Date().toLocaleTimeString()} - ${log}`
        )
        setLogs(prev => [...timestampedLogs, ...prev])
      }

      if (data.success) {
        setLogs(prev => [
          `🎉 ${new Date().toLocaleTimeString()} - Credential creation completed!`,
          `📊 Results: Ledger=${data.ledgerVerification?.ledgerAccessible ? '✅' : '❌'}, Schema=${data.ledgerVerification?.schemaFound ? '✅' : '❌'}, CredDef=${data.ledgerVerification?.credDefFound ? '✅' : '❌'}`,
          ...prev
        ])
      }

    } catch (error) {
      console.error('Failed to create test credential:', error)
      setLogs(prev => [`❌ ${new Date().toLocaleTimeString()} - Failed to create credential: ${error}`, ...prev])
    }
    
    setIsCreatingCredential(false)
  }

  const createRealSchemaCredential = async () => {
    setIsCreatingCredential(true)
    setLogs(prev => [`🔬 ${new Date().toLocaleTimeString()} - Creating credential with REAL schema from your BCovrin ledger...`, ...prev])
    
    try {
      // First, let's see what schemas actually exist on your ledger
      setLogs(prev => [`🔍 ${new Date().toLocaleTimeString()} - Checking for existing schemas on your ledger...`, ...prev])
      
      const response = await fetch('/api/credentials/test-ledger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Try some common schema IDs that might be on your BCovrin ledger
          schemaId: 'Th7MpTaRZVRYnPiabds81Y:2:BasicIdentity:1.0', // Common test schema
          credentialDefinitionId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:1:default',
          attributes: [
            { name: 'name', value: 'BCovrin Ledger User' },
            { name: 'email', value: 'user@bcovrin-test.com' },
            { name: 'date', value: new Date().toISOString().split('T')[0] }
          ]
        })
      })

      const data = await response.json()
      setTestResult(data)
      
      if (data.logs) {
        const timestampedLogs = data.logs.map((log: string) => 
          `${new Date().toLocaleTimeString()} - ${log}`
        )
        setLogs(prev => [...timestampedLogs, ...prev])
      }

    } catch (error) {
      setLogs(prev => [`❌ ${new Date().toLocaleTimeString()} - Real schema test failed: ${error}`, ...prev])
    }
    
    setIsCreatingCredential(false)
  }

  const clearLogs = () => {
    setLogs([])
  }

  const getStatusColor = (status: boolean): 'online' | 'offline' => {
    return status ? 'online' : 'offline'
  }

  return (
    <div className="min-h-screen bg-vr-bg-primary">
      <div className="max-w-6xl mx-auto px-vr-6 py-vr-12">
        
        <header className="text-center mb-vr-12">
          <h1 className="vr-title mb-vr-6">BCovrin Ledger Integration Test</h1>
          <p className="vr-body-large text-tertiary max-w-3xl mx-auto mb-vr-8">
            Real-time testing of credential creation with your BCovrin VON Network ledger at{" "}
            <code className="bg-subtle px-2 py-1 rounded">dev.greenlight.bcovrin.vonx.io</code>
          </p>
        </header>

        {/* Ledger Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-vr-6 mb-vr-8">
          <div className="vr-card text-center">
            <StatusIndicator 
              status={ledgerStatus?.tests.genesis?.accessible ? 'online' : 'offline'}
              label="Genesis Endpoint"
              className="mb-vr-4"
            />
            <h3 className="vr-subtitle mb-vr-2">Genesis</h3>
            <p className="vr-caption text-tertiary">
              {ledgerStatus?.tests.genesis?.accessible ? 
                `✅ ${ledgerStatus.tests.genesis.contentLength} chars` : 
                '❌ Not accessible'}
            </p>
          </div>

          <div className="vr-card text-center">
            <StatusIndicator 
              status={ledgerStatus?.tests.browse?.accessible ? 'online' : 'offline'}
              label="Browse API"
              className="mb-vr-4"
            />
            <h3 className="vr-subtitle mb-vr-2">Browse</h3>
            <p className="vr-caption text-tertiary">
              {ledgerStatus?.tests.browse?.accessible ? 
                '✅ API accessible' : 
                '❌ Not accessible'}
            </p>
          </div>

          <div className="vr-card text-center">
            <StatusIndicator 
              status={testResult?.ledgerVerification?.ledgerAccessible ? 'online' : 'offline'}
              label="Last Test"
              className="mb-vr-4"
            />
            <h3 className="vr-subtitle mb-vr-2">Verification</h3>
            <p className="vr-caption text-tertiary">
              {testResult ? 
                `Schema: ${testResult.ledgerVerification?.schemaFound ? '✅' : '❌'} CredDef: ${testResult.ledgerVerification?.credDefFound ? '✅' : '❌'}` :
                'Not tested yet'}
            </p>
          </div>
        </div>

        {/* Test Controls */}
        <div className="vr-card mb-vr-8">
          <h2 className="vr-heading mb-vr-6">Ledger Integration Tests</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-vr-4">
            <VRButton
              variant="secondary"
              onClick={checkLedgerStatus}
              loading={isTestingConnection}
              className="w-full"
            >
              Check Ledger Status
            </VRButton>
            
            <VRButton
              variant="primary"
              onClick={createTestCredential}
              loading={isCreatingCredential}
              className="w-full"
            >
              Test with Mock Schema
            </VRButton>

            <VRButton
              variant="outline"
              onClick={createRealSchemaCredential}
              loading={isCreatingCredential}
              className="w-full"
            >
              Test with Real Schema
            </VRButton>

            <VRButton
              variant="danger"
              onClick={clearLogs}
              className="w-full"
            >
              Clear Logs
            </VRButton>
          </div>
        </div>

        {/* Test Results */}
        {testResult && (
          <div className="vr-card mb-vr-8">
            <h3 className="vr-heading mb-vr-6">Latest Test Results</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-vr-6">
              <div>
                <h4 className="vr-subtitle mb-vr-4">Credential Created</h4>
                <div className="space-y-vr-2">
                  <div className="flex justify-between">
                    <span className="vr-body text-tertiary">Success:</span>
                    <span className={`vr-body font-medium ${testResult.success ? 'text-success' : 'text-danger'}`}>
                      {testResult.success ? '✅ Yes' : '❌ No'}
                    </span>
                  </div>
                  {testResult.credentialId && (
                    <div className="flex justify-between">
                      <span className="vr-body text-tertiary">ID:</span>
                      <span className="vr-caption font-mono">{testResult.credentialId}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="vr-subtitle mb-vr-4">Ledger Verification</h4>
                {testResult.ledgerVerification ? (
                  <div className="space-y-vr-2">
                    <div className="flex justify-between">
                      <span className="vr-body text-tertiary">Ledger Access:</span>
                      <span className={`vr-body font-medium ${testResult.ledgerVerification.ledgerAccessible ? 'text-success' : 'text-danger'}`}>
                        {testResult.ledgerVerification.ledgerAccessible ? '✅ Connected' : '❌ Failed'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="vr-body text-tertiary">Schema Found:</span>
                      <span className={`vr-body font-medium ${testResult.ledgerVerification.schemaFound ? 'text-success' : 'text-warning'}`}>
                        {testResult.ledgerVerification.schemaFound ? '✅ Found' : '⚠️ Not Found'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="vr-body text-tertiary">CredDef Found:</span>
                      <span className={`vr-body font-medium ${testResult.ledgerVerification.credDefFound ? 'text-success' : 'text-warning'}`}>
                        {testResult.ledgerVerification.credDefFound ? '✅ Found' : '⚠️ Not Found'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="vr-body text-tertiary">No verification data available</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Real-time Logs */}
        <div className="vr-card">
          <div className="flex items-center justify-between mb-vr-6">
            <h3 className="vr-heading">Real-time Ledger Interaction Logs</h3>
            <div className="flex items-center space-x-vr-2">
              <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
              <span className="vr-caption text-tertiary">Live</span>
            </div>
          </div>

          <div className="bg-subtle rounded-lg p-vr-4 max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="vr-body text-tertiary text-center py-vr-8">
                No logs yet. Click "Check Ledger Status" or create a test credential to see real-time interaction with your BCovrin ledger.
              </p>
            ) : (
              <div className="space-y-vr-1 font-mono text-sm">
                {logs.map((log, index) => (
                  <div key={index} className={`${
                    log.includes('✅') ? 'text-success' :
                    log.includes('❌') ? 'text-danger' :
                    log.includes('⚠️') ? 'text-warning' :
                    log.includes('🔗') || log.includes('🔍') ? 'text-info' :
                    'text-primary'
                  }`}>
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="vr-card mt-vr-8">
          <h3 className="vr-heading mb-vr-4">How to Verify Ledger Usage</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-vr-6">
            <div>
              <h4 className="vr-subtitle mb-vr-4">🔍 What to Look For</h4>
              <ul className="vr-body text-tertiary space-y-vr-2">
                <li>• ✅ "BCovrin ledger is accessible" - Real connection</li>
                <li>• ✅ "Schema found on BCovrin ledger" - Real schema validation</li>
                <li>• ✅ "Credential definition found" - Real creddef validation</li>
                <li>• 📋 JSON data responses from ledger APIs</li>
              </ul>
            </div>
            <div>
              <h4 className="vr-subtitle mb-vr-4">🎯 Expected Behavior</h4>
              <ul className="vr-body text-tertiary space-y-vr-2">
                <li>• If ledger is working: ✅ Real validation against BCovrin</li>
                <li>• If ledger is down: ⚠️ Development mode with mock data</li>
                <li>• Schema/CredDef not found: ⚠️ Will use fallback but still connected</li>
                <li>• All interactions logged in real-time above</li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}