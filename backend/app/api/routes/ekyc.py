from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, func

# Project Imports
from app.api import deps
from app.models import SecureIdentity
from app.core import security_ekyc
from app.schemas import ekyc as schemas 

router = APIRouter()

# --- 1. Public Key Endpoint ---
# Frontend URL: /api/v1/public-key
@router.get("/public-key")
def get_public_key():
    """
    Frontend calls this to initialize the SecureBridge.
    """
    return {"public_key": security_ekyc.get_rsa_public_key()} 


# --- 2. Create Identity Endpoint ---
# Frontend URL: /api/v1/secure-identities
@router.post("/secure-identities", response_model=schemas.SecureIdentityResponse, status_code=status.HTTP_201_CREATED)
def create_secure_identity(
    payload: schemas.SecureIdentityCreateRequest, 
    db: Session = Depends(deps.get_db)
):
    try:
        # 1. Decrypt (Hybrid Decryption)
        national_id_str = security_ekyc.decrypt_ingress_payload(
            encrypted_aes_key=payload.encrypted_key,
            iv=payload.iv,
            ciphertext=payload.encrypted_data,
            auth_tag=payload.auth_tag
        )
        
        if not national_id_str:
            raise HTTPException(status_code=400, detail="Decryption resulted in empty data")

        # 2. Generate Blind Index
        blind_idx = security_ekyc.generate_blind_index(national_id_str)

        # 3. Check Duplicates
        statement = select(SecureIdentity).where(SecureIdentity.blind_index_hash == blind_idx)
        existing = db.exec(statement).first()
        
        if existing:
             raise HTTPException(status_code=409, detail=f"Identity already exists (ID: {existing.id})")

        # 4. Encrypt for Storage
        storage_blob = security_ekyc.encrypt_for_db(national_id_str)

        # 5. Save to Database
        new_identity = SecureIdentity(
            full_name=payload.full_name,
            encrypted_data_blob=storage_blob,
            blind_index_hash=blind_idx
        )
        db.add(new_identity)
        db.commit()
        db.refresh(new_identity)

        return schemas.SecureIdentityResponse(
            id=new_identity.id,
            full_name=new_identity.full_name,
            blind_index=new_identity.blind_index_hash, 
            created_at=new_identity.created_at
        )

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Ingress Error: {str(e)}")
        raise HTTPException(status_code=400, detail="Secure processing failed.")


# --- 3. Read Identities Endpoint ---
# Frontend URL: /api/v1/secure-identities
@router.get("/secure-identities", response_model=schemas.SecureIdentitiesPublic)
def read_secure_identities(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(deps.get_db)
):
    # 1. Get total count
    count_statement = select(func.count()).select_from(SecureIdentity)
    count = db.exec(count_statement).one()

    # 2. Get Data Page
    statement = select(SecureIdentity).offset(skip).limit(limit)
    identities_db = db.exec(statement).all()

    # 3. Map to Response Models
    results = [
        schemas.SecureIdentityResponse(
            id=item.id,
            full_name=item.full_name,
            blind_index=item.blind_index_hash, 
            created_at=item.created_at
        )
        for item in identities_db
    ]

    return {"data": results, "count": count}