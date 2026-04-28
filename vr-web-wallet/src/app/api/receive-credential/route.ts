import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser, storeEncryptedCredential } from '@/lib/couchdb-auth'

// Handle CORS preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const { username, password, encryptedCredential, metadata } = await request.json()

    // Validate required fields
    if (!username || !password || !encryptedCredential) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        }
      )
    }

    // Authenticate the user
    const isAuthenticated = await authenticateUser(username, password)
    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials' },
        { 
          status: 401,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        }
      )
    }

    // Store the encrypted credential
    const credentialId = await storeEncryptedCredential(
      username, 
      password, 
      encryptedCredential,
      metadata || {}
    )

    return NextResponse.json({
      success: true,
      message: 'Credential received and stored successfully',
      credentialId
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })

  } catch (error) {
    console.error('Error receiving credential:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      }
    )
  }
}