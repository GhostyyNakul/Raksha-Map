import { XMLParser } from 'fast-xml-parser'
import { INDIA_POINTS } from './data.js'
import { computeRisk } from './risk.js'
import type { Alert, HazardPoint, ReliefSite, SourceHealth } from './types.js'

const env = process.env
const OPEN_METEO = env.OPEN_METEO_URL || 'https://api.open-meteo.com/v1/forecast'
const USGS = env.USGS_ALL_DAY_URL || 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson'
const EONET = env.NASA_EONET_URL || 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=90'
const IMD_BASE = env.IMD_API_BASE_URL || 'https://api.imd.gov.in/api/v1'
const IMD_HEADER = env.IMD_AUTH_HEADER_NAME || 'Authorization'
const IMD_VALUE = env.IMD_AUTH_HEADER_VALUE || (env.IMD_API_TOKEN ? `Bearer ${env.IMD_API_TOKEN}` : '')
const CAP_URL = env.SACHET_CAP_FEED_URL || ''
const RSS_URL = env.SACHET_RSS_URL || ''
const VULN_URL = env.VULNERABILITY_GEOJSON_URL || ''
const RELIEF_URL = env.RELIEF_SITES_GEOJSON_URL || ''
const SDMA_URL = env.SDMA_FEED_URL || ''
const SDMA_HEADER = env.SDMA_FEED_AUTH_HEADER_NAME || ''
const SDMA_VALUE = env.SDMA_FEED_AUTH_HEADER_VALUE || ''
const SDMA_STATE = env.SDMA_STATE || 'State / UT SDMA'
const GSI_INVENTORY_URL = env.GSI_INVENTORY_GEOJSON_URL || ''

let cache: { expires: number; data: any } | null = null
let ndmaEtag: string | undefined
let ndmaXml: string | undefined
const sourceStatus = new Map<string, SourceHealth>()

async function timedFetch(url: string, init: RequestInit = {}, timeout = Number(env.REQUEST_TIMEOUT_MS || 12000)) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeout)
  const started = Date.now()
  try { const r = await fetch(url, { ...init, signal: controller.signal, headers: { 'user-agent': 'RakshaMap/2.0 SIH disaster decision support', ...(init.headers || {}) } }); const latency = Date.now() - started; if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return { response: r, latency } }
  finally { clearTimeout(timer) }
}
function setSource(s: SourceHealth) { sourceStatus.set(s.id, s) }
function baseSource(id: string, name: string, authority: string, official: boolean, url: string): SourceHealth { return { id, name, authority, official, url, status: 'optional', updatedAt: null, detail: '' } }

const sources = [
  baseSource('imd', 'India Meteorological Department API', 'Ministry of Earth Sciences', true, 'https://api.imd.gov.in/public/api_reference.html'),
  baseSource('ndma', 'NDMA SACHET CAP / RSS', 'National Disaster Management Authority', true, 'https://sachet.ndma.gov.in/CapFeed'),
  baseSource('sdma', 'State / UT SDMA feed', 'State / UT Disaster Management Authority', true, SDMA_URL || 'https://sachet.ndma.gov.in/'),
  baseSource('usgs', 'USGS Earthquake Feed', 'U.S. Geological Survey', true, 'https://earthquake.usgs.gov/earthquakes/feed/'),
  baseSource('openmeteo', 'Open-Meteo Forecast', 'Open weather model service', false, 'https://open-meteo.com/'),
  baseSource('eonet', 'NASA EONET', 'NASA', true, 'https://eonet.gsfc.nasa.gov/'),
  baseSource('bhuvan', 'Bhuvan Thematic GIS', 'ISRO / NRSC', true, 'https://bhuvan-app1.nrsc.gov.in/2dresources/bhuvanstore.php'),
  baseSource('gsi', 'GSI Landslide Intelligence', 'Geological Survey of India', true, 'https://bhusanket.gsi.gov.in/'),
  baseSource('vulnerability', 'Vulnerability / population layer', 'Deployment authority', true, VULN_URL || 'https://data.gov.in/'),
  baseSource('relief', 'Official relief registry', 'Deployment authority', true, RELIEF_URL || '')
]
const sourceById = Object.fromEntries(sources.map(s => [s.id, s])) as Record<string, SourceHealth> & {
  imd: SourceHealth; ndma: SourceHealth; sdma: SourceHealth; usgs: SourceHealth; openmeteo: SourceHealth; eonet: SourceHealth;
  bhuvan: SourceHealth; gsi: SourceHealth; vulnerability: SourceHealth; relief: SourceHealth
}

async function fetchWeather(lat: number, lon: number) {
  const qs = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: 'precipitation,wind_speed_10m,temperature_2m,relative_humidity_2m',
    current: 'temperature_2m,wind_speed_10m,relative_humidity_2m,precipitation,weather_code',
    forecast_days: '4',
    timezone: 'auto'
  })

  const { response } = await timedFetch(`${OPEN_METEO}?${qs}`)
  const d: any = await response.json()

  return parseWeatherData(d)
}

function parseWeatherData(d: any) {
  const p = Array.isArray(d.hourly?.precipitation)
    ? d.hourly.precipitation.map(Number)
    : []

  const w = Array.isArray(d.hourly?.wind_speed_10m)
    ? d.hourly.wind_speed_10m.map(Number)
    : []

  return {
    precipitationMm24h: p
      .slice(0, 24)
      .reduce((a: number, b: number) => a + (b || 0), 0),

    precipitationMm72h: p
      .slice(0, 72)
      .reduce((a: number, b: number) => a + (b || 0), 0),

    windKmh: Number(
      d.current?.wind_speed_10m ??
      Math.max(...w.slice(0, 24), 0)
    ),

    tempC: Number(d.current?.temperature_2m ?? 0),

    humidityPct: Number(
      d.current?.relative_humidity_2m ?? 0
    ),

    elevationM: Number(d.elevation ?? 0),

    weatherCode: Number(d.current?.weather_code ?? 0)
  }
}
async function fetchEarthquakes() {
  const { response, latency } = await timedFetch(USGS); const d: any = await response.json(); setSource({ ...sourceById.usgs, status: 'live', updatedAt: new Date().toISOString(), latencyMs: latency, detail: 'USGS all-day earthquake feed connected.' }); return (d.features ?? []).map((f: any) => ({ id: String(f.id), lat: Number(f.geometry?.coordinates?.[1]), lon: Number(f.geometry?.coordinates?.[0]), magnitude: Number(f.properties?.mag ?? 0), place: String(f.properties?.place ?? 'Unknown'), time: new Date(Number(f.properties?.time ?? 0)).toISOString() })).filter((q: any) => q.lat >= 5 && q.lat <= 38 && q.lon >= 67 && q.lon <= 100)
}
async function fetchEonet() {
  const { response, latency } = await timedFetch(EONET); const d: any = await response.json(); setSource({ ...sourceById.eonet, status: 'live', updatedAt: new Date().toISOString(), latencyMs: latency, detail: 'NASA EONET open-event feed connected.' }); return (d.events ?? []).map((e: any) => { const g = e.geometry?.[e.geometry.length - 1]; const [lon, lat] = g?.coordinates ?? []; return { id: String(e.id), title: String(e.title ?? 'Event'), category: String(e.categories?.[0]?.title ?? 'Hazard'), lat: Number(lat), lon: Number(lon), date: g?.date ?? new Date().toISOString() } }).filter((e: any) => Number.isFinite(e.lat) && e.lat >= 5 && e.lat <= 38 && e.lon >= 67 && e.lon <= 100)
}

function normaliseDistrict(v: string) { return v.toLowerCase().replace(/district|\s|[-_]/g, '') }
async function fetchImdWarnings() {
  if (!IMD_VALUE) { setSource({ ...sourceById.imd, status: 'auth-required', detail: 'IMD exposes the required district-warning API, but this deployment has no authorised credential configured.' }); return [] }
  try { const headers: Record<string, string> = { [IMD_HEADER]: IMD_VALUE }; const { response, latency } = await timedFetch(`${IMD_BASE}/districtwarning`, { headers }); const d: any = await response.json(); const rows = d.data ?? d ?? []; setSource({ ...sourceById.imd, status: 'live', updatedAt: new Date().toISOString(), latencyMs: latency, detail: `District-wise warning API connected (${rows.length} records observed).` }); return Array.isArray(rows) ? rows : [] }
  catch (e) { setSource({ ...sourceById.imd, status: 'error', updatedAt: new Date().toISOString(), detail: `IMD adapter error: ${e instanceof Error ? e.message : 'request failed'}` }); return [] }
}

function parseCapXml(xml: string) {
  try {
    const p = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true }); const d: any = p.parse(xml); const alerts = Array.isArray(d?.alert) ? d.alert : [d?.alert].filter(Boolean)
    return alerts.map((a: any) => { const info = Array.isArray(a.info) ? a.info[0] : a.info || {}; const area = Array.isArray(info.area) ? info.area[0] : info.area || {}; const circle = String(area.circle ?? ''); const [first] = circle.split(';'); const nums = first.replaceAll(',', ' ').split(/\s+/).map(Number); const [lat, lon, radius] = nums; const ev = String(info.event ?? 'Multi-hazard alert'); const sev = String(info.severity ?? 'Moderate').toLowerCase(); const severity: any = sev.includes('extreme') || sev.includes('severe') ? 'critical' : sev.includes('moderate') ? 'medium' : 'low'; return { id: String(a.identifier ?? Math.random()), title: ev, severity, region: String(area.areaDesc ?? 'India'), lat: lat || 22.59, lon: lon || 78.96, radiusKm: Number(radius || 0), timestamp: String(a.sent ?? new Date().toISOString()), source: 'NDMA SACHET', official: true, details: String(info.headline ?? info.description ?? 'Official CAP alert'), link: 'https://sachet.ndma.gov.in/' } })
  } catch { return [] }
}
function parseRssXml(xml: string) {
  try { const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true }); const d: any = parser.parse(xml); const channel = d?.rss?.channel ?? d?.channel ?? {}; const items = Array.isArray(channel.item) ? channel.item : [channel.item].filter(Boolean); return items.map((item: any) => { const point = String(item['point'] ?? item['georss:point'] ?? item.georss?.point ?? '').trim().split(/\s+/).map(Number); const lat = point[0], lon = point[1]; return { id: String(item.guid ?? item.id ?? crypto.randomUUID()), title: String(item.title ?? 'NDMA alert'), severity: 'medium', region: String(item.category ?? 'India'), lat: Number.isFinite(lat) ? lat : 22.5937, lon: Number.isFinite(lon) ? lon : 78.9629, timestamp: new Date(item.pubDate ?? Date.now()).toISOString(), source: 'NDMA SACHET RSS', official: true, details: String(item.description ?? 'Official NDMA/SACHET RSS item'), link: 'https://sachet.ndma.gov.in/' } }) } catch { return [] }
}
async function fetchNdma() {
  if (!CAP_URL && !RSS_URL) { setSource({ ...sourceById.ndma, status: 'configured', detail: 'SACHET adapter is ready. Configure an approved CAP XML or RSS feed URL for agency consumption.', updatedAt: null }); return [] }
  const url = CAP_URL || RSS_URL
  try {
    const started = Date.now(); const headers: Record<string, string> = { accept: 'application/xml,text/xml,application/rss+xml' }; if (ndmaEtag) headers['If-None-Match'] = ndmaEtag
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(Number(env.REQUEST_TIMEOUT_MS || 12000)) }); const latency = Date.now() - started
    if (r.status === 304 && ndmaXml) { setSource({ ...sourceById.ndma, status: 'live', updatedAt: new Date().toISOString(), latencyMs: latency, detail: 'SACHET feed unchanged (ETag 304); serving cached CAP/RSS XML.' }); return CAP_URL ? parseCapXml(ndmaXml) : parseRssXml(ndmaXml) }
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
    const text = await r.text(); ndmaXml = text; ndmaEtag = r.headers.get('etag') || undefined
    setSource({ ...sourceById.ndma, status: 'live', updatedAt: new Date().toISOString(), latencyMs: latency, detail: ndmaEtag ? 'SACHET feed connected with ETag caching.' : 'SACHET feed connected.' })
    return CAP_URL ? parseCapXml(text) : parseRssXml(text)
  } catch (e) { setSource({ ...sourceById.ndma, status: 'error', updatedAt: new Date().toISOString(), detail: `SACHET adapter error: ${e instanceof Error ? e.message : 'request failed'}` }); return [] }
}


function severityFromValue(v: any): 'low' | 'medium' | 'high' | 'critical' {
  const s = String(v ?? 'medium').toLowerCase();
  if (s.includes('extreme') || s.includes('critical')) return 'critical';
  if (s.includes('severe') || s.includes('high')) return 'high';
  if (s.includes('moderate') || s.includes('medium')) return 'medium';
  return 'low';
}
function parseSdmaJson(payload: any): Alert[] {
  const rows = Array.isArray(payload) ? payload : (Array.isArray(payload?.alerts) ? payload.alerts : (Array.isArray(payload?.features) ? payload.features : []));
  return rows.map((row: any, idx: number) => {
    const props = row?.properties ?? row ?? {};
    const coords = row?.geometry?.coordinates;
    let lat = Number(props.lat ?? props.latitude ?? (Array.isArray(coords) ? coords[1] : NaN));
    let lon = Number(props.lon ?? props.lng ?? props.longitude ?? (Array.isArray(coords) ? coords[0] : NaN));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) { lat = 22.5937; lon = 78.9629 }
    return {
      id: String(props.id ?? row.id ?? `sdma-${idx}-${Date.now()}`),
      type: String(props.type ?? props.hazard ?? props.category ?? 'multi').toLowerCase().includes('flood') ? 'flood' : String(props.type ?? props.hazard ?? props.category ?? '').toLowerCase().includes('landslide') ? 'landslide' : String(props.type ?? props.hazard ?? props.category ?? '').toLowerCase().includes('cyclone') ? 'cyclone' : String(props.type ?? props.hazard ?? props.category ?? '').toLowerCase().includes('earthquake') ? 'earthquake' : String(props.type ?? props.hazard ?? props.category ?? '').toLowerCase().includes('heat') ? 'heat' : 'multi',
      title: String(props.title ?? props.headline ?? props.event ?? props.name ?? 'State / UT disaster alert'),
      severity: severityFromValue(props.severity ?? props.level),
      region: String(props.region ?? props.area ?? props.district ?? SDMA_STATE),
      district: props.district ? String(props.district) : undefined,
      details: String(props.description ?? props.details ?? props.instruction ?? 'Official state / UT disaster-management alert.'),
      lat, lon, timestamp: new Date(props.timestamp ?? props.sent ?? props.updatedAt ?? Date.now()).toISOString(),
      validUntil: props.validUntil ? new Date(props.validUntil).toISOString() : undefined,
      source: SDMA_STATE, authority: SDMA_STATE, official: true,
      link: props.link ? String(props.link) : undefined
    } as Alert;
  }).filter((a: { lat: number; lon: number }) => a.lat >= 5 && a.lat <= 38 && a.lon >= 67 && a.lon <= 100)
}
async function fetchSdma() {
  if (!SDMA_URL) { setSource({ ...sourceById.sdma, status: 'configured', updatedAt: null, detail: 'State/UT SDMA adapter ready. Configure an authority-approved JSON/GeoJSON feed; no statewide endpoint is invented.' }); return [] }
  try {
    const headers: Record<string, string> = { accept: 'application/json,application/geo+json' };
    if (SDMA_HEADER && SDMA_VALUE) headers[SDMA_HEADER] = SDMA_VALUE;
    const { response, latency } = await timedFetch(SDMA_URL, { headers });
    const payload = await response.json(); const alerts = parseSdmaJson(payload);
    setSource({ ...sourceById.sdma, status: 'live', updatedAt: new Date().toISOString(), latencyMs: latency, detail: `${SDMA_STATE} feed connected (${alerts.length} alerts observed).` });
    return alerts;
  } catch (e) { setSource({ ...sourceById.sdma, status: 'error', updatedAt: new Date().toISOString(), detail: `${SDMA_STATE} adapter error: ${e instanceof Error ? e.message : 'request failed'}` }); return [] }
}

async function fetchGeoJson(url: string) { const { response } = await timedFetch(url); return response.json() as Promise<any> }
function vulnForPoint(features: any[], lat: number, lon: number) { let best: any = null, bestDist = 1e9; for (const f of features) { const g = f.geometry; let p = g?.type === 'Point' ? g.coordinates : null; if (!p) continue; const d = Math.hypot(Number(p[1]) - lat, (Number(p[0]) - lon) * Math.cos(lat * Math.PI / 180)); if (d < bestDist) { bestDist = d; best = f } } if (!best || bestDist > .65) return null; const pr = best.properties || {}; const vulnerability = Number(pr.vulnerability_score ?? pr.vulnerability ?? pr.risk ?? pr.index ?? 50); const exposure = Number(pr.population_exposure ?? pr.population ?? pr.people_at_risk ?? 0); return { vulnerability: Math.max(0, Math.min(100, Number.isFinite(vulnerability) ? vulnerability : 50)), exposure: Number.isFinite(exposure) ? exposure : 0 } }
function asBool(v: any) { return v === true || v === 1 || String(v ?? '').toLowerCase() === 'true' || String(v ?? '').toLowerCase() === 'yes' }
function parseRelief(json: any): ReliefSite[] {
  return (json?.features ?? []).map((f: any) => {
    const [lon, lat] = f.geometry?.coordinates ?? []; const p = f.properties || {}
    return { id: String(p.id ?? f.id ?? crypto.randomUUID()), name: String(p.name ?? p.title ?? 'Official relief site'), type: (String(p.type ?? 'shelter').toLowerCase().includes('hospital') ? 'hospital' : String(p.type ?? '').toLowerCase().includes('relief') ? 'relief_centre' : 'shelter') as any, lat: Number(lat), lon: Number(lon), capacity: Math.max(0, Number(p.capacity ?? 0)), occupied: Math.max(0, Number(p.occupied ?? 0)), beds: Math.max(0, Number(p.beds ?? 0)), water: asBool(p.water), power: asBool(p.power), medical: asBool(p.medical), accessibility: asBool(p.accessibility), hazardScore: Math.max(0, Math.min(100, Number(p.hazard_score ?? p.hazardScore ?? 0))), source: 'official', status: 'verified', state: String(p.state ?? ''), district: String(p.district ?? '') }
  }).filter((s: any) => Number.isFinite(s.lat) && Number.isFinite(s.lon) && s.lat >= 6 && s.lat <= 38 && s.lon >= 68 && s.lon <= 98)
}
function parseGsiInventory(json: any) {
  return (json?.features ?? []).filter((f: any) => { const [lon, lat] = f.geometry?.coordinates ?? []; return Number.isFinite(Number(lat)) && Number.isFinite(Number(lon)) && Number(lat) >= 5 && Number(lat) <= 38 && Number(lon) >= 67 && Number(lon) <= 100 }).map((f: any) => { const p = f.properties || {}; const [lon, lat] = f.geometry.coordinates; return { id: String(p.id ?? f.id ?? crypto.randomUUID()), lat: Number(lat), lon: Number(lon), title: String(p.name ?? p.title ?? p.event ?? 'GSI landslide inventory'), date: String(p.date ?? p.event_date ?? p.updatedAt ?? new Date().toISOString()) } })
}

export async function getDashboard() {
  if (cache && cache.expires > Date.now()) return cache.data
  sources.forEach(s => setSource({ ...s }))
  const [earthquakes, eonet, imd, ndma, sdma] = await Promise.all([fetchEarthquakes().catch(e => { setSource({ ...sourceById.usgs, status: 'error', updatedAt: new Date().toISOString(), detail: `USGS: ${e instanceof Error ? e.message : 'failed'}` }); return [] }), fetchEonet().catch(e => { setSource({ ...sourceById.eonet, status: 'error', updatedAt: new Date().toISOString(), detail: `NASA EONET: ${e instanceof Error ? e.message : 'failed'}` }); return [] }), fetchImdWarnings(), fetchNdma(), fetchSdma()])

  let vulnFeatures: any[] = []; if (VULN_URL) { try { const j = await fetchGeoJson(VULN_URL); vulnFeatures = j.features ?? []; setSource({ ...sourceById.vulnerability, status: 'live', updatedAt: new Date().toISOString(), detail: `Configured vulnerability layer connected (${vulnFeatures.length} features).` }) } catch (e) { setSource({ ...sourceById.vulnerability, status: 'error', updatedAt: new Date().toISOString(), detail: `Vulnerability layer: ${e instanceof Error ? e.message : 'failed'}` }) } } else setSource({ ...sourceById.vulnerability, status: 'configured', detail: 'Ready for an approved population/vulnerability GeoJSON service from the deployment authority.' })
  let relief: ReliefSite[] = []; if (RELIEF_URL) { try { relief = parseRelief(await fetchGeoJson(RELIEF_URL)); setSource({ ...sourceById.relief, status: 'live', updatedAt: new Date().toISOString(), detail: `Official relief registry connected (${relief.length} sites).` }) } catch (e) { setSource({ ...sourceById.relief, status: 'error', updatedAt: new Date().toISOString(), detail: `Relief registry: ${e instanceof Error ? e.message : 'failed'}` }) } } else setSource({ ...sourceById.relief, status: 'configured', detail: 'Ready for an approved official shelter/relief registry GeoJSON feed.' })
  setSource({ ...sourceById.bhuvan, status: env.BHUVAN_WMS_CONFIGURED === 'true' ? 'configured' : 'optional', detail: env.BHUVAN_WMS_CONFIGURED === 'true' ? 'Bhuvan WMS/WMTS layer is configured for the client map.' : 'Client-side Bhuvan WMS is supported; set VITE_BHUVAN_WMS_URL and VITE_BHUVAN_WMS_LAYERS.' })
  setSource({ ...sourceById.gsi, status: env.GSI_WMS_CONFIGURED === 'true' ? 'configured' : 'optional', detail: env.GSI_WMS_CONFIGURED === 'true' ? 'Approved GSI OGC layer is configured.' : 'GSI landslide portal is integrated as an authoritative source registry; add an approved OGC service or GeoJSON for direct overlay.' })
  let gsiInventory: any[] = []
  if (GSI_INVENTORY_URL) {
    try { const j = await fetchGeoJson(GSI_INVENTORY_URL); gsiInventory = parseGsiInventory(j); setSource({ ...sourceById.gsi, status: 'live', updatedAt: new Date().toISOString(), detail: `GSI landslide inventory connected (${gsiInventory.length} features).` }) }
    catch (e) { setSource({ ...sourceById.gsi, status: 'error', updatedAt: new Date().toISOString(), detail: `GSI inventory: ${e instanceof Error ? e.message : 'failed'}` }) }
  }
  const weatherResults: PromiseSettledResult<{
    p: typeof INDIA_POINTS[number]
    weather: ReturnType<typeof parseWeatherData>
  }>[] = []

  const fallbackWeather = {
    precipitationMm24h: 0,
    precipitationMm72h: 0,
    windKmh: 0,
    tempC: 25,
    humidityPct: 50,
    elevationM: 0,
    weatherCode: 0
  }

  try {
    const latitudes = INDIA_POINTS.map(p => p.lat).join(',')
    const longitudes = INDIA_POINTS.map(p => p.lon).join(',')

    const qs = new URLSearchParams({
      latitude: latitudes,
      longitude: longitudes,
      hourly: 'precipitation,wind_speed_10m,temperature_2m,relative_humidity_2m',
      current: 'temperature_2m,wind_speed_10m,relative_humidity_2m,precipitation,weather_code',
      forecast_days: '4',
      timezone: 'auto'
    })

    const { response, latency } = await timedFetch(
      `${OPEN_METEO}?${qs}`
    )

    const raw = await response.json()
    const weatherData = Array.isArray(raw) ? raw : [raw]

    INDIA_POINTS.forEach((p, index) => {
      const d = weatherData[index]

      weatherResults.push({
        status: 'fulfilled',
        value: {
          p,
          weather: d ? parseWeatherData(d) : fallbackWeather
        }
      })
    })

    const successfulWeather = weatherResults.filter(
      x => x.status === 'fulfilled'
    ).length

    setSource({
      ...sourceById.openmeteo,
      status: 'live',
      updatedAt: new Date().toISOString(),
      latencyMs: latency,
      detail: `Open-Meteo batch forecast connected for ${successfulWeather}/${INDIA_POINTS.length} monitored cells.`
    })

  } catch (e) {

    console.error('Open-Meteo batch request failed:', e)

    // Keep all monitored cells available even if Open-Meteo fails.
    INDIA_POINTS.forEach(p => {
      weatherResults.push({
        status: 'fulfilled',
        value: {
          p,
          weather: fallbackWeather
        }
      })
    })

    setSource({
      ...sourceById.openmeteo,
      status: 'error',
      updatedAt: new Date().toISOString(),
      detail: `Open-Meteo unavailable (${e instanceof Error ? e.message : 'request failed'}). Dashboard is using fallback weather values.`
    })
  }
  const points: HazardPoint[] = weatherResults.filter(x => x.status === 'fulfilled').map((x: any) => { const { p, weather } = x.value; const nearby = earthquakes.filter((q: any) => { const dlat = q.lat - p.lat; const dlon = (q.lon - p.lon) * Math.cos(p.lat * Math.PI / 180); return Math.hypot(dlat, dlon) * 111 <= 350 }); const eonetHist = eonet.filter((e: any) => { const dlat = e.lat - p.lat; const dlon = (e.lon - p.lon) * Math.cos(p.lat * Math.PI / 180); return Math.hypot(dlat, dlon) * 111 <= 250 }).length; const gsiCount = gsiInventory.filter((e: any) => { const dlat = e.lat - p.lat; const dlon = (e.lon - p.lon) * Math.cos(p.lat * Math.PI / 180); return Math.hypot(dlat, dlon) * 111 <= 50 }).length; const hist = eonetHist + Math.min(12, gsiCount); const official = imd.find((r: any) => normaliseDistrict(String(r.District ?? r.district ?? r.district_name ?? '')) === normaliseDistrict(p.district)); const warningColor = Number(official?.Day1_Color ?? official?.Day1_Color_Code ?? 0) || 0; const v = vulnForPoint(vulnFeatures, p.lat, p.lon) ?? { vulnerability: Math.min(85, 25 + hist * 3), exposure: Math.round(20000 + hist * 1200) }; const r = computeRisk({ rainfall24h: weather.precipitationMm24h, rainfall72h: weather.precipitationMm72h, windKmh: weather.windKmh, tempC: weather.tempC, elevationM: weather.elevationM, earthquakeCount: nearby.length, history90d: hist, vulnerability: v.vulnerability, officialWarningColor: warningColor }); return { ...p, rainfall24h: Number(weather.precipitationMm24h.toFixed(1)), rainfall72h: Number(weather.precipitationMm72h.toFixed(1)), windKmh: Number(weather.windKmh.toFixed(1)), tempC: Number(weather.tempC.toFixed(1)), humidityPct: Math.round(weather.humidityPct), elevationM: Math.round(weather.elevationM), earthquakeCount: nearby.length, disasterHistoryCount90d: hist, gsiLandslideCount: gsiCount, populationExposure: Math.round(v.exposure), vulnerabilityScore: Math.round(v.vulnerability), riskScore: r.riskScore, primaryHazard: r.primaryHazard, confidence: r.confidence, provisionalRedZone: r.riskScore >= 75, relocationPriority: r.relocationPriority, reasons: r.reasons, componentScores: r.componentScores } })
  const modelAlerts: Alert[] = points.filter(p => p.riskScore >= 60).slice().sort((a, b) => b.riskScore - a.riskScore).slice(0, 10).map(p => ({ id: `model-${p.id}`, type: p.primaryHazard, title: `${p.primaryHazard[0].toUpperCase() + p.primaryHazard.slice(1)} screening`, severity: p.riskScore >= 85 ? 'critical' : p.riskScore >= 72 ? 'high' : 'medium', region: p.state, district: p.district, details: `${p.reasons.join(' · ')}. Modelled screening signal — not an official warning.`, lat: p.lat, lon: p.lon, timestamp: new Date().toISOString(), source: 'RakshaMap risk engine', official: false }))
  const eqAlerts: Alert[] = earthquakes.filter((q: any) => q.magnitude >= 4).slice(0, 8).map((q: any) => ({ id: `eq-${q.id}`, type: 'earthquake', title: `Earthquake M${q.magnitude.toFixed(1)}`, severity: q.magnitude >= 6 ? 'critical' : q.magnitude >= 5 ? 'high' : 'medium', region: q.place, details: 'USGS seismic event inside the India monitoring envelope.', lat: q.lat, lon: q.lon, timestamp: q.time, source: 'USGS', official: false, link: 'https://earthquake.usgs.gov/earthquakes/feed/' }))
  const officialImd: Alert[] = imd.filter((r: any) => Number(r.Day1_Color || 0) >= 2).slice(0, 20).map((r: any) => {
    const p = INDIA_POINTS.find(x => normaliseDistrict(x.district) === normaliseDistrict(String(r.District ?? r.district ?? r.district_name ?? ''))) ?? INDIA_POINTS[0]; const c = Number(r.Day1_Color)
    return { id: `imd-${r.Obj_id ?? r.District}`, type: 'multi', title: `IMD district warning · ${r.District}`, severity: c === 4 ? 'critical' : c === 3 ? 'high' : c === 2 ? 'medium' : 'low', region: String(r.State ?? r.state ?? r.District ?? r.district ?? 'India'), district: String(r.District ?? r.district ?? r.district_name ?? ''), details: `Day-1 warning code ${r.Day_1 ?? r.Day1 ?? r.day1 ?? '—'} · official colour ${c}.`, lat: p.lat, lon: p.lon, timestamp: new Date().toISOString(), source: 'IMD district warning API', authority: 'India Meteorological Department', official: true, link: 'https://mausam.imd.gov.in/responsive/districtWiseWarningGIS.php' }
  })
  const alerts = [...ndma, ...sdma, ...officialImd, ...modelAlerts, ...eqAlerts]
  const data = { alerts, points, earthquakes, weatherByPoint: Object.fromEntries(points.map(p => [p.id, { lat: p.lat, lon: p.lon, tempC: p.tempC, precipitationMm24h: p.rainfall24h, precipitationMm72h: p.rainfall72h, windKmh: p.windKmh, humidityPct: p.humidityPct, weatherCode: 0, elevationM: p.elevationM, updatedAt: new Date().toISOString() }])), reliefSites: relief, sourceHealth: [...sourceStatus.values()], officialCoverage: { imdConfigured: Boolean(IMD_VALUE), ndmaConfigured: Boolean(CAP_URL || RSS_URL), sdmaConfigured: Boolean(SDMA_URL), bhuvanConfigured: env.BHUVAN_WMS_CONFIGURED === 'true', gsiConfigured: (env.GSI_WMS_CONFIGURED === 'true' || Boolean(GSI_INVENTORY_URL)), vulnerabilityConfigured: Boolean(VULN_URL), reliefConfigured: Boolean(RELIEF_URL) }, metrics: { activeAlerts: alerts.length, officialAlerts: alerts.filter((a: any) => a.official).length, peopleAtRiskEstimate: Math.round(points.reduce((sum, p) => sum + p.populationExposure * (p.riskScore / 100), 0)), provisionalRedZones: points.filter(p => p.provisionalRedZone).length, relocationCandidates: relief.length, monitoredCells: points.length }, generatedAt: new Date().toISOString() }
  cache = { expires: Date.now() + Number(env.CACHE_TTL_MS || 120000), data }; return data
}
export async function getWeather(lat: number, lon: number) { return { lat, lon, ...await fetchWeather(lat, lon), updatedAt: new Date().toISOString() } }
