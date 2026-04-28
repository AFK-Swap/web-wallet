import { NextRequest, NextResponse } from 'next/server';
import { storeCredential, getUserCredentials } from '@/lib/couchdb-auth';
import { encryptCredential, deriveEncryptionKey, decryptCredential } from '@/lib/encryption';
import { walletAgentEndpoints } from '@/lib/wallet-config';

declare global {
  var notificationStore: any[] | undefined;
  var notificationSessions: any[] | undefined;  // Track user sessions for notifications
}

// Helper function to get user session data from notification
async function getUserSessionFromNotification(notificationId: string) {
  // Initialize session store if it doesn't exist
  if (!globalThis.notificationSessions) {
    globalThis.notificationSessions = [];
  }
  
  const session = globalThis.notificationSessions.find((s: any) => s.notificationId === notificationId);
  return session || null;
}

// Helper function to store user session for notification
async function storeNotificationUserSession(notificationId: string, username: string, password: string) {
  // Initialize session store if it doesn't exist
  if (!globalThis.notificationSessions) {
    globalThis.notificationSessions = [];
  }
  
  // Remove any existing session for this notification
  globalThis.notificationSessions = globalThis.notificationSessions.filter((s: any) => s.notificationId !== notificationId);
  
  // Add new session
  globalThis.notificationSessions.push({
    notificationId,
    username,
    password,
    createdAt: new Date().toISOString()
  });
  
  console.log(`Stored user session for notification ${notificationId} for user ${username}`);
}

// Helper function to store encrypted credential in CouchDB
async function storeEncryptedCredential(username: string, password: string, credentialData: any) {
  try {
    // Derive encryption key from user password and username
    const encryptionKey = await deriveEncryptionKey(password, username);
    
    // Encrypt the credential data
    const encryptedData = await encryptCredential(credentialData, encryptionKey);
    
    // Create the credential document for CouchDB
    const credentialDoc = {
      type: 'credential',
      encryptedCredential: encryptedData,
      receivedAt: new Date().toISOString(),
      metadata: {
        status: 'stored',
        source: 'didcomm',
        exchangeId: credentialData.exchangeId
      }
    };
    
    // Store in CouchDB using the auth system
    await storeCredential(username, password, credentialDoc);
    console.log('Credential encrypted and stored in CouchDB for user:', username);
    
  } catch (error) {
    console.error('Error storing encrypted credential:', error);
    throw error;
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { action, credentialId, userSession } = await request.json();
    const notificationId = params.id;

    console.log(`\n🔧 PATCH /api/notifications/${notificationId}`);
    console.log(`📋 Action: ${action}`);
    console.log(`Processing ${action} for notification/credential: ${notificationId}`);
    
    // Store user session for credential storage if provided
    if (userSession && userSession.username && userSession.password) {
      await storeNotificationUserSession(notificationId, userSession.username, userSession.password);
    }
    
    // Initialize stores if they don't exist
    if (typeof globalThis !== 'undefined' && !globalThis.notificationStore) {
      globalThis.notificationStore = [];
    }
    
    // Find notification in wallet's internal store (autonomous operation)
    const notificationIndex = globalThis.notificationStore?.findIndex(
      (n: any) => n.id === notificationId
    ) ?? -1;
    
    let notification = null;
    
    if (notificationIndex !== -1) {
      // Found in local notification store
      notification = globalThis.notificationStore![notificationIndex];
      console.log('Found notification in wallet store');
    } else {
      return NextResponse.json(
        { success: false, error: 'Notification not found in wallet' },
        { status: 404 }
      );
    }
    
    if (action === 'accept') {
      if (notification.type === 'credential-offer') {
        console.log('Accepting credential offer (autonomous wallet mode)');
        
        try {
          // Get user session for CouchDB storage (primary storage)
          const userSession = await getUserSessionFromNotification(notificationId);
          console.log('🔍 User session from notification:', userSession ? 'Found' : 'Not found');
          
          if (userSession && userSession.username && userSession.password) {
            console.log(`💾 Storing accepted credential in CouchDB for user: ${userSession.username}`);
            
            // Create credential document for CouchDB
            const credentialForCouchDB = {
              credentialPreview: {
                attributes: notification.credentialData?.credentialPreview?.attributes || []
              },
              metadata: {
                title: 'Digital Credential',
                issuer: 'DIDComm Issuer', 
                source: 'didcomm'
              },
              issuedAt: new Date().toISOString(),
              credentialDefinitionId: notification.credentialData?.credentialDefinitionId || '',
              exchangeId: notification.exchangeId || notification.id,
              connectionId: notification.credentialData?.connectionId
            };
            
            console.log('🔍 Credential document to store:', JSON.stringify(credentialForCouchDB, null, 2));
            
            try {
              await storeEncryptedCredential(userSession.username, userSession.password, credentialForCouchDB);
              console.log('✅ Credential stored in CouchDB (primary storage)');
            } catch (storageError) {
              console.error('❌ Failed to store in CouchDB:', storageError);
              throw storageError;
            }
            
          } else {
            console.log('⚠️ No user session - credential cannot be stored');
            throw new Error('User session required for credential storage');
          }
          
        } catch (error) {
          console.error('Error storing credential offer:', error);
          throw error;
        }
      } else if (notification.type === 'proof-request') {
        console.log('📤 User approved proof request - sending presentation to verifier');
        
        try {
          // Call ACA-Py to send the proof presentation
          const acaPyResponse = await fetch(walletAgentEndpoints.sendPresentation(notification.exchangeId), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              indy: {
                requested_attributes: {},  // ACA-Py will auto-fill from available credentials
                requested_predicates: {},
                self_attested_attributes: {}
              }
            })
          });
          
          if (acaPyResponse.ok) {
            const result = await acaPyResponse.json();
            console.log('✅ Proof presentation sent successfully:', result.state);
          } else {
            const error = await acaPyResponse.text();
            console.error('❌ Failed to send proof presentation:', error);
            throw new Error(`Failed to send proof presentation: ${error}`);
          }
          
        } catch (error) {
          console.error('Error sending proof presentation:', error);
          throw error;
        }
      }
      
      // Update notification status
      notification.status = 'accepted';
      notification.acceptedAt = new Date().toISOString();
      
    } else if (action === 'decline') {
      console.log(`🚫 Declining notification type: ${notification.type}`);
      console.log(`🚫 Exchange ID: ${notification.exchangeId}`);

      // Update notification status
      notification.status = 'declined';
      notification.declinedAt = new Date().toISOString();

      // If this is a proof request, delete it from Alice's ACA-Py to prevent it from being recreated
      if (notification.type === 'proof-request') {
        console.log(`✓ Notification is a proof-request`);
        if (notification.exchangeId) {
          console.log(`✓ Exchange ID exists: ${notification.exchangeId}`);
          try {
            const deleteUrl = `http://127.0.0.1:8031/present-proof-2.0/records/${notification.exchangeId}`;
            console.log(`🗑️ Deleting declined proof request from Alice: ${deleteUrl}`);

            const deleteResponse = await fetch(deleteUrl, {
              method: 'DELETE'
            });

            console.log(`📡 Delete response status: ${deleteResponse.status}`);

            if (deleteResponse.ok) {
              console.log(`✅ Successfully deleted proof request ${notification.exchangeId} from Alice`);
            } else {
              const errorBody = await deleteResponse.text();
              console.warn(`⚠️ Failed to delete proof request from Alice: ${deleteResponse.status} - ${errorBody}`);
            }
          } catch (error) {
            console.error('❌ Error deleting proof request from Alice:', error);
          }
        } else {
          console.warn(`⚠️ No exchangeId found on notification, cannot delete from Alice`);
        }
      } else {
        console.log(`ℹ️ Not a proof-request, skipping Alice deletion`);
      }
    }
    
    // Auto-remove processed notifications after short delay
    setTimeout(() => {
      if (globalThis.notificationStore) {
        const index = globalThis.notificationStore.findIndex(n => n.id === notificationId);
        if (index !== -1) {
          globalThis.notificationStore.splice(index, 1);
          console.log(`Auto-removed processed notification: ${notificationId}`);
        }
      }
    }, 2000); // 2 second delay to allow frontend to show status change
    
    return NextResponse.json({
      success: true,
      notification: notification,
      action: action,
      autoRemove: true // Signal to frontend that notification will be auto-removed
    });
    
  } catch (error) {
    console.error('Error processing notification action:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process action' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const notificationId = params.id;
    
    if (typeof globalThis !== 'undefined' && !globalThis.notificationStore) {
      globalThis.notificationStore = [];
    }
    
    // Remove notification from store
    const initialLength = globalThis.notificationStore?.length ?? 0;
    globalThis.notificationStore = globalThis.notificationStore?.filter(
      (n: any) => n.id !== notificationId
    ) ?? [];
    
    const removed = initialLength > (globalThis.notificationStore?.length ?? 0);
    
    return NextResponse.json({
      success: removed,
      message: removed ? 'Notification deleted' : 'Notification not found'
    });
    
  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete notification' },
      { status: 500 }
    );
  }
}