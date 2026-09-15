# RakshaMap API contract

## Public

`GET /api/health`

Returns service status.

`GET /api/dashboard`

Returns the fused operational dashboard: monitored cells, alerts, source health, official-coverage flags, earthquakes, weather snapshots, relief sites and metrics.

`GET /api/weather?lat=<lat>&lon=<lon>`

Returns a forecast snapshot for a requested point.

`GET /api/approved-sites`

Returns verified official sites plus authority-approved community sites.

## Google-authenticated

Send:

```http
Authorization: Bearer <Firebase ID token>
```

`POST /api/contributions`

Example body:

```json
{
  "type": "relief_centre",
  "name": "Community relief centre",
  "description": "Concrete school building usable as temporary shelter with toilets and water.",
  "lat": 31.1048,
  "lon": 77.1734,
  "capacity": 1500,
  "medical": true,
  "water": true,
  "power": true,
  "accessibility": true
}
```

Submissions are server-stamped and created as `pending`.

`GET /api/contributions/mine`

Returns the signed-in user's submissions.

## Authority-admin

Requires the Firebase custom claim `admin=true` or `role=admin`.

`GET /api/admin/summary`

`GET /api/admin/contributions?status=pending`

`POST /api/admin/contributions/:id/status`

Body:

```json
{"status":"approved","moderationNote":"Verified against district control room record."}
```

Every moderation action is written to `moderation_audit`.
