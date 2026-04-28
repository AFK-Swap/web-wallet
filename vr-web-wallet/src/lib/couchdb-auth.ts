// CouchDB authentication and user management

const COUCHDB_URL = 'http://localhost:5984';
const ADMIN_CREDENTIALS = 'admin:admin_pass';

/**
 * Registers a new user in CouchDB
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {Promise<boolean>} - Success status
 */
export async function registerUser(username: string, password: string): Promise<boolean> {
  try {
    console.log(`[Auth] Registering user: ${username}`);
    
    // 1. Create user document
    const userDoc = {
      _id: `org.couchdb.user:${username}`,
      name: username,
      type: 'user',
      password: password,
      roles: ['wallet_user'],
      created_at: new Date().toISOString()
    };
    
    // 2. Add user to _users database
    const userResponse = await fetch(`${COUCHDB_URL}/_users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(ADMIN_CREDENTIALS)}`
      },
      body: JSON.stringify(userDoc)
    });
    
    if (!userResponse.ok) {
      const error = await userResponse.text();
      console.error(`[Auth] Failed to create user: ${error}`);
      return false;
    }
    
    console.log(`[Auth] User created successfully`);
    
    // 3. Create user's private database
    const dbName = `wallet_${username}`;
    const dbResponse = await fetch(`${COUCHDB_URL}/${dbName}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${btoa(ADMIN_CREDENTIALS)}`
      }
    });
    
    if (!dbResponse.ok) {
      const error = await dbResponse.text();
      console.error(`[Auth] Failed to create user database: ${error}`);
      return false;
    }
    
    console.log(`[Auth] User database created: ${dbName}`);
    
    // 4. Set database security (only user can access)
    const security = {
      admins: { names: [username], roles: [] },
      members: { names: [username], roles: [] }
    };
    
    const securityResponse = await fetch(`${COUCHDB_URL}/${dbName}/_security`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(ADMIN_CREDENTIALS)}`
      },
      body: JSON.stringify(security)
    });
    
    if (!securityResponse.ok) {
      const error = await securityResponse.text();
      console.error(`[Auth] Failed to set database security: ${error}`);
      return false;
    }
    
    console.log(`[Auth] Database security configured`);
    return true;
    
  } catch (error) {
    console.error(`[Auth] Registration error:`, error);
    return false;
  }
}

/**
 * Authenticates user with CouchDB
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {Promise<Object|null>} - Session info or null if failed
 */
export async function authenticateUser(username: string, password: string): Promise<boolean> {
  try {
    console.log(`[Auth] Logging in user: ${username}`);
    
    // Authenticate with CouchDB
    const response = await fetch(`${COUCHDB_URL}/_session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: username, password: password })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`[Auth] Login failed: ${error}`);
      return null;
    }
    
    const sessionData = await response.json();
    console.log(`[Auth] Login successful for user: ${username}`);
    
    // Store session info (in memory only)
    const session = {
      username: username,
      password: password, // Needed for database operations
      authenticated: true,
      loginTime: new Date().toISOString()
    };
    
    return session;
    
  } catch (error) {
    console.error(`[Auth] Login error:`, error);
    return null;
  }
}

/**
 * Checks if user exists
 * @param {string} username - Username to check
 * @returns {Promise<boolean>} - True if user exists
 */
export async function userExists(username: string): Promise<boolean> {
  try {
    const response = await fetch(`${COUCHDB_URL}/_users/org.couchdb.user:${username}`, {
      headers: {
        'Authorization': `Basic ${btoa(ADMIN_CREDENTIALS)}`
      }
    });
    
    return response.ok;
  } catch (error) {
    console.error(`[Auth] Error checking user existence:`, error);
    return false;
  }
}

/**
 * Stores encrypted credential in user's database
 * @param {string} username - Username
 * @param {string} password - Password
 * @param {Object} encryptedCredential - Encrypted credential data
 * @returns {Promise<boolean>} - Success status
 */
export async function storeEncryptedCredential(username: string, password: string, encryptedCredential: any, metadata: any = {}): Promise<string> {
  try {
    console.log(`[Auth] Storing encrypted credential for user: ${username}`);
    
    const dbName = `wallet_${username}`;
    const credentialDoc = {
      _id: `credential_${Date.now()}`,
      type: 'credential',
      encrypted_data: encryptedCredential.encrypted_data,
      iv: encryptedCredential.iv,
      metadata: {
        credential_type: 'university_degree', // Can be dynamic
        created_at: new Date().toISOString()
      }
    };
    
    const response = await fetch(`${COUCHDB_URL}/${dbName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${username}:${password}`)}`
      },
      body: JSON.stringify(credentialDoc)
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`[Auth] Failed to store credential: ${error}`);
      return false;
    }
    
    console.log(`[Auth] Credential stored successfully`);
    return true;
    
  } catch (error) {
    console.error(`[Auth] Error storing credential:`, error);
    return false;
  }
}

/**
 * Retrieves all encrypted credentials for user
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {Promise<Array>} - Array of encrypted credentials
 */
export async function getUserCredentials(username: string, password: string): Promise<any[]> {
  try {
    console.log(`[Auth] Fetching credentials for user: ${username}`);
    
    const dbName = `wallet_${username}`;
    const response = await fetch(`${COUCHDB_URL}/${dbName}/_all_docs?include_docs=true`, {
      headers: {
        'Authorization': `Basic ${btoa(`${username}:${password}`)}`
      }
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`[Auth] Failed to fetch credentials: ${error}`);
      return [];
    }
    
    const data = await response.json();
    
    // Filter for credential documents
    const credentials = data.rows
      .map(row => row.doc)
      .filter(doc => doc.type === 'credential');
    
    console.log(`[Auth] Found ${credentials.length} credentials for user`);
    return credentials;
    
  } catch (error) {
    console.error(`[Auth] Error fetching credentials:`, error);
    return [];
  }
}

/**
 * Removes a credential from user's database
 * @param {string} username - Username
 * @param {string} password - Password  
 * @param {string} credentialId - ID of credential to remove
 * @returns {Promise<boolean>} - Success status
 */
export async function removeCredential(username: string, password: string, credentialId: string): Promise<boolean> {
  try {
    console.log(`[Auth] Removing credential ${credentialId} for user: ${username}`);
    
    const dbName = `wallet_${username}`;
    
    // First get the document to get its revision
    const getResponse = await fetch(`${COUCHDB_URL}/${dbName}/${credentialId}`, {
      headers: {
        'Authorization': `Basic ${btoa(`${username}:${password}`)}`
      }
    });
    
    if (!getResponse.ok) {
      console.error(`[Auth] Failed to get credential for deletion: ${getResponse.statusText}`);
      return false;
    }
    
    const doc = await getResponse.json();
    
    // Now delete the document with its revision
    const deleteResponse = await fetch(`${COUCHDB_URL}/${dbName}/${credentialId}?rev=${doc._rev}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${btoa(`${username}:${password}`)}`
      }
    });
    
    if (!deleteResponse.ok) {
      const error = await deleteResponse.text();
      console.error(`[Auth] Failed to delete credential: ${error}`);
      return false;
    }
    
    console.log(`[Auth] Credential ${credentialId} deleted successfully`);
    return true;
    
  } catch (error) {
    console.error(`[Auth] Error deleting credential:`, error);
    return false;
  }
}

/**
 * Stores an encrypted credential in user's database
 * @param {string} username - Username
 * @param {string} password - Password
 * @param {object} credentialDoc - Credential document to store
 * @returns {Promise<boolean>} - Success status
 */
export async function storeCredential(username: string, password: string, credentialDoc: any): Promise<boolean> {
  try {
    console.log(`[Auth] Storing credential for user: ${username}`);
    
    const dbName = `wallet_${username}`;
    const credentialId = credentialDoc.id || `cred_${Date.now()}`;
    
    const response = await fetch(`${COUCHDB_URL}/${dbName}/${credentialId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${username}:${password}`)}`
      },
      body: JSON.stringify({
        ...credentialDoc,
        _id: credentialId,
        type: 'credential',
        createdAt: new Date().toISOString()
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`[Auth] Failed to store credential: ${error}`);
      return false;
    }
    
    console.log(`[Auth] Credential ${credentialId} stored successfully`);
    return true;
    
  } catch (error) {
    console.error(`[Auth] Error storing credential:`, error);
    return false;
  }
}