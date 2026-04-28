import { NextRequest, NextResponse } from 'next/server';

// Accept invitation URL from Minecraft /verify web command
export async function POST(request: NextRequest) {
  try {
    const { invitationUrl, username } = await request.json();
    
    if (!invitationUrl) {
      return NextResponse.json(
        { success: false, error: 'Invitation URL required' },
        { status: 400 }
      );
    }
    
    console.log(`🔗 Accepting invitation for user: ${username}`);
    console.log(`📨 Invitation URL: ${invitationUrl.substring(0, 100)}...`);
    
    // Extract invitation from URL
    let invitationData;
    if (invitationUrl.includes('c_i=')) {
      // Connections 1.0 format
      const base64Data = invitationUrl.split('c_i=')[1];
      invitationData = JSON.parse(Buffer.from(base64Data, 'base64').toString());
    } else if (invitationUrl.includes('oob=')) {
      // Out-of-band 1.1 format  
      const base64Data = invitationUrl.split('oob=')[1];
      invitationData = JSON.parse(Buffer.from(base64Data, 'base64').toString());
    } else {
      throw new Error('Invalid invitation URL format');
    }
    
    console.log('📋 Decoded invitation:', invitationData);
    
    // ACTUAL APPROACH: Accept the invitation via ACA-Py to establish the connection
    let serviceEndpoint;
    if (invitationData.serviceEndpoint) {
      // Connections 1.0 format
      serviceEndpoint = invitationData.serviceEndpoint;
    } else if (invitationData.services && invitationData.services.length > 0) {
      // Out-of-band 1.1 format
      serviceEndpoint = invitationData.services[0].serviceEndpoint;
    } else {
      throw new Error('No service endpoint found in invitation');
    }
    
    const invitationId = invitationData['@id'];
    
    console.log(`📋 User ${username} accepting invitation from: ${serviceEndpoint}`);
    console.log(`🆔 Invitation ID: ${invitationId}`);
    
    // FIXED: Actually accept the invitation via Alice's ACA-Py agent instead of just storing
    console.log('🔗 Accepting invitation via Alice ACA-Py agent...');
    
    try {
      // Accept invitation via Alice's ACA-Py agent (localhost:8031)
      const acapyResponse = await fetch('http://localhost:8031/connections/receive-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invitationData)
      });
      
      if (!acapyResponse.ok) {
        const errorText = await acapyResponse.text();
        throw new Error(`Alice ACA-Py invitation acceptance failed: ${errorText}`);
      }
      
      const connectionResult = await acapyResponse.json();
      console.log('✅ Alice ACA-Py accepted invitation:', connectionResult);
      
      // Store connection info for user
      const connectionRecord = {
        invitationId: invitationId,
        connectionId: connectionResult.connection_id,
        username: username, 
        serviceEndpoint: serviceEndpoint,
        invitationUrl: invitationUrl,
        state: connectionResult.state,
        createdAt: new Date().toISOString()
      };
      
      return NextResponse.json({
        success: true,
        message: 'Invitation accepted - connection established via Alice agent',
        data: { 
          ...connectionRecord,
          instructions: 'Connection established! Alice agent will receive credentials and proof requests.',
          aliceConnectionId: connectionResult.connection_id,
          connectionState: connectionResult.state
        }
      });
      
    } catch (acapyError) {
      console.error('❌ Alice ACA-Py connection failed:', acapyError);
      
      // Fallback: Store invitation for manual processing  
      const connectionRecord = {
        invitationId: invitationId,
        username: username, 
        serviceEndpoint: serviceEndpoint,
        invitationUrl: invitationUrl,
        createdAt: new Date().toISOString(),
        error: acapyError.message
      };
      
      return NextResponse.json({
        success: false,
        message: 'Failed to connect via Alice agent - stored for manual processing',
        data: connectionRecord,
        error: acapyError.message
      });
    }
    
  } catch (error) {
    console.error('❌ Accept invitation error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}