import { NextRequest, NextResponse } from 'next/server';

// Store connection invitations with user context
declare global {
  var connectionInvitations: Map<string, any> | undefined;
}

// Generate DIDComm connection invitation for Minecraft verification
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const playerName = searchParams.get('playerName');
    const playerUUID = searchParams.get('playerUUID');
    
    if (!username) {
      return NextResponse.json(
        { success: false, error: 'Username parameter required' },
        { status: 400 }
      );
    }
    
    if (!globalThis.connectionInvitations) {
      globalThis.connectionInvitations = new Map();
    }
    
    // Create DIDComm invitation via ACA-Py connections endpoint (1.0 format)
    const invitationPayload = {
      my_label: `Minecraft Verification - User: ${username}`,
      alias: `minecraft-${username}-${Date.now()}`
    };
    
    console.log('Creating DIDComm invitation for user:', username);
    
    const response = await fetch('http://localhost:8031/connections/create-invitation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invitationPayload)
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ACA-Py invitation creation failed: ${error}`);
    }
    
    const invitationResult = await response.json();
    
    // Store invitation with user context
    const invitationId = invitationResult.invitation['@id']; // Use invitation ID from 1.0 format
    const connectionRecord = {
      invitationId,
      connectionId: invitationResult.connection_id,
      username,
      playerName,
      playerUUID,
      createdAt: new Date().toISOString(),
      status: 'invitation-created',
      invitation: invitationResult.invitation,
      invitationUrl: invitationResult.invitation_url
    };
    
    globalThis.connectionInvitations.set(invitationId, connectionRecord);
    
    console.log(`✅ Created DIDComm invitation for ${username}:`, {
      invitationId,
      invitationUrl: invitationResult.invitation_url?.substring(0, 100) + '...'
    });
    
    return NextResponse.json({
      success: true,
      data: {
        invitationId,
        invitationUrl: invitationResult.invitation_url,
        // Short URL for Minecraft (avoids command length limits)
        minecraftUrl: `http://localhost:3001/api/minecraft/invitation/${invitationId}`,
        username,
        playerName,
        playerUUID,
        instructions: "Copy this URL and use it in Minecraft: /verify web <URL>"
      }
    });
    
  } catch (error) {
    console.error('Connection invitation creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create connection invitation', details: error.message },
      { status: 500 }
    );
  }
}

// Handle connection establishment callback from ACA-Py
export async function POST(request: NextRequest) {
  try {
    const { connectionId, invitationId, state } = await request.json();
    
    if (!globalThis.connectionInvitations) {
      return NextResponse.json(
        { success: false, error: 'No invitation records found' },
        { status: 404 }
      );
    }
    
    const invitation = globalThis.connectionInvitations.get(invitationId);
    if (!invitation) {
      return NextResponse.json(
        { success: false, error: 'Invitation not found' },
        { status: 404 }
      );
    }
    
    // Update invitation record with connection details
    invitation.connectionId = connectionId;
    invitation.connectionState = state;
    invitation.connectedAt = new Date().toISOString();
    invitation.status = 'connection-established';
    
    console.log(`🔗 Connection established for user ${invitation.username}:`, {
      connectionId,
      invitationId,
      state
    });
    
    return NextResponse.json({
      success: true,
      message: 'Connection established',
      data: {
        username: invitation.username,
        connectionId,
        state
      }
    });
    
  } catch (error) {
    console.error('Connection establishment error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to handle connection establishment' },
      { status: 500 }
    );
  }
}

// Get connection status
export async function GET_STATUS(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const invitationId = searchParams.get('invitationId');
    
    if (!invitationId) {
      return NextResponse.json(
        { success: false, error: 'invitationId parameter required' },
        { status: 400 }
      );
    }
    
    if (!globalThis.connectionInvitations) {
      return NextResponse.json(
        { success: false, error: 'No invitation records found' },
        { status: 404 }
      );
    }
    
    const invitation = globalThis.connectionInvitations.get(invitationId);
    if (!invitation) {
      return NextResponse.json(
        { success: false, error: 'Invitation not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: invitation
    });
    
  } catch (error) {
    console.error('Connection status error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get connection status' },
      { status: 500 }
    );
  }
}