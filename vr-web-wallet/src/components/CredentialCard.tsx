'use client'

import React from 'react'
import { VRCard } from './VRCard'
import { VRButton } from './VRButton'
import type { CredentialRecord } from '@/lib/types'

interface CredentialCardProps {
  credential: CredentialRecord
  onSelect?: (credential: CredentialRecord) => void
  onView?: (credential: CredentialRecord) => void
  selectable?: boolean
  selected?: boolean
  className?: string
}

export const CredentialCard: React.FC<CredentialCardProps> = ({
  credential,
  onSelect,
  onView,
  selectable = false,
  selected = false,
  className = ''
}) => {
  const getStatusColor = (state: string) => {
    switch (state) {
      case 'done':
        return 'text-vr-success'
      case 'offer-received':
        return 'text-vr-warning'
      case 'request-sent':
        return 'text-vr-info'
      default:
        return 'text-vr-text-dim'
    }
  }

  const getStatusText = (state: string) => {
    switch (state) {
      case 'done':
        return 'Verified'
      case 'offer-received':
        return 'Pending Acceptance'
      case 'request-sent':
        return 'Requesting'
      case 'credential-issued':
        return 'Issued'
      case 'proposal-sent':
        return 'Proposed'
      default:
        return state.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }
  }

  const formatAttributes = (attributes: Record<string, string | number>) => {
    if (!attributes || Object.keys(attributes).length === 0) {
      return 'No attributes available'
    }
    
    const keys = Object.keys(attributes)
    if (keys.length <= 2) {
      return keys.map(key => `${key}: ${attributes[key]}`).join(', ')
    }
    
    return `${keys.length} attributes available`
  }

  return (
    <VRCard
      title={credential.schemaId ? `Schema: ${credential.schemaId.split(':').pop()}` : 'Credential'}
      subtitle={`ID: ${credential.id.substring(0, 8)}...`}
      interactive={selectable}
      onClick={selectable ? () => onSelect?.(credential) : undefined}
      className={`${className} ${selected ? 'ring-4 ring-vr-accent' : ''}`}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className={`vr-caption font-semibold ${getStatusColor(credential.state)}`}>
            {getStatusText(credential.state)}
          </span>
          <span className="vr-caption text-vr-text-dim">
            {new Date(credential.createdAt).toLocaleDateString()}
          </span>
        </div>
        
        {credential.credentialAttributes && (
          <div className="vr-card p-4">
            <p className="vr-body text-vr-text-dim mb-2">
              Attributes:
            </p>
            <p className="vr-caption text-vr-text">
              {formatAttributes(credential.credentialAttributes)}
            </p>
          </div>
        )}
        
        <div className="flex space-x-3 pt-2">
          {onView && (
            <VRButton
              variant="outline"
              size="sm"
              onClick={() => onView(credential)}
            >
              View Details
            </VRButton>
          )}
          
          {selectable && (
            <VRButton
              variant={selected ? "primary" : "secondary"}
              size="sm"
              onClick={() => onSelect?.(credential)}
            >
              {selected ? 'Selected' : 'Select'}
            </VRButton>
          )}
        </div>
      </div>
    </VRCard>
  )
}