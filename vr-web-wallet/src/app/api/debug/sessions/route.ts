import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const sessions = globalThis.verificationSessions || [];
    
    return NextResponse.json({
      success: true,
      totalSessions: sessions.length,
      sessions: sessions.map(session => ({
        id: session.id,
        playerName: session.requester?.playerName,
        status: session.status,
        createdAt: session.createdAt,
        completedAt: session.completedAt,
        verified: session.status === 'verified'
      }))
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to get sessions',
      details: error
    });
  }
}