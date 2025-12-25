# Scenario A — Annual DEK Rotation at Scale (Millions of Records, Zero Downtime)

## Problem
Compliance requires rotating the **Data Encryption Key (DEK)** annually. We have **millions of encrypted rows**, so we cannot:
- stop traffic to re-encrypt everything at once,
- block reads/writes while migrating,
- risk partial migrations causing decrypt failures.

## Goals
1. **No downtime** for reads/writes.
2. **Safe migration** that can pause/resume.
3. **Correct decrypt** during transition (rows may be under different DEKs).
4. **Auditability**: prove which key encrypted which record.
5. **Minimal operational risk** (rollback plan).

---

## Solution Overview: Key Versioning + Dual-Read + Background Re-encrypt

### Key idea
Every encrypted record stores metadata: **`dek_version`**.
- Reads pick the correct DEK by version.
- Writes always use the newest DEK.
- A background worker gradually re-encrypts old rows.

### Data model
![scenario A](/assets/images/scenario-A.drawio.svg)

Add/ensure these fields exist on each record:
- `dek_version` (string or small int): e.g., `dek-v1`, `dek-v2`
- `nonce` (or IV) used for randomized encryption
- `ciphertext`
- `created_at`, `updated_at` (optional)
- `reencrypted_at`, `migration_batch_id` (optional)
#### Before (Not rotation-safe ❌)
| Column | Notes |
|------|------|
| ciphertext | Encrypted PII |
| nonce | AES-GCM nonce |

#### After (Rotation-safe ✅)
| Column | Purpose |
|------|--------|
| ciphertext | Encrypted PII |
| nonce | Random per encryption |
| dek_version | Which DEK encrypted this row |
| created_at | Audit |
| updated_at | Audit |
| reencrypted_at | Audit |
| migration_batch_id  | Audit |

### Key registry (logical)
Maintain a key ring in KMS/HSM:
- `dek-v1`, `dek-v2`, ...

| Key Version | Status | Usage |
|-----------|--------|------|
| dek-v1 | decrypt-only | Old data |
| dek-v2 | active | New writes |
| dek-v3 | future | Not loaded |

The service has:
- **ACTIVE_WRITE_DEK = dek-v2**
- **DECRYPT_KEYRING** containing old + new DEKs (or fetched on-demand)

---

## Detailed Flow

### 1) Write path (always newest key)
When ingesting new data:
1. Use `ACTIVE_WRITE_DEK` (e.g., `dek-v2`) to encrypt.
2. Store `dek_version = dek-v2`.
3. Store a fresh random nonce each time.

**Why this is chosen**
- Ensures all new data is immediately compliant with latest policy.
- Avoids writing more data under old keys during migration.

---

### 2) Read path (dual-read using dek_version)
When reading data:
1. Read the row.
2. Inspect `dek_version`.
3. Load the matching DEK from KMS/HSM (cache allowed).
4. Decrypt using that DEK.

**Why this is chosen**
- Guarantees correctness during migration: any record can be decrypted.
- No need to “guess” which DEK was used.

---

### 3) Background migration (online re-encryption)
Run a **re-encryption worker** (cron / queue consumer) that:
1. Selects a small batch: `WHERE dek_version = dek-v1 LIMIT N`.
2. For each row:
   - decrypt with `dek-v1`,
   - encrypt with `dek-v2` using new random nonce,
   - update row atomically to `dek_version = dek-v2`.
3. Commit frequently (small transactions).

**Operational controls**
- throttle rate (avoid DB/KMS overload),
- backoff on errors,
- emit metrics: % migrated, failures, lag.

---

## Concurrency & correctness

### Avoid races with optimistic update
Update using a conditional predicate:
- `UPDATE ... SET ... WHERE id = ? AND dek_version = 'dek-v1'`
If affected rows = 0, someone else already migrated it.

**Why**
- Prevents double migration and inconsistent writes.

---

## Rollout Plan (safe & reversible)

### Step-by-step
1. **Introduce `dek_version` field + multi-key decrypt** (no behavior change yet).
2. Deploy with both `dek-v1` and `dek-v2` available for decrypt.
3. Flip config: `ACTIVE_WRITE_DEK = dek-v2` (new writes use v2).
4. Start background migration v1 → v2.
5. When migration reaches ~100%:
   - keep v1 for a grace period (weeks),
   - then disable v1 decrypt in code,
   - finally disable v1 in KMS (or keep archived if policy requires).

### Rollback
If v2 causes issues:
- Flip `ACTIVE_WRITE_DEK` back to `dek-v1`.
- Reads still work because `dek_version` tells which key to use.

**Why this approach is chosen**
- It is the standard “online migration” pattern used in large-scale systems.
- Reduces blast radius: only config flip for new writes; migration is gradual.
- Provides a clean audit trail and deterministic correctness.

---

## What about the blind index during DEK rotation?
Blind index uses **HMAC key** (separate from DEK).
- Rotating DEK does NOT require changing blind indexes.
- If you rotate the HMAC key, you must maintain `hmac_version` similarly and query multiple indexes during transition.

---

## Summary (Scenario A)
**Chosen approach:** Key versioning + dual-read + background re-encrypt  
**Why:** zero downtime, correctness for mixed-key data, safe incremental migration, easy rollback.

---

# Scenario B — Data Leak Incident: Decrypted National ID Logged

## Problem
A developer accidentally logged **plaintext National IDs** to cloud logs for the last 24 hours.
This is a security incident because logs typically have:
- broad access (many engineers/ops),
- retention and exports,
- third-party integrations (SIEM, analytics).

## Goals
1. **Stop ongoing leakage** immediately.
2. **Reduce exposure** (access, retention, exports).
3. **Assess scope** (who/what/when/how much).
4. **Remediate**: remove or isolate leaked logs.
5. **Prevent recurrence** with technical controls + process.

---

## Immediate Actions
### Incident Response Flow
![scenario B](/assets/images/scenario-B.drawio.svg)
### 1) Stopping further leakage at the source
- Remove logging statements.
- Disable verbose/debug logging in production via feature flag/config.
- Remove logs from source code and deploy.

### 2) Restrict access to logs
- Tighten IAM on logging resources:
  - remove broad viewer roles,
  - limit access to incident response team only.
- If logs are in multiple projects/accounts, apply across all.

### 3) Block further propagation
- Identify and pause log sinks/exports:
  - CloudWatch subscription filters,
  - Stackdriver exports to BigQuery/GCS,
  - SIEM forwarding.
- Confirm whether logs went to:
  - object storage,
  - analytics warehouse,
  - third-party vendor.


---

## Investigate & Understand impact

### 4) Determine scope precisely
- Time window: start/end of bad logging deployment.
- Which services/versions produced the logs.
- Count impacted entries (approx).
- Identify affected tenants/customers if multi-tenant.

### 5) Audit access
- Check who accessed log dashboards/exports during the window.
- Preserve audit evidence (do not destroy forensic trails).
---

## Remove / isolate leaked data

### 6) Delete or isolate leaked log entries
Options depend on platform:
- If deletion is supported: delete affected log streams.
- If not:
  - export to a quarantined secure store (restricted),
  - shorten retention to minimum allowed,
  - rotate log group / create new group,
  - prevent further reads by locking permissions.

### 7) Notifications & governance
- Engage security + legal + compliance.
- Determine regulatory requirements (breach notification thresholds).
- Inform customers if required by contract or law.

---

## Prevention: Make this not to repeat

## A) Logging Guardrails
### 1) Structured logging + allow-list fields
- Code merge requests needed to be reviewed by others.
- Only log approved fields.
- Forbid raw payload logging.


### 2) Safe Logger wrapper (runtime enforcement)
- Create a shared logger that:
  - redacts keys marked as sensitive (`national_id`, `ssn`, `dob`),
  - rejects log events containing sensitive patterns,
  - hashes identifiers by default.

### 3) CI checks / lint rules (shift-left)
- Static scanning to block:
  - `logger.*(national_id)` patterns,
  - `print(payload)` in sensitive code paths,
  - structured schema containing PII fields in logs.
- Unit tests for “no plaintext PII in logs”.

---

## B) DLP for Logs
### 4) DLP scanning on log ingestion or sink
- Cloud DLP / regex detectors scanning logs.
- Auto-alert and auto-quarantine on match.

---

## C) Access & Retention Hardening (reduce blast radius)
### 5) Least privilege + separate environments
- Only a small group can view prod logs.
- Use separate projects/accounts per env.
- Ensure contractors/vendors cannot access sensitive logs.

### 6) Short retention for sensitive systems
- Reduce retention duration for services processing PII.
- Disable “export everything” sinks by default.
---

## Summary 
**Chosen approach:** Contain first (stop source + restrict access), then scope (audit + exports), then remediate (delete/isolate), then prevent (safe logging + CI rules + DLP + IAM/retention).  
**Why:** It minimizes immediate harm quickly and adds layered controls so the same class of failure becomes unlikely.

---
