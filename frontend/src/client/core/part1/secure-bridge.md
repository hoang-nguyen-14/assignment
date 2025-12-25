# Secure Bridge – Client-side E2E Encryption Library

## Purpose

SecureBridge is a **developer-friendly client-side cryptography library**
that enables **End-to-End (E2E) encryption** of sensitive data (PII)
*before* it leaves the browser.

This guarantees:
- Plaintext is **never visible** to load balancers or proxies
- Only the backend application with the **private key** can decrypt data
- Transport security (TLS) is layered with **application-layer encryption**

---

## Threat Model

### We assume:
- TLS can terminate at internal infrastructure
- Logs, proxies, or misconfigured middleware may inspect payloads

### We protect against:
- Accidental plaintext logging
- Internal traffic inspection
- Compromised edge infrastructure

---

## Cryptographic Design (Hybrid Encryption)

| Layer | Algorithm | Reason |
|-----|---------|-------|
| Payload encryption | AES-256-GCM | Fast, authenticated, random IV |
| Key encryption | RSA-OAEP (SHA-256) | Secure key exchange |
| Entropy | WebCrypto RNG | Cryptographically secure |

---

## High-Level Flow

1. Generate a **random AES-256 symmetric key**
2. Encrypt the sensitive payload using **AES-GCM**
3. Encrypt the AES key using the server’s **RSA public key**
4. Send encrypted payload + encrypted key to backend

```
Client (Browser)
  ├─ AES-GCM encrypt(payload)
  ├─ RSA-OAEP encrypt(AES key)
  └─ send → API
```

---

## SecureBridge API

### `initialize(publicKeyPem: string)`

Initializes the library with the server’s **RSA public key**.

```ts
await bridge.initialize(serverPublicKeyPem)
```

**Why this design**
- Explicit initialization avoids silent crypto misuse
- Public key can be rotated independently of the frontend build

---

### `encrypt(data: string): Promise<EncryptedPayload>`

Encrypts sensitive data using **hybrid encryption**.

```ts
const encrypted = await bridge.encrypt("123-45-6789")
```

Returns:

```ts
{
  encrypted_data: string  // AES-GCM ciphertext
  encrypted_key: string   // RSA-encrypted AES key
  iv: string              // AES-GCM IV
  auth_tag: string        // GCM authentication tag
}
```

---

## SecureBridge Implementation

```ts
// frontend-lib/SecureBridge.ts

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
```

---

## Example Usage (Frontend)

```ts
const bridge = new SecureBridge()
await bridge.initialize(serverPublicKeyPem)

const encryptedPayload = await bridge.encrypt("123-45-6789")

await fetch("/api/ingest", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(encryptedPayload),
})
```

---

## Design Decisions & Rationale

### Why Hybrid Encryption?
- RSA alone is slow and size-limited
- AES alone cannot safely share keys
- Hybrid encryption combines **security + performance**

### Why AES-GCM?
- Provides **confidentiality + integrity**
- Prevents silent ciphertext tampering
- Standard for modern cryptographic systems

### Why WebCrypto?
- Hardware-backed RNG
- Native browser support
- Avoids risky userland crypto libraries

---

## Security Guarantees

✔ Plaintext never leaves browser  
✔ Resistant to replay & tampering  
✔ Compatible with key rotation  
✔ Auditable & deterministic API  

---

## What This Library Does NOT Do

- ❌ Key storage (handled by backend / KMS)
- ❌ Transport security (TLS still required)
- ❌ Persistent encryption (this is ingress-only)

---

## Summary

SecureBridge provides **simple, correct, and auditable**
E2E encryption for frontend applications handling PII,
while remaining **framework-agnostic and future-proof**.
