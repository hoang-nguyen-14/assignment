/**
 * SecureBridge - E2E Encryption Library
 * Implements hybrid encryption using RSA-OAEP + AES-256-GCM
 */

export interface EncryptedPayload {
  encrypted_data: string;  // Base64 encoded ciphertext
  encrypted_key: string;   // Base64 encoded encrypted symmetric key
  iv: string;              // Base64 encoded initialization vector
  auth_tag: string;        // Base64 encoded authentication tag
}

export class SecureBridge {
  private publicKey: CryptoKey | null = null;

  /**
   * Initialize the library with the server's public key
   * @param publicKeyPem - Server's RSA public key in PEM format
   */
  async initialize(publicKeyPem: string): Promise<void> {
    try {
      // Remove PEM headers and decode base64
      const pemContents = publicKeyPem
        .replace('-----BEGIN PUBLIC KEY-----', '')
        .replace('-----END PUBLIC KEY-----', '')
        .replace(/\s/g, '');
      
      const binaryKey = this.base64ToArrayBuffer(pemContents);

      // Import the public key for RSA-OAEP encryption
      this.publicKey = await crypto.subtle.importKey(
        'spki',
        binaryKey,
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256',
        },
        false,
        ['encrypt']
      );
    } catch (error) {
      throw new Error(`Failed to initialize SecureBridge: ${error}`);
    }
  }

  /**
   * Encrypt sensitive data using hybrid encryption
   * @param data - Plain text data to encrypt (e.g., National ID)
   * @returns Encrypted payload ready for transmission
   */
  async encrypt(data: string): Promise<EncryptedPayload> {
    if (!this.publicKey) {
      throw new Error('SecureBridge not initialized. Call initialize() first.');
    }

    try {
      // Step 1: Generate a transient AES-256 symmetric key
      const symmetricKey = await crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256,
        },
        true,
        ['encrypt']
      );

      // Step 2: Generate a random IV (Initialization Vector)
      const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM

      // Step 3: Encrypt the data with AES-256-GCM
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      
      const encryptedData = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          tagLength: 128, // 128-bit authentication tag
        },
        symmetricKey,
        dataBuffer
      );

      // Extract ciphertext and auth tag (last 16 bytes)
      const ciphertext = encryptedData.slice(0, -16);
      const authTag = encryptedData.slice(-16);

      // Step 4: Export the symmetric key
      const exportedKey = await crypto.subtle.exportKey('raw', symmetricKey);

      // Step 5: Encrypt the symmetric key with RSA-OAEP
      const encryptedKey = await crypto.subtle.encrypt(
        {
          name: 'RSA-OAEP',
        },
        this.publicKey,
        exportedKey
      );

      // Step 6: Return the packaged payload
      return {
        encrypted_data: this.arrayBufferToBase64(ciphertext),
        encrypted_key: this.arrayBufferToBase64(encryptedKey),
        iv: this.arrayBufferToBase64(iv.buffer),
        auth_tag: this.arrayBufferToBase64(authTag),
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error}`);
    }
  }

  /**
   * Utility: Convert ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Utility: Convert Base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

// // Example Usage
// export async function example() {
//   // Server's public key (normally fetched from API)
//   const serverPublicKey = `-----BEGIN PUBLIC KEY-----
// MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
// -----END PUBLIC KEY-----`;

//   const bridge = new SecureBridge();
//   await bridge.initialize(serverPublicKey);

//   const nationalId = '123-45-6789';
//   const encrypted = await bridge.encrypt(nationalId);

//   console.log('Encrypted Payload:', encrypted);

//   // Send to server
//   await fetch('https://api.example.com/submit', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify(encrypted),
//   });
// }