import { NextRequest, NextResponse } from 'next/server';

// Alice ACA-Py agent URL for credential checking
const ALICE_AGENT_URL = 'http://localhost:8031';

declare global {
  var notificationStore: any[] | undefined;
  var unifiedCredentialStore: any[] | undefined;
  // Legacy stores for backward compatibility
  var credentialStore: any[] | undefined;
  var anonCredsStore: any[] | undefined;
}

// Helper function to ensure unified store is initialized and migrated
async function initializeUnifiedStore() {
  if (!globalThis.unifiedCredentialStore) {
    globalThis.unifiedCredentialStore = [];
  }
  
  // Migrate from legacy stores if they exist
  if (globalThis.credentialStore?.length > 0 || globalThis.anonCredsStore?.length > 0) {
    console.log('Migrating credentials to unified store for check...');
    
    // Migrate from credentialStore
    if (globalThis.credentialStore?.length > 0) {
      for (const cred of globalThis.credentialStore) {
        const existing = globalThis.unifiedCredentialStore.find(c => c.id === cred.id);
        if (!existing) {
          const normalized = {
            id: cred.id,
            originalFormat: 'legacy-simple',
            timestamp: cred.timestamp || new Date().toISOString(),
            status: cred.status || 'stored',
            credentialData: cred.credential,
            attributes: Object.keys(cred.credential || {}).map(key => ({
              name: key,
              value: cred.credential[key]
            })),
            ...cred
          };
          globalThis.unifiedCredentialStore.push(normalized);
        }
      }
      globalThis.credentialStore = [];
    }
    
    // Migrate from anonCredsStore
    if (globalThis.anonCredsStore?.length > 0) {
      for (const cred of globalThis.anonCredsStore) {
        const existing = globalThis.unifiedCredentialStore.find(c => c.id === cred.id);
        if (!existing) {
          const normalized = {
            ...cred,
            originalFormat: 'anoncreds',
            attributes: cred.credentialPreview?.attributes || []
          };
          globalThis.unifiedCredentialStore.push(normalized);
        }
      }
      globalThis.anonCredsStore = [];
    }
  }
}

function findMatchingCredentials(requestedAttributes: any) {
  if (!globalThis.unifiedCredentialStore) return [];
  
  const requiredAttributeNames = Object.values(requestedAttributes)
    .map((attr: any) => attr.name.toLowerCase());
  
  const matchingCredentials = [];
  
  for (const credential of globalThis.unifiedCredentialStore) {
    // Get credential attributes from normalized structure
    let credentialAttributes = [];
    
    if (credential.attributes && Array.isArray(credential.attributes)) {
      credentialAttributes = credential.attributes.map((attr: any) => attr.name?.toLowerCase()).filter(Boolean);
    } else if (credential.credentialPreview?.attributes) {
      credentialAttributes = credential.credentialPreview.attributes.map((attr: any) => attr.name?.toLowerCase()).filter(Boolean);
    } else if (credential.credentialData && typeof credential.credentialData === 'object') {
      credentialAttributes = Object.keys(credential.credentialData).map(key => key.toLowerCase());
    }
    
    const hasAllAttributes = requiredAttributeNames.every(required =>
      credentialAttributes.includes(required)
    );
    
    if (hasAllAttributes) {
      matchingCredentials.push(credential);
    }
  }
  
  return matchingCredentials;
}

// Get credentials from Alice ACA-Py agent
async function getAliceCredentials() {
  try {
    const response = await fetch(`${ALICE_AGENT_URL}/credentials`);
    if (!response.ok) {
      console.error('Failed to fetch credentials from Alice agent');
      return [];
    }
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Error fetching credentials from Alice agent:', error);
    return [];
  }
}

async function checkCredentialAvailability(requestedAttributes: any) {
  const requiredAttributeNames = Object.values(requestedAttributes)
    .map((attr: any) => attr.name.toLowerCase());
  
  // Get credentials from Alice ACA-Py agent (primary source)
  const aliceCredentials = await getAliceCredentials();
  
  // Get all available attributes from Alice credentials
  const allAvailableAttributes = new Set();
  const allCredentials = [];
  
  // Process Alice credentials
  aliceCredentials.forEach(credential => {
    if (credential.attrs && typeof credential.attrs === 'object') {
      Object.keys(credential.attrs).forEach(key => {
        allAvailableAttributes.add(key.toLowerCase());
      });
      
      // Format credential for matching
      allCredentials.push({
        id: credential.referent,
        referent: credential.referent,
        attributes: Object.keys(credential.attrs).map(key => ({
          name: key,
          value: credential.attrs[key]
        })),
        credentialData: credential.attrs,
        source: 'alice_storage',
        schema_id: credential.schema_id,
        cred_def_id: credential.cred_def_id
      });
    }
  });
  
  // Also check unified store for any additional credentials
  if (globalThis.unifiedCredentialStore) {
    globalThis.unifiedCredentialStore.forEach(credential => {
      if (credential.attributes && Array.isArray(credential.attributes)) {
        credential.attributes.forEach((attr: any) => {
          if (attr.name) allAvailableAttributes.add(attr.name.toLowerCase());
        });
        allCredentials.push(credential);
      } else if (credential.credentialPreview?.attributes) {
        credential.credentialPreview.attributes.forEach((attr: any) => {
          if (attr.name) allAvailableAttributes.add(attr.name.toLowerCase());
        });
        allCredentials.push(credential);
      } else if (credential.credentialData && typeof credential.credentialData === 'object') {
        Object.keys(credential.credentialData).forEach(key => {
          allAvailableAttributes.add(key.toLowerCase());
        });
        allCredentials.push(credential);
      }
    });
  }
  
  const missingAttributes = requiredAttributeNames.filter(required => 
    !allAvailableAttributes.has(required)
  );
  
  // Find matching credentials
  const matchingCredentials = [];
  if (missingAttributes.length === 0) {
    for (const credential of allCredentials) {
      const credentialAttributes = [];
      
      if (credential.attributes && Array.isArray(credential.attributes)) {
        credentialAttributes.push(...credential.attributes.map((attr: any) => attr.name?.toLowerCase()).filter(Boolean));
      } else if (credential.credentialData && typeof credential.credentialData === 'object') {
        credentialAttributes.push(...Object.keys(credential.credentialData).map(key => key.toLowerCase()));
      }
      
      const hasAllAttributes = requiredAttributeNames.every(required =>
        credentialAttributes.includes(required)
      );
      
      if (hasAllAttributes) {
        matchingCredentials.push(credential);
      }
    }
  }
  
  return {
    hasMatch: missingAttributes.length === 0,
    missingAttributes: missingAttributes,
    availableAttributes: Array.from(allAvailableAttributes),
    matchingCredentials: matchingCredentials
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const notificationId = params.id;
    
    // Initialize unified store and migrate legacy credentials
    await initializeUnifiedStore();
    
    if (!globalThis.notificationStore) {
      return NextResponse.json(
        { success: false, error: 'No notifications found' },
        { status: 404 }
      );
    }
    
    // Find the notification
    const notification = globalThis.notificationStore.find(
      (n: any) => n.id === notificationId
    );
    
    if (!notification || notification.type !== 'proof-request') {
      return NextResponse.json(
        { success: false, error: 'Proof request notification not found' },
        { status: 404 }
      );
    }
    
    const proofRequestData = notification.proofRequestData;
    
    // Check if we have the right structure for proof request data
    const requestedAttributes = proofRequestData.proofRequest?.requested_attributes || proofRequestData.requested_attributes;
    
    if (!requestedAttributes) {
      return NextResponse.json(
        { success: false, error: 'Invalid proof request structure' },
        { status: 400 }
      );
    }
    
    const availability = await checkCredentialAvailability(requestedAttributes);
    
    return NextResponse.json({
      success: true,
      ...availability,
      requestedAttributes: Object.values(requestedAttributes).map((attr: any) => attr.name)
    });
    
  } catch (error) {
    console.error('Error checking credential availability:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check availability' },
      { status: 500 }
    );
  }
}