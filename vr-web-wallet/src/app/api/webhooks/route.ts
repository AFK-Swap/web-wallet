import { NextRequest, NextResponse } from 'next/server';

// ACA-Py webhook handler to receive proof request events and create manual approval notifications
export async function POST(request: NextRequest) {
  try {
    const webhook = await request.json();
    
    console.log('🔔 Received ACA-Py webhook:', JSON.stringify(webhook, null, 2));
    
    // Handle present-proof-2.0 webhook events - intercept for manual approval with credential decryption
    if (webhook.topic === 'present_proof_v2_0' && (webhook.state === 'request-received' || webhook.state === 'request_received')) {
      console.log('📨 Proof request received - preparing for manual approval with credential decryption');
      
      const proofExchangeId = webhook.pres_ex_id;
      const connectionId = webhook.connection_id;
      
      // Extract proof request data
      const proofRequest = webhook.by_format?.pres_request?.indy || webhook.pres_request;
      
      if (!proofRequest) {
        console.log('⚠️ No proof request data found in webhook');
        return NextResponse.json({ success: true, message: 'No proof request data' });
      }
      
      console.log(`📋 Proof request for: ${proofRequest.name || 'Verification'}`);
      console.log(`📝 Requested attributes: ${Object.keys(proofRequest.requested_attributes || {}).join(', ')}`);
      
      // Create notification that will trigger manual approval flow
      // This includes credential decryption when user approves
      const notification = {
        id: `proof-request-${proofExchangeId}`,
        type: 'proof-request',
        title: 'Manual Proof Request Approval Required',
        message: `Approval needed for: ${proofRequest.name || 'Verification Request'}`,
        proofRequestData: {
          proofRequest: proofRequest,
          requestedAttributes: Object.keys(proofRequest.requested_attributes || {}),
          requestedPredicates: Object.keys(proofRequest.requested_predicates || {}),
          requiresDecryption: true, // Flag to indicate credential decryption needed
          exchangeId: proofExchangeId,
          connectionId: connectionId,
          pres_ex_id: proofExchangeId,
          preparedRequest: webhook.prepared_request // Store Alice's prepared presentation request
        },
        exchangeId: proofExchangeId,
        connectionId: connectionId,
        timestamp: new Date().toISOString(),
        status: 'pending',
        requiresManualApproval: true
      };
      
      // Store notification for manual processing
      if (typeof globalThis !== 'undefined' && !globalThis.notificationStore) {
        globalThis.notificationStore = [];
      }
      
      if (typeof globalThis !== 'undefined' && globalThis.notificationStore) {
        // Check for duplicates
        const existing = globalThis.notificationStore.find(
          (n: any) => n.exchangeId === proofExchangeId
        );
        
        if (!existing) {
          globalThis.notificationStore.push(notification);
          console.log('✅ Created manual proof request notification:', notification.id);
          console.log('🔐 Notification requires credential decryption with username/password');
        } else {
          console.log('⚠️ Duplicate proof request notification prevented:', proofExchangeId);
        }
      }
      
      return NextResponse.json({
        success: true,
        message: 'Proof request notification created'
      });
    }
    
    // Handle credential offers
    if (webhook.topic === 'issue_credential_v2_0' && webhook.state === 'offer-received') {
      console.log('📜 Credential offer received - creating notification');
      
      // Extract credential offer data
      const credentialExchangeId = webhook.cred_ex_id;
      const connectionId = webhook.connection_id;
      const credentialOffer = webhook.by_format?.cred_offer?.indy || webhook.cred_offer;
      
      // Create credential offer notification
      const notification = {
        id: `credential-offer-${credentialExchangeId}`,
        type: 'credential-offer',
        title: 'New Credential Offer',
        message: 'You have received a new credential offer',
        credentialData: {
          credentialPreview: webhook.credential_proposal_dict?.credential_preview || webhook.credential_preview,
          credentialOffer: credentialOffer
        },
        exchangeId: credentialExchangeId,
        connectionId: connectionId,
        timestamp: new Date().toISOString(),
        status: 'pending'
      };
      
      // Store notification
      if (typeof globalThis !== 'undefined' && !globalThis.notificationStore) {
        globalThis.notificationStore = [];
      }
      
      if (typeof globalThis !== 'undefined' && globalThis.notificationStore) {
        const existing = globalThis.notificationStore.find(
          (n: any) => n.exchangeId === credentialExchangeId
        );
        
        if (!existing) {
          globalThis.notificationStore.push(notification);
          console.log('✅ Created credential offer notification:', notification.id);
        }
      }
      
      return NextResponse.json({
        success: true,
        message: 'Credential offer notification created'
      });
    }
    
    // Handle completed credential issuance - store full AnonCreds credential
    if (webhook.topic === 'issue_credential_v2_0' && webhook.state === 'done') {
      console.log('🎉 Complete credential received - storing full AnonCreds credential');
      
      const credentialExchangeId = webhook.cred_ex_id;
      const connectionId = webhook.connection_id;
      
      // Extract the complete credential with cryptographic components
      const fullCredential = webhook.by_format?.cred?.indy || webhook.credential;
      const credentialAttributes = webhook.credential_proposal_dict?.credential_preview?.attributes || 
                                  webhook.credential_preview?.attributes || [];
      
      if (fullCredential) {
        // Store the complete credential with all cryptographic components
        const completeCredential = {
          credentialId: `full_cred_${credentialExchangeId}`,
          exchangeId: credentialExchangeId,
          connectionId: connectionId,
          // Full AnonCreds credential structure
          anonCredsCredential: {
            schema_id: fullCredential.schema_id,
            cred_def_id: fullCredential.cred_def_id,
            rev_reg_id: fullCredential.rev_reg_id,
            values: fullCredential.values,
            signature: fullCredential.signature,
            signature_correctness_proof: fullCredential.signature_correctness_proof,
            rev_reg: fullCredential.rev_reg,
            witness: fullCredential.witness
          },
          // Attribute preview for easy access
          credentialPreview: {
            attributes: credentialAttributes
          },
          // Metadata
          metadata: {
            issued_at: new Date().toISOString(),
            issuer_connection_id: connectionId,
            schema_id: fullCredential.schema_id,
            cred_def_id: fullCredential.cred_def_id,
            source: 'acapy_webhook',
            exportable: true
          }
        };
        
        console.log('💾 Storing complete AnonCreds credential:', {
          schema_id: fullCredential.schema_id,
          cred_def_id: fullCredential.cred_def_id,
          has_signature: !!fullCredential.signature,
          has_witness: !!fullCredential.witness,
          attributes: credentialAttributes.map(a => a.name)
        });
        
        // Note: Credential storage disabled to prevent duplicates
        // Alice ACA-Py already stores credentials automatically
        // This webhook processing is for notification purposes only
        console.log('ℹ️ Credential completed - Alice ACA-Py already stored it automatically');
      } else {
        console.warn('⚠️ No credential data found in webhook');
      }
      
      return NextResponse.json({
        success: true,
        message: 'Complete credential processed'
      });
    }
    
    // Log other webhook events for debugging
    console.log(`📋 Webhook event: ${webhook.topic} - ${webhook.state}`);
    
    return NextResponse.json({
      success: true,
      message: 'Webhook received'
    });
    
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'ACA-Py Webhook Handler',
    status: 'active',
    timestamp: new Date().toISOString()
  });
}