'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { VRButton } from '@/components/VRButton'

interface ProofRequest {
  name: string
  version: string
  requested_attributes: {
    [key: string]: {
      name: string
      restrictions?: any[]
    }
  }
  requested_predicates?: {
    [key: string]: {
      name: string
      p_type: string
      p_value: number
      restrictions?: any[]
    }
  }
}

export default function VerifyPage() {
  const [isCreating, setIsCreating] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')

  const proofTemplates = {
    education: {
      name: 'Education Verification',
      description: 'Request verification of educational credentials',
      attributes: ['name', 'degree', 'university', 'date']
    },
    identity: {
      name: 'Identity Verification', 
      description: 'Request basic identity information',
      attributes: ['name', 'age', 'country']
    },
    vr_gaming: {
      name: 'VR Gaming Profile',
      description: 'Request VR gaming achievements and profile',
      attributes: ['name', 'level', 'achievements', 'platform']
    },
    custom: {
      name: 'Custom Request',
      description: 'Create a custom proof request',
      attributes: []
    }
  }

  const [customAttributes, setCustomAttributes] = useState<string[]>([''])

  const addCustomAttribute = () => {
    setCustomAttributes([...customAttributes, ''])
  }

  const updateCustomAttribute = (index: number, value: string) => {
    const updated = [...customAttributes]
    updated[index] = value
    setCustomAttributes(updated)
  }

  const removeCustomAttribute = (index: number) => {
    setCustomAttributes(customAttributes.filter((_, i) => i !== index))
  }

  const createProofRequest = async () => {
    setIsCreating(true)
    
    try {
      let attributes: string[] = []
      
      if (selectedTemplate === 'custom') {
        attributes = customAttributes.filter(attr => attr.trim() !== '')
      } else if (selectedTemplate) {
        attributes = proofTemplates[selectedTemplate as keyof typeof proofTemplates].attributes
      }

      if (attributes.length === 0) {
        alert('Please select attributes to request')
        return
      }

      const proofRequest: ProofRequest = {
        name: proofTemplates[selectedTemplate as keyof typeof proofTemplates]?.name || 'Custom Proof Request',
        version: '1.0',
        requested_attributes: {}
      }

      // Build requested attributes
      attributes.forEach((attr, index) => {
        proofRequest.requested_attributes[`attr_${index}`] = {
          name: attr.toLowerCase().trim()
        }
      })

      const response = await fetch('/api/proof-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(proofRequest)
      })

      if (response.ok) {
        const result = await response.json()
        alert(`Proof request created successfully! ID: ${result.proofRequest.id}`)
        setSelectedTemplate('')
        setCustomAttributes([''])
      } else {
        alert('Failed to create proof request')
      }
    } catch (error) {
      console.error('Error creating proof request:', error)
      alert('Error creating proof request')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-vr-bg-primary">
      <div className="max-w-4xl mx-auto px-vr-6 py-vr-12">
        
        {/* Header */}
        <header className="mb-vr-12">
          <div className="flex items-center justify-between mb-vr-6">
            <Link href="/" className="vr-btn vr-btn-ghost vr-btn-sm">
              ← Back to Wallet
            </Link>
          </div>
          <h1 className="vr-title mb-vr-4">Create Verification Request</h1>
          <p className="vr-body-large text-tertiary">
            Request specific information to be verified from credential holders
          </p>
        </header>

        {/* Template Selection */}
        <div className="mb-vr-8">
          <h2 className="vr-heading mb-vr-6">Select Verification Template</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-vr-4">
            {Object.entries(proofTemplates).map(([key, template]) => (
              <div
                key={key}
                className={`vr-card vr-card-interactive cursor-pointer transition-all ${
                  selectedTemplate === key ? 'border-accent bg-accent bg-opacity-5' : ''
                }`}
                onClick={() => setSelectedTemplate(key)}
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-accent bg-opacity-10 rounded-lg flex items-center justify-center">
                      <span className="text-xl">
                        {key === 'education' ? '🎓' :
                         key === 'identity' ? '🆔' :
                         key === 'vr_gaming' ? '🎮' : '⚙️'}
                      </span>
                    </div>
                  </div>
                  <div className="flex-grow">
                    <h3 className="vr-subtitle mb-vr-2">{template.name}</h3>
                    <p className="vr-body text-tertiary mb-vr-3">{template.description}</p>
                    {template.attributes.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {template.attributes.map((attr) => (
                          <span key={attr} className="px-2 py-1 bg-accent bg-opacity-10 rounded text-xs text-accent">
                            {attr}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedTemplate === key && (
                    <div className="flex-shrink-0">
                      <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center">
                        <span className="text-primary text-sm">✓</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Custom Attributes */}
        {selectedTemplate === 'custom' && (
          <div className="mb-vr-8">
            <h3 className="vr-subtitle mb-vr-4">Custom Attributes</h3>
            <div className="space-y-vr-3">
              {customAttributes.map((attr, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <input
                    type="text"
                    placeholder="Enter attribute name (e.g., name, age, qualification)"
                    value={attr}
                    onChange={(e) => updateCustomAttribute(index, e.target.value)}
                    className="flex-grow px-4 py-3 bg-surface border border-subtle rounded-lg focus:border-accent focus:outline-none text-primary"
                  />
                  {customAttributes.length > 1 && (
                    <VRButton
                      variant="outline"
                      size="sm"
                      onClick={() => removeCustomAttribute(index)}
                    >
                      Remove
                    </VRButton>
                  )}
                </div>
              ))}
              <VRButton
                variant="outline"
                onClick={addCustomAttribute}
                className="w-full"
              >
                + Add Attribute
              </VRButton>
            </div>
          </div>
        )}

        {/* Create Button */}
        {selectedTemplate && (
          <div className="text-center">
            <VRButton
              variant="primary"
              size="lg"
              onClick={createProofRequest}
              loading={isCreating}
              className="min-w-48"
            >
              {isCreating ? 'Creating Request...' : 'Create Proof Request'}
            </VRButton>
          </div>
        )}

        {/* Info Section */}
        <div className="mt-vr-16 text-center">
          <h3 className="vr-heading mb-vr-6">How Verification Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-vr-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-accent bg-opacity-10 rounded-xl flex items-center justify-center mx-auto mb-vr-4">
                <span className="text-2xl">📝</span>
              </div>
              <h4 className="vr-subtitle mb-vr-2">1. Create Request</h4>
              <p className="vr-body text-tertiary">
                Specify what information you need to verify
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-accent bg-opacity-10 rounded-xl flex items-center justify-center mx-auto mb-vr-4">
                <span className="text-2xl">📤</span>
              </div>
              <h4 className="vr-subtitle mb-vr-2">2. Send to Holder</h4>
              <p className="vr-body text-tertiary">
                Share the proof request with the credential holder
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-accent bg-opacity-10 rounded-xl flex items-center justify-center mx-auto mb-vr-4">
                <span className="text-2xl">✅</span>
              </div>
              <h4 className="vr-subtitle mb-vr-2">3. Verify Response</h4>
              <p className="vr-body text-tertiary">
                Receive and verify the cryptographic proof
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}