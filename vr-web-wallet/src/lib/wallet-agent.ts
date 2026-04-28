// Web-compatible wallet agent using DIDComm messaging and browser storage
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

// Web wallet implementation using DIDComm protocols and browser storage
export class VRWalletAgent {
  private static instance: VRWalletAgent
  private eventListeners: ((event: WalletEvent) => void)[] = []
  private isInitialized = false
  private walletId: string
  private walletKey: string
  private endpoint: string

  constructor() {
    // Initialize with default values, will be set properly during initialize()
    this.walletId = ''
    this.walletKey = ''
    this.endpoint = ''
  }

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
      // Initialize browser-specific values
      if (typeof window !== 'undefined') {
        this.walletId = localStorage.getItem('vr-wallet-id') || this.generateId()
        this.walletKey = localStorage.getItem('vr-wallet-key') || this.generateSecureKey()
        this.endpoint = `${window.location.origin}/api/didcomm`
        
        // Store wallet credentials in localStorage
        localStorage.setItem('vr-wallet-id', this.walletId)
        localStorage.setItem('vr-wallet-key', this.walletKey)
      } else {
        // Server-side fallback
        this.walletId = this.generateId()
        this.walletKey = this.generateSecureKey()
        this.endpoint = '/api/didcomm'
      }
      
      // Initialize IndexedDB for storing connections, credentials, and proofs
      await this.initializeStorage()
      
      this.isInitialized = true
      
      this.emitEvent({
        type: 'connection',
        data: { status: 'initialized' },
        timestamp: new Date().toISOString()
      })

      console.log('VR Wallet Agent initialized successfully (Web mode)')
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
  }

  private async initializeStorage(): Promise<void> {
    if (typeof window === 'undefined') {
      // Server-side - just resolve
      return Promise.resolve()
    }
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('VRWalletDB', 1)
      
      request.onerror = () => reject(new Error('Failed to open IndexedDB'))
      
      request.onsuccess = () => {
        resolve()
      }
      
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result
        
        // Create object stores
        if (!db.objectStoreNames.contains('connections')) {
          db.createObjectStore('connections', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('credentials')) {
          db.createObjectStore('credentials', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('proofs')) {
          db.createObjectStore('proofs', { keyPath: 'id' })
        }
      }
    })
  }

  private async getFromStorage<T>(storeName: string, key?: string): Promise<T[]> {
    if (typeof window === 'undefined') {
      return Promise.resolve([])
    }
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('VRWalletDB', 1)
      
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction([storeName], 'readonly')
        const store = transaction.objectStore(storeName)
        
        if (key) {
          const getRequest = store.get(key)
          getRequest.onsuccess = () => resolve(getRequest.result ? [getRequest.result] : [])
          getRequest.onerror = () => reject(new Error(`Failed to get ${key} from ${storeName}`))
        } else {
          const getAllRequest = store.getAll()
          getAllRequest.onsuccess = () => resolve(getAllRequest.result || [])
          getAllRequest.onerror = () => reject(new Error(`Failed to get all from ${storeName}`))
        }
      }
      
      request.onerror = () => reject(new Error('Failed to open IndexedDB'))
    })
  }

  private async saveToStorage<T>(storeName: string, data: T): Promise<void> {
    if (typeof window === 'undefined') {
      return Promise.resolve()
    }
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('VRWalletDB', 1)
      
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction([storeName], 'readwrite')
        const store = transaction.objectStore(storeName)
        
        const putRequest = store.put(data)
        putRequest.onsuccess = () => resolve()
        putRequest.onerror = () => reject(new Error(`Failed to save to ${storeName}`))
      }
      
      request.onerror = () => reject(new Error('Failed to open IndexedDB'))
    })
  }

  private async deleteFromStorage(storeName: string, key: string): Promise<void> {
    if (typeof window === 'undefined') {
      return Promise.resolve()
    }
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('VRWalletDB', 1)
      
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction([storeName], 'readwrite')
        const store = transaction.objectStore(storeName)
        
        const deleteRequest = store.delete(key)
        deleteRequest.onsuccess = () => resolve()
        deleteRequest.onerror = () => reject(new Error(`Failed to delete ${key} from ${storeName}`))
      }
      
      request.onerror = () => reject(new Error('Failed to open IndexedDB'))
    })
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
      const recipientKey = this.generateDidKey()
      
      // Create DIDComm invitation
      const invitation = {
        '@type': 'https://didcomm.org/connections/1.0/invitation',
        '@id': invitationId,
        label: 'VR Web Wallet',
        serviceEndpoint: this.endpoint,
        recipientKeys: [recipientKey]
      }
      
      const invitationUrl = `${window.location.origin}/invitation?c_i=${encodeURIComponent(JSON.stringify(invitation))}`
      
      // Create connection record
      const connection: ConnectionRecord = {
        id: invitationId,
        state: 'invitation-sent',
        theirLabel: undefined,
        theirDid: undefined,
        myDid: recipientKey,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      await this.saveToStorage('connections', connection)
      
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
      // Parse invitation from URL
      const url = new URL(invitationUrl)
      const invitationParam = url.searchParams.get('c_i')
      
      if (!invitationParam) {
        throw new Error('Invalid invitation URL')
      }
      
      const invitation = JSON.parse(decodeURIComponent(invitationParam))
      
      const connectionId = this.generateId()
      const connection: ConnectionRecord = {
        id: connectionId,
        state: 'request-sent',
        theirLabel: invitation.label || 'External Agent',
        theirDid: invitation.recipientKeys?.[0],
        myDid: this.generateDidKey(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      await this.saveToStorage('connections', connection)
      return connection
    } catch (error) {
      throw new ConnectionError('Failed to receive invitation', error)
    }
  }

  async getConnections(): Promise<ConnectionRecord[]> {
    if (!this.isInitialized) throw new WalletError('Agent not initialized')
    return await this.getFromStorage<ConnectionRecord>('connections')
  }

  async getConnectionById(id: string): Promise<ConnectionRecord | null> {
    if (!this.isInitialized) throw new WalletError('Agent not initialized')
    
    try {
      const connections = await this.getFromStorage<ConnectionRecord>('connections', id)
      return connections[0] || null
    } catch (error) {
      return null
    }
  }

  // Credential Management
  async getCredentials(): Promise<CredentialRecord[]> {
    if (!this.isInitialized) throw new WalletError('Agent not initialized')
    return await this.getFromStorage<CredentialRecord>('credentials')
  }

  async getCredentialById(id: string): Promise<CredentialRecord | null> {
    if (!this.isInitialized) throw new WalletError('Agent not initialized')
    
    try {
      const credentials = await this.getFromStorage<CredentialRecord>('credentials', id)
      return credentials[0] || null
    } catch (error) {
      return null
    }
  }

  async acceptCredentialOffer(credentialId: string): Promise<void> {
    if (!this.isInitialized) throw new WalletError('Agent not initialized')

    try {
      const credentials = await this.getFromStorage<CredentialRecord>('credentials', credentialId)
      const credential = credentials[0]
      
      if (credential) {
        credential.state = 'done'
        credential.updatedAt = new Date().toISOString()
        
        await this.saveToStorage('credentials', credential)
        
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
      await this.deleteFromStorage('credentials', credentialId)
    } catch (error) {
      throw new CredentialError('Failed to decline credential offer', error)
    }
  }

  // Proof Management
  async getProofs(): Promise<ProofRecord[]> {
    if (!this.isInitialized) throw new WalletError('Agent not initialized')
    return await this.getFromStorage<ProofRecord>('proofs')
  }

  async getProofById(id: string): Promise<ProofRecord | null> {
    if (!this.isInitialized) throw new WalletError('Agent not initialized')
    
    try {
      const proofs = await this.getFromStorage<ProofRecord>('proofs', id)
      return proofs[0] || null
    } catch (error) {
      return null
    }
  }

  async getProofRequestData(proofId: string): Promise<ProofRequestData | null> {
    if (!this.isInitialized) throw new WalletError('Agent not initialized')

    try {
      const proofs = await this.getFromStorage<ProofRecord>('proofs', proofId)
      const proof = proofs[0]
      if (!proof) return null

      const credentials = await this.getCredentials()
      const availableCredentials = credentials.filter(cred => cred.state === 'done')

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
      const proofs = await this.getFromStorage<ProofRecord>('proofs', proofId)
      const proof = proofs[0]
      
      if (proof) {
        proof.state = 'presentation-sent'
        proof.updatedAt = new Date().toISOString()
        
        await this.saveToStorage('proofs', proof)
        
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
      await this.deleteFromStorage('proofs', proofId)
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

    try {
      const [connections, credentials, proofs] = await Promise.all([
        this.getConnections(),
        this.getCredentials(),
        this.getProofs()
      ])

      const activeConnections = connections.filter(conn => 
        conn.state === 'completed' || conn.state === 'response-sent'
      )

      return {
        connections: activeConnections.length,
        credentials: credentials.filter(cred => cred.state === 'done').length,
        proofs: proofs.length,
        isInitialized: true,
        isConnected: activeConnections.length > 0
      }
    } catch (error) {
      throw new WalletError('Failed to get wallet stats', error)
    }
  }

  // Utility Methods
  private generateId(): string {
    return uuidv4().replace(/-/g, '').substring(0, 12)
  }

  private generateSecureKey(): string {
    if (typeof window === 'undefined') {
      // Server-side fallback
      return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2)
    }
    
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  private generateDidKey(): string {
    return `did:key:z${this.generateId()}`
  }

  // Health Check
  isReady(): boolean {
    return this.isInitialized
  }

  getAgent(): any | null {
    return null // No actual AFJ agent in web mode
  }

  // Test/Demo methods for manual API testing
  async addTestCredential(): Promise<void> {
    if (!this.isInitialized) throw new WalletError('Agent not initialized')

    const connections = await this.getConnections()
    const credential: CredentialRecord = {
      id: this.generateId(),
      state: 'offer-received',
      connectionId: connections[0]?.id,
      threadId: this.generateId(),
      credentialAttributes: {
        name: 'Test User',
        age: '25',
        email: 'test@example.com',
        university: 'Test University'
      },
      schemaId: 'BzCbsNYhMrjHiqZDTUASHg:2:student_card:1.0',
      credentialDefinitionId: 'BzCbsNYhMrjHiqZDTUASHg:3:CL:123:TAG',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {}
    }
    
    await this.saveToStorage('credentials', credential)
    
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

  async addTestProofRequest(): Promise<void> {
    if (!this.isInitialized) throw new WalletError('Agent not initialized')

    const connections = await this.getConnections()
    const proof: ProofRecord = {
      id: this.generateId(),
      state: 'request-received',
      connectionId: connections[0]?.id,
      threadId: this.generateId(),
      requestMessage: {
        requestAttachments: [{
          data: {
            json: {
              name: 'Age Verification',
              version: '1.0',
              requested_attributes: {
                name: { name: 'name' },
                university: { name: 'university' }
              },
              requested_predicates: {
                age: { name: 'age', p_type: '>=', p_value: 18 }
              }
            }
          }
        }]
      },
      presentationMessage: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isVerified: undefined
    }
    
    await this.saveToStorage('proofs', proof)
    
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

  // Simulate connection completion for testing
  async simulateConnectionComplete(): Promise<void> {
    const connections = await this.getConnections()
    if (connections.length > 0) {
      const connection = connections[0]
      connection.state = 'completed'
      connection.theirLabel = 'Test Issuer/Verifier'
      connection.updatedAt = new Date().toISOString()
      
      await this.saveToStorage('connections', connection)
      
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