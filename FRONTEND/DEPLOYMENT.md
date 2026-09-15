# Deployment blueprint

## Frontend

Build with `npm run build`. Serve the Vite output from any static host.

Set:

- `VITE_API_BASE_URL`
- `VITE_MAPTILER_KEY`
- `VITE_FIREBASE_*`
- optional `VITE_BHUVAN_WMS_*`
- optional `VITE_GSI_WMS_*`

## API

Build with `npm run server:build` and start with `npm run server:start`.

Set:

- `CORS_ORIGIN` to the exact frontend origin(s)
- Firebase Admin credentials through workload identity or `GOOGLE_APPLICATION_CREDENTIALS`
- IMD credential material issued to the deployment
- an approved SACHET CAP/RSS feed
- a state/UT SDMA JSON/GeoJSON feed where available
- authoritative vulnerability and relief GIS feeds

## Firebase

1. Enable Google sign-in.
2. Create Firestore.
3. Deploy `firestore.rules`.
4. Give only designated authority accounts the admin custom claim using `npm run admin:set -- person@example.gov.in`.
5. Use a separate production Firebase project from development.

## Production hardening

Use HTTPS, workload identity rather than service-account files when supported, secret management, centralized logging, database backups, rate-limit telemetry, App Check, object-storage malware scanning, and a PostGIS-backed spatial service for large layers.

Do not use the prototype relief records as operational shelter data.
