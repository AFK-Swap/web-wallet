// AnonCreds specific types for real credential storage
// Compatible with Hyperledger Indy / BCovrin VON Network

export interface IndyLedgerConfig {
  genesisUrl: string
  poolName: string
  did?: string
  verkey?: string
}

export interface CredentialSchema {
  id: string
  name: string
  version: string
  attrNames: string[]
  seqNo?: number
  ver?: string
}

export interface CredentialDefinition {
  id: string
  schemaId: string
  tag: string
  type: string
  value: {
    primary: any
    revocation?: any
  }
  ver?: string
}

export interface AnonCredsCredential {
  schema_id: string
  cred_def_id: string
  rev_reg_id?: string
  values: Record<string, {
    raw: string
    encoded: string
  }>
  signature: any
  signature_correctness_proof: any
  rev_reg?: any
  witness?: any
}

export interface EncryptedCredentialRecord {
  id: string
  state: 'offer-received' | 'request-sent' | 'credential-received' | 'done' | 'declined'
  connectionId?: string
  threadId?: string
  
  // AnonCreds specific fields
  schemaId: string
  credentialDefinitionId: string
  revocationRegistryId?: string
  
  // Encrypted credential data
  encryptedCredential?: string  // Encrypted AnonCredsCredential
  credentialOffer?: any
  credentialRequest?: any
  credentialRequestMetadata?: any
  
  // Metadata
  createdAt: string
  updatedAt: string
  isRevoked?: boolean
  revocationTimestamp?: string
  
  // Display data (unencrypted for UI)
  credentialPreview?: {
    attributes: Array<{
      name: string
      value: string
    }>
  }
}

export interface ProofRequestAnonCreds {
  name: string
  version: string
  nonce: string
  requested_attributes: Record<string, {
    name?: string
    names?: string[]
    restrictions?: Array<{
      schema_id?: string
      schema_issuer_did?: string
      schema_name?: string
      schema_version?: string
      issuer_did?: string
      cred_def_id?: string
      rev_reg_id?: string
    }>
    non_revoked?: {
      from?: number
      to?: number
    }
  }>
  requested_predicates: Record<string, {
    name: string
    p_type: '>=' | '>' | '<=' | '<' | '=='
    p_value: number
    restrictions?: Array<{
      schema_id?: string
      schema_issuer_did?: string
      schema_name?: string
      schema_version?: string
      issuer_did?: string
      cred_def_id?: string
      rev_reg_id?: string
    }>
    non_revoked?: {
      from?: number
      to?: number
    }
  }>
  non_revoked?: {
    from?: number
    to?: number
  }
}

export interface ProofAnonCreds {
  proof: {
    proofs: any[]
    aggregated_proof: any
  }
  requested_proof: {
    revealed_attrs: Record<string, {
      sub_proof_index: number
      raw: string
      encoded: string
    }>
    unrevealed_attrs: Record<string, {
      sub_proof_index: number
    }>
    self_attested_attrs: Record<string, string>
    predicates: Record<string, {
      sub_proof_index: number
    }>
  }
  identifiers: Array<{
    schema_id: string
    cred_def_id: string
    rev_reg_id?: string
    timestamp?: number
  }>
}

export interface LedgerService {
  getSchema(schemaId: string): Promise<CredentialSchema | null>
  getCredentialDefinition(credDefId: string): Promise<CredentialDefinition | null>
  verifyProof(proofRequest: ProofRequestAnonCreds, proof: ProofAnonCreds): Promise<boolean>
  parseCredentialDefinitionId(credDefId: string): {
    did: string
    schemaSeqNo: string
    tag: string
  }
}

export interface WalletCrypto {
  encrypt(data: string, key: string): Promise<string>
  decrypt(encryptedData: string, key: string): Promise<string>
  generateNonce(): string
  hash(data: string): string
}

export interface CredentialRevocationStatus {
  revoked: boolean
  timestamp?: number
  revocationRegistryId?: string
}

export interface WalletBackup {
  version: string
  walletId: string
  createdAt: string
  encryptedData: string
  schemas: CredentialSchema[]
  credentialDefinitions: CredentialDefinition[]
}

// Events for AnonCreds workflow
export interface AnonCredsWalletEvent {
  type: 'credential-offer' | 'credential-received' | 'proof-request' | 'schema-cached' | 'revocation-check'
  data: {
    credentialId?: string
    proofId?: string
    schemaId?: string
    credDefId?: string
    connectionId?: string
    revoked?: boolean
    error?: string
  }
  timestamp: string
}

// Integration with BCovrin VON Network
export interface BCovrinConfig {
  genesisUrl: string
  webServerUrl: string
  ledgerBrowserUrl: string
  poolName: string
}

export const DEFAULT_BCOVRIN_CONFIG: BCovrinConfig = {
  genesisUrl: 'http://dev.greenlight.bcovrin.vonx.io/genesis',
  webServerUrl: 'http://dev.greenlight.bcovrin.vonx.io',
  ledgerBrowserUrl: 'http://dev.greenlight.bcovrin.vonx.io/browse',
  poolName: 'bcovrin-dev-greenlight'
}