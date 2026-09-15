<img width="1899" height="1052" alt="Rakshamap-desktop" src="https://github.com/user-attachments/assets/f947ca38-fdf9-4843-b153-edfb0349d8d2" />
## >> run guide: 

```bash
npm run install:all
```

Copy `.env.example` to `.env` and fill your keys.

Run:

```bash
npm run dev
```

Client: `http://localhost:5173`

API: `http://localhost:8787`

### Firebase Google authentication

Enable:

`Firebase Console → Authentication → Sign-in method → Google`

Add your development and production authorised domains.

The UI requires Google sign-in before a contribution can be submitted.

### Firebase Admin credentials

Preferred server deployment:

```text
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/service-account.json
```

Alternative for platforms that only provide environment variables:

```text
GOOGLE_SERVICE_ACCOUNT_JSON_B64=<base64 service-account-json>
```

The backend verifies the Firebase ID token. It does not trust an `admin` field sent from the browser.

### Give an authority account admin role

```bash
npm run admin:set -- authority@example.gov.in
```

Then have that account sign out/sign back in (or refresh its ID token). Backend moderation routes validate the `admin` / `role=admin` custom claim.

### IMD credential configuration

The exact authentication material is intentionally not guessed. Use the header/value issued to your authorised application:

```env
IMD_AUTH_HEADER_NAME=Authorization
IMD_AUTH_HEADER_VALUE=Bearer YOUR_ISSUED_VALUE
```

or:

```env
IMD_API_TOKEN=YOUR_ISSUED_VALUE
IMD_AUTH_HEADER_NAME=Authorization
```

### NDMA / SACHET

Configure an approved feed URL:

```env
SACHET_CAP_FEED_URL=https://sachet.ndma.gov.in/cap_public_website/FetchXMLFile?identifier=YOUR_IDENTIFIER
```

The adapter handles XML parsing and is designed for ETag-aware caching. Do not guess the identifier; use the feed identifier issued/visible for the integration you are authorised to consume.

### Bhuvan

```env
VITE_BHUVAN_WMS_URL=https://bhuvan-vec2.nrsc.gov.in/bhuvan/wms
VITE_BHUVAN_WMS_LAYERS=THE_LAYER_NAME_FROM_BHUVAN_METADATA
BHUVAN_WMS_CONFIGURED=true
```

The project does not hard-code an unknown layer name because Bhuvan exposes multiple thematic layers.

### GSI

Add the approved OGC service and layer name provided to your deployment:

```env
VITE_GSI_WMS_URL=https://...
VITE_GSI_WMS_LAYERS=...
GSI_WMS_CONFIGURED=true
```

### State / UT SDMA

```env
SDMA_FEED_URL=https://your-state-sdma.example/api/alerts
SDMA_STATE=Your State / UT SDMA
```

The adapter accepts alert arrays or GeoJSON FeatureCollections and labels every item as an official authority feed.

### Population/vulnerability

```env
VULNERABILITY_GEOJSON_URL=https://your-authority-host.example/vulnerability.geojson
```

### Official relief registry

```env
RELIEF_SITES_GEOJSON_URL=https://your-authority-host.example/relief-sites.geojson
```
