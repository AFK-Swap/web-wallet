import { NextRequest, NextResponse } from 'next/server';

// Get stored invitation URL for a user (for Minecraft plugin to use)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    
    if (!username) {
      return NextResponse.json(
        { success: false, error: 'Username required' },
        { status: 400 }
      );
    }
    
    // Check if invitation exists for this user
    if (!globalThis.userInvitations) {
      return NextResponse.json(
        { success: false, error: 'No invitations stored' },
        { status: 404 }
      );
    }
    
    const invitation = globalThis.userInvitations.get(username);
    
    if (!invitation) {
      return NextResponse.json(
        { success: false, error: 'No invitation found for this user' },
        { status: 404 }
      );
    }
    
    // Mark as processed
    invitation.processed = true;
    invitation.retrievedAt = Date.now();
    globalThis.userInvitations.set(username, invitation);
    
    console.log(`🎮 Minecraft retrieving invitation for user: ${username}`);
    
    return NextResponse.json({
      success: true,
      data: {
        invitationUrl: invitation.invitationUrl,
        invitationId: invitation.invitationId,
        username: username,
        timestamp: invitation.timestamp
      }
    });
    
  } catch (error) {
    console.error('❌ Get invitation error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}