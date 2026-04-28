import { NextRequest, NextResponse } from 'next/server';

// Test endpoint to create a credential with real ledger verification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { schemaId, credentialDefinitionId, attributes } = body;

    // Initialize store if needed
    if (!globalThis.anonCredsStore) {
      globalThis.anonCredsStore = [];
    }

    const logs: string[] = [];
    
    // Step 1: Test BCovrin ledger connectivity
    logs.push('🔗 Testing BCovrin ledger connection...');
    
    try {
      const genesisResponse = await fetch('http://dev.greenlight.bcovrin.vonx.io/genesis', {
        method: 'GET',
        timeout: 5000
      } as any);
      
      if (genesisResponse.ok) {
        logs.push('✅ BCovrin ledger is accessible');
        const genesisData = await genesisResponse.text();
        logs.push(`📋 Genesis data size: ${genesisData.length} chars`);
      } else {
        logs.push(`⚠️ BCovrin ledger returned status: ${genesisResponse.status}`);
      }
    } catch (error) {
      logs.push(`❌ BCovrin ledger connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Step 2: Try to fetch schema from ledger
    logs.push(`🔍 Attempting to fetch schema: ${schemaId}`);
    
    try {
      // Try the BCovrin ledger browser API
      const schemaResponse = await fetch(`http://dev.greenlight.bcovrin.vonx.io/browse/domain/${encodeURIComponent(schemaId)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'VR-Web-Wallet/1.0'
        },
        timeout: 10000
      } as any);

      if (schemaResponse.ok) {
        const schemaData = await schemaResponse.json();
        logs.push('✅ Schema found on BCovrin ledger');
        logs.push(`📋 Schema data: ${JSON.stringify(schemaData, null, 2)}`);
      } else {
        logs.push(`⚠️ Schema not found on ledger (${schemaResponse.status})`);
        
        // Try alternative endpoint
        const altResponse = await fetch(`http://dev.greenlight.bcovrin.vonx.io/ledger/schema/${encodeURIComponent(schemaId)}`, {
          timeout: 5000
        } as any);
        
        if (altResponse.ok) {
          const altData = await altResponse.json();
          logs.push('✅ Schema found via alternative endpoint');
          logs.push(`📋 Alt schema data: ${JSON.stringify(altData, null, 2)}`);
        } else {
          logs.push(`❌ Schema not found via alternative endpoint (${altResponse.status})`);
        }
      }
    } catch (error) {
      logs.push(`❌ Schema fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Step 3: Try to fetch credential definition
    logs.push(`🔍 Attempting to fetch credential definition: ${credentialDefinitionId}`);
    
    try {
      const credDefResponse = await fetch(`http://dev.greenlight.bcovrin.vonx.io/browse/domain/${encodeURIComponent(credentialDefinitionId)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'VR-Web-Wallet/1.0'
        },
        timeout: 10000
      } as any);

      if (credDefResponse.ok) {
        const credDefData = await credDefResponse.json();
        logs.push('✅ Credential definition found on BCovrin ledger');
        logs.push(`📋 CredDef data: ${JSON.stringify(credDefData, null, 2)}`);
      } else {
        logs.push(`⚠️ Credential definition not found on ledger (${credDefResponse.status})`);
      }
    } catch (error) {
      logs.push(`❌ Credential definition fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Step 4: Create credential with ledger verification attempt
    const credentialId = `test_cred_${Date.now()}`;
    
    const credential = {
      id: credentialId,
      state: 'offer-received',
      schemaId,
      credentialDefinitionId,
      credentialPreview: {
        attributes: attributes || [
          { name: 'name', value: 'Ledger Test User' },
          { name: 'university', value: 'BCovrin Test University' },
          { name: 'degree', value: 'Computer Science' },
          { name: 'graduation_year', value: '2024' }
        ]
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        ledgerTested: true,
        ledgerAccessible: logs.some(log => log.includes('✅ BCovrin ledger is accessible')),
        schemaFound: logs.some(log => log.includes('✅ Schema found')),
        credDefFound: logs.some(log => log.includes('✅ Credential definition found'))
      }
    };

    globalThis.anonCredsStore.push(credential);

    logs.push(`✅ Test credential created: ${credentialId}`);
    logs.push(`📊 Ledger verification results:`);
    logs.push(`   - Ledger accessible: ${credential.metadata.ledgerAccessible}`);
    logs.push(`   - Schema found: ${credential.metadata.schemaFound}`);
    logs.push(`   - CredDef found: ${credential.metadata.credDefFound}`);

    return NextResponse.json({
      success: true,
      message: 'Test credential created with ledger verification',
      credentialId,
      credential,
      ledgerVerification: {
        ledgerAccessible: credential.metadata.ledgerAccessible,
        schemaFound: credential.metadata.schemaFound,
        credDefFound: credential.metadata.credDefFound
      },
      logs
    });

  } catch (error) {
    console.error('Error creating test credential:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        logs: [`❌ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      },
      { status: 500 }
    );
  }
}

// Get current ledger status
export async function GET() {
  try {
    const status = {
      timestamp: new Date().toISOString(),
      bcovrinUrl: 'http://dev.greenlight.bcovrin.vonx.io',
      tests: {}
    };

    // Test genesis endpoint
    try {
      const genesisResponse = await fetch('http://dev.greenlight.bcovrin.vonx.io/genesis', {
        timeout: 5000
      } as any);
      
      status.tests = {
        ...status.tests,
        genesis: {
          accessible: genesisResponse.ok,
          status: genesisResponse.status,
          contentLength: genesisResponse.ok ? (await genesisResponse.text()).length : 0
        }
      };
    } catch (error) {
      status.tests = {
        ...status.tests,
        genesis: {
          accessible: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }

    // Test browse endpoint
    try {
      const browseResponse = await fetch('http://dev.greenlight.bcovrin.vonx.io/browse', {
        timeout: 5000
      } as any);
      
      status.tests = {
        ...status.tests,
        browse: {
          accessible: browseResponse.ok,
          status: browseResponse.status
        }
      };
    } catch (error) {
      status.tests = {
        ...status.tests,
        browse: {
          accessible: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }

    return NextResponse.json({
      success: true,
      status,
      recommendation: status.tests.genesis?.accessible ? 
        'BCovrin ledger is accessible - credentials will use real ledger validation' :
        'BCovrin ledger not accessible - credentials will use development mode'
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}