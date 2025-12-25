from typing import List, Optional, Any
from pydantic import BaseModel
from datetime import datetime

# --- INPUT SCHEMAS ---

class SecureIdentityCreateRequest(BaseModel):
    """
    The payload sent by the Frontend 'SecureBridge' library.
    Contains the cleartext name + the hybrid encrypted payload.
    """
    full_name: str
    encrypted_data: str  # Base64 ciphertext of National ID
    encrypted_key: str   # Base64 encrypted AES key
    iv: str              # Base64 Initialization Vector
    auth_tag: str        # Base64 GCM Auth Tag

# --- OUTPUT SCHEMAS ---

class SecureIdentityResponse(BaseModel):
    """
    The object representing a single secure identity.
    Note: We return 'blind_index' (hash), never the raw sensitive ID.
    """
    id: int
    full_name: str
    blind_index: str     # Matches Frontend column accessor
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class SecureIdentitiesPublic(BaseModel):
    """
    The wrapper structure expected by React Query / TanStack Table.
    { data: [...], count: 10 }
    """
    data: List[SecureIdentityResponse]
    count: int