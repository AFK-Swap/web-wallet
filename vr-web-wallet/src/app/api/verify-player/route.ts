import { NextRequest, NextResponse } from 'next/server';

declare global {
  var qrVerificationSessions: any[] | undefined;
}

// Handle mobile QR verification requests
export async function POST(request: NextRequest) {
  try {
    const { playerName } = await request.json();
    
    if (!playerName) {
      return NextResponse.json(
        { success: false, error: 'Player name is required' },
        { status: 400 }
      );
    }

    // Initialize QR sessions store
    if (!globalThis.qrVerificationSessions) {
      globalThis.qrVerificationSessions = [];
    }

    // Create QR verification session
    const sessionId = `qr-session-${Date.now()}`;
    const qrUrl = `https://example.com/verify?session=${sessionId}&player=${encodeURIComponent(playerName)}`;
    
    const qrSession = {
      sessionId,
      playerName,
      qrUrl,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
    };

    globalThis.qrVerificationSessions.push(qrSession);

    console.log(`Created QR verification session for ${playerName}: ${sessionId}`);

    return NextResponse.json({
      success: true,
      sessionId,
      qrUrl,
      message: `QR code generated for ${playerName}`,
      expiresIn: 600 // 10 minutes in seconds
    });

  } catch (error) {
    console.error('Error creating QR verification session:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create QR verification session' },
      { status: 500 }
    );
  }
}

// Get QR verification status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const playerName = searchParams.get('playerName');

    if (!globalThis.qrVerificationSessions) {
      return NextResponse.json(
        { success: false, error: 'No QR verification sessions found' },
        { status: 404 }
      );
    }

    let session;
    if (sessionId) {
      session = globalThis.qrVerificationSessions.find(s => s.sessionId === sessionId);
    } else if (playerName) {
      session = globalThis.qrVerificationSessions.find(s => s.playerName === playerName);
    }

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'QR verification session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      session
    });

  } catch (error) {
    console.error('Error getting QR verification status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get QR verification status' },
      { status: 500 }
    );
  }
}