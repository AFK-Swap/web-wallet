import { NextRequest, NextResponse } from 'next/server';

// Poll ACA-Py for pending proof requests - alternative to webhook approach
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking for pending proof requests...');
    
    // Get all present-proof exchanges from ACA-Py
    const response = await fetch('http://localhost:8031/present-proof-2.0/records', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`ACA-Py API error: ${response.status}`);
    }
    
    const data = await response.json();
    const proofRecords = data.results || [];
    
    // Filter for very recent proof requests (last 5 minutes) that need manual approval  
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const pendingRequests = proofRecords.filter((record: any) => {
      const isRecentState = record.state === 'request-received' || 
                           record.state === 'request_received' ||
                           record.state === 'presentation-sent' ||
                           record.state === 'presentation_sent' ||
                           record.state === 'done';
      
      const isRecent = record.created_at > fiveMinutesAgo;
      
      console.log(`Record ${record.pres_ex_id}: state=${record.state}, created=${record.created_at}, isRecent=${isRecent}`);
      return isRecentState && isRecent;
    });
    
    console.log(`📊 Found ${pendingRequests.length} pending proof requests`);
    
    if (pendingRequests.length === 0) {
      return NextResponse.json({
        success: true,
        pendingRequests: [],
        message: 'No pending proof requests'
      });
    }
    
    // Transform proof requests into notification format
    const notifications = pendingRequests.map((record: any) => {
      const proofRequest = record.by_format?.pres_request?.indy || record.pres_request;
      
      return {
        id: `proof-request-${record.pres_ex_id}`,
        type: 'proof-request',
        title: 'Manual Proof Request Approval Required',
        message: `Approval needed for: ${proofRequest?.name || 'Verification Request'}`,
        proofRequestData: {
          proofRequest: proofRequest,
          requestedAttributes: Object.keys(proofRequest?.requested_attributes || {}),
          requestedPredicates: Object.keys(proofRequest?.requested_predicates || {}),
          requiresDecryption: true,
          exchangeId: record.pres_ex_id,
          connectionId: record.connection_id
        },
        exchangeId: record.pres_ex_id,
        connectionId: record.connection_id,
        timestamp: new Date().toISOString(),
        status: 'pending',
        requiresManualApproval: true
      };
    });
    
    return NextResponse.json({
      success: true,
      pendingRequests: notifications,
      message: `Found ${notifications.length} pending proof requests`
    });
    
  } catch (error) {
    console.error('❌ Error checking proof requests:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check proof requests' },
      { status: 500 }
    );
  }
}