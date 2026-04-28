'use client'

import React, { useState } from 'react'
import { VRCard } from './VRCard'
import { VRButton } from './VRButton'
import { CredentialCard } from './CredentialCard'
import type { ProofRequestData, CredentialRecord } from '@/lib/types'

interface ProofRequestCardProps {
  proofRequestData: ProofRequestData
  onAccept?: (proofId: string, selectedCredentialIds: string[]) => void
  onDecline?: (proofId: string) => void
  className?: string
}

export const ProofRequestCard: React.FC<ProofRequestCardProps> = ({
  proofRequestData,
  onAccept,
  onDecline,
  className = ''
}) => {
  const [selectedCredentials, setSelectedCredentials] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const { proofRecord, requestedCredentials, canRespond } = proofRequestData

  const getStatusColor = (state: string) => {
    switch (state) {
      case 'done':
        return 'text-vr-success'
      case 'request-received':
        return 'text-vr-warning'
      case 'presentation-sent':
        return 'text-vr-info'
      default:
        return 'text-vr-text-dim'
    }
  }

  const getStatusText = (state: string) => {
    switch (state) {
      case 'done':
        return 'Verified'
      case 'request-received':
        return 'Awaiting Response'
      case 'presentation-sent':
        return 'Response Sent'
      case 'proposal-sent':
        return 'Proposed'
      default:
        return state.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }
  }

  const handleCredentialSelect = (credential: CredentialRecord) => {
    setSelectedCredentials(prev => {
      if (prev.includes(credential.id)) {
        return prev.filter(id => id !== credential.id)
      } else {
        return [...prev, credential.id]
      }
    })
  }

  const handleAccept = async () => {
    if (!onAccept || selectedCredentials.length === 0) return
    
    setIsProcessing(true)
    try {
      await onAccept(proofRecord.id, selectedCredentials)
      
      // Check for auto-close after successful credential sharing
      if (typeof window !== 'undefined' && (window as any).minecraftAutoClose) {
        console.log('Auto-closing window after credential sharing');
        setTimeout(() => {
          window.close();
        }, 2000); // 2 second delay to show success message
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDecline = async () => {
    if (!onDecline) return
    
    setIsProcessing(true)
    try {
      await onDecline(proofRecord.id)
      
      // Check for auto-close after declining credential request
      if (typeof window !== 'undefined' && (window as any).minecraftAutoClose) {
        console.log('Auto-closing window after declining request');
        setTimeout(() => {
          window.close();
        }, 1000); // 1 second delay for decline
      }
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <VRCard
      title="Proof Request"
      subtitle={`ID: ${proofRecord.id.substring(0, 8)}...`}
      className={className}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <span className={`vr-body font-semibold ${getStatusColor(proofRecord.state)}`}>
            {getStatusText(proofRecord.state)}
          </span>
          <span className="vr-caption text-vr-text-dim">
            {new Date(proofRecord.createdAt).toLocaleDateString()}
          </span>
        </div>

        {proofRecord.requestMessage && (
          <div className="vr-card p-4">
            <h4 className="vr-subtitle text-vr-primary mb-3">
              Request Details
            </h4>
            <p className="vr-body text-vr-text-dim">
              This verifier is requesting proof of your credentials. Review the available credentials below and select which ones to share.
            </p>
          </div>
        )}

        {canRespond && requestedCredentials.length > 0 && (
          <div className="space-y-4">
            <h4 className="vr-subtitle text-vr-primary">
              Available Credentials ({requestedCredentials.length})
            </h4>
            <div className="space-y-3">
              {requestedCredentials.map((credential) => (
                <CredentialCard
                  key={credential.id}
                  credential={credential}
                  selectable={canRespond}
                  selected={selectedCredentials.includes(credential.id)}
                  onSelect={handleCredentialSelect}
                />
              ))}
            </div>
          </div>
        )}

        {canRespond && requestedCredentials.length === 0 && (
          <div className="vr-card p-6 text-center">
            <p className="vr-body text-vr-danger">
              No matching credentials found for this proof request.
            </p>
            <p className="vr-caption text-vr-text-dim mt-2">
              You may need to receive the required credentials first.
            </p>
          </div>
        )}

        {canRespond && (
          <div className="flex space-x-4 pt-4">
            <VRButton
              variant="primary"
              size="lg"
              onClick={handleAccept}
              disabled={selectedCredentials.length === 0 || isProcessing}
              loading={isProcessing}
              className="flex-1"
            >
              Share Selected Credentials ({selectedCredentials.length})
            </VRButton>
            
            <VRButton
              variant="danger"
              size="lg"
              onClick={handleDecline}
              disabled={isProcessing}
              className="flex-1"
            >
              Decline Request
            </VRButton>
          </div>
        )}

        {!canRespond && (
          <div className="pt-4">
            <VRButton
              variant="outline"
              size="lg"
              disabled
              className="w-full"
            >
              {proofRecord.state === 'done' ? 'Proof Completed' : 'Cannot Respond'}
            </VRButton>
          </div>
        )}
      </div>
    </VRCard>
  )
}