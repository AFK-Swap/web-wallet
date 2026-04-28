import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// Alice ACA-Py agent URL
const ALICE_ACAPY_URL = 'http://localhost:8031';

export async function POST(request: NextRequest) {
  try {
    const { pres_ex_id, approve = true, preparedRequest } = await request.json();
    
    if (!pres_ex_id) {
      return NextResponse.json(
        { success: false, error: 'pres_ex_id is required' },
        { status: 400 }
      );
    }

    if (!approve) {
      // Decline the proof request
      await axios.delete(`${ALICE_ACAPY_URL}/present-proof-2.0/records/${pres_ex_id}`);
      return NextResponse.json({
        success: true,
        action: 'declined',
        pres_ex_id
      });
    }

    // Use Alice's prepared presentation request if available
    let presentationBody = {};

    if (preparedRequest) {
      console.log('🚀 Using Alice\'s prepared presentation request for:', pres_ex_id);
      presentationBody = preparedRequest;
    } else {
      console.log('⚠️ No prepared request available, fetching credentials and auto-building presentation');

      // Fetch the proof request record to see what's being requested
      const proofRecordResponse = await axios.get(
        `${ALICE_ACAPY_URL}/present-proof-2.0/records/${pres_ex_id}`
      );
      const proofRecord = proofRecordResponse.data;
      console.log('📋 Proof record state:', proofRecord.state);

      // Fetch matching credentials from Alice's wallet
      const credentialsResponse = await axios.get(
        `${ALICE_ACAPY_URL}/present-proof-2.0/records/${pres_ex_id}/credentials`
      );
      console.log('🔍 Available credentials:', JSON.stringify(credentialsResponse.data, null, 2));

      // Auto-select the first matching credential for each requested attribute
      const requestedAttributes: any = {};
      const proofRequest = proofRecord.by_format?.pres_request?.indy || proofRecord.pres_request;

      if (proofRequest?.requested_attributes) {
        for (const [referent, attrInfo] of Object.entries(proofRequest.requested_attributes)) {
          // Find a credential that has this attribute
          const matchingCreds = credentialsResponse.data.filter((cred: any) =>
            cred.cred_info?.attrs &&
            Object.keys(cred.cred_info.attrs).some((attr: string) =>
              attr === (attrInfo as any).name
            )
          );

          if (matchingCreds.length > 0) {
            const cred = matchingCreds[0];
            requestedAttributes[referent] = {
              cred_id: cred.cred_info.referent,
              revealed: true
            };
            console.log(`✅ Auto-selected credential ${cred.cred_info.referent} for attribute ${(attrInfo as any).name}`);
          } else {
            console.warn(`⚠️ No matching credential found for attribute ${(attrInfo as any).name}`);
          }
        }
      }

      presentationBody = {
        indy: {
          requested_attributes: requestedAttributes,
          requested_predicates: {},
          self_attested_attributes: {}
        }
      };

      console.log('📤 Auto-built presentation body:', JSON.stringify(presentationBody, null, 2));
    }

    const proofResponse = await axios.post(
      `${ALICE_ACAPY_URL}/present-proof-2.0/records/${pres_ex_id}/send-presentation`,
      presentationBody
    );

    console.log('Proof presentation sent successfully:', {
      pres_ex_id,
      state: proofResponse.data.state
    });

    // Update notification status to completed
    if (typeof globalThis !== 'undefined' && globalThis.notificationStore) {
      const notification = globalThis.notificationStore.find((n: any) => 
        n.proofRequestData?.pres_ex_id === pres_ex_id
      );
      if (notification) {
        notification.status = 'completed';
        notification.completedAt = new Date().toISOString();
      }
    }

    // Update any corresponding verification sessions to mark them as completed
    if (typeof globalThis !== 'undefined' && globalThis.verificationSessions) {
      const verificationSession = globalThis.verificationSessions.find((session: any) => 
        session.pres_ex_id === pres_ex_id || 
        session.connection_id === proofResponse.data.connection_id
      );
      
      if (verificationSession) {
        console.log('🔄 Updating verification session after proof response');
        verificationSession.status = 'proof_shared';
        verificationSession.proofReceived = {
          type: 'anoncreds',
          pres_ex_id: pres_ex_id,
          state: proofResponse.data.state,
          credential_used: {
            status: 'used_from_alice_wallet'
          }
        };
        verificationSession.completedAt = new Date().toISOString();
        verificationSession.userApproved = true;
        verificationSession.approvalTimestamp = new Date().toISOString();
        verificationSession.sharedWithMinecraft = true;
        
        console.log('✅ Verification session updated for Minecraft detection');
      }
    }


    return NextResponse.json({
      success: true,
      action: 'approved',
      pres_ex_id,
      state: proofResponse.data.state,
      message: 'Proof presentation sent successfully'
    });

  } catch (error) {
    console.error('Error responding to proof request:', error);
    
    // Check if it's an axios error
    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data || error.message;
      return NextResponse.json(
        { success: false, error: `ACA-Py error: ${JSON.stringify(errorMessage)}` },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to respond to proof request' },
      { status: 500 }
    );
  }
}