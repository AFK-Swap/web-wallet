// Core wallet types and interfaces

export interface WalletConfig {
  id: string
  key: string
  label: string
  endpoints?: string[]
  mediatorUrl?: string
  autoAcceptConnections?: boolean
  autoAcceptCredentials?: 'always' | 'contentApproved' | 'never'
  autoAcceptProofs?: 'always' | 'contentApproved' | 'never'
}

export interface ConnectionRecord {
  id: string
  state: string
  theirLabel?: string
  theirDid?: string
  myDid?: string
  createdAt: string
  updatedAt: string
}

export interface CredentialRecord {
  id: string
  state: string
  connectionId?: string
  threadId?: string
  credentialAttributes?: Record<string, string | number>
  schemaId?: string
  credentialDefinitionId?: string
  createdAt: string
  updatedAt: string
  metadata?: any
}

export interface ProofRecord {
  id: string
  state: string
  connectionId?: string
  threadId?: string
  requestMessage?: any
  presentationMessage?: any
  createdAt: string
  updatedAt: string
  isVerified?: boolean
}

export interface WalletStats {
  connections: number
  credentials: number
  proofs: number
  isInitialized: boolean
  isConnected: boolean
}

export interface WalletEvent {
  type: 'connection' | 'credential' | 'proof' | 'error'
  data: any
  timestamp: string
}

export interface InvitationData {
  invitationUrl: string
  qrCodeData: string
  connectionId?: string
}

export interface ProofRequest {
  id: string
  name?: string
  version?: string
  requestedAttributes: Record<string, {
    name: string
    restrictions?: any[]
  }>
  requestedPredicates: Record<string, {
    name: string
    p_type: '>=' | '>' | '<=' | '<'
    p_value: number
    restrictions?: any[]
  }>
  nonRevoked?: {
    from?: number
    to?: number
  }
}

export interface ProofRequestData {
  proofRecord: ProofRecord
  requestedCredentials: CredentialRecord[]
  canRespond: boolean
}

export interface CredentialOffer {
  id: string
  connectionId: string
  credentialPreview: {
    attributes: Array<{
      name: string
      value: string
    }>
  }
  schemaId?: string
  credentialDefinitionId?: string
}

// UI Component Props
export interface VRButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  disabled?: boolean
  loading?: boolean
  className?: string
}

export interface VRCardProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  interactive?: boolean
  onClick?: () => void
  className?: string
}

export interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'pending'
  label?: string
  className?: string
}

// Error types
export class WalletError extends Error {
  constructor(
    message: string,
    public code?: string,
    public originalError?: any
  ) {
    super(message)
    this.name = 'WalletError'
  }
}

export class ConnectionError extends WalletError {
  constructor(message: string, originalError?: any) {
    super(message, 'CONNECTION_ERROR', originalError)
    this.name = 'ConnectionError'
  }
}

export class CredentialError extends WalletError {
  constructor(message: string, originalError?: any) {
    super(message, 'CREDENTIAL_ERROR', originalError)
    this.name = 'CredentialError'
  }
}

export class ProofError extends WalletError {
  constructor(message: string, originalError?: any) {
    super(message, 'PROOF_ERROR', originalError)
    this.name = 'ProofError'
  }
}