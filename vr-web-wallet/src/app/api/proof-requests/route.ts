import { NextRequest, NextResponse } from 'next/server';

// Shared global storage for proof requests
declare global {
  var proofRequestStore: any[] | undefined;
}

export async function GET() {
  // Initialize global store if it doesn't exist
  if (typeof globalThis !== 'undefined' && !globalThis.proofRequestStore) {
    globalThis.proofRequestStore = [];
  }
  
  return NextResponse.json({
    success: true,
    proofRequests: globalThis.proofRequestStore || []
  });
}

export async function POST(request: NextRequest) {
  try {
    const verificationSessionData = await request.json();
    
    // Initialize global stores
    if (typeof globalThis !== 'undefined' && !globalThis.proofRequestStore) {
      globalThis.proofRequestStore = [];
    }
    if (typeof globalThis !== 'undefined' && !globalThis.notificationStore) {
      globalThis.notificationStore = [];
    }
    if (typeof globalThis !== 'undefined' && !globalThis.verificationSessions) {
      globalThis.verificationSessions = [];
    }
    
    // Create verification session (compatible with Minecraft API structure)
    const verificationSession = {
      ...verificationSessionData,
      timestamp: new Date().toISOString(),
      status: 'created'
    };
    
    // Store verification session (for Minecraft API to poll)
    if (typeof globalThis !== 'undefined' && globalThis.verificationSessions) {
      globalThis.verificationSessions.push(verificationSession);
    }
    
    // Create proof request for internal storage
    const proofRequest = {
      id: `proof-request-${Date.now()}`,
      sessionId: verificationSessionData.id,
      requestedAttributes: verificationSessionData.requestedAttributes,
      requester: verificationSessionData.requester,
      timestamp: new Date().toISOString(),
      status: 'created'
    };
    
    if (typeof globalThis !== 'undefined' && globalThis.proofRequestStore) {
      globalThis.proofRequestStore.push(proofRequest);
    }
    
    // Create notification for user
    const notification = {
      id: `notification-${Date.now()}`,
      type: 'proof-request',
      title: `Minecraft Verification Request`,
      message: `${verificationSessionData.requester?.playerName || 'Player'} requests proof of: ${verificationSessionData.requestedAttributes?.join(', ') || 'credentials'}`,
      proofRequestData: {
        sessionId: verificationSessionData.id,
        requestedAttributes: verificationSessionData.requestedAttributes,
        requester: verificationSessionData.requester
      },
      timestamp: new Date().toISOString(),
      status: 'pending'
    };
    
    if (typeof globalThis !== 'undefined' && globalThis.notificationStore) {
      globalThis.notificationStore.push(notification);
    }
    
    console.log('Created web wallet verification request:', {
      session: verificationSession,
      proofRequest: proofRequest,
      notification: notification
    });
    
    return NextResponse.json({
      success: true,
      verificationSession: verificationSession,
      proofRequest: proofRequest,
      notification: notification
    });
    
  } catch (error) {
    console.error('Error creating web wallet verification request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create verification request' },
      { status: 500 }
    );
  }
}