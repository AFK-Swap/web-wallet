import { NextRequest, NextResponse } from 'next/server';
import { getUserCredentials, deriveEncryptionKey } from '@/lib/couchdb-auth';

// Handle proof requests over established DIDComm connections
export async function POST(request: NextRequest) {
  try {
    const { connectionId, proofRequest, username, playerName } = await request.json();
    
    if (!connectionId || !proofRequest || !username) {
      return NextResponse.json(
        { success: false, error: 'connectionId, proofRequest, and username are required' },
        { status: 400 }
      );
    }
    
    console.log(`📋 Received proof request over connection ${connectionId} for user ${username}`);
    
    // Get user's credentials from encrypted storage
    let userCredentials;
    try {
      // For connection-based requests, we need the user's password to decrypt
      // This will be provided by the web wallet when the user is logged in
      const password = request.headers.get('x-password');
      if (!password) {
        return NextResponse.json(
          { success: false, error: 'User password required for credential decryption' },
          { status: 401 }
        );
      }
      
      userCredentials = await getUserCredentials(username, password);
    } catch (error) {
      console.error('Failed to get user credentials:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to access user credentials' },
        { status: 401 }
      );
    }
    
    if (!userCredentials || userCredentials.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No credentials found for user' },
        { status: 404 }
      );
    }
    
    // Find credential that matches proof request requirements
    const requestedAttributes = proofRequest.requestedAttributes || [];
    let matchingCredential = null;
    
    for (const credential of userCredentials) {
      const hasAllAttributes = requestedAttributes.every(attr => 
        credential.decryptedData && credential.decryptedData[attr]
      );
      
      if (hasAllAttributes) {
        matchingCredential = credential;
        break;
      }
    }
    
    if (!matchingCredential) {
      return NextResponse.json(
        { success: false, error: 'No matching credential found for proof request' },
        { status: 404 }
      );
    }
    
    // Create proof presentation
    const proofPresentation = {
      credential: matchingCredential.decryptedData,
      connectionId,
      username,
      presentedAt: new Date().toISOString()
    };
    
    // Send proof presentation back via DIDComm connection
    try {
      const presentationPayload = {
        connection_id: connectionId,
        presentation: {
          indy: {
            requested_proof: {
              revealed_attrs: {},
              revealed_attr_groups: {
                "identity_attributes": {
                  values: {}
                }
              }
            }
          }
        }
      };
      
      // Populate revealed attributes
      requestedAttributes.forEach(attr => {
        if (matchingCredential.decryptedData[attr]) {
          presentationPayload.presentation.indy.requested_proof.revealed_attrs[attr] = {
            raw: matchingCredential.decryptedData[attr],
            encoded: matchingCredential.decryptedData[attr]
          };
          
          presentationPayload.presentation.indy.requested_proof.revealed_attr_groups.identity_attributes.values[attr] = {
            raw: matchingCredential.decryptedData[attr],
            encoded: matchingCredential.decryptedData[attr]
          };
        }
      });
      
      console.log('Sending proof presentation via DIDComm:', presentationPayload);
      
      const response = await fetch('http://localhost:8031/present-proof-2.0/records/{pres_ex_id}/send-presentation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(presentationPayload)
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to send proof presentation: ${error}`);
      }
      
      const result = await response.json();
      
      console.log(`✅ Proof presentation sent successfully for ${username}`);
      
      return NextResponse.json({
        success: true,
        message: 'Proof presentation sent successfully',
        data: {
          username,
          playerName,
          connectionId,
          presentationId: result.pres_ex_id,
          presentedAttributes: Object.keys(proofPresentation.credential)
        }
      });
      
    } catch (error) {
      console.error('Failed to send proof presentation:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to send proof presentation', details: error.message },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Connection proof request error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to handle connection proof request', details: error.message },
      { status: 500 }
    );
  }
}

// Get proof request status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');
    const proofExchangeId = searchParams.get('proofExchangeId');
    
    if (!connectionId && !proofExchangeId) {
      return NextResponse.json(
        { success: false, error: 'connectionId or proofExchangeId required' },
        { status: 400 }
      );
    }
    
    // Query ACA-Py for proof exchange status
    let url = 'http://localhost:8031/present-proof-2.0/records';
    if (proofExchangeId) {
      url += `/${proofExchangeId}`;
    } else if (connectionId) {
      url += `?connection_id=${connectionId}`;
    }
    
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get proof status: ${error}`);
    }
    
    const result = await response.json();
    
    return NextResponse.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Proof status error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get proof status', details: error.message },
      { status: 500 }
    );
  }
}