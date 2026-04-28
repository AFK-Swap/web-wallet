import { NextRequest, NextResponse } from 'next/server';

// Monitor for proof requests (same as mobile wallet) but via API polling
export async function POST(request: NextRequest) {
  try {
    const { connectionId, username } = await request.json();
    
    if (!connectionId) {
      return NextResponse.json(
        { success: false, error: 'Connection ID required' },
        { status: 400 }
      );
    }
    
    console.log(`🔍 Monitoring proof requests for connection: ${connectionId}`);
    
    // Check for proof requests via SSI tutorial API (same as mobile wallet logic)
    const proofResponse = await fetch(`http://localhost:4002/proof-status/${connectionId}`);
    if (!proofResponse.ok) {
      throw new Error(`Failed to get proof records: ${proofResponse.statusText}`);
    }
    
    const proofData = await proofResponse.json();
    const proofRecords = proofData.proofRequests || [];
    
    // Filter for proof requests on this connection (same as mobile wallet)
    const connectionProofRequests = proofRecords.filter((record: any) => 
      record.connection_id === connectionId && 
      (record.state === 'request-received' || record.state === 'request_received')
    );
    
    console.log(`📊 Found ${connectionProofRequests.length} proof requests for connection ${connectionId}`);
    
    if (connectionProofRequests.length === 0) {
      return NextResponse.json({
        success: true,
        proofRequests: [],
        message: 'No proof requests found for this connection'
      });
    }
    
    // Transform proof requests into format for manual approval (same as mobile wallet UI)
    const proofRequestsForApproval = connectionProofRequests.map((record: any) => {
      const proofRequest = record.by_format?.pres_request?.indy || record.pres_request;
      
      return {
        id: record.pres_ex_id,
        connectionId: record.connection_id,
        proofRequestLabel: proofRequest?.name || 'Verification Request',
        requestedAttributes: Object.keys(proofRequest?.requested_attributes || {}),
        requestedPredicates: Object.keys(proofRequest?.requested_predicates || {}),
        proofRequest: proofRequest,
        state: record.state,
        createdAt: record.created_at,
        threadId: record.thread_id,
        // This is what mobile wallet would show to user for manual approval
        requiresManualApproval: true
      };
    });
    
    return NextResponse.json({
      success: true,
      proofRequests: proofRequestsForApproval,
      message: `Found ${proofRequestsForApproval.length} proof requests requiring manual approval`
    });
    
  } catch (error) {
    console.error('❌ Error monitoring proof requests:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}