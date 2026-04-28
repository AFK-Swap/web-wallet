import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'
import type { 
  WalletConfig, 
  ConnectionRecord, 
  CredentialRecord, 
  ProofRecord, 
  WalletEvent, 
  InvitationData,
  ProofRequestData,
  WalletStats
} from './types'
import { WalletError, ConnectionError, CredentialError, ProofError } from './types'

// Simplified HTTP-based wallet for testing without native dependencies
export class VRWalletAgent {
  private static instance: VRWalletAgent
  private eventListeners: ((event: WalletEvent) => void)[] = []
  private isInitialized = false
  private agentApiUrl = 'http://localhost:8031' // Alice ACA-Py admin URL (Holder agent)
  private connections: ConnectionRecord[] = []
  private credentials: CredentialRecord[] = []
  private proofs: ProofRecord[] = []

  static getInstance(): VRWalletAgent {
    if (!VRWalletAgent.instance) {
      VRWalletAgent.instance = new VRWalletAgent()
    }
    return VRWalletAgent.instance
  }

  async initialize(config?: Partial<WalletConfig>): Promise<any> {
    if (this.isInitialized) {
      return Promise.resolve({})
    }

    try {
      // For now, just mark as initialized
      // In a real implementation, this would set up the HTTP client
      this.isInitialized = true
      
      this.emitEvent({
        type: 'connection',
        data: { status: 'initialized' },
        timestamp: new Date().toISOString()
      })

      console.log('VR Wallet Agent initialized successfully (HTTP mode)')
      return {}

    } catch (error) {
      this.emitEvent({
        type: 'error',
        data: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date().toISOString()
      })
      throw new WalletError('Failed to initialize wallet agent', 'INIT_ERROR', error)
    }
  }

  async shutdown(): Promise<void> {
    this.isInitialized = false
    this.eventListeners = []
    this.connections = []
    this.credentials = []
    this.proofs = []
  }

  // Event Management
  addEventListener(listener: (event: WalletEvent) => void): void {
    this.eventListeners.push(listener)
  }

  removeEventListener(listener: (event: WalletEvent) => void): void {
    this.eventListeners = this.eventListeners.filter(l => l !== listener)
  }

  private emitEvent(event: WalletEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        console.error('Error in event listener:', error)
      }
    })
  }

  // Connection Management
  async createInvitation(): Promise<InvitationData> {
    if (!this.isInitialized) throw new WalletError('Agent not initialized')

    try {
      const invitationId = this.generateId()
      const invitationUrl = `http://localhost:3001/invitation?c_i=${encodeURIComponent(JSON.stringify({
        id: invitationId,
        type: 'https://didcomm.org/connections/1.0/invitation',
        label: 'VR Web Wallet',
        serviceEndpoint: 'http://localhost:3001/didcomm',
        recipientKeys: [`did:key:${this.generateId()}`]
      }))}`
      
      // Create a mock connection record
      const connection: ConnectionRecord = {
        id: invitationId,
        state: 'invitation-sent',
        theirLabel: undefined,
        theirDid: undefined,
        myDid: `did:key:${this.generateId()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      this.connections.push(connection)
      
      return {
        invitationUrl,
        qrCodeData: invitationUrl,
        connectionId: invitationId
      }
    } catch (error) {
      throw new ConnectionError('Failed to create invitation', error)
    }
  }

  async receiveInvitation(invitationUrl: string): Promise<ConnectionRecord> {
    if (!this.isInitialized) throw new WalletError('Agent not initialized')

    try {
      const connectionId = this.generateId()
      const connection: ConnectionRecord = {
        id: connectionId,
        state: 'request-sent',
        theirLabel: 'External Agent',
        theirDid: `did:key:${this.generateId()}`,
        myDid: `did:key:${this.generateId()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      this.connections.push(connection)
      return connection
    } catch (error) {
      throw new ConnectionError('Failed to receive invitation', error)
    }
  }

  async getConnections(): Promise<ConnectionRecord[]> {
    if (!this.isInitialized) throw new WalletError('Agent not initialized')
    return [...this.connections]
  }

  async getConnectionById(id: string): Promise<ConnectionRecord | null> {
    if (!this.isInitialized) throw new WalletError('Agent not initialized')
    return this.connections.find(conn => conn.id === id) || null
  }

  // Credential Management
  async getCredentials(): Promise<CredentialRecord[]> {
    if (!this.isInitialized) throw new WalletError('Agent not initialized')
    return [...this.credentials]
  }

  async getCredentialById(id: string): Promise<CredentialRecord | null> {
    if (!this.isInitialized) throw new WalletError('Agent not initialized')
    return this.credentials.find(cred => cred.id === id) || null
  }

  async acceptCredentialOffer(credentialId: string): Promise<void> {
    if (!this.isInitialized) throw new WalletError('Agent not initialized')

    try {
      const credential = this.credentials.find(cred => cred.id === credentialId)
      if (credential) {
        credential.state = 'done'
        credential.updatedAt = new Date().toISOString()
        
        this.emitEvent({
          type: 'credential',
          data: {
            credentialId: credential.id,
            state: credential.state,
            connectionId: credential.connectionId
          },
          timestamp: new Date().toISOString()
        })
      }
    } catch (error) {
      throw new CredentialError('Failed to accept credential offer', error)
    }
  }

  async declineCredentialOffer(credentialId: string): Promise<void> {
    if (!this.isInitialized) throw new WalletError('Agent not initialized')

    try {
      this.credentials = this.credentials.filter(cred => cred.id !== credentialId)
    } catch (error) {
      throw new CredentialError('Failed to decline credential offer', error)
    }
  }

  // Proof Management
  async getProofs(): Promise<ProofRecord[]> {
    if (!this.isInitialized) throw new WalletError('Agent not initialized')
    return [...this.proofs]
  }

  async getProofById(id: string): Promise<ProofRecord | null> {
    if (!this.isInitialized) throw new WalletError('Agent not initialized')
    return this.proofs.find(proof => proof.id === id) || null
  }

  async getProofRequestData(proofId: string): Promise<ProofRequestData | null> {
    if (!this.isInitialized) throw new WalletError('Agent not initialized')

    try {
      const proof = this.proofs.find(p => p.id === proofId)
      if (!proof) return null

      // Get available credentials for this proof request
      const availableCredentials = this.credentials.filter(cred => cred.state === 'done')

      return {
        proofRecord: proof,
        requestedCredentials: availableCredentials,
        canRespond: proof.state === 'request-received'
      }
    } catch (error) {
      throw new ProofError('Failed to get proof request data', error)
    }
  }

  async acceptProofRequest(proofId: string, selectedCredentialIds: string[]): Promise<void> {
    if (!this.isInitialized) throw new WalletError('Agent not initialized')

    try {
      const proof = this.proofs.find(p => p.id === proofId)
      if (proof) {
        proof.state = 'presentation-sent'
        proof.updatedAt = new Date().toISOString()
        
        this.emitEvent({
          type: 'proof',
          data: {
            proofId: proof.id,
            state: proof.state,
            connectionId: proof.connectionId
          },
          timestamp: new Date().toISOString()
        })
      }
    } catch (error) {
      throw new ProofError('Failed to accept proof request', error)
    }
  }

  async declineProofRequest(proofId: string): Promise<void> {
    if (!this.isInitialized) throw new WalletError('Agent not initialized')

    try {
      this.proofs = this.proofs.filter(proof => proof.id !== proofId)
    } catch (error) {
      throw new ProofError('Failed to decline proof request', error)
    }
  }

  // Wallet Statistics
  async getWalletStats(): Promise<WalletStats> {
    if (!this.isInitialized) {
      return {
        connections: 0,
        credentials: 0,
        proofs: 0,
        isInitialized: false,
        isConnected: false
      }
    }

    const activeConnections = this.connections.filter(conn => 
      conn.state === 'completed' || conn.state === 'response-sent'
    )

    return {
      connections: activeConnections.length,
      credentials: this.credentials.filter(cred => cred.state === 'done').length,
      proofs: this.proofs.length,
      isInitialized: true,
      isConnected: activeConnections.length > 0
    }
  }

  // Utility Methods
  private generateId(): string {
    return uuidv4().replace(/-/g, '').substring(0, 12)
  }

  // Health Check
  isReady(): boolean {
    return this.isInitialized
  }

  getAgent(): any | null {
    return null // No actual agent in HTTP mode
  }

  // Mock data methods for testing
  addMockCredential(attributes: Record<string, string | number> = {}): void {
    const credential: CredentialRecord = {
      id: this.generateId(),
      state: 'offer-received',
      connectionId: this.connections[0]?.id,
      threadId: this.generateId(),
      credentialAttributes: attributes.name ? attributes : {
        name: 'John Doe',
        age: '25',
        email: 'john@example.com',
        ...attributes
      },
      schemaId: 'BzCbsNYhMrjHiqZDTUASHg:2:student_card:1.0',
      credentialDefinitionId: 'BzCbsNYhMrjHiqZDTUASHg:3:CL:123:TAG',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {}
    }
    
    this.credentials.push(credential)
    
    this.emitEvent({
      type: 'credential',
      data: {
        credentialId: credential.id,
        state: credential.state,
        connectionId: credential.connectionId
      },
      timestamp: new Date().toISOString()
    })
  }

  addMockProofRequest(): void {
    const proof: ProofRecord = {
      id: this.generateId(),
      state: 'request-received',
      connectionId: this.connections[0]?.id,
      threadId: this.generateId(),
      requestMessage: {
        requestAttachments: [{
          data: {
            json: {
              name: 'Proof Request',
              version: '1.0',
              requested_attributes: {
                name: { name: 'name' },
                age: { name: 'age' }
              },
              requested_predicates: {}
            }
          }
        }]
      },
      presentationMessage: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isVerified: undefined
    }
    
    this.proofs.push(proof)
    
    this.emitEvent({
      type: 'proof',
      data: {
        proofId: proof.id,
        state: proof.state,
        connectionId: proof.connectionId
      },
      timestamp: new Date().toISOString()
    })
  }

  // Simulate connection establishment
  simulateConnectionEstablished(): void {
    if (this.connections.length > 0) {
      const connection = this.connections[0]
      connection.state = 'completed'
      connection.theirLabel = 'Mock Issuer'
      connection.updatedAt = new Date().toISOString()
      
      this.emitEvent({
        type: 'connection',
        data: {
          connectionId: connection.id,
          state: connection.state,
          theirLabel: connection.theirLabel
        },
        timestamp: new Date().toISOString()
      })
    }
  }
}