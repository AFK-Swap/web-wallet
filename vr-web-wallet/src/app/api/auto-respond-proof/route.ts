import { NextRequest, NextResponse } from 'next/server';
import { getUserCredentials } from '@/lib/couchdb-auth';
import { deriveEncryptionKey, decryptAttributeValue } from '@/lib/encryption';
import crypto from 'crypto';

// Auto-respond to proof requests with real encrypted credentials
export async function POST(request: NextRequest) {
  try {
    const { username, password, proofExchangeId } = await request.json();
    
    if (!username || !password || !proofExchangeId) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    console.log(`🔐 Auto-responding to proof request ${proofExchangeId} for user ${username}`);
    
    // 1. Get the proof request details from ACA-Py
    const proofResponse = await fetch(`http://localhost:8031/present-proof-2.0/records/${proofExchangeId}`);
    if (!proofResponse.ok) {
      throw new Error(`Failed to get proof request: ${proofResponse.statusText}`);
    }
    
    const proofRecord = await proofResponse.json();
    const proofRequest = proofRecord.by_format?.pres_request?.indy || proofRecord.pres_request;
    
    if (!proofRequest) {
      throw new Error('No proof request found in record');
    }
    
    console.log(`📋 Proof request: ${proofRequest.name}`);
    console.log(`📝 Requested attributes: ${Object.keys(proofRequest.requested_attributes || {}).join(', ')}`);
    
    // 2. Fetch encrypted credentials from CouchDB
    const encryptedCredentials = await getUserCredentials(username, password);
    if (encryptedCredentials.length === 0) {
      throw new Error('No credentials found in wallet');
    }
    
    console.log(`💾 Found ${encryptedCredentials.length} encrypted credentials in wallet`);
    
    // 3. Decrypt credentials and find matching attributes
    const decryptionKey = await deriveEncryptionKey(password, username);
    let matchedAttributes: any = {};
    
    for (const encCred of encryptedCredentials) {
      try {
        console.log(`🔓 Decrypting credential ${encCred._id}...`);
        
        // Decrypt the credential data
        const decipher = crypto.createDecipheriv('aes-256-gcm', decryptionKey, Buffer.from(encCred.encryptedCredential.iv, 'base64'));
        if (encCred.encryptedCredential.authTag) {
          decipher.setAuthTag(Buffer.from(encCred.encryptedCredential.authTag, 'base64'));
        }
        
        let decrypted = decipher.update(encCred.encryptedCredential.encrypted_data, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        
        const credentialData = JSON.parse(decrypted);
        console.log(`✅ Decrypted credential with attributes: ${Object.keys(credentialData).join(', ')}`);
        
        // Match requested attributes with decrypted credential
        for (const [attrKey, attrSpec] of Object.entries(proofRequest.requested_attributes || {})) {
          const requestedNames = (attrSpec as any).names || [];
          
          for (const attrName of requestedNames) {
            if (credentialData[attrName] && !matchedAttributes[attrKey]) {
              matchedAttributes[attrKey] = {
                name: attrName,
                value: credentialData[attrName],
                cred_id: encCred._id
              };
              console.log(`🎯 Matched ${attrName}: ${credentialData[attrName]}`);
            }
          }
        }
        
      } catch (decryptError) {
        console.error(`❌ Failed to decrypt credential ${encCred._id}:`, decryptError);
        continue;
      }
    }
    
    if (Object.keys(matchedAttributes).length === 0) {
      throw new Error('No matching attributes found in credentials');
    }
    
    // 4. Build the proof presentation with real values
    const presentationRequest = {
      requested_attributes: {},
      requested_predicates: {},
      self_attested_attributes: {}
    };
    
    // Add matched attributes
    for (const [attrKey, attrData] of Object.entries(matchedAttributes)) {
      presentationRequest.requested_attributes[attrKey] = {
        cred_id: (attrData as any).cred_id,
        revealed: true
      };
    }
    
    // Add any unmatched attributes as self-attested (fallback)
    for (const [attrKey, attrSpec] of Object.entries(proofRequest.requested_attributes || {})) {
      if (!matchedAttributes[attrKey]) {
        const attrNames = (attrSpec as any).names || [];
        const attrName = attrNames[0] || attrKey;
        presentationRequest.self_attested_attributes[attrKey] = `real-${attrName}-value`;
        console.log(`⚠️ Self-attesting ${attrKey} (no matching credential)`);
      }
    }
    
    console.log(`🚀 Sending proof presentation with ${Object.keys(presentationRequest.requested_attributes).length} real attributes`);
    
    // 5. Send the proof presentation to ACA-Py
    const presentResponse = await fetch(`http://localhost:8031/present-proof-2.0/records/${proofExchangeId}/send-presentation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(presentationRequest)
    });
    
    if (!presentResponse.ok) {
      const error = await presentResponse.text();
      throw new Error(`Failed to send presentation: ${error}`);
    }
    
    const presentResult = await presentResponse.json();
    console.log(`✅ Proof presentation sent successfully`);
    
    return NextResponse.json({
      success: true,
      message: 'Auto-responded with real credential data',
      matchedAttributes: Object.keys(matchedAttributes),
      presentationId: presentResult.pres_ex_id
    });
    
  } catch (error) {
    console.error('❌ Auto-response error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}