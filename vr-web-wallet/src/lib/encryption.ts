// Client-side encryption utilities for SSI credentials

/**
 * Derives an encryption key from password + username
 * @param {string} password - User's password
 * @param {string} username - User's username (used as salt)
 * @returns {Promise<CryptoKey>} - Derived encryption key
 */
export async function deriveEncryptionKey(password: string, username: string): Promise<CryptoKey> {
  // Create salt from username
  const salt = new TextEncoder().encode(username + "_ssi_wallet_salt");
  
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  
  // Derive AES-GCM key
  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000, // OWASP recommended minimum
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a credential object
 * @param {Object} credential - The credential to encrypt
 * @param {CryptoKey} key - Encryption key
 * @returns {Promise<Object>} - Encrypted data with IV
 */
export async function encryptCredential(credential: any, key: CryptoKey): Promise<{encrypted_data: string; iv: string}> {
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Convert credential to string
  const credentialData = JSON.stringify(credential);
  const encodedData = new TextEncoder().encode(credentialData);
  
  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    key,
    encodedData
  );
  
  // Return encrypted data with IV
  return {
    encrypted_data: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv)
  };
}

/**
 * Decrypts a credential
 * @param {string} encryptedData - Base64 encrypted data
 * @param {string} ivBase64 - Base64 IV
 * @param {CryptoKey} key - Decryption key
 * @returns {Promise<Object>} - Decrypted credential
 */
export async function decryptCredential(encryptedCredential: {encrypted_data: string; iv: string}, key: CryptoKey): Promise<any> {
  // Convert base64 back to ArrayBuffer
  const encrypted = base64ToArrayBuffer(encryptedCredential.encrypted_data);
  const iv = base64ToArrayBuffer(encryptedCredential.iv);
  
  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    key,
    encrypted
  );
  
  // Convert back to object
  const decryptedText = new TextDecoder().decode(decrypted);
  return JSON.parse(decryptedText);
}

/**
 * Converts ArrayBuffer to Base64 string
 * @param {ArrayBuffer} buffer - Buffer to convert
 * @returns {string} - Base64 string
 */
export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts Base64 string to ArrayBuffer
 * @param {string} base64 - Base64 string
 * @returns {ArrayBuffer} - Converted buffer
 */
export function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Creates a hash of data for verification
 * @param {string} data - Data to hash
 * @returns {Promise<string>} - Base64 hash
 */
export async function hashData(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return arrayBufferToBase64(hashBuffer);
}

/**
 * Decrypts a single attribute value that was encrypted as a JSON string
 * @param {string} encryptedValue - JSON string containing encrypted data
 * @param {CryptoKey} key - Decryption key
 * @returns {Promise<string>} - Decrypted attribute value
 */
export async function decryptAttributeValue(encryptedValue: string, key: CryptoKey): Promise<string> {
  try {
    console.log('🔍 Decrypting value of length:', encryptedValue.length);
    let encryptedData;
    
    // First try to parse as base64-encoded JSON (new format)
    try {
      const decodedValue = atob(encryptedValue);
      console.log('📦 Base64 decoded:', decodedValue.substring(0, 100) + '...');
      encryptedData = JSON.parse(decodedValue);
      console.log('✅ Parsed as base64-encoded JSON');
    } catch (e) {
      // If base64 decoding fails, try direct JSON parsing (legacy format)
      console.log('⚠️ Base64 decode failed, trying direct JSON parse');
      encryptedData = JSON.parse(encryptedValue);
      console.log('✅ Parsed as direct JSON');
    }
    
    console.log('🔑 Encrypted data structure:', {
      hasEncryptedData: !!encryptedData.encrypted_data,
      hasIv: !!encryptedData.iv,
      encryptedDataType: typeof encryptedData.encrypted_data,
      ivType: typeof encryptedData.iv
    });
    
    // Convert arrays back to ArrayBuffer if needed
    let encrypted, iv;
    
    if (Array.isArray(encryptedData.encrypted_data)) {
      encrypted = new Uint8Array(encryptedData.encrypted_data).buffer;
      console.log('📊 Converted encrypted_data array to buffer');
    } else if (typeof encryptedData.encrypted_data === 'string') {
      encrypted = base64ToArrayBuffer(encryptedData.encrypted_data);
      console.log('📊 Converted encrypted_data string to buffer');
    } else {
      encrypted = encryptedData.encrypted_data;
      console.log('📊 Using encrypted_data as-is');
    }
    
    if (Array.isArray(encryptedData.iv)) {
      iv = new Uint8Array(encryptedData.iv).buffer;
      console.log('📊 Converted IV array to buffer');
    } else if (typeof encryptedData.iv === 'string') {
      iv = base64ToArrayBuffer(encryptedData.iv);
      console.log('📊 Converted IV string to buffer');
    } else {
      iv = encryptedData.iv;
      console.log('📊 Using IV as-is');
    }
    
    console.log('🔓 Attempting AES-GCM decryption...');
    
    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv
      },
      key,
      encrypted
    );
    
    // Convert back to string
    const result = new TextDecoder().decode(decrypted);
    console.log('✅ Decryption successful, result length:', result.length);
    return result;
  } catch (error) {
    console.error('❌ Decryption failed with error:', error.name, error.message);
    console.error('❌ Full error object:', error);
    return '[DECRYPTION FAILED]';
  }
}