import { NextRequest, NextResponse } from 'next/server';

// Shared global storage for notifications
declare global {
  var notificationStore: any[] | undefined;
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function GET() {
  try {
    // Force clear on startup - only poll API should populate notifications
    if (typeof globalThis !== 'undefined') {
      if (!globalThis.notificationStore) {
        globalThis.notificationStore = [];
      }
    }

    // Return only in-memory notifications (wallet should be autonomous)
    // ACA-Py should only send credentials via DIDComm, wallet manages its own notifications
    console.log(`📝 Total notifications in store: ${globalThis.notificationStore?.length || 0}`);

    const notifications = globalThis.notificationStore?.filter((notification: any) => {
      // Only show pending notifications
      return notification.status === 'pending';
    }) || [];

    console.log(`📝 Pending notifications: ${notifications.length}`);
    console.log(`📝 Notification IDs: ${notifications.map((n: any) => n.id).join(', ')}`);
    
    return NextResponse.json({
      success: true,
      notifications: notifications
    }, { headers: corsHeaders });
    
  } catch (error) {
    console.error('Error fetching notifications from wallet store:', error);
    return NextResponse.json({
      success: true,
      notifications: []
    }, { headers: corsHeaders });
  }
}

// PRIVACY PROTECTION: No more plaintext credential storage
// Credentials are only stored encrypted in CouchDB via the main credential flow
async function syncCredentialsToWalletStorage(completedCredentials: any[]) {
  // This function is now a no-op to maintain privacy
  // Credentials must go through proper encrypted storage via the wallet UI
  console.log('⚠️ Credential sync disabled for privacy protection - credentials must be stored via encrypted wallet UI');
  return;
}

export async function DELETE() {
  try {
    // Clear all notifications to ensure only current issuer data is shown
    if (typeof globalThis !== 'undefined') {
      globalThis.notificationStore = [];
    }
    
    console.log('🗑️ All notifications cleared - only current issuer data will be shown');
    
    return NextResponse.json({
      success: true,
      message: 'All notifications cleared'
    }, { headers: corsHeaders });
    
  } catch (error) {
    console.error('Error clearing notifications:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to clear notifications' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const notification = await request.json();
    
    // Initialize global store if it doesn't exist (in-memory only)
    if (typeof globalThis !== 'undefined' && !globalThis.notificationStore) {
      globalThis.notificationStore = [];
    }
    
    // Prepare notification with consistent ID and timestamp
    const notificationId = notification.id || `notification-${Date.now()}`;
    const storedNotification = {
      id: notificationId,
      ...notification,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };
    
    // Duplicate prevention: Check if notification with same ID already exists
    if (typeof globalThis !== 'undefined' && globalThis.notificationStore) {
      const existingNotification = globalThis.notificationStore.find(
        (existing: any) => existing.id === notificationId
      );
      
      if (existingNotification) {
        console.log(`⚠️ Duplicate notification prevented: ${notificationId}`);
        return NextResponse.json({
          success: true,
          notification: existingNotification,
          isDuplicate: true
        }, { headers: corsHeaders });
      }
      
      // Also check for content-based duplicates (same exchange ID and credential data)
      if (notification.exchangeId) {
        const contentDuplicate = globalThis.notificationStore.find(
          (existing: any) => 
            existing.exchangeId === notification.exchangeId &&
            existing.status === 'pending' &&
            existing.type === notification.type
        );
        
        if (contentDuplicate) {
          console.log(`⚠️ Content duplicate prevented for exchange: ${notification.exchangeId}`);
          return NextResponse.json({
            success: true,
            notification: contentDuplicate,
            isDuplicate: true
          }, { headers: corsHeaders });
        }
      }
      
      // Check for attribute-based duplicates (same credential content, different exchange IDs)
      if (notification.credentialData?.credentialPreview?.attributes && notification.connectionId) {
        const attributes = notification.credentialData.credentialPreview.attributes;
        
        // Create content fingerprint from raw attribute names (ignore encrypted values)
        const attributeNames = attributes.map((attr: any) => attr.name).sort().join('|');
        const rawValues = attributes.map((attr: any) => {
          // Special handling for issuer_did - always use actual value
          if (attr.name === 'issuer_did') {
            return `${attr.name}:${attr.value}`;
          }
          
          // For other attributes, normalize encrypted vs unencrypted to be equivalent
          try {
            if (attr.value && typeof attr.value === 'string' && attr.value.length > 30) {
              const decoded = Buffer.from(attr.value, 'base64').toString('utf-8');
              if (decoded.includes('encrypted_data') && decoded.includes('iv')) {
                return `${attr.name}:ENCRYPTED`;
              }
            }
          } catch (e) {
            // Not base64 or not encrypted format
          }
          // For non-encrypted values, normalize to encrypted equivalent for comparison
          return `${attr.name}:ENCRYPTED`;
        }).sort().join('|');
        
        const contentFingerprint = `${notification.connectionId}:${attributeNames}:${rawValues}`;
        
        const attributeDuplicate = globalThis.notificationStore.find(
          (existing: any) => {
            if (!existing.credentialData?.credentialPreview?.attributes || 
                existing.connectionId !== notification.connectionId ||
                existing.status !== 'pending' ||
                existing.type !== notification.type) {
              return false;
            }
            
            const existingAttributes = existing.credentialData.credentialPreview.attributes;
            const existingNames = existingAttributes.map((attr: any) => attr.name).sort().join('|');
            const existingRawValues = existingAttributes.map((attr: any) => {
              // Special handling for issuer_did - always use actual value
              if (attr.name === 'issuer_did') {
                return `${attr.name}:${attr.value}`;
              }
              
              // For other attributes, normalize encrypted vs unencrypted to be equivalent
              try {
                if (attr.value && typeof attr.value === 'string' && attr.value.length > 30) {
                  const decoded = Buffer.from(attr.value, 'base64').toString('utf-8');
                  if (decoded.includes('encrypted_data') && decoded.includes('iv')) {
                    return `${attr.name}:ENCRYPTED`;
                  }
                }
              } catch (e) {
                // Not base64 or not encrypted format
              }
              // For non-encrypted values, normalize to encrypted equivalent for comparison
              return `${attr.name}:ENCRYPTED`;
            }).sort().join('|');
            
            const existingFingerprint = `${existing.connectionId}:${existingNames}:${existingRawValues}`;
            
            return existingFingerprint === contentFingerprint;
          }
        );
        
        if (attributeDuplicate) {
          console.log(`⚠️ Attribute duplicate prevented - same content, different exchange IDs: ${notification.exchangeId} vs ${attributeDuplicate.exchangeId}`);
          return NextResponse.json({
            success: true,
            notification: attributeDuplicate,
            isDuplicate: true
          }, { headers: corsHeaders });
        }
      }
      
      // No duplicates found, add new notification
      globalThis.notificationStore.push(storedNotification);
    }
    
    console.log(`✅ New notification stored: ${storedNotification.id}`);
    
    return NextResponse.json({
      success: true,
      notification: storedNotification,
      isDuplicate: false
    }, { headers: corsHeaders });
    
  } catch (error) {
    console.error('Error storing notification:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to store notification' },
      { status: 500, headers: corsHeaders }
    );
  }
}