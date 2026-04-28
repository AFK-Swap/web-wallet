import { NextRequest, NextResponse } from 'next/server';

// Connectionless proof request notification endpoint
// This endpoint receives notifications from Minecraft about connectionless proof requests

interface ConnectionlessProofRequest {
  type: 'connectionless_proof_request';
  proofExchangeId: string;
  playerName: string;
  playerUUID: string;
  title: string;
  message: string;
}

declare global {
  var notificationStore: any[] | undefined;
}

export async function POST(request: NextRequest) {
  try {
    const body: ConnectionlessProofRequest = await request.json();
    
    console.log('Received connectionless proof request from Minecraft:', body);
    
    // Initialize notification store if needed
    if (!globalThis.notificationStore) {
      globalThis.notificationStore = [];
    }
    
    // Create connectionless proof request notification
    const notification = {
      id: `conn_less_${Date.now()}`,
      type: 'proof-request',
      title: body.title,
      message: body.message,
      proofRequestData: {
        name: 'Minecraft Connectionless Verification',
        version: '1.0',
        requested_attributes: {
          attr_0: { name: 'name' },
          attr_1: { name: 'email' },
          attr_2: { name: 'department' },
          attr_3: { name: 'issuer_did' },
          attr_4: { name: 'age' }
        },
        source: 'connectionless_minecraft',
        proofExchangeId: body.proofExchangeId,
        playerName: body.playerName,
        playerUUID: body.playerUUID,
        connectionless: true
      },
      timestamp: new Date().toISOString(),
      status: 'pending'
    };
    
    globalThis.notificationStore.push(notification);
    
    console.log('Created connectionless proof request notification:', notification.id);
    
    return NextResponse.json({
      success: true,
      message: 'Connectionless proof request notification created',
      notificationId: notification.id
    });
    
  } catch (error) {
    console.error('Error creating connectionless proof request notification:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create connectionless notification' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Return current connectionless notifications
  if (!globalThis.notificationStore) {
    globalThis.notificationStore = [];
  }
  
  const connectionlessNotifications = globalThis.notificationStore.filter(
    (notification: any) => notification.proofRequestData?.connectionless === true
  );
  
  return NextResponse.json({
    success: true,
    notifications: connectionlessNotifications
  });
}