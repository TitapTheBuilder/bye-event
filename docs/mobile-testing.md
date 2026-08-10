# Testing the exhibitor PWA on a phone

Mobile browsers allow camera access and service workers only in a **secure context**. `http://localhost` is a special development exception, but `http://<PC-LAN-IP>:3000` is not. Production session cookies are also intentionally `Secure`, so a production build served over LAN HTTP cannot stay signed in.

Do not disable `Secure` cookies to work around this. Use trusted HTTPS.

## Trusted LAN certificate with mkcert

1. Install [mkcert](https://github.com/FiloSottile/mkcert) on the development PC and run:

   ```sh
   mkcert -install
   ```

2. Find the PC's LAN IP (for example, `192.168.1.25`). Create the app certificate directory and generate a certificate containing that exact IP:

   ```sh
   mkdir -p apps/exhibitor/.certs
   mkcert -key-file apps/exhibitor/.certs/lan-key.pem -cert-file apps/exhibitor/.certs/lan-cert.pem 192.168.1.25 localhost 127.0.0.1
   ```

   Replace `192.168.1.25` with the PC's current LAN IP.

3. Run `mkcert -CAROOT`, copy that directory's `rootCA.pem` to the phone, and install it as a trusted root certificate. The exact trust-certificate screen differs between Android and iOS.

4. Start the exhibitor app from the repository root:

   ```sh
   pnpm --filter @repo/exhibitor dev:mobile
   ```

5. On the phone, open the HTTPS URL matching the certificate, for example:

   ```text
   https://192.168.1.25:3000
   ```

The phone and PC must be on the same network, and the PC firewall must allow inbound TCP port `3000`.

## Admin and uploaded logos

`event_settings.logo_url` is stored origin-relative (`/uploads/logos/<file>`) and each app serves the file itself from its own `/uploads/[...path]` route, so the logo resolves against whatever host the browser is on — phone, LAN IP, or production domain — with no extra configuration and no mixed-content risk.

What both apps DO need is the same uploads directory: set `UPLOADS_DIR` to a shared location for both (in `docker-compose.yml` this is the `uploads-data` volume; for local dev `apps/exhibitor/.uploads` is a symlink to `apps/admin/.uploads`). If the exhibitor app can't see the admin's uploads, the logo 404s.

## Reverse-proxy deployments

For staging/production, terminate TLS with Caddy, Nginx, or another reverse proxy and preserve the external `Host` header. Keep the application APIs same-origin; the current client already uses relative `/api/...` URLs and does not require CORS.
