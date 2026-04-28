'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { VRButton } from '@/components/VRButton'
import { VRCard } from '@/components/VRCard'
import { ProofRequestCard } from '@/components/ProofRequestCard'
import { VRWalletAgent } from '@/lib/wallet-agent'
import type { ProofRecord, ProofRequestData } from '@/lib/types'

export default function ProofsPage() {
  const [walletAgent] = useState(() => VRWalletAgent.getInstance())
  const [proofs, setProofs] = useState<ProofRecord[]>([])
  const [proofRequests, setProofRequests] = useState<ProofRequestData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadProofs()
  }, [])

  const loadProofs = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      if (!walletAgent.isReady()) {
        await walletAgent.initialize()
      }
      
      const allProofs = await walletAgent.getProofs()
      setProofs(allProofs)
      
      // Load detailed data for pending proof requests
      const pendingProofs = allProofs.filter(proof => proof.state === 'request-received')
      const proofRequestData = await Promise.all(
        pendingProofs.map(async (proof) => {
          try {
            return await walletAgent.getProofRequestData(proof.id)
          } catch (error) {
            console.error(`Failed to load proof request data for ${proof.id}:`, error)
            return null
          }
        })
      )
      
      setProofRequests(proofRequestData.filter(Boolean) as ProofRequestData[])
    } catch (error) {
      console.error('Failed to load proofs:', error)
      setError(error instanceof Error ? error.message : 'Failed to load proofs')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAcceptProof = async (proofId: string, selectedCredentialIds: string[]) => {
    try {
      await walletAgent.acceptProofRequest(proofId, selectedCredentialIds)
      await loadProofs() // Refresh the list
    } catch (error) {
      console.error('Failed to accept proof request:', error)
      setError(error instanceof Error ? error.message : 'Failed to accept proof request')
    }
  }

  const handleDeclineProof = async (proofId: string) => {
    try {
      await walletAgent.declineProofRequest(proofId)
      await loadProofs() // Refresh the list
    } catch (error) {
      console.error('Failed to decline proof request:', error)
      setError(error instanceof Error ? error.message : 'Failed to decline proof request')
    }
  }

  const filteredProofs = {
    pending: proofs.filter(proof => proof.state === 'request-received'),
    completed: proofs.filter(proof => proof.state === 'done'),
    sent: proofs.filter(proof => proof.state === 'presentation-sent'),
    other: proofs.filter(proof => !['request-received', 'done', 'presentation-sent'].includes(proof.state))
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-vr-bg p-vr-6">
        <div className="max-w-4xl mx-auto">
          <VRCard title="Loading Proofs">
            <div className="text-center py-8">
              <div className="vr-spinner mx-auto mb-4" />
              <p className="vr-body text-vr-text-dim">Loading proof requests...</p>
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
            <h1 className="vr-title text-vr-primary">Proof Requests</h1>
            <p className="vr-subtitle text-vr-text-dim">
              Manage verification requests and proof sharing
            </p>
          </div>
          
          <Link href="/">
            <VRButton variant="outline" size="lg">
              Dashboard
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

        {/* Pending Proof Requests */}
        {proofRequests.length > 0 && (
          <div className="space-y-4">
            <h2 className="vr-heading text-vr-warning">
              Pending Requests ({proofRequests.length})
            </h2>
            <div className="space-y-6">
              {proofRequests.map((proofRequestData) => (
                <ProofRequestCard
                  key={proofRequestData.proofRecord.id}
                  proofRequestData={proofRequestData}
                  onAccept={handleAcceptProof}
                  onDecline={handleDeclineProof}
                  className="border-vr-warning"
                />
              ))}
            </div>
          </div>
        )}

        {/* Completed Proofs */}
        {filteredProofs.completed.length > 0 && (
          <div className="space-y-4">
            <h2 className="vr-heading text-vr-success">
              Completed Proofs ({filteredProofs.completed.length})
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredProofs.completed.map((proof) => (
                <VRCard
                  key={proof.id}
                  title="Proof Completed"
                  subtitle={`ID: ${proof.id.substring(0, 8)}...`}
                  className="border-vr-success"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="vr-body text-vr-success font-semibold">
                        ✓ Verified
                      </span>
                      <span className="vr-caption text-vr-text-dim">
                        {new Date(proof.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    
                    {proof.isVerified !== undefined && (
                      <div className="vr-card p-4">
                        <p className="vr-caption text-vr-text-dim">Verification Status:</p>
                        <p className={`vr-body font-semibold ${proof.isVerified ? 'text-vr-success' : 'text-vr-danger'}`}>
                          {proof.isVerified ? 'Successfully Verified' : 'Verification Failed'}
                        </p>
                      </div>
                    )}
                  </div>
                </VRCard>
              ))}
            </div>
          </div>
        )}

        {/* Sent Proofs (Awaiting Verification) */}
        {filteredProofs.sent.length > 0 && (
          <div className="space-y-4">
            <h2 className="vr-heading text-vr-info">
              Awaiting Verification ({filteredProofs.sent.length})
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredProofs.sent.map((proof) => (
                <VRCard
                  key={proof.id}
                  title="Proof Sent"
                  subtitle={`ID: ${proof.id.substring(0, 8)}...`}
                  className="border-vr-info"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="vr-body text-vr-info font-semibold">
                        ⏳ Pending Verification
                      </span>
                      <span className="vr-caption text-vr-text-dim">
                        {new Date(proof.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <div className="vr-card p-4">
                      <p className="vr-caption text-vr-text-dim">
                        Your proof has been sent and is waiting for the verifier to complete the verification process.
                      </p>
                    </div>
                  </div>
                </VRCard>
              ))}
            </div>
          </div>
        )}

        {/* Other States */}
        {filteredProofs.other.length > 0 && (
          <div className="space-y-4">
            <h2 className="vr-heading text-vr-text-dim">
              Other ({filteredProofs.other.length})
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredProofs.other.map((proof) => (
                <VRCard
                  key={proof.id}
                  title={`Proof ${proof.state}`}
                  subtitle={`ID: ${proof.id.substring(0, 8)}...`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="vr-body text-vr-text-dim">
                        {proof.state.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                      <span className="vr-caption text-vr-text-dim">
                        {new Date(proof.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </VRCard>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {proofs.length === 0 && (
          <VRCard title="No Proof Requests">
            <div className="text-center space-y-6">
              <p className="vr-body text-vr-text-dim">
                You haven't received any proof requests yet. When verifiers request proof of your credentials, they will appear here.
              </p>
              
              <Link href="/credentials">
                <VRButton variant="primary" size="xl">
                  View Your Credentials
                </VRButton>
              </Link>
            </div>
          </VRCard>
        )}

        {/* Summary Stats */}
        {proofs.length > 0 && (
          <VRCard title="Proof Statistics">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-vr-warning">
                  {filteredProofs.pending.length}
                </div>
                <div className="vr-caption text-vr-text-dim">Pending</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-vr-info">
                  {filteredProofs.sent.length}
                </div>
                <div className="vr-caption text-vr-text-dim">Sent</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-vr-success">
                  {filteredProofs.completed.length}
                </div>
                <div className="vr-caption text-vr-text-dim">Completed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-vr-accent">
                  {proofs.length}
                </div>
                <div className="vr-caption text-vr-text-dim">Total</div>
              </div>
            </div>
          </VRCard>
        )}
      </div>
    </div>
  )
}