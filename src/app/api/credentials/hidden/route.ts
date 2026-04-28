import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Store hidden credentials in a simple JSON file
// In production, you'd use a proper database
const HIDDEN_CREDENTIALS_FILE = path.join(process.cwd(), 'data', 'hidden-credentials.json');

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = path.dirname(HIDDEN_CREDENTIALS_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Read hidden credentials from file
async function getHiddenCredentials(): Promise<Set<string>> {
  try {
    await ensureDataDir();
    const data = await fs.readFile(HIDDEN_CREDENTIALS_FILE, 'utf-8');
    const hiddenIds = JSON.parse(data);
    return new Set(hiddenIds);
  } catch (error) {
    // File doesn't exist or is corrupted, return empty set
    return new Set();
  }
}

// Save hidden credentials to file
async function saveHiddenCredentials(hiddenIds: Set<string>) {
  try {
    await ensureDataDir();
    await fs.writeFile(HIDDEN_CREDENTIALS_FILE, JSON.stringify([...hiddenIds]), 'utf-8');
  } catch (error) {
    console.error('Error saving hidden credentials:', error);
    throw error;
  }
}

// GET: Get list of hidden credential IDs
export async function GET() {
  try {
    const hiddenCredentials = await getHiddenCredentials();
    
    return NextResponse.json({
      success: true,
      hiddenCredentials: [...hiddenCredentials],
      count: hiddenCredentials.size
    });
  } catch (error) {
    console.error('Error getting hidden credentials:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get hidden credentials' },
      { status: 500 }
    );
  }
}

// POST: Hide a credential
export async function POST(request: NextRequest) {
  try {
    const { credentialId } = await request.json();
    
    if (!credentialId) {
      return NextResponse.json(
        { success: false, error: 'Credential ID is required' },
        { status: 400 }
      );
    }
    
    const hiddenCredentials = await getHiddenCredentials();
    hiddenCredentials.add(credentialId);
    await saveHiddenCredentials(hiddenCredentials);
    
    console.log(`🙈 Hidden credential: ${credentialId}`);
    
    return NextResponse.json({
      success: true,
      message: 'Credential hidden successfully',
      credentialId
    });
  } catch (error) {
    console.error('Error hiding credential:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to hide credential' },
      { status: 500 }
    );
  }
}

// DELETE: Unhide a credential
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const credentialId = searchParams.get('id');
    
    if (!credentialId) {
      return NextResponse.json(
        { success: false, error: 'Credential ID is required' },
        { status: 400 }
      );
    }
    
    const hiddenCredentials = await getHiddenCredentials();
    hiddenCredentials.delete(credentialId);
    await saveHiddenCredentials(hiddenCredentials);
    
    console.log(`👁️ Unhidden credential: ${credentialId}`);
    
    return NextResponse.json({
      success: true,
      message: 'Credential unhidden successfully',
      credentialId
    });
  } catch (error) {
    console.error('Error unhiding credential:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to unhide credential' },
      { status: 500 }
    );
  }
}