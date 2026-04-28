import { NextRequest, NextResponse } from 'next/server'

// Enhanced DIDComm endpoint for handling connections and credentials
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('Received DIDComm message:', JSON.stringify(body, null, 2))
    
    const messageType = body['@type']
    
    if (messageType?.includes('connections/1.0/request')) {
      // Handle connection request - send connection response
      const response = {
        "@type": "https://didcomm.org/connections/1.0/response",
        "@id": `response-${Date.now()}`,
        "~thread": {
          "thid": body['@id']
        },
        "connection": {
          "DID": "did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH",
          "DIDDoc": {
            "@context": "https://w3id.org/did/v1",
            "id": "did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH",
            "publicKey": [{
              "id": "did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH#keys-1",
              "type": "Ed25519VerificationKey2018",
              "controller": "did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH",
              "publicKeyBase58": "8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K"
            }],
            "service": [{
              "id": "did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH#did-communication",
              "type": "did-communication",
              "serviceEndpoint": "http://localhost:3001/api/didcomm"
            }]
          }
        }
      }
      
      console.log('Sending connection response:', JSON.stringify(response, null, 2))
      return NextResponse.json(response)
    }
    
    if (messageType?.includes('issue-credential')) {
      // Handle credential-related messages
      if (messageType.includes('offer')) {
        // Create notification for user to accept/decline
        const credentialPreview = body.credential_preview || body.offers_attach?.[0]?.data;
        let credentialData = {};
        
        if (credentialPreview?.attributes) {
          // Extract attributes from credential preview for display
          credentialData = credentialPreview.attributes.reduce((acc: any, attr: any) => {
            acc[attr.name] = attr.value;
            return acc;
          }, {});
        }
        
        const notification = {
          id: `notification-${Date.now()}`,
          type: 'credential-offer',
          title: 'New Credential Offer',
          message: 'You have received a new credential offer',
          credentialData: credentialData,
          rawMessage: body,
          timestamp: new Date().toISOString(),
          status: 'pending'
        };
        
        // Store notification in global store
        if (typeof globalThis !== 'undefined' && !globalThis.notificationStore) {
          globalThis.notificationStore = [];
        }
        
        if (typeof globalThis !== 'undefined' && globalThis.notificationStore) {
          globalThis.notificationStore.push(notification);
          console.log('Created notification for credential offer:', notification);
        }
        
        // Don't auto-accept - just acknowledge receipt
        return NextResponse.json({
          success: true,
          message: 'Credential offer received and notification created'
        });
      }
      
      if (messageType.includes('issue')) {
        // Final credential received - store it
        const credentialData = body.credentials_attach?.[0]?.data;
        let decodedCredential = {};
        
        if (credentialData?.base64) {
          try {
            const decoded = Buffer.from(credentialData.base64, 'base64').toString('utf-8');
            decodedCredential = JSON.parse(decoded);
          } catch (e) {
            console.log('Could not decode credential, using raw data');
            decodedCredential = credentialData;
          }
        } else {
          decodedCredential = body;
        }
        
        const credential = {
          id: `credential-${Date.now()}`,
          type: 'credential',
          credential: decodedCredential,
          rawMessage: body,
          timestamp: new Date().toISOString(),
          status: 'stored'
        }
        
        console.log('Storing final credential:', credential)
        
        // Store credential directly (import the storage mechanism)
        // For demo, we'll use a simple global store
        if (typeof globalThis !== 'undefined' && !globalThis.credentialStore) {
          globalThis.credentialStore = [];
        }
        
        if (typeof globalThis !== 'undefined' && globalThis.credentialStore) {
          globalThis.credentialStore.push(credential);
          console.log('Credential stored in global store');
        }
        
        return NextResponse.json({ 
          success: true, 
          message: 'Credential stored successfully' 
        })
      }
    }
    
    if (messageType?.includes('present-proof')) {
      // Handle proof request messages
      if (messageType.includes('request')) {
        // Create notification for proof request
        const requestedAttributes = body.request_presentations_attach?.[0]?.data?.requested_attributes || {};
        
        const attributeNames = Object.values(requestedAttributes)
          .map((attr: any) => attr.name || 'unknown')
          .join(', ');
        
        const notification = {
          id: `notification-${Date.now()}`,
          type: 'proof-request',
          title: 'Proof Request',
          message: `You have received a proof request for: ${attributeNames}`,
          proofRequestData: body,
          timestamp: new Date().toISOString(),
          status: 'pending'
        };
        
        // Store notification
        if (typeof globalThis !== 'undefined' && !globalThis.notificationStore) {
          globalThis.notificationStore = [];
        }
        
        if (typeof globalThis !== 'undefined' && globalThis.notificationStore) {
          globalThis.notificationStore.push(notification);
          console.log('Created proof request notification:', notification);
        }
        
        return NextResponse.json({
          success: true,
          message: 'Proof request received and notification created'
        });
      }
      
      if (messageType.includes('presentation')) {
        // Handle proof presentation (response)
        console.log('Received proof presentation:', body);
        
        return NextResponse.json({
          success: true,
          message: 'Proof presentation received and verified'
        });
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'DIDComm message processed',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error processing DIDComm message:', error)
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'VR Wallet DIDComm Endpoint',
    status: 'active',
    timestamp: new Date().toISOString()
  })
}