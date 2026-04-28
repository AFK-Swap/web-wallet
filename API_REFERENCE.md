# VR Web Wallet API Reference

## Complete API Endpoint Documentation

This document provides detailed information about all API endpoints in the VR Web Wallet system, including request/response formats, authentication requirements, and implementation details.

---

## Authentication & User Management

### POST `/api/credentials` - Store Credential
**File**: `/src/app/api/credentials/route.ts:100-136`
**Purpose**: Store encrypted credentials in user's CouchDB database
**Authentication**: Username/password required

**Request**:
```json
{
  "credential": "encrypted_credential_data",
  "username": "swap", 
  "password": "12345678"
}
```

**Response (Success)**:
```json
{
  "success": true,
  "message": "Credential stored securely"
}
```

**Response (Error)**:
```json
{
  "success": false,
  "error": "Authentication required"
}
```

**Implementation Details**:
- Uses multi-tenant CouchDB with database per user
- Credentials stored encrypted with user-specific database
- Database name format: `wallet_{username}`

---

### GET `/api/credentials?username=X&password=Y` - Retrieve Credentials
**File**: `/src/app/api/credentials/route.ts:6-37`
**Purpose**: Retrieve user's encrypted credentials from CouchDB
**Authentication**: Query parameter authentication

**Request Parameters**:
- `username`: User identifier
- `password`: User password for database access

**Response (Success)**:
```json
{
  "success": true,
  "credentials": [
    {
      "_id": "cred_1756557463659",
      "_rev": "1-abc123",
      "type": "credential",
      "encryptedCredential": {
        "encrypted_data": "base64_encrypted_data",
        "iv": "base64_iv"
      },
      "receivedAt": "2025-08-30T12:37:43.658Z",
      "metadata": {
        "status": "stored",
        "source": "didcomm"
      }
    }
  ],
  "message": "Found 1 encrypted credentials"
}
```

**Error Responses**:
```json
{
  "success": false,
  "error": "Username and password required"
}
```

---

### DELETE `/api/credentials?id=X` - Delete Credential  
**File**: `/src/app/api/credentials/route.ts:138-182`
**Purpose**: Remove credential from user's storage
**Authentication**: Header-based (x-username, x-password)

**Headers**:
- `x-username`: User identifier
- `x-password`: User password

**Response**:
```json
{
  "success": true,
  "message": "Credential deleted successfully"
}
```

---

## Minecraft Integration APIs

### POST `/api/minecraft/verify` - Initiate Verification
**File**: `/src/app/api/minecraft/verify/route.ts`
**Purpose**: Create verification session for Minecraft player

**Request**:
```json
{
  "playerName": "aceSwap",
  "playerUUID": "c88fd9b0-6b0d-3796-b8f1-e2eccdf8db3c",
  "requestedAttributes": ["name", "email", "department", "issuer_did", "age"]
}
```

**Response**:
```json
{
  "success": true,
  "verificationUrl": "http://localhost:3001/minecraft-verify?sessionId=web_verify_123456789",
  "sessionId": "web_verify_123456789",
  "message": "Verification session created"
}
```

**Implementation**:
- Creates global verification session
- Generates unique session ID
- Returns verification URL for player access

---

### POST `/api/minecraft/verify/[sessionId]` - Submit Proof
**File**: `/src/app/api/minecraft/verify/[sessionId]/route.ts:8-79`
**Purpose**: Process cryptographic proof submission and verification

**Request (AnonCreds Proof)**:
```json
{
  "action": "share",
  "proof": {
    "type": "anoncreds",
    "proofRequest": {
      "name": "Minecraft Web Verification",
      "version": "1.0", 
      "nonce": "1234567890",
      "requested_attributes": {
        "attr_0_name": {"name": "name"},
        "attr_1_email": {"name": "email"}
      }
    },
    "proof": {
      "proof": {
        "proofs": [{"primary_proof": {...}}],
        "aggregated_proof": {"c_hash": "...", "c_list": []}
      },
      "requested_proof": {
        "revealed_attrs": {
          "attr_0_name": {
            "sub_proof_index": 0,
            "raw": "John Doe",
            "encoded": "John Doe"
          }
        }
      },
      "identifiers": [{
        "schema_id": "mock_schema_id",
        "cred_def_id": "14Eyuai4HZ491AfnA43Amr:3:CL:1:default"
      }]
    }
  }
}
```

**Request (Decline)**:
```json
{
  "action": "decline"
}
```

**Response (Success)**:
```json
{
  "success": true,
  "verified": true,
  "message": "✅ Cryptographic proof VERIFIED! Cryptographically verified by trusted issuer: 14Eyuai4HZ491AfnA43Amr",
  "details": {
    "cryptographicVerification": true,
    "attributeMatches": [
      {
        "required": "name",
        "provided": "attr_0_name", 
        "value": "John Doe",
        "encoded": "John Doe"
      }
    ],
    "proofType": "AnonCreds",
    "issuerDID": "14Eyuai4HZ491AfnA43Amr",
    "credentialDefinitionId": "14Eyuai4HZ491AfnA43Amr:3:CL:1:default"
  },
  "playerName": "aceSwap"
}
```

**Response (Trust Failure)**:
```json
{
  "success": true,
  "verified": false,
  "message": "❌ Issuer validation FAILED! DID 14Eyuai4HZ491AfnA43Amr is not in trusted registry",
  "details": {
    "cryptographicVerification": true,
    "proofType": "AnonCreds",
    "issuerDID": "14Eyuai4HZ491AfnA43Amr"
  }
}
```

**Verification Process**:
1. **Proof Structure Validation** - Checks for required AnonCreds components
2. **Cryptographic Verification** - Validates proof signatures and structure  
3. **Attribute Matching** - Ensures all requested attributes are provided
4. **Trust Registry Validation** - Verifies issuer DID against trusted registry
5. **Final Decision** - All checks must pass for verification success

---

### GET `/api/minecraft/verify/[sessionId]` - Check Session Status
**File**: `/src/app/api/minecraft/verify/[sessionId]/route.ts:82-119`
**Purpose**: Retrieve verification session status and details

**Response**:
```json
{
  "success": true,
  "session": {
    "id": "web_verify_123456789",
    "verificationSessionId": "web_verify_123456789",
    "playerName": "aceSwap",
    "playerUUID": "c88fd9b0-6b0d-3796-b8f1-e2eccdf8db3c",
    "requestedAttributes": ["name", "email", "department"],
    "status": "verified",
    "createdAt": "2025-08-30T16:36:50.513Z",
    "completedAt": "2025-08-30T16:38:15.124Z",
    "verificationResult": {
      "isValid": true,
      "message": "✅ Cryptographic proof VERIFIED!"
    }
  }
}
```

---

## Notification System APIs

### GET `/api/notifications` - List Notifications
**File**: `/src/app/api/notifications/route.ts:6-45`
**Purpose**: Retrieve pending proof requests and credential offers

**Response**:
```json
{
  "success": true,
  "notifications": [
    {
      "id": "notification-1756571810512",
      "type": "proof-request",
      "title": "Minecraft Web Verification",
      "message": "aceSwap requests verification via web wallet",
      "proofRequestData": {
        "name": "Minecraft Web Verification",
        "requested_attributes": {
          "attr_name": {"name": "name"},
          "attr_email": {"name": "email"}
        },
        "minecraftPlayer": {
          "playerName": "aceSwap",
          "playerUUID": "c88fd9b0-6b0d-3796-b8f1-e2eccdf8db3c"
        },
        "verificationSessionId": "web_verify_1756571810206"
      },
      "timestamp": "2025-08-30T16:36:50.513Z",
      "status": "pending"
    }
  ]
}
```

---

### POST `/api/notifications` - Add Notification
**File**: `/src/app/api/notifications/route.ts:47-89`  
**Purpose**: Add new proof request or credential offer notification

**Request**:
```json
{
  "type": "proof-request",
  "title": "Identity Verification",
  "message": "Please verify your identity",
  "proofRequestData": {
    "requested_attributes": {
      "attr_name": {"name": "name"}
    }
  }
}
```

**Response**:
```json
{
  "success": true,
  "notification": {
    "id": "notification-123456789",
    "timestamp": "2025-08-30T16:36:50.513Z"
  }
}
```

---

### GET `/api/notifications/[id]` - Get Notification Details
**File**: `/src/app/api/notifications/[id]/route.ts`
**Purpose**: Retrieve specific notification with detailed information

**Response**:
```json
{
  "success": true,
  "notification": {
    "id": "notification-123",
    "type": "credential-offer",
    "credentialData": {
      "credentialPreview": {
        "attributes": [
          {
            "name": "name",
            "value": "encrypted_value_base64"
          }
        ]
      }
    }
  }
}
```

---

## Proof & Verification APIs

### POST `/api/approve-proof` - Approve Proof Request  
**File**: `/src/app/api/approve-proof/route.ts`
**Purpose**: Approve and respond to proof request with user credentials

**Request**:
```json
{
  "proofRequestId": "proof_123",
  "selectedAttributes": {
    "name": "John Doe",
    "email": "john@example.com"  
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Proof submitted successfully"
}
```

---

### GET `/api/proof-requests` - List Proof Requests
**File**: `/src/app/api/proof-requests/route.ts`
**Purpose**: Retrieve active proof requests requiring user response

**Response**:
```json
{
  "success": true,
  "proofRequests": [
    {
      "id": "proof_123",
      "connectionId": "connection_456",
      "proofRequest": {
        "name": "Identity Verification",
        "requested_attributes": {...}
      },
      "status": "request-received"
    }
  ]
}
```

---

## Connection Management APIs

### POST `/api/connections/create-invitation` - Create Connection
**File**: `/src/app/api/connections/create-invitation/route.ts`
**Purpose**: Generate DIDComm invitation for establishing connections

**Response**:
```json
{
  "success": true,
  "invitationUrl": "https://example.com?c_i=eyJ...",
  "connectionId": "connection_123"
}
```

---

### POST `/api/out-of-band/receive-invitation` - Accept Invitation
**File**: `/src/app/api/out-of-band/receive-invitation/route.ts`  
**Purpose**: Process and accept incoming connection invitations

**Request**:
```json
{
  "invitationUrl": "https://example.com?c_i=eyJ..."
}
```

**Response**:
```json
{
  "success": true,
  "connectionId": "connection_456"
}
```

---

## Webhook & Event APIs

### POST `/api/webhooks` - Webhook Handler
**File**: `/src/app/api/webhooks/route.ts`
**Purpose**: Handle incoming webhooks from ACA-Py agents and external services

**Request** (Credential Offer):
```json
{
  "topic": "issue_credential",
  "state": "offer-received",
  "credential_exchange_id": "exchange_123",
  "credential_offer": {...}
}
```

**Request** (Proof Request):
```json
{
  "topic": "present_proof",
  "state": "request-received", 
  "presentation_exchange_id": "presentation_456",
  "presentation_request": {...}
}
```

**Response**:
```json
{
  "success": true,
  "message": "Webhook processed"
}
```

---

## Debug & Utility APIs

### GET `/api/debug/sessions` - Debug Sessions
**File**: `/src/app/api/debug/sessions/route.ts`
**Purpose**: Development endpoint for inspecting active verification sessions

**Response**:
```json
{
  "success": true,
  "sessions": [
    {
      "id": "session_123",
      "playerName": "aceSwap",
      "status": "pending",
      "createdAt": "2025-08-30T16:36:50.513Z"
    }
  ]
}
```

---

## Error Handling

### Standard Error Response Format
All APIs use consistent error response format:

```json
{
  "success": false,
  "error": "Error message description",
  "code": "ERROR_CODE", 
  "details": {
    "additional": "context information"
  }
}
```

### Common Error Codes
- `AUTHENTICATION_REQUIRED` - Missing or invalid credentials
- `INVALID_REQUEST` - Malformed request data
- `NOT_FOUND` - Resource doesn't exist
- `VERIFICATION_FAILED` - Cryptographic verification failed
- `TRUST_VALIDATION_FAILED` - Issuer not in trusted registry
- `DATABASE_ERROR` - CouchDB connection or storage error
- `ENCRYPTION_ERROR` - Credential encryption/decryption failure

### HTTP Status Codes
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (authentication failure)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error (system failure)

---

## Implementation Examples

### Complete Minecraft Verification Flow

```javascript
// 1. Initiate verification from Minecraft server
const initiateResponse = await fetch('http://localhost:3001/api/minecraft/verify', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    playerName: 'aceSwap',
    playerUUID: 'c88fd9b0-6b0d-3796-b8f1-e2eccdf8db3c',
    requestedAttributes: ['name', 'email', 'department']
  })
})

const {verificationUrl, sessionId} = await initiateResponse.json()

// 2. Player accesses verification URL and submits proof
const proofResponse = await fetch(`http://localhost:3001/api/minecraft/verify/${sessionId}`, {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    action: 'share',
    proof: {
      type: 'anoncreds',
      proofRequest: {...},
      proof: {
        proof: {proofs: [...], aggregated_proof: {...}},
        requested_proof: {revealed_attrs: {...}},
        identifiers: [{cred_def_id: '14Eyuai4HZ491AfnA43Amr:3:CL:1:default'}]
      }
    }
  })
})

// 3. Minecraft server checks verification result
const statusResponse = await fetch(`http://localhost:3001/api/minecraft/verify/${sessionId}`)
const {session} = await statusResponse.json()

if (session.status === 'verified') {
  // Grant player access
  console.log('✅ Player verified:', session.verificationResult.message)
} else {
  // Deny access  
  console.log('❌ Verification failed:', session.verificationResult.message)
}
```

### Credential Storage and Retrieval

```javascript
// Store encrypted credential
const storeResponse = await fetch('http://localhost:3001/api/credentials', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    credential: encryptedCredentialData,
    username: 'swap',
    password: '12345678'
  })
})

// Retrieve user credentials
const getResponse = await fetch(
  'http://localhost:3001/api/credentials?username=swap&password=12345678'
)
const {credentials} = await getResponse.json()

console.log(`Found ${credentials.length} stored credentials`)
```

---

## Security Considerations

### Authentication
- All credential operations require username/password authentication
- Multi-tenant database isolation prevents cross-user access
- Session-based authentication for Minecraft verification flows

### Encryption
- Credentials encrypted with AES-256-GCM using Web Crypto API
- PBKDF2 key derivation with 100,000 iterations
- Unique random IV for each encryption operation

### Proof Verification
- Cryptographic signature validation for AnonCreds proofs
- Trust registry validation against external service
- Attribute matching verification before acceptance
- Tamper-evident proof structures prevent manipulation

### Network Security
- HTTPS enforcement in production
- CORS policies for cross-origin protection  
- Input validation and sanitization on all endpoints
- Rate limiting on authentication endpoints

This API reference provides complete implementation details for integrating with and extending the VR Web Wallet system.