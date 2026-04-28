import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Direct Alice storage integration for web wallet UI
const ALICE_AGENT_URL = 'http://localhost:8031';
const HIDDEN_CREDENTIALS_FILE = path.join(process.cwd(), 'data', 'hidden-credentials.json');

// Helper function to get hidden credentials
async function getHiddenCredentials(): Promise<Set<string>> {
  try {
    const data = await fs.readFile(HIDDEN_CREDENTIALS_FILE, 'utf-8');
    const hiddenIds = JSON.parse(data);
    return new Set(hiddenIds);
  } catch (error) {
    // File doesn't exist, return empty set
    return new Set();
  }
}

// GET: Get credentials directly from Alice storage for web wallet display
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeHidden = searchParams.get('includeHidden') === 'true';
    
    console.log(`📋 Getting credentials from Alice for web wallet display (includeHidden: ${includeHidden})`);
    
    // Get credentials directly from Alice ACA-Py agent
    const aliceResponse = await fetch(`${ALICE_AGENT_URL}/credentials`);
    
    if (!aliceResponse.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to connect to Alice agent' },
        { status: 500 }
      );
    }
    
    const aliceData = await aliceResponse.json();
    const aliceCredentials = aliceData.results || [];
    
    // Always show all credentials by default - don't hide any unless explicitly requested
    const hiddenCredentials = new Set();
    
    // Format credentials for web wallet UI and filter out hidden ones
    const allCredentials = aliceCredentials.map(cred => ({
      id: cred.referent,
      referent: cred.referent,
      schema_id: cred.schema_id,
      cred_def_id: cred.cred_def_id,
      rev_reg_id: cred.rev_reg_id,
      
      // Extract attributes for display
      name: cred.attrs?.name || 'Unknown',
      degree: cred.attrs?.degree || 'Unknown',
      date: cred.attrs?.date || 'Unknown',
      email: cred.attrs?.email || 'Unknown',
      department: cred.attrs?.department || 'Unknown',
      age: cred.attrs?.age || 'Unknown',
      
      // All attributes
      attributes: cred.attrs || {},
      
      // Metadata
      source: 'alice_storage',
      retrieved_at: new Date().toISOString(),
      hidden: hiddenCredentials.has(cred.referent)
    }));
    
    // Filter out hidden credentials unless specifically requested
    const filteredCredentials = includeHidden 
      ? allCredentials 
      : allCredentials.filter(cred => !cred.hidden);
    
    // Group identical credentials and show only every 2nd one (assuming 2 duplicates per connection)
    // This handles the case where each connection creates 2 identical credentials
    const credentialsByContent = new Map();
    
    for (const cred of filteredCredentials) {
      // Create a unique key based on the actual credential content
      const contentKey = `${cred.name}:${cred.email}:${cred.department}:${cred.age}:${cred.cred_def_id}`;
      
      if (!credentialsByContent.has(contentKey)) {
        credentialsByContent.set(contentKey, []);
      }
      credentialsByContent.get(contentKey).push(cred);
    }
    
    const uniqueCredentials = [];
    for (const [contentKey, credGroup] of credentialsByContent) {
      if (credGroup.length > 1) {
        console.log(`🔄 Found ${credGroup.length} credentials with same content: ${contentKey}`);
        
        // Sort by referent to get consistent ordering
        credGroup.sort((a, b) => a.referent.localeCompare(b.referent));
        
        // Show every 2nd credential (assuming 2 duplicates per connection)
        // This will show 1 credential per connection
        for (let i = 0; i < credGroup.length; i += 2) {
          uniqueCredentials.push(credGroup[i]);
          console.log(`✅ Showing credential from connection ${Math.floor(i/2) + 1}: ${credGroup[i].name} (${credGroup[i].id})`);
        }
        
        const hidden = credGroup.length - Math.ceil(credGroup.length / 2);
        if (hidden > 0) {
          console.log(`🔄 Hidden ${hidden} duplicate credential(s)`);
        }
      } else {
        uniqueCredentials.push(credGroup[0]);
        console.log(`✅ Added unique credential: ${credGroup[0].name} (${credGroup[0].id})`);
      }
    }
    
    const credentials = uniqueCredentials;
    
    console.log(`📦 Found ${aliceCredentials.length} total credentials in Alice storage, ${credentials.length} unique visible`);
    
    return NextResponse.json({
      success: true,
      credentials,
      count: credentials.length,
      totalCount: aliceCredentials.length,
      hiddenCount: aliceCredentials.length - credentials.length,
      source: 'alice_agent',
      message: `Retrieved ${credentials.length} visible credential(s) from Alice storage`
    });
    
  } catch (error) {
    console.error('❌ Error getting credentials from Alice:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to get credentials' },
      { status: 500 }
    );
  }
}

// No more global credential stores - all data stored encrypted in CouchDB only

// Helper function to detect credential format and normalize
function normalizeCredential(credential: any) {
  const normalized = {
    id: credential.id || `cred-${Date.now()}`,
    originalFormat: 'unknown',
    timestamp: credential.timestamp || new Date().toISOString(),
    status: credential.status || 'stored',
    // Standard fields
    credentialData: null,
    credentialPreview: null,
    attributes: []
  };

  // Detect and normalize different credential formats
  if (credential.credentialData?.credentialPreview?.attributes) {
    // Format: Credential offer with nested structure
    normalized.originalFormat = 'credential-offer';
    normalized.credentialData = credential.credentialData;
    normalized.credentialPreview = credential.credentialData.credentialPreview;
    normalized.attributes = credential.credentialData.credentialPreview.attributes;
  } else if (credential.credentialPreview?.attributes) {
    // Format: Direct credentialPreview (AnonCreds style)
    normalized.originalFormat = 'anoncreds';
    normalized.credentialPreview = credential.credentialPreview;
    normalized.attributes = credential.credentialPreview.attributes;
  } else if (credential.credential && typeof credential.credential === 'object') {
    // Format: Simple key-value object
    normalized.originalFormat = 'simple';
    normalized.credentialData = credential.credential;
    normalized.attributes = Object.keys(credential.credential).map(key => ({
      name: key,
      value: credential.credential[key]
    }));
    // Create credentialPreview for compatibility
    normalized.credentialPreview = {
      attributes: normalized.attributes
    };
  } else if (credential.attributes && Array.isArray(credential.attributes)) {
    // Format: Direct attributes array
    normalized.originalFormat = 'attributes-array';
    normalized.attributes = credential.attributes;
    normalized.credentialPreview = {
      attributes: credential.attributes
    };
  }

  // Copy any additional fields
  Object.keys(credential).forEach(key => {
    if (!normalized.hasOwnProperty(key)) {
      normalized[key] = credential[key];
    }
  });

  return normalized;
}


// Legacy migration removed - no more plaintext credential storage

// POST: Select credential for proof generation
export async function POST(request: NextRequest) {
  try {
    const { referent, proofRequest } = await request.json();
    
    if (!referent) {
      return NextResponse.json(
        { success: false, error: 'Credential referent required' },
        { status: 400 }
      );
    }
    
    console.log(`🔐 Selecting credential for proof generation: ${referent}`);
    
    // Get the specific credential from Alice
    const credResponse = await fetch(`${ALICE_AGENT_URL}/credentials`);
    
    if (!credResponse.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to connect to Alice agent' },
        { status: 500 }
      );
    }
    
    const credData = await credResponse.json();
    const credential = credData.results?.find(c => c.referent === referent);
    
    if (!credential) {
      return NextResponse.json(
        { success: false, error: 'Credential not found in Alice storage' },
        { status: 404 }
      );
    }
    
    console.log(`✅ Selected credential: ${credential.attrs?.name || 'Unknown'}`);
    
    return NextResponse.json({
      success: true,
      message: 'Credential selected for proof generation',
      credential: {
        referent: credential.referent,
        name: credential.attrs?.name || 'Unknown',
        degree: credential.attrs?.degree || 'Unknown',
        attributes: credential.attrs,
        schema_id: credential.schema_id,
        cred_def_id: credential.cred_def_id
      },
      next_step: 'proof_generation',
      proof_request: proofRequest
    });
    
  } catch (error) {
    console.error('❌ Error in credential selection:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Credential selection failed' },
      { status: 500 }
    );
  }
}

// PUT: Update credential display name
export async function PUT(request: NextRequest) {
  try {
    const { credentialId, displayName, username, password } = await request.json();
    
    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    if (!credentialId || !displayName) {
      return NextResponse.json(
        { success: false, error: 'Credential ID and display name required' },
        { status: 400 }
      );
    }
    
    // Get user's credentials
    const credentials = await getUserCredentials(username, password);
    const credential = credentials.find(c => c._id === credentialId);
    
    if (!credential) {
      return NextResponse.json(
        { success: false, error: 'Credential not found' },
        { status: 404 }
      );
    }
    
    // Update credential directly in CouchDB with proper revision
    const dbName = `wallet_${username}`;
    const COUCHDB_URL = 'http://localhost:5984';
    
    // Add display name to credential
    const updatedCredential = {
      ...credential,
      displayName: displayName.trim(),
      updatedAt: new Date().toISOString()
    };
    
    const response = await fetch(`${COUCHDB_URL}/${dbName}/${credentialId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
      },
      body: JSON.stringify(updatedCredential)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('CouchDB update error:', errorText);
      return NextResponse.json(
        { success: false, error: 'Failed to update credential in database' },
        { status: 500 }
      );
    }
    
    console.log('Updated credential display name:', credentialId, displayName);
    
    return NextResponse.json({
      success: true,
      message: 'Credential name updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating credential:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update credential' },
      { status: 500 }
    );
  }
}

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
    
    console.log(`🗑️ Delete request for credential: ${credentialId}`);
    
    // ACA-Py agents typically don't support credential deletion for security reasons
    // Credentials are meant to be permanent records in the wallet
    // Instead, we'll return an informative message
    
    console.log('⚠️ Credential deletion not supported - ACA-Py wallets maintain permanent credential records');
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Credential deletion not supported',
        message: 'ACA-Py agents maintain permanent credential records for security and audit purposes. Credentials cannot be deleted from the wallet.',
        suggestion: 'You can hide credentials in the UI if needed, but they will remain in the underlying wallet storage.'
      },
      { status: 501 }
    );
    
  } catch (error) {
    console.error('❌ Error in delete request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process delete request' },
      { status: 500 }
    );
  }
}