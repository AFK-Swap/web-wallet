import { NextRequest, NextResponse } from 'next/server';

// Web wallet ACA-Py integration for Minecraft verification
// This endpoint accepts invitations from ACA-Py and establishes connections

interface AcaPyInvitationRequest {
  type: 'acapy_invitation' | 'didcomm_invitation' | 'web_invitation';
  invitationUrl: string;
  connectionId: string;
  playerName: string;
  playerUUID: string;
}

declare global {
  var acaPyConnections: any[] | undefined;
}

export async function POST(request: NextRequest) {
  try {
    const body: AcaPyInvitationRequest = await request.json();
    
    console.log('Received ACA-Py invitation from Minecraft:', body);
    
    // Initialize ACA-Py connections store
    if (!globalThis.acaPyConnections) {
      globalThis.acaPyConnections = [];
    }
    
    // Parse the invitation URL to extract the invitation
    const invitation = extractInvitationFromUrl(body.invitationUrl);
    if (!invitation) {
      return NextResponse.json(
        { success: false, error: 'Invalid invitation URL format' },
        { status: 400 }
      );
    }
    
    // Accept the invitation automatically through our web wallet's ACA-Py agent
    // Note: This assumes we have an ACA-Py agent for the web wallet
    const connectionResult = await acceptAcaPyInvitation(invitation, body);
    
    if (!connectionResult.success) {
      return NextResponse.json(
        { success: false, error: connectionResult.error },
        { status: 500 }
      );
    }
    
    // Store the connection info
    const connectionRecord = {
      id: `web_conn_${Date.now()}`,
      acaPyConnectionId: body.connectionId,
      webWalletConnectionId: connectionResult.connectionId,
      playerName: body.playerName,
      playerUUID: body.playerUUID,
      status: 'connecting',
      createdAt: new Date().toISOString(),
      invitationUrl: body.invitationUrl
    };
    
    globalThis.acaPyConnections.push(connectionRecord);
    
    console.log('Web wallet accepting ACA-Py invitation for player:', body.playerName);
    
    // Start monitoring the connection establishment
    monitorConnectionEstablishment(connectionRecord);
    
    return NextResponse.json({
      success: true,
      message: 'ACA-Py invitation accepted, establishing connection',
      connectionId: connectionRecord.id,
      playerName: body.playerName
    });
    
  } catch (error) {
    console.error('Error accepting ACA-Py invitation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to accept ACA-Py invitation' },
      { status: 500 }
    );
  }
}

function extractInvitationFromUrl(invitationUrl: string): any {
  try {
    // Parse invitation from URL - typically base64 encoded
    const url = new URL(invitationUrl);
    const invitationParam = url.searchParams.get('c_i') || url.searchParams.get('oob');
    
    if (!invitationParam) {
      console.error('No invitation parameter found in URL:', invitationUrl);
      return null;
    }
    
    // Decode the invitation
    const decodedInvitation = Buffer.from(invitationParam, 'base64').toString('utf-8');
    return JSON.parse(decodedInvitation);
    
  } catch (error) {
    console.error('Failed to extract invitation from URL:', error);
    return null;
  }
}

async function acceptAcaPyInvitation(invitation: any, requestData: AcaPyInvitationRequest) {
  try {
    console.log('Processing invitation for web wallet simulation');
    
    // For now, simulate accepting the invitation
    // In a full implementation, this would connect to a web wallet's ACA-Py agent
    console.log('Invitation details:', invitation);
    console.log('Request data:', requestData);
    
    // Simulate successful connection establishment
    const webWalletConnectionId = `web_${Date.now()}`;
    
    // Store invitation acceptance - simulate the web wallet connecting back
    return {
      success: true,
      connectionId: webWalletConnectionId,
      message: 'Web wallet invitation accepted (simulated)',
      invitation: invitation
    };
    
  } catch (error) {
    console.error('Failed to accept invitation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

function monitorConnectionEstablishment(connectionRecord: any) {
  // Simulate connection establishment after 2 seconds (like the original)
  setTimeout(() => {
    connectionRecord.status = 'active';
    connectionRecord.establishedAt = new Date().toISOString();
    
    console.log(`Web wallet connection established for player: ${connectionRecord.playerName}`);
    
    // Create notification for proof request when it comes from ACA-Py
    console.log('Web wallet ready to receive proof requests via DIDComm');
    
  }, 2000);
}

function createProofRequestNotification(connectionRecord: any) {
  try {
    // Initialize notification store if needed
    if (!globalThis.notificationStore) {
      globalThis.notificationStore = [];
    }
    
    // Create proof request notification (will be triggered by ACA-Py)
    const proofNotification = {
      id: `proof_req_${Date.now()}`,
      type: 'proof-request',
      title: `Minecraft Verification via ACA-Py`,
      message: `${connectionRecord.playerName} requests proof via ACA-Py connection with DID trust validation`,
      proofRequestData: {
        name: 'Minecraft ACA-Py Verification',
        version: '1.0',
        requested_attributes: {
          attr_0: { name: 'name' },
          attr_1: { name: 'email' },
          attr_2: { name: 'department' },
          attr_3: { name: 'issuer_did' },
          attr_4: { name: 'age' }
        },
        source: 'acapy_minecraft',
        connectionId: connectionRecord.acaPyConnectionId,
        webConnectionId: connectionRecord.id,
        playerName: connectionRecord.playerName,
        playerUUID: connectionRecord.playerUUID
      },
      timestamp: new Date().toISOString(),
      status: 'pending'
    };
    
    globalThis.notificationStore.push(proofNotification);
    
    console.log('Created ACA-Py proof request notification for player:', connectionRecord.playerName);
    
  } catch (error) {
    console.error('Failed to create proof request notification:', error);
  }
}

export async function GET() {
  // Return current ACA-Py connections
  if (!globalThis.acaPyConnections) {
    globalThis.acaPyConnections = [];
  }
  
  return NextResponse.json({
    success: true,
    connections: globalThis.acaPyConnections
  });
}