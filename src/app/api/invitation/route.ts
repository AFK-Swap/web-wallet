import { NextResponse } from 'next/server'

export async function GET() {
  // Return a sample invitation format that ACA-Py can understand
  const invitation = {
    "@type": "https://didcomm.org/connections/1.0/invitation",
    "@id": `invitation-${Date.now()}`,
    "label": "VR Web Wallet",
    "serviceEndpoint": `${process.env.NEXT_PUBLIC_WALLET_URL || 'http://localhost:3001'}/api/didcomm`,
    "recipientKeys": [`did:key:z${Math.random().toString(36).substring(2, 15)}`]
  }

  const invitationUrl = `${process.env.NEXT_PUBLIC_WALLET_URL || 'http://localhost:3001'}/invitation?c_i=${encodeURIComponent(JSON.stringify(invitation))}`

  return NextResponse.json({
    invitation,
    invitationUrl,
    qrCodeData: invitationUrl
  })
}