import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Generate a simple connection invitation for testing
    // Using a valid base58 encoded Ed25519 public key format
    const publicKey = "8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K"; // Example valid key
    const invitation = {
      "@type": "https://didcomm.org/connections/1.0/invitation",
      "@id": `invitation-${Date.now()}`,
      "label": "VR SSI Wallet",
      "serviceEndpoint": "http://localhost:3001/api/didcomm",
      "recipientKeys": [publicKey],
      "routingKeys": []
    };

    // Store invitation for later use
    if (typeof window !== 'undefined') {
      localStorage.setItem('pendingInvitation', JSON.stringify(invitation));
    }

    return NextResponse.json({
      success: true,
      invitation,
      invitationUrl: `http://localhost:3001/invite?c_i=${encodeURIComponent(JSON.stringify(invitation))}`
    });
  } catch (error) {
    console.error('Error creating invitation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create invitation' },
      { status: 500 }
    );
  }
}