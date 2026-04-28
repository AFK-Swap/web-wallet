import { NextRequest, NextResponse } from 'next/server';

// Direct Alice storage integration - no CouchDB needed
const ALICE_AGENT_URL = 'http://localhost:8031';

// Export credentials directly from Alice storage
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const credentialId = url.searchParams.get('credentialId');
    
    console.log(`📤 Getting credentials directly from Alice storage`);
    
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
    
    if (aliceCredentials.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No credentials found in Alice storage' },
        { status: 404 }
      );
    }
    
    // Find the specific credential or return all credentials
    let credentialsToExport = aliceCredentials;
    
    if (credentialId) {
      const specificCredential = aliceCredentials.find(cred => 
        cred.referent === credentialId
      );
      
      if (!specificCredential) {
        return NextResponse.json(
          { success: false, error: 'Credential not found' },
          { status: 404 }
        );
      }
      
      credentialsToExport = [specificCredential];
    }
    
    // Format Alice credentials for web wallet display
    const exportedCredentials = [];
    
    for (const aliceCred of credentialsToExport) {
      console.log(`✅ Processing Alice credential: ${aliceCred.referent}`);
      
      // Format Alice credential for web wallet compatibility
      const exportFormat = {
        credential_id: `alice_${aliceCred.referent}`,
        referent: aliceCred.referent,
        schema_id: aliceCred.schema_id,
        cred_def_id: aliceCred.cred_def_id,
        rev_reg_id: aliceCred.rev_reg_id,
        
        // Credential attributes
        attributes: Object.entries(aliceCred.attrs || {}).map(([name, value]) => ({
          name,
          value
        })),
        
        // Metadata
        metadata: {
          source: 'alice_storage',
          schema_id: aliceCred.schema_id,
          cred_def_id: aliceCred.cred_def_id,
          referent: aliceCred.referent,
          exported_at: new Date().toISOString()
        }
      };
      
      exportedCredentials.push(exportFormat);
    }
    
    if (exportedCredentials.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No credentials found in Alice storage',
          message: 'Alice agent has no stored credentials'
        },
        { status: 404 }
      );
    }
    
    console.log(`📤 Retrieved ${exportedCredentials.length} credential(s) from Alice storage`);
    
    return NextResponse.json({
      success: true,
      credentials: exportedCredentials,
      count: exportedCredentials.length,
      message: `Retrieved ${exportedCredentials.length} credential(s) from Alice storage`,
      source: 'alice_agent'
    });
    
  } catch (error) {
    console.error('❌ Export error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    );
  }
}

// POST endpoint to trigger credential export and import into target ACA-Py agent
export async function POST(request: NextRequest) {
  try {
    const { username, password, credentialId, targetAgent, targetAgentUrl } = await request.json();
    
    if (!username || !password || !targetAgentUrl) {
      return NextResponse.json(
        { success: false, error: 'Username, password, and target agent URL required' },
        { status: 400 }
      );
    }
    
    console.log(`🚀 Starting credential export and import to ${targetAgent || 'target agent'}`);
    
    // First, export the credential
    const exportUrl = new URL('/api/credentials/export', 'http://localhost:3001');
    exportUrl.searchParams.set('username', username);
    exportUrl.searchParams.set('password', password);
    if (credentialId) {
      exportUrl.searchParams.set('credentialId', credentialId);
    }
    
    const exportResponse = await fetch(exportUrl.toString());
    const exportResult = await exportResponse.json();
    
    if (!exportResult.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to export credential', details: exportResult.error },
        { status: 400 }
      );
    }
    
    const credentialsToImport = exportResult.credentials;
    const importResults = [];
    
    // Import each credential into the target ACA-Py agent
    for (const credential of credentialsToImport) {
      try {
        console.log(`📥 Importing credential ${credential.credential_id} to ${targetAgentUrl}`);
        
        // Import the credential using ACA-Py's credential storage API
        const importResponse = await fetch(`${targetAgentUrl}/credential/store`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            credential_id: `imported_${credential.credential_id}`,
            credential: credential.credential,
            metadata: credential.metadata
          })
        });
        
        if (importResponse.ok) {
          const importResult = await importResponse.json();
          importResults.push({
            credential_id: credential.credential_id,
            status: 'success',
            imported_id: importResult.credential_id || `imported_${credential.credential_id}`,
            message: 'Credential imported successfully'
          });
          console.log(`✅ Successfully imported credential ${credential.credential_id}`);
        } else {
          // Try alternative import method using wallet records
          const recordResponse = await fetch(`${targetAgentUrl}/wallet/records`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'anoncreds_credential',
              id: `imported_${credential.credential_id}`,
              value: JSON.stringify(credential.credential),
              tags: {
                schema_id: credential.credential.schema_id,
                cred_def_id: credential.credential.cred_def_id,
                source: 'web_wallet_import'
              }
            })
          });
          
          if (recordResponse.ok) {
            importResults.push({
              credential_id: credential.credential_id,
              status: 'success',
              imported_id: `imported_${credential.credential_id}`,
              message: 'Credential imported as wallet record'
            });
            console.log(`✅ Successfully imported credential ${credential.credential_id} as wallet record`);
          } else {
            const errorText = await recordResponse.text();
            importResults.push({
              credential_id: credential.credential_id,
              status: 'failed',
              error: `Import failed: ${errorText}`,
              message: 'Could not import credential'
            });
            console.error(`❌ Failed to import credential ${credential.credential_id}: ${errorText}`);
          }
        }
        
      } catch (importError) {
        importResults.push({
          credential_id: credential.credential_id,
          status: 'failed',
          error: importError instanceof Error ? importError.message : 'Unknown import error',
          message: 'Import process failed'
        });
        console.error(`❌ Import error for credential ${credential.credential_id}:`, importError);
      }
    }
    
    const successfulImports = importResults.filter(r => r.status === 'success').length;
    
    return NextResponse.json({
      success: successfulImports > 0,
      message: `${successfulImports}/${importResults.length} credentials imported successfully`,
      results: importResults,
      targetAgent: targetAgent || targetAgentUrl
    });
    
  } catch (error) {
    console.error('❌ Export and import error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Export and import failed' },
      { status: 500 }
    );
  }
}