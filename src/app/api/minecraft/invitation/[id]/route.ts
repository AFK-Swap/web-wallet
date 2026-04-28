import { NextRequest, NextResponse } from 'next/server';

// Serve invitation by ID (short URL for Minecraft)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const invitationId = params.id;
    
    if (!globalThis.connectionInvitations) {
      return NextResponse.json(
        { success: false, error: 'No invitations found' },
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
    
    // Return the full invitation URL for Minecraft plugin to process
    return NextResponse.json({
      success: true,
      data: {
        invitationId: invitation.invitationId,
        invitationUrl: invitation.invitationUrl,
        username: invitation.username,
        playerName: invitation.playerName,
        playerUUID: invitation.playerUUID
      }
    });
    
  } catch (error) {
    console.error('Invitation lookup error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to lookup invitation' },
      { status: 500 }
    );
  }
}