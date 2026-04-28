import { NextRequest, NextResponse } from 'next/server';
import { getUserCredentials } from '@/lib/couchdb-auth';
import { deriveEncryptionKey } from '@/lib/encryption';
import crypto from 'crypto';

// Manual proof approval/rejection - user selects to share or reject
export async function POST(request: NextRequest) {
  try {
    const { action, proofExchangeId, selectedCredentialId, username, password } = await request.json();
    
    if (!action || !proofExchangeId) {
      return NextResponse.json(
        { success: false, error: 'Action and proofExchangeId required' },
        { status: 400 }
      );
    }
    
    // Handle rejection
    if (action === 'reject') {
      console.log(`❌ User rejected proof request: ${proofExchangeId}`);
      
      // Remove notification if it exists
      if (globalThis.notificationStore) {
        globalThis.notificationStore = globalThis.notificationStore.filter(
          (n: any) => n.exchangeId !== proofExchangeId
        );
      }
      
      return NextResponse.json({
        success: true,
        message: 'Proof request rejected',
        action: 'rejected'
      });
    }
    
    // Handle approval - requires credentials
    if (action === 'approve') {
      if (!selectedCredentialId || !username || !password) {
        return NextResponse.json(
          { success: false, error: 'Approval requires selectedCredentialId, username, and password' },
          { status: 400 }
        );
      }
    
    console.log(`👤 User ${username} approving proof request ${proofExchangeId} with credential ${selectedCredentialId}`);
    
    // 1. Get the proof request details (same as mobile wallet)
    const proofResponse = await fetch(`http://localhost:8031/present-proof-2.0/records/${proofExchangeId}`);
    if (!proofResponse.ok) {
      throw new Error(`Failed to get proof request: ${proofResponse.statusText}`);
    }
    
    const proofRecord = await proofResponse.json();
    const proofRequest = proofRecord.by_format?.pres_request?.indy || proofRecord.pres_request;
    
    if (!proofRequest) {
      throw new Error('No proof request found in record');
    }
    
    console.log(`📋 Approving proof request: ${proofRequest.name}`);
    
    // 2. Get user's encrypted credentials from CouchDB
    const encryptedCredentials = await getUserCredentials(username, password);
    if (encryptedCredentials.length === 0) {
      throw new Error('No credentials found in wallet');
    }
    
    // 3. Find the selected credential
    const selectedCredential = encryptedCredentials.find(cred => cred._id === selectedCredentialId);
    if (!selectedCredential) {
      throw new Error('Selected credential not found');
    }
    
    console.log(`💾 Using selected credential: ${selectedCredentialId}`);
    
    // 4. Decrypt the selected credential (same as mobile wallet decryption)
    const decryptionKey = await deriveEncryptionKey(password, username);
    let decryptedCredentialData;
    
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', decryptionKey, Buffer.from(selectedCredential.encryptedCredential.iv, 'base64'));
      if (selectedCredential.encryptedCredential.authTag) {
        decipher.setAuthTag(Buffer.from(selectedCredential.encryptedCredential.authTag, 'base64'));
      }
      
      let decrypted = decipher.update(selectedCredential.encryptedCredential.encrypted_data, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      decryptedCredentialData = JSON.parse(decrypted);
      console.log(`🔓 Decrypted credential attributes: ${Object.keys(decryptedCredentialData).join(', ')}`);
    } catch (decryptError) {
      throw new Error(`Failed to decrypt selected credential: ${decryptError.message}`);
    }
    
    // 5. Build proof presentation using real credential values (same as mobile wallet)
    const presentation = {
      requested_attributes: {},
      requested_predicates: {},
      self_attested_attributes: {}
    };
    
    // Match requested attributes with decrypted credential data
    for (const [attrKey, attrSpec] of Object.entries(proofRequest.requested_attributes || {})) {
      const requestedNames = (attrSpec as any).names || [];
      let matched = false;
      
      for (const requestedName of requestedNames) {
        if (decryptedCredentialData[requestedName] && !matched) {
          // Use self-attested for now (same as mobile wallet behavior for this schema)
          presentation.self_attested_attributes[attrKey] = decryptedCredentialData[requestedName];
          console.log(`✅ Matched ${requestedName}: ${decryptedCredentialData[requestedName]}`);
          matched = true;
          break;
        }
      }
      
      if (!matched) {
        // Fallback for unmatched attributes
        const attrName = requestedNames[0] || attrKey;
        presentation.self_attested_attributes[attrKey] = `Not available`;
        console.log(`⚠️ No credential data for ${attrKey}`);
      }
    }
    
    // Handle predicates (age >= 18, etc.) - same as mobile wallet
    for (const [predKey, predSpec] of Object.entries(proofRequest.requested_predicates || {})) {
      const predName = (predSpec as any).name;
      if (decryptedCredentialData[predName]) {
        // For predicates, we self-attest the value (same as mobile wallet for this use case)
        presentation.self_attested_attributes[`${predKey}_value`] = decryptedCredentialData[predName];
        console.log(`🔢 Predicate ${predName}: ${decryptedCredentialData[predName]}`);
      }
    }
    
    console.log(`📤 Sending proof presentation with ${Object.keys(presentation.self_attested_attributes).length} attributes`);
    
    // 6. Send the proof presentation via SSI tutorial (same as mobile wallet DIDComm response)
    const presentResponse = await fetch(`http://localhost:4002/respond-proof-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        proofExchangeId: proofExchangeId,
        presentation: presentation
      })
    });
    
    if (!presentResponse.ok) {
      const error = await presentResponse.text();
      throw new Error(`Failed to send presentation: ${error}`);
    }
    
    const presentResult = await presentResponse.json();
    console.log(`✅ Proof presentation sent successfully - same as mobile wallet!`);
    
    // Remove notification after successful approval
    if (globalThis.notificationStore) {
      globalThis.notificationStore = globalThis.notificationStore.filter(
        (n: any) => n.exchangeId !== proofExchangeId
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Proof presentation sent successfully (same as mobile wallet)',
      proofExchangeId: proofExchangeId,
      presentationState: presentResult.state,
      sharedAttributes: Object.keys(presentation.self_attested_attributes),
      action: 'approved'
    });
    }
    
    // Invalid action
    return NextResponse.json(
      { success: false, error: 'Invalid action. Use "approve" or "reject"' },
      { status: 400 }
    );
    
  } catch (error) {
    console.error('❌ Proof approval error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}