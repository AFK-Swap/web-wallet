import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// Alice ACA-Py agent URL
const ALICE_ACAPY_URL = 'http://localhost:8031';

// Global storage for tracking processed proof requests
declare global {
  var processedProofRequests: Set<string> | undefined;
  var notificationStore: any[] | undefined;
}

export async function GET() {
  try {
    // Initialize global stores
    if (typeof globalThis !== 'undefined' && !globalThis.processedProofRequests) {
      globalThis.processedProofRequests = new Set();
    }
    if (typeof globalThis !== 'undefined' && !globalThis.notificationStore) {
      globalThis.notificationStore = [];
    }

    // Get all proof records from Alice's ACA-Py agent
    const response = await axios.get(`${ALICE_ACAPY_URL}/present-proof-2.0/records`);
    const proofRecords = response.data.results || [];

    // Filter for new proof requests in "request-received" state
    const newProofRequests = proofRecords.filter((record: any) => 
      record.state === 'request-received' && 
      !globalThis.processedProofRequests?.has(record.pres_ex_id)
    );

    console.log(`Found ${newProofRequests.length} new proof requests from Alice ACA-Py`);

    // Process new proof requests
    const notifications = [];
    for (const proofRecord of newProofRequests) {
      try {
        // Mark as processed
        globalThis.processedProofRequests?.add(proofRecord.pres_ex_id);

        // Extract proof request details
        const proofRequest = proofRecord.by_format?.pres_request?.indy;
        const requestedAttributes = proofRequest?.requested_attributes || {};
        
        // Create readable attribute list
        const attributeNames = Object.values(requestedAttributes).map((attr: any) => attr.name);

        // Create notification for user
        const notification = {
          id: `notification-${Date.now()}-${proofRecord.pres_ex_id}`,
          type: 'proof-request',
          title: 'Proof Request Received',
          message: `Verification request for: ${attributeNames.join(', ')}`,
          proofRequestData: {
            pres_ex_id: proofRecord.pres_ex_id,
            connection_id: proofRecord.connection_id,
            requestedAttributes: attributeNames,
            proofRequest: proofRequest,
            comment: proofRecord.pres_request?.comment || 'Verification request'
          },
          timestamp: new Date().toISOString(),
          status: 'pending'
        };

        globalThis.notificationStore?.push(notification);
        notifications.push(notification);

        // Also create a verification session for Minecraft compatibility
        if (!globalThis.verificationSessions) {
          globalThis.verificationSessions = [];
        }

        // Check if we already have a verification session for this proof request
        const existingSession = globalThis.verificationSessions.find((session: any) => 
          session.pres_ex_id === proofRecord.pres_ex_id
        );

        if (!existingSession) {
          const verificationSession = {
            id: `minecraft-verification-${proofRecord.pres_ex_id}`,
            verificationSessionId: `minecraft-verification-${proofRecord.pres_ex_id}`,
            type: 'minecraft_verification',
            pres_ex_id: proofRecord.pres_ex_id,
            connection_id: proofRecord.connection_id,
            playerName: 'MinecraftPlayer',
            status: 'pending',
            createdAt: new Date().toISOString(),
            proofReceived: null,
            verificationResult: null,
            requestedAttributes: attributeNames,
            title: 'Minecraft Verification Request',
            message: `Minecraft server requests verification of: ${attributeNames.join(', ')}`,
            requester: {
              playerName: 'MinecraftPlayer',
              playerUUID: 'minecraft-uuid'
            }
          };

          globalThis.verificationSessions.push(verificationSession);
          
          console.log('Created verification session for Minecraft compatibility:', {
            sessionId: verificationSession.id,
            pres_ex_id: proofRecord.pres_ex_id,
            attributes: attributeNames
          });
        }

        console.log('Created notification for proof request:', {
          pres_ex_id: proofRecord.pres_ex_id,
          attributes: attributeNames,
          comment: proofRecord.pres_request?.comment
        });

      } catch (error) {
        console.error('Error processing proof request:', proofRecord.pres_ex_id, error);
      }
    }

    return NextResponse.json({
      success: true,
      newProofRequests: newProofRequests.length,
      notifications: notifications,
      totalProcessed: globalThis.processedProofRequests?.size || 0
    });

  } catch (error) {
    console.error('Error monitoring proof requests:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to monitor proof requests' },
      { status: 500 }
    );
  }
}

// POST endpoint to manually trigger monitoring
export async function POST() {
  return GET();
}