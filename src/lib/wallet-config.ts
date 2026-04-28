// VR Web Wallet Agent Configuration - Using Node.js proxy approach like SSI-Tutorial

export const WALLET_AGENT_CONFIG = {
  // Direct Alice ACA-Py connection (no proxy)
  AGENT_SERVER_URL: 'http://localhost:8031',
  AGENT_LABEL: 'alice.agent',
  
  // Webhook URL for receiving ACA-Py events
  WEBHOOK_URL: 'http://localhost:3001/api/webhooks',
  
  // Connection and credential settings
  AUTO_ACCEPT_INVITES: true,
  AUTO_ACCEPT_REQUESTS: true,
  AUTO_STORE_CREDENTIAL: true
} as const

// Helper functions for building API endpoints (direct Alice ACA-Py)
export const walletAgentEndpoints = {
  status: () => `${WALLET_AGENT_CONFIG.AGENT_SERVER_URL}/status`,
  connections: (connectionId?: string) => 
    connectionId 
      ? `${WALLET_AGENT_CONFIG.AGENT_SERVER_URL}/connections/${connectionId}`
      : `${WALLET_AGENT_CONFIG.AGENT_SERVER_URL}/connections`,
  connectionAccept: (connectionId: string) => 
    `${WALLET_AGENT_CONFIG.AGENT_SERVER_URL}/connections/${connectionId}/accept-request`,
  receiveInvitation: () => 
    `${WALLET_AGENT_CONFIG.AGENT_SERVER_URL}/connections/receive-invitation`,
  receiveOobInvitation: () => 
    `${WALLET_AGENT_CONFIG.AGENT_SERVER_URL}/out-of-band/receive-invitation`,
  credentialRecords: () => 
    `${WALLET_AGENT_CONFIG.AGENT_SERVER_URL}/issue-credential-2.0/records`,
  proofRecords: () => 
    `${WALLET_AGENT_CONFIG.AGENT_SERVER_URL}/present-proof-2.0/records`,
  sendPresentation: (exchangeId: string) => 
    `${WALLET_AGENT_CONFIG.AGENT_SERVER_URL}/present-proof-2.0/records/${exchangeId}/send-presentation`,
  resolveDID: (did: string) => 
    `${WALLET_AGENT_CONFIG.AGENT_SERVER_URL}/resolver/resolve/${encodeURIComponent(did)}`,
  verifyCredential: () => 
    `${WALLET_AGENT_CONFIG.AGENT_SERVER_URL}/credentials/w3c/verify`,
  getSchema: (schemaId: string) => 
    `${WALLET_AGENT_CONFIG.AGENT_SERVER_URL}/schemas/${encodeURIComponent(schemaId)}`
} as const