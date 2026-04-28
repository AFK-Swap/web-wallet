import { NextRequest, NextResponse } from 'next/server';

// Poll Alice ACA-Py for pending proof requests that need user approval
export async function GET(request: NextRequest) {
  try {
    console.log('\n\n🔍 =============== POLL API CALLED ===============');
    console.log('🔍 Polling Alice for pending proof requests...');
    
    // Test connectivity first with credentials endpoint that we know works
    console.log('🧪 Testing Alice connectivity with credentials endpoint...');
    const testResponse = await fetch('http://127.0.0.1:8031/credentials');
    console.log(`🧪 Test response status: ${testResponse.status}`);
    const testData = await testResponse.json();
    console.log(`🧪 Test data length: ${testData.results?.length || 0}`);
    
    // Get all proof records from Alice ACA-Py
    // Try multiple localhost variations due to WSL/Docker networking issues
    console.log('🌐 Attempting to fetch from Alice on port 8031...');

    // Try 127.0.0.1 instead of localhost (more reliable in WSL/Docker)
    const response = await fetch('http://127.0.0.1:8031/present-proof-2.0/records');
    console.log(`📡 Response status: ${response.status} ${response.statusText}`);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`❌ Failed response body:`, errorBody);
      throw new Error(`Failed to get proof records: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`📊 Response data keys:`, Object.keys(data));
    console.log(`📊 Results array length:`, data.results?.length);
    console.log(`📊 First 3 proof records:`, JSON.stringify(data.results?.slice(0, 3), null, 2));
    const proofRecords = data.results || [];
    console.log(`📊 Total proof records retrieved: ${proofRecords.length}`);
    console.log(`📊 Proof request IDs from Alice: ${proofRecords.map((r: any) => r.pres_ex_id).join(', ')}`);

    console.log(`📊 Raw proof records from Alice:`, JSON.stringify(proofRecords, null, 2));
    
    // Filter for proof requests in "request-received" state (waiting for user approval)
    const pendingRequests = proofRecords.filter((record: any) => {
      console.log(`🔍 Checking record state: ${record.state} (pres_ex_id: ${record.pres_ex_id})`);
      return record.state === 'request-received' || record.state === 'request_received';
    });
    
    console.log(`📊 Found ${pendingRequests.length} pending proof requests`);
    
    // FORCE CLEAR: Always start with empty notification store to sync with current Alice state
    if (typeof globalThis !== 'undefined') {
      console.log(`🗑️ FORCE CLEARING notification store (had ${globalThis.notificationStore?.length || 0} items)`);
      globalThis.notificationStore = [];
    }

    console.log(`📋 Current notificationStore size BEFORE processing: ${globalThis.notificationStore?.length || 0}`);
    console.log(`📋 Existing notification IDs: ${globalThis.notificationStore?.map((n: any) => n.exchangeId).join(', ') || 'none'}`);

    // Demo notification disabled - we'll use real proof requests from ACA-Py
    console.log('📋 Demo notifications disabled - using real proof requests only');
    
    // Create notifications for any new pending requests
    const notifications = [];
    
    if (typeof globalThis !== 'undefined' && !globalThis.notificationStore) {
      globalThis.notificationStore = [];
    }
    
    for (const proofRecord of pendingRequests) {
      const proofExchangeId = proofRecord.pres_ex_id;
      console.log(`🔄 Processing proof request ${proofExchangeId}`);

      // Check if we already have a notification for this proof request
      const existingNotification = globalThis.notificationStore?.find(
        (n: any) => n.exchangeId === proofExchangeId && n.type === 'proof-request'
      );

      if (existingNotification) {
        console.log(`⏭️ Notification already exists for ${proofExchangeId}, skipping`);
        continue;
      }

      // Extract proof request data
      const proofRequest = proofRecord.by_format?.pres_request?.indy || proofRecord.pres_request;

      console.log(`📋 Proof request data exists: ${!!proofRequest}`);
      if (proofRequest) {
        console.log(`📋 Proof request name: ${proofRequest.name || 'N/A'}`);
        console.log(`📋 Requested attributes: ${JSON.stringify(Object.keys(proofRequest.requested_attributes || {}))}`);

        const notification = {
            id: `proof-request-${proofExchangeId}`,
            type: 'proof-request',
            title: 'Proof Request Requires Approval',
            message: `Approval needed for: ${proofRequest.name || 'Verification Request'}`,
            proofRequestData: {
              pres_ex_id: proofExchangeId,  // Critical: needed for respond-to-proof API
              proofRequest: proofRequest,
              requestedAttributes: Object.keys(proofRequest.requested_attributes || {}),
              requestedPredicates: Object.keys(proofRequest.requested_predicates || {}),
              exchangeId: proofExchangeId,
              connectionId: proofRecord.connection_id
            },
            exchangeId: proofExchangeId,
            connectionId: proofRecord.connection_id,
            timestamp: new Date().toISOString(),
            status: 'pending',
            requiresManualApproval: true
          };
          
        globalThis.notificationStore.push(notification);
        notifications.push(notification);
        console.log('✅ Created new proof request notification:', notification.id);
      } else {
        console.log(`⚠️ No proof request data found in record ${proofExchangeId}`);
        console.log(`⚠️ by_format exists: ${!!proofRecord.by_format}`);
        console.log(`⚠️ pres_request exists: ${!!proofRecord.pres_request}`);
      }
    }

    console.log(`📊 Final notification store size: ${globalThis.notificationStore?.length || 0}`);
    console.log(`📊 Returning ${notifications.length} new notifications`);

    return NextResponse.json({
      success: true,
      pendingCount: pendingRequests.length,
      newNotifications: notifications.length,
      notifications: notifications,
      message: `Found ${pendingRequests.length} pending proof requests, ${notifications.length} new`
    });
    
  } catch (error) {
    console.error('❌ Error polling proof requests:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}