# app/core/security_ekyc.py
import os
import base64
import hmac
import hashlib
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding as asym_padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from cryptography.fernet import Fernet

# --- CONFIGURATION ---
# In production, use a secure vault or env vars.
# We auto-generate a key if missing for local dev convenience.
RSA_KEY_PATH = "private_key.pem"
BLIND_INDEX_SECRET = os.getenv("BLIND_INDEX_SECRET", "change-this-secret-to-something-long").encode()
STORAGE_KEY = os.getenv("STORAGE_KEY", Fernet.generate_key().decode()).encode()

# Initialize Storage Cipher (Fernet)
storage_cipher = Fernet(STORAGE_KEY)

# --- KEY MANAGEMENT ---
def load_or_generate_private_key():
    """
    Loads RSA Key from disk or generates a new one if missing.
    """
    if os.path.exists(RSA_KEY_PATH):
        with open(RSA_KEY_PATH, "rb") as f:
            return serialization.load_pem_private_key(
                f.read(), password=None, backend=default_backend()
            )
    
    # Generate new 2048-bit RSA key if none exists
    print("Generating new RSA Key pair...")
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    )
    # Save it so it persists across restarts
    with open(RSA_KEY_PATH, "wb") as f:
        f.write(private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        ))
    return private_key

# Global Private Key Instance
_private_key = load_or_generate_private_key()

def get_rsa_public_key() -> str:
    """
    Export the Public Key in PEM format.
    The frontend calls this to get the key for encryption.
    """
    public_key = _private_key.public_key()
    pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    return pem.decode('utf-8')

# --- INGRESS DECRYPTION (Matches Frontend) ---
def decrypt_ingress_payload(encrypted_aes_key: str, iv: str, ciphertext: str, auth_tag: str) -> str:
    """
    Decrypts the hybrid payload sent by the frontend.
    Mode: AES-GCM (No manual padding needed).
    """
    try:
        # 1. Decode Base64 components
        enc_sym_key_bytes = base64.b64decode(encrypted_aes_key)
        iv_bytes = base64.b64decode(iv)
        ciphertext_bytes = base64.b64decode(ciphertext)
        auth_tag_bytes = base64.b64decode(auth_tag)

        # 2. Decrypt the Symmetric Key using RSA Private Key
        symmetric_key = _private_key.decrypt(
            enc_sym_key_bytes,
            asym_padding.OAEP(
                mgf=asym_padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )

        # 3. Decrypt the Data using AES-GCM
        # Note: GCM handles authentication (tag) and decryption in one step
        decryptor = Cipher(
            algorithms.AES(symmetric_key),
            modes.GCM(iv_bytes, auth_tag_bytes),
            backend=default_backend()
        ).decryptor()

        decrypted_data = decryptor.update(ciphertext_bytes) + decryptor.finalize()
        
        return decrypted_data.decode('utf-8')

    except Exception as e:
        print(f"Decryption failed: {e}")
        # Return None or raise generic error to avoid leaking crypto details
        return None

# --- STORAGE SECURITY (Blind Index & Storage Encryption) ---
def generate_blind_index(input_string: str) -> str:
    """
    Creates a deterministic HMAC-SHA256 hash for searching.
    """
    return hmac.new(
        key=BLIND_INDEX_SECRET,
        msg=input_string.encode('utf-8'),
        digestmod=hashlib.sha256
    ).hexdigest()

def encrypt_for_db(plaintext_data: str) -> str:
    """
    Encrypts the raw string for database storage (Randomized).
    """
    return storage_cipher.encrypt(plaintext_data.encode('utf-8')).decode('utf-8')

def decrypt_from_db(encrypted_blob: str) -> str:
    """
    Decrypts the blob retrieved from the database.
    """
    return storage_cipher.decrypt(encrypted_blob.encode('utf-8')).decode('utf-8')