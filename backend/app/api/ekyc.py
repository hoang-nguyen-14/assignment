# core/security_ekyc.py
import os
import base64
import json
import hmac
import hashlib
from cryptography.hazmat.primitives import hashes, serialization, padding as sym_padding
from cryptography.hazmat.primitives.asymmetric import padding as asym_padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from cryptography.fernet import Fernet

# Load config (Replace these with your actual config loader if you have one, e.g., os.getenv)
RSA_KEY_PATH = os.getenv("RSA_PRIVATE_KEY_PATH", "certs/private.pem")
BLIND_INDEX_SECRET = os.getenv("BLIND_INDEX_SECRET", "default-insecure-secret").encode()
STORAGE_KEY = os.getenv("STORAGE_ENCRYPTION_KEY", Fernet.generate_key().decode()).encode()

# Initialize Storage Encryptor (Fernet handles Randomized Encryption automatically)
storage_cipher = Fernet(STORAGE_KEY)

def load_private_key():
    """Loads the RSA Private Key from disk."""
    try:
        with open(RSA_KEY_PATH, "rb") as key_file:
            return serialization.load_pem_private_key(
                key_file.read(),
                password=None,
                backend=default_backend()
            )
    except FileNotFoundError:
        print(f"WARNING: Private key not found at {RSA_KEY_PATH}")
        return None

private_key = load_private_key()

def decrypt_ingress_payload(enc_key_b64: str, iv_b64: str, ciphertext_b64: str) -> dict:
    """
    1. Decrypts the AES key using RSA Private Key.
    2. Decrypts the content using the AES key.
    """
    if not private_key:
        raise Exception("Server Private Key not loaded.")

    # 1. Decode Base64 inputs
    enc_aes_key = base64.b64decode(enc_key_b64)
    iv = base64.b64decode(iv_b64)
    ciphertext = base64.b64decode(ciphertext_b64)

    # 2. Decrypt the Symmetric Key (RSA)
    symmetric_key = private_key.decrypt(
        enc_aes_key,
        asym_padding.OAEP(
            mgf=asym_padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )

    # 3. Decrypt the Data (AES-CBC Example - adjust mode if library uses GCM)
    cipher = Cipher(algorithms.AES(symmetric_key), modes.CBC(iv), backend=default_backend())
    decryptor = cipher.decryptor()
    padded_plaintext = decryptor.update(ciphertext) + decryptor.finalize()

    # 4. Remove PKCS7 Padding
    unpadder = sym_padding.PKCS7(128).unpadder()
    plaintext = unpadder.update(padded_plaintext) + unpadder.finalize()

    return json.loads(plaintext.decode('utf-8'))

def generate_blind_index(input_string: str) -> str:
    """
    Generates a deterministic HMAC-SHA256 hash for exact-match searching.
    """
    return hmac.new(
        key=BLIND_INDEX_SECRET,
        msg=input_string.encode('utf-8'),
        digestmod=hashlib.sha256
    ).hexdigest()

def encrypt_for_db(data: dict) -> bytes:
    """
    Encrypts data for storage using Fernet (Randomized Encryption).
    Output changes every time.
    """
    json_str = json.dumps(data)
    return storage_cipher.encrypt(json_str.encode('utf-8'))

def decrypt_from_db(encrypted_blob: bytes) -> dict:
    """
    Decrypts data retrieved from the database.
    """
    json_bytes = storage_cipher.decrypt(encrypted_blob)
    return json.loads(json_bytes.decode('utf-8'))