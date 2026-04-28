// Cryptographic utilities for secure credential storage
// Browser-compatible encryption using Web Crypto API

import type { WalletCrypto } from './anoncreds-types'

export class BrowserWalletCrypto implements WalletCrypto {
  private static instance: BrowserWalletCrypto
  
  static getInstance(): BrowserWalletCrypto {
    if (!BrowserWalletCrypto.instance) {
      BrowserWalletCrypto.instance = new BrowserWalletCrypto()
    }
    return BrowserWalletCrypto.instance
  }

  /**
   * Encrypts data using AES-GCM with the provided key
   */
  async encrypt(data: string, key: string): Promise<string> {
    try {
      // Convert key to proper format
      const cryptoKey = await this.deriveKey(key)
      
      // Generate random IV
      const iv = crypto.getRandomValues(new Uint8Array(12))
      
      // Encrypt the data
      const encodedData = new TextEncoder().encode(data)
      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        encodedData
      )
      
      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength)
      combined.set(iv)
      combined.set(new Uint8Array(encryptedBuffer), iv.length)
      
      // Return as base64
      return this.arrayBufferToBase64(combined.buffer)
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Decrypts data using AES-GCM with the provided key
   */
  async decrypt(encryptedData: string, key: string): Promise<string> {
    try {
      // Convert key to proper format
      const cryptoKey = await this.deriveKey(key)
      
      // Decode from base64
      const combined = new Uint8Array(this.base64ToArrayBuffer(encryptedData))
      
      // Extract IV and encrypted data
      const iv = combined.slice(0, 12)
      const encrypted = combined.slice(12)
      
      // Decrypt the data
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        encrypted
      )
      
      // Return as string
      return new TextDecoder().decode(decryptedBuffer)
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generates a cryptographically secure random nonce for AnonCreds
   */
  generateNonce(): string {
    // AnonCreds requires 80-bit nonce (10 bytes)
    const nonce = crypto.getRandomValues(new Uint8Array(10))
    return Array.from(nonce, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Creates a SHA-256 hash of the input data
   */
  async hash(data: string): Promise<string> {
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(data)
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
    return this.arrayBufferToBase64(hashBuffer)
  }

  /**
   * Derives a key from a password/seed using PBKDF2
   */
  private async deriveKey(password: string, salt?: Uint8Array): Promise<CryptoKey> {
    // Use provided salt or generate one from password hash
    const actualSalt = salt || new TextEncoder().encode(password.slice(0, 16).padEnd(16, '0'))
    
    // Import the password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    )
    
    // Derive the actual encryption key
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: actualSalt,
        iterations: 100000, // 100k iterations for security
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
  }

  /**
   * Converts ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    bytes.forEach(byte => binary += String.fromCharCode(byte))
    return btoa(binary)
  }

  /**
   * Converts base64 string to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  }

  /**
   * Generates a secure random wallet key
   */
  static generateWalletKey(): string {
    const array = new Uint8Array(32) // 256-bit key
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Generates a secure random wallet ID
   */
  static generateWalletId(): string {
    const array = new Uint8Array(16) // 128-bit ID
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Validates that we're in a secure context for crypto operations
   */
  static validateSecureContext(): boolean {
    return typeof crypto !== 'undefined' && 
           typeof crypto.subtle !== 'undefined' && 
           (location.protocol === 'https:' || location.hostname === 'localhost')
  }

  /**
   * Creates a backup key for wallet recovery
   */
  async createBackupKey(walletKey: string, userPassphrase: string): Promise<string> {
    const combined = walletKey + '|' + userPassphrase
    return await this.hash(combined)
  }

  /**
   * Encrypts wallet data for backup
   */
  async encryptForBackup(data: any, backupKey: string): Promise<string> {
    const jsonData = JSON.stringify(data)
    return await this.encrypt(jsonData, backupKey)
  }

  /**
   * Decrypts wallet data from backup
   */
  async decryptFromBackup(encryptedData: string, backupKey: string): Promise<any> {
    const jsonData = await this.decrypt(encryptedData, backupKey)
    return JSON.parse(jsonData)
  }
}

// Utility functions for credential encoding (AnonCreds requirement)
export class AnonCredsEncoder {
  /**
   * Encodes a credential attribute value according to AnonCreds rules
   */
  static encode(value: string): string {
    // AnonCreds encoding: convert to integer representation
    // For strings, use SHA-256 hash as BigInteger
    const encoder = new TextEncoder()
    const data = encoder.encode(value)
    
    // Create a simple integer encoding (for demo purposes)
    // In production, you'd use a proper AnonCreds library
    let encoded = ''
    for (let i = 0; i < data.length; i++) {
      encoded += data[i].toString()
    }
    
    // Ensure it's a valid integer string
    return encoded.substring(0, 32).padEnd(32, '0')
  }

  /**
   * Validates that an encoded value matches the raw value
   */
  static validateEncoding(raw: string, encoded: string): boolean {
    return this.encode(raw) === encoded
  }
}

// Export singleton instance
export const walletCrypto = BrowserWalletCrypto.getInstance()