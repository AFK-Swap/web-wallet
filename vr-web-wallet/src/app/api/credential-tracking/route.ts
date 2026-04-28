import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// CORS headers for cross-origin requests from SSI tutorial interface
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Server-side credential issuance tracking to prevent duplicates across browser sessions
const ISSUED_CREDENTIALS_FILE = path.join(process.cwd(), 'data', 'issued-credentials.json');

interface IssuedCredential {
  connectionId: string;
  credentialType: string;
  issuedAt: string;
  exchangeId?: string;
  issuerDid?: string;
  issuerLabel?: string;
}

// Helper function to ensure data directory exists
async function ensureDataDirectory(): Promise<void> {
  const dataDir = path.dirname(ISSUED_CREDENTIALS_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Helper function to get issued credentials log
async function getIssuedCredentials(): Promise<IssuedCredential[]> {
  try {
    await ensureDataDirectory();
    const data = await fs.readFile(ISSUED_CREDENTIALS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist, return empty array
    return [];
  }
}

// Helper function to save issued credentials log
async function saveIssuedCredentials(credentials: IssuedCredential[]): Promise<void> {
  await ensureDataDirectory();
  await fs.writeFile(ISSUED_CREDENTIALS_FILE, JSON.stringify(credentials, null, 2));
}

// GET: Check if credential already issued for connection
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');
    const credentialType = searchParams.get('credentialType') || 'john-doe-identity';
    
    if (!connectionId) {
      return NextResponse.json(
        { success: false, error: 'Connection ID is required' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    const issuedCredentials = await getIssuedCredentials();
    const existingCredential = issuedCredentials.find(
      cred => cred.connectionId === connectionId && cred.credentialType === credentialType
    );
    
    console.log(`🔍 Checking credential issuance for connection ${connectionId}:`, 
      existingCredential ? 'Already issued' : 'Not issued yet');
    
    return NextResponse.json({
      success: true,
      alreadyIssued: !!existingCredential,
      issuedAt: existingCredential?.issuedAt,
      exchangeId: existingCredential?.exchangeId
    }, { headers: corsHeaders });
    
  } catch (error) {
    console.error('❌ Error checking credential issuance:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check credential issuance' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST: Record credential issuance for connection
export async function POST(request: NextRequest) {
  try {
    const { connectionId, credentialType = 'john-doe-identity', exchangeId } = await request.json();
    
    if (!connectionId) {
      return NextResponse.json(
        { success: false, error: 'Connection ID is required' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    const issuedCredentials = await getIssuedCredentials();
    
    // Check if already recorded
    const existingCredential = issuedCredentials.find(
      cred => cred.connectionId === connectionId && cred.credentialType === credentialType
    );
    
    if (existingCredential) {
      console.log(`⚠️ Credential already recorded for connection ${connectionId}`);
      return NextResponse.json({
        success: true,
        alreadyRecorded: true,
        message: 'Credential issuance already recorded',
        issuedAt: existingCredential.issuedAt
      }, { headers: corsHeaders });
    }
    
    // Record new credential issuance
    const newCredential: IssuedCredential = {
      connectionId,
      credentialType,
      issuedAt: new Date().toISOString(),
      exchangeId
    };
    
    issuedCredentials.push(newCredential);
    await saveIssuedCredentials(issuedCredentials);
    
    console.log(`✅ Recorded credential issuance for connection ${connectionId}`);
    
    return NextResponse.json({
      success: true,
      alreadyRecorded: false,
      message: 'Credential issuance recorded successfully',
      issuedAt: newCredential.issuedAt
    }, { headers: corsHeaders });
    
  } catch (error) {
    console.error('❌ Error recording credential issuance:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to record credential issuance' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// DELETE: Clear all credential issuance records (for testing)
export async function DELETE() {
  try {
    await saveIssuedCredentials([]);
    console.log('🗑️ Cleared all credential issuance records');
    
    return NextResponse.json({
      success: true,
      message: 'All credential issuance records cleared'
    }, { headers: corsHeaders });
    
  } catch (error) {
    console.error('❌ Error clearing credential records:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to clear credential records' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// OPTIONS: Handle CORS preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}