# Production Deployment & Operational Runbook

This document serves as the operational guide and incident runbook for the Exhibition Visitor-Scanning Platform. It supplements the `production-security-checklist.md` by providing the required human/operational procedures that cannot be autoped in the repository.

## 1. Infrastructure Specifications

### 1.1 Network and Proxies
- **Topology:** The production environment must run the `compose.production.yml` topology behind a host/cloud firewall.
- **Exposure:** Only port `80` (HTTP, which Caddy redirects to HTTPS) and `443` (HTTPS) should be exposed to the public internet.
- **Admin Panel Access:** The Admin Panel domain (`ADMIN_DOMAIN`) must be placed behind a VPN, Identity-Aware Proxy (IAP), or restricted IP allowlist. **Exception:** Phishing-resistant MFA is currently scheduled for Q4; the network-level access control acts as the compensating control.
- **Database:** The Postgres instance must reside in a private subnet. The `exhibitor` and `admin` containers should connect via TLS if Postgres is hosted externally.

### 1.2 Secrets Management
- Ensure `EXHIBITOR_SESSION_SECRET` and `ADMIN_SESSION_SECRET` are generated independently and are cryptographically random (at least 32 bytes).
- Do not store secrets in `.env` files in production. Use a secret manager (AWS Secrets Manager, HashiCorp Vault, or Docker Swarm Secrets) to inject them into the containers at runtime.
- The startup routines in `proxy.ts` will intentionally fail (`throw new Error`) if secrets are missing, too short, or equal to development defaults.

## 2. Backup & Restore Drill

A restore drill must be executed periodically to prove the Recovery Time Objective (RTO) and Recovery Point Objective (RPO).

### 2.1 Performing a Backup
Run the following command against the production Postgres instance:
```bash
pg_dump -h <db-host> -U postgres -F c -f backup_$(date +%F).dump <dbname>
```
Store this dump in an encrypted, offsite bucket (e.g., AWS S3 with KMS encryption) with a strict retention lifecycle (e.g., deleted after 30 days to comply with PII retention policies).

### 2.2 Restore Drill Procedure
To restore the backup into a new/test environment:
1. Provision a fresh Postgres instance.
2. Run the `migrate` container from `compose.production.yml` to lay down the base schema.
3. Apply the backup:
```bash
pg_restore -h <new-db-host> -U postgres -d <dbname> -1 backup_$(date +%F).dump
```
4. Start the `admin` and `exhibitor` containers.
5. **Verification:** Log in to the Admin Panel and verify that `Visitor.qr_token` and `(exhibitor_id, visitor_id)` uniqueness constraints remain intact by attempting to re-import a known CSV.

## 3. Incident Readiness & Runbooks

### 3.1 Stolen Admin Credentials or Leaked Admin Session
1. **Revoke Session:** Immediately delete or disable the Admin account in the database (or via another trusted Admin). The `proxy.ts` middleware verifies the account status on every request and will instantly block the compromised session.
2. **Rotate Keys:** If the `ADMIN_SESSION_SECRET` is suspected to be leaked, rotate the secret in the secret manager and restart the `admin` container. This will invalidate ALL current admin sessions.
3. **Audit:** Review the Admin audit logs (or database application logs) to identify any bulk exports or visitor modifications performed during the compromised window.

### 3.2 Malicious Upload or Content Bomb
- **Mitigation:** The application strictly decodes and re-encodes images via `jimp`/`sharp`, rejecting SVG/polyglot files and oversized payloads.
- **Response:** If an upload bypasses this (e.g., zero-day in image parser), immediately clear the `uploads-data` Docker volume, disable the branding endpoint via reverse proxy, and restart the containers. 

### 3.3 Lost Exhibitor Device
1. **Deactivate Exhibitor:** An Admin must immediately deactivate the Exhibitor account via the Admin Panel.
2. **Impact:** The `proxy.ts` middleware checks Exhibitor status. The lost device will be immediately logged out upon its next network request.
3. **Data Exposure:** Any scans pending in the offline outbox (IndexedDB) on the lost device remain on the device. However, they cannot be synced to the server. If the device was stolen, physical device encryption (e.g., iOS Data Protection) is the primary defense for the at-rest IndexedDB data.

## 4. Final Security Decision & Exceptions

### Active Exceptions
- **[P1] Admin MFA:** Phishing-resistant MFA is not yet implemented. 
  - *Compensating Control:* The Admin Panel is restricted by network-level controls (VPN/Allowlist).
  - *Expiry:* Q4 Release.
- **[P1] Six-Digit Code Rate Limiting:** Unlimited retries are allowed for the six-digit manual code.
  - *Compensating Control:* Product owner accepted the risk. Unusual volume is monitored but not blocked to prevent DoS on the show floor.

### Launch Approval
Before exposing the Exhibitor PWA to the public internet, the Release Owner and Security Reviewer must execute the Staging verification tests (Section 12 of the checklist) on the actual deployment infrastructure and sign the release record.
