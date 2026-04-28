import { NextRequest, NextResponse } from 'next/server';

// Handle manual proof request approval with credential decryption
export async function POST(request: NextRequest) {
  try {
    const { exchangeId, username, password, approve } = await request.json();
    
    if (!exchangeId || !username || !password) {
      return NextResponse.json(
        { success: false, error: 'Exchange ID, username, and password required' },
        { status: 400 }
      );
    }
    
    console.log(`🔐 Processing proof approval for exchange: ${exchangeId}`);
    console.log(`👤 User: ${username}, Approve: ${approve}`);
    
    if (!approve) {
      // User declined - send decline to ACA-Py
      console.log('❌ User declined proof request');
      
      try {
        const declineResponse = await fetch(`http://localhost:8031/present-proof-2.0/records/${exchangeId}/problem-report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: 'User declined to present proof'
          })
        });
        
        if (declineResponse.ok) {
          console.log('✅ Proof request declined successfully');
          return NextResponse.json({
            success: true,
            message: 'Proof request declined'
          });
        } else {
          console.log('⚠️ Failed to decline proof request via ACA-Py');
        }
      } catch (error) {
        console.error('❌ Error declining proof request:', error);
      }
      
      return NextResponse.json({
        success: true,
        message: 'Proof request declined'
      });
    }
    
    // User approved - decrypt credentials and present proof
    console.log('✅ User approved - decrypting credentials and presenting proof');
    
    // 1. Get encrypted credentials from web wallet storage
    const credentialsResponse = await fetch(`http://localhost:3001/api/credentials`, {
      headers: {
        'x-username': username,
        'x-password': password
      }
    });
    
    if (!credentialsResponse.ok) {
      throw new Error('Failed to retrieve credentials');
    }
    
    const credentialsData = await credentialsResponse.json();
    const credentials = credentialsData.credentials || [];
    
    if (credentials.length === 0) {
      throw new Error('No credentials found in web wallet');
    }
    
    console.log(`🔓 Found ${credentials.length} encrypted credentials`);
    
    // 2. Decrypt credentials using username/password (same as credential storage)
    const crypto = require('crypto');
    
    const deriveDecryptionKey = async (password: string, username: string) => {
      const salt = Buffer.from(username + '_ssi_wallet_salt');
      return new Promise((resolve, reject) => {
        crypto.pbkdf2(password, salt, 100000, 32, 'sha256', (err: any, derivedKey: any) => {
          if (err) reject(err);
          else resolve(derivedKey);
        });
      });
    };
    
    const decryptCredential = async (encryptedData: any, key: Buffer) => {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(encryptedData.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(encryptedData.authTag || '', 'base64'));
      
      let decrypted = decipher.update(encryptedData.encrypted_data, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    };
    
    // 3. Find matching credential and decrypt it
    const decryptionKey = await deriveDecryptionKey(password, username) as Buffer;
    let matchingCredential = null;
    
    for (const cred of credentials) {
      try {
        // First check if this credential has the trusted issuer DID (might be in credentialPreview directly)
        const previewAttributes = cred.credentialPreview?.attributes || [];
        const issuerDidAttr = previewAttributes.find((attr: any) => attr.name === 'issuer_did');
        
        if (issuerDidAttr && issuerDidAttr.value === '3LhPupCmt1y8u3QzwavQMG') {
          console.log('✅ Found credential with trusted issuer DID, decrypting...');
          
          // Now decrypt the encrypted attributes
          let decryptedAttributes = [];
          
          for (const attr of previewAttributes) {
            try {
              if (attr.name === 'issuer_did') {
                // Keep issuer_did as-is (it's not encrypted)
                decryptedAttributes.push({
                  name: attr.name,
                  value: attr.value
                });
              } else if (typeof attr.value === 'string' && attr.value.includes('encrypted_data')) {
                // This is an encrypted attribute - decrypt it
                const encryptedData = JSON.parse(attr.value);
                const decipher = crypto.createDecipheriv('aes-256-gcm', decryptionKey, Buffer.from(encryptedData.iv, 'base64'));
                if (encryptedData.authTag) {
                  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'base64'));
                }
                let decrypted = decipher.update(encryptedData.encrypted_data, 'base64', 'utf8');
                decrypted += decipher.final('utf8');
                
                decryptedAttributes.push({
                  name: attr.name,
                  value: decrypted
                });
              } else {
                // Not encrypted, keep as-is
                decryptedAttributes.push({
                  name: attr.name,
                  value: attr.value
                });
              }
            } catch (decryptError) {
              console.log(`⚠️ Failed to decrypt attribute ${attr.name}, keeping encrypted`);
              decryptedAttributes.push(attr);
            }
          }
          
          matchingCredential = { attributes: decryptedAttributes };
          console.log('🔓 Decrypted credential with attributes:', decryptedAttributes.map(a => `${a.name}: ${a.value.substring(0, 20)}...`));
          break;
        }
      } catch (error) {
        console.log('⚠️ Error processing credential, trying next...');
        continue;
      }
    }
    
    if (!matchingCredential) {
      throw new Error('No matching decrypted credential found with trusted issuer DID');
    }
    
    // 4. Get the actual proof request to understand what's being asked for
    const proofRequestResponse = await fetch(`http://localhost:8031/present-proof-2.0/records/${exchangeId}`);
    const proofRequestData = await proofRequestResponse.json();
    const requestedAttributes = proofRequestData.by_format?.pres_request?.indy?.requested_attributes || {};
    
    console.log('📋 Proof request asks for attributes:', Object.keys(requestedAttributes));
    
    // 5. Build proof presentation from decrypted credential
    const attributes = matchingCredential.attributes || [];
    const proofPresentation = {
      self_attested_attributes: {},
      requested_attributes: {},
      requested_predicates: {}
    };
    
    // Map decrypted attributes to requested attribute references
    Object.keys(requestedAttributes).forEach((attrRef) => {
      const requestedAttr = requestedAttributes[attrRef];
      const attrName = requestedAttr.name;
      
      // Find matching attribute in decrypted credential
      const matchingAttr = attributes.find((attr: any) => attr.name === attrName);
      
      if (matchingAttr) {
        proofPresentation.requested_attributes[attrRef] = {
          cred_id: `credential_id_for_${attrName}`,
          revealed: true
        };
        console.log(`✅ Mapped ${attrRef} -> ${attrName}: ${matchingAttr.value}`);
      } else {
        console.log(`⚠️ Requested attribute ${attrName} not found in credential`);
      }
    });
    
    console.log('📤 Presenting proof with requested attributes:', Object.keys(proofPresentation.requested_attributes));
    
    // 5. Send proof presentation to ACA-Py
    const presentResponse = await fetch(`http://localhost:8031/present-proof-2.0/records/${exchangeId}/send-presentation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        indy: proofPresentation
      })
    });
    
    if (!presentResponse.ok) {
      const errorText = await presentResponse.text();
      throw new Error(`Failed to present proof: ${errorText}`);
    }
    
    const presentResult = await presentResponse.json();
    console.log('✅ Proof presented successfully:', presentResult.state);
    
    return NextResponse.json({
      success: true,
      message: 'Proof presented successfully with decrypted credentials',
      proofState: presentResult.state
    });
    
  } catch (error) {
    console.error('❌ Error processing proof approval:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}