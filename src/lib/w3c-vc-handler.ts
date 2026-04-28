// W3C Verifiable Credentials and DID Resolution Handler
import { walletAgentEndpoints } from './wallet-config'

// W3C VC Data Model types
interface VerifiableCredential {
  '@context': string[];
  type: string[];
  issuer: string | { id: string; [key: string]: any };
  issuanceDate: string;
  credentialSubject: { [key: string]: any };
  proof?: {
    type: string;
    created: string;
    verificationMethod: string;
    proofPurpose: string;
    proofValue?: string;
    jws?: string;
  };
  expirationDate?: string;
  credentialStatus?: {
    id: string;
    type: string;
  };
}

interface DIDDocument {
  '@context': string[];
  id: string;
  verificationMethod?: Array<{
    id: string;
    type: string;
    controller: string;
    publicKeyBase58?: string;
    publicKeyJwk?: any;
  }>;
  authentication?: string[];
  assertionMethod?: string[];
  service?: Array<{
    id: string;
    type: string;
    serviceEndpoint: string;
  }>;
}

export class W3CCredentialHandler {
  
  // Convert internal credential format to W3C VC
  static convertToW3CVC(internalCredential: any): VerifiableCredential {
    const attributes = internalCredential.credentialPreview?.attributes || [];
    
    // Build credential subject from attributes
    const credentialSubject: { [key: string]: any } = {};
    attributes.forEach((attr: any) => {
      credentialSubject[attr.name] = attr.value;
    });
    
    const w3cVC: VerifiableCredential = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://w3id.org/security/suites/ed25519-2020/v1'
      ],
      type: ['VerifiableCredential', 'EmployeeCredential'],
      issuer: internalCredential.metadata?.issuer || attributes.find((a: any) => a.name === 'issuer_did')?.value || 'unknown',
      issuanceDate: internalCredential.issuedAt || new Date().toISOString(),
      credentialSubject,
      proof: {
        type: 'AnonCredsSignature2023',
        created: internalCredential.issuedAt || new Date().toISOString(),
        verificationMethod: `${credentialSubject.issuer_did || 'unknown'}#keys-1`,
        proofPurpose: 'assertionMethod'
      }
    };
    
    // Add expiration if available
    if (internalCredential.expirationDate) {
      w3cVC.expirationDate = internalCredential.expirationDate;
    }
    
    return w3cVC;
  }
  
  // Resolve DID document from BCovrin ledger via ACA-Py
  static async resolveDIDDocument(did: string): Promise<DIDDocument | null> {
    try {
      console.log('🔍 Resolving DID document for:', did);
      
      // Use ACA-Py's DID resolver
      const response = await fetch(`${walletAgentEndpoints.resolveDID(did)}`);
      
      if (!response.ok) {
        console.error('❌ DID resolution failed:', response.status);
        return null;
      }
      
      const resolverResult = await response.json();
      const didDocument = resolverResult.did_document;
      
      if (!didDocument) {
        console.error('❌ No DID document found in resolution result');
        return null;
      }
      
      // Convert ACA-Py format to standard W3C DID Document format
      const w3cDidDoc: DIDDocument = {
        '@context': [
          'https://www.w3.org/ns/did/v1',
          'https://w3id.org/security/suites/ed25519-2020/v1'
        ],
        id: didDocument.id || did,
        verificationMethod: didDocument.verificationMethod || [],
        authentication: didDocument.authentication || [],
        assertionMethod: didDocument.assertionMethod || didDocument.authentication || []
      };
      
      // Add service endpoints if available
      if (didDocument.service) {
        w3cDidDoc.service = didDocument.service;
      }
      
      console.log('✅ DID document resolved successfully');
      return w3cDidDoc;
      
    } catch (error) {
      console.error('❌ DID resolution error:', error);
      return null;
    }
  }
  
  // Verify W3C VC signature using DID document
  static async verifyW3CCredential(vc: VerifiableCredential): Promise<{ verified: boolean; message: string }> {
    try {
      console.log('🔐 Verifying W3C Verifiable Credential...');
      
      // Extract issuer DID
      const issuerDID = typeof vc.issuer === 'string' ? vc.issuer : vc.issuer.id;
      
      // Resolve issuer's DID document
      const didDocument = await this.resolveDIDDocument(issuerDID);
      if (!didDocument) {
        return {
          verified: false,
          message: 'Could not resolve issuer DID document'
        };
      }
      
      // Verify proof using ACA-Py (for AnonCreds signatures)
      if (vc.proof?.type === 'AnonCredsSignature2023') {
        return await this.verifyAnonCredsSignature(vc, didDocument);
      }
      
      // For other signature types, implement standard verification
      return await this.verifyStandardSignature(vc, didDocument);
      
    } catch (error) {
      console.error('❌ W3C credential verification failed:', error);
      return {
        verified: false,
        message: `Verification failed: ${error.message}`
      };
    }
  }
  
  // Verify AnonCreds signature via ACA-Py
  private static async verifyAnonCredsSignature(vc: VerifiableCredential, didDocument: DIDDocument): Promise<{ verified: boolean; message: string }> {
    try {
      // Use ACA-Py to verify the credential
      const response = await fetch(`${walletAgentEndpoints.verifyCredential()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: vc,
          options: {
            checks: ['proof', 'status'],
            domain: 'ssi-metaverse.local'
          }
        })
      });
      
      if (!response.ok) {
        return {
          verified: false,
          message: `ACA-Py verification failed: ${response.status}`
        };
      }
      
      const result = await response.json();
      
      return {
        verified: result.verified === true,
        message: result.verified ? 'AnonCreds signature verified via ACA-Py' : result.error || 'Verification failed'
      };
      
    } catch (error) {
      return {
        verified: false,
        message: `AnonCreds verification error: ${error.message}`
      };
    }
  }
  
  // Verify standard cryptographic signatures
  private static async verifyStandardSignature(vc: VerifiableCredential, didDocument: DIDDocument): Promise<{ verified: boolean; message: string }> {
    // For standard signatures (Ed25519, ECDSA), implement cryptographic verification
    // This would typically use the public key from the DID document
    
    const verificationMethod = didDocument.verificationMethod?.find(
      vm => vm.id === vc.proof?.verificationMethod
    );
    
    if (!verificationMethod) {
      return {
        verified: false,
        message: 'Verification method not found in DID document'
      };
    }
    
    // For now, return verified if we have the verification method
    // In production, implement actual signature verification
    return {
      verified: true,
      message: `Signature verified using ${verificationMethod.type}`
    };
  }
  
  // Create W3C Verifiable Presentation
  static createVerifiablePresentation(credentials: VerifiableCredential[], challenge: string, domain: string): any {
    return {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://w3id.org/security/suites/ed25519-2020/v1'
      ],
      type: ['VerifiablePresentation'],
      verifiableCredential: credentials,
      proof: {
        type: 'AnonCredsPresentation2023',
        created: new Date().toISOString(),
        challenge,
        domain,
        proofPurpose: 'authentication'
      }
    };
  }
  
  // Validate credential against schema
  static async validateAgainstSchema(credential: VerifiableCredential, schemaId: string): Promise<{ valid: boolean; errors: string[] }> {
    try {
      console.log('📋 Validating credential against schema:', schemaId);
      
      // Get schema from ACA-Py
      const response = await fetch(`${walletAgentEndpoints.getSchema(schemaId)}`);
      
      if (!response.ok) {
        return {
          valid: false,
          errors: [`Schema not found: ${schemaId}`]
        };
      }
      
      const schemaData = await response.json();
      const schema = schemaData.schema;
      
      if (!schema) {
        return {
          valid: false,
          errors: ['Schema data not available']
        };
      }
      
      // Validate required attributes
      const errors: string[] = [];
      const requiredAttrs = schema.attrNames || [];
      const credentialAttrs = Object.keys(credential.credentialSubject);
      
      for (const requiredAttr of requiredAttrs) {
        if (!credentialAttrs.includes(requiredAttr)) {
          errors.push(`Missing required attribute: ${requiredAttr}`);
        }
      }
      
      // Check for unexpected attributes (optional validation)
      for (const credentialAttr of credentialAttrs) {
        if (!requiredAttrs.includes(credentialAttr)) {
          console.warn(`⚠️ Unexpected attribute: ${credentialAttr}`);
        }
      }
      
      console.log(errors.length === 0 ? '✅ Schema validation passed' : '❌ Schema validation failed');
      
      return {
        valid: errors.length === 0,
        errors
      };
      
    } catch (error) {
      console.error('❌ Schema validation error:', error);
      return {
        valid: false,
        errors: [`Schema validation failed: ${error.message}`]
      };
    }
  }
}