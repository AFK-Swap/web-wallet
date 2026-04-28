import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const invitation = await request.json();
    
    console.log('Received out-of-band invitation:', JSON.stringify(invitation, null, 2));
    
    // Extract service endpoint and recipient keys from invitation
    const service = invitation.services?.[0];
    if (!service) {
      throw new Error('No service found in invitation');
    }
    
    // Create connection request to send to ACA-Py
    const connectionRequest = {
      "@type": "https://didcomm.org/connections/1.0/request",
      "@id": `request-${Date.now()}`,
      "label": "VR SSI Wallet",
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
      },
      "~thread": {
        "thid": invitation['@id']
      }
    };
    
    // Send connection request to ACA-Py's service endpoint
    console.log('Sending connection request to:', service.serviceEndpoint);
    console.log('Connection request:', JSON.stringify(connectionRequest, null, 2));
    
    // In a real implementation, this would be sent via DIDComm transport
    // For demo, we'll simulate the connection being established
    
    return NextResponse.json({
      success: true,
      message: 'Out-of-band invitation processed',
      connectionId: `conn-${Date.now()}`,
      status: 'connected'
    });
    
  } catch (error) {
    console.error('Error processing out-of-band invitation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process invitation' },
      { status: 500 }
    );
  }
}