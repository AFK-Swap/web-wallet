import { NextRequest, NextResponse } from 'next/server';

// Global storage for verification sessions
declare global {
  var verificationSessions: any[] | undefined;
}

interface VerificationRequest {
  type: string;
  verificationSessionId?: string;
  playerName?: string;
  playerUUID?: string;
  requester?: {
    playerUUID: string;
    playerName: string;
  };
  requestedAttributes?: string[];
  timestamp?: string;
  title?: string;
  message?: string;
  proofRequestData?: any;
}

export async function POST(request: NextRequest) {
  try {
    const verificationRequest: VerificationRequest = await request.json();
    
    console.log('Received verification request from Minecraft:', verificationRequest);
    
    // Initialize verification sessions store
    if (!globalThis.verificationSessions) {
      globalThis.verificationSessions = [];
    }
    
    // Determine verification method and source
    const isAcaPyVerification = verificationRequest.type === 'acapy_web_verification';
    const isWebProofRequest = verificationRequest.type === 'web_proof_request';
    const isUserConsentVerification = verificationRequest.type === 'user_consent_verification';
    const trustValidation = verificationRequest.trustValidation || (isAcaPyVerification || isWebProofRequest || isUserConsentVerification ? 'acapy' : 'none');
    
    // Create verification session
    const verificationSession = {
      id: `verification-${Date.now()}`,
      ...verificationRequest,
      status: 'pending',
      createdAt: new Date().toISOString(),
      proofReceived: null,
      verificationResult: null,
      acaPyTrustValidation: isAcaPyVerification || isWebProofRequest || isUserConsentVerification,
      requiresUserConsent: verificationRequest.requiresUserConsent || false,
      // Ensure requester exists for the session
      requester: verificationRequest.requester || {
        playerName: verificationRequest.playerName || 'testPlayer',
        playerUUID: verificationRequest.playerUUID || 'test-uuid-' + Date.now()
      }
    };
    
    globalThis.verificationSessions.push(verificationSession);
    
    // Create proof request for the web wallet
    let proofRequest;
    
    if ((isWebProofRequest || isUserConsentVerification) && verificationRequest.proofRequestData) {
      // Use the proof request data sent directly from the plugin (Bifold-compatible)
      proofRequest = verificationRequest.proofRequestData;
    } else if (isUserConsentVerification) {
      // Build proof request for user consent verification
      proofRequest = {
        name: 'Minecraft User Consent Verification',
        version: '1.0',
        requested_attributes: {}
      };
      
      if (verificationRequest.requestedAttributes && Array.isArray(verificationRequest.requestedAttributes)) {
        verificationRequest.requestedAttributes.forEach((attr, index) => {
          proofRequest.requested_attributes[`attr_${attr}`] = {
            name: attr.toLowerCase().trim()
          };
        });
      }
    } else {
      // Build requested attributes object (legacy format)
      proofRequest = {
        name: isAcaPyVerification ? 'Minecraft ACA-Py Trust Verification' : `${verificationRequest.type} Verification Request`,
        version: '1.0',
        requested_attributes: {}
      };
      
      if (verificationRequest.requestedAttributes && Array.isArray(verificationRequest.requestedAttributes)) {
        verificationRequest.requestedAttributes.forEach((attr, index) => {
          proofRequest.requested_attributes[`attr_${index}`] = {
            name: attr.toLowerCase().trim()
          };
        });
      }
    }
    
    // Create notification for the web wallet
    const playerName = verificationRequest.requester?.playerName || verificationRequest.playerName || 'Unknown Player';
    const notification = {
      id: `notification-${Date.now()}`,
      type: 'proof-request',
      title: isUserConsentVerification
        ? `${verificationRequest.title || 'Minecraft User Consent Verification'}`
        : isWebProofRequest 
          ? `${verificationRequest.title || 'Minecraft Web Verification'}` 
          : isAcaPyVerification 
            ? `Minecraft Verification with ACA-Py Trust` 
            : `Minecraft Verification: ${verificationRequest.type}`,
      message: isUserConsentVerification
        ? `${verificationRequest.message || playerName + ' requests your permission to verify identity. You have full control over what credentials to share.'}`
        : isWebProofRequest
          ? `${verificationRequest.message || playerName + ' requests proof via web wallet (Bifold-compatible)'}`
          : isAcaPyVerification
            ? `${playerName} requests proof with DID trust validation via ACA-Py`
            : `${playerName} requests proof of: ${verificationRequest.requestedAttributes ? verificationRequest.requestedAttributes.join(', ') : 'credentials'}`,
      proofRequestData: {
        ...proofRequest,
        minecraftPlayer: verificationRequest.requester,
        verificationSessionId: (isWebProofRequest || isUserConsentVerification) ? verificationRequest.verificationSessionId || verificationSession.id : verificationSession.id,
        source: isUserConsentVerification ? 'user_consent_minecraft' : isWebProofRequest ? 'web_minecraft' : isAcaPyVerification ? 'acapy_minecraft' : 'minecraft',
        trustValidation: trustValidation,
        acapyVerifierUrl: verificationRequest.acapyVerifierUrl || undefined
      },
      timestamp: new Date().toISOString(),
      status: 'pending'
    };
    
    // Store notification
    if (!globalThis.notificationStore) {
      globalThis.notificationStore = [];
    }
    
    globalThis.notificationStore.push(notification);
    
    console.log(`Created ${isUserConsentVerification ? 'user consent ' : isAcaPyVerification ? 'ACA-Py trust ' : ''}verification request for ${playerName}:`, notification);
    
    return NextResponse.json({
      success: true,
      message: isUserConsentVerification
        ? 'User consent verification request created - user can choose to approve or decline'
        : isAcaPyVerification 
          ? 'Verification request created with ACA-Py trust validation'
          : 'Verification request created',
      verificationId: verificationSession.id,
      proofRequest: proofRequest,
      playerName: verificationRequest.requester?.playerName || verificationRequest.playerName,
      trustValidation: trustValidation,
      requiresUserConsent: verificationRequest.requiresUserConsent || false
    });
    
  } catch (error) {
    console.error('Error processing Minecraft verification request:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { success: false, error: 'Failed to process verification request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Return current verification sessions
  if (!globalThis.verificationSessions) {
    globalThis.verificationSessions = [];
  }
  
  return NextResponse.json({
    success: true,
    sessions: globalThis.verificationSessions
  });
}