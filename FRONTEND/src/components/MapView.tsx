import { useEffect, useRef, useState } from 'react'
import * as maptilersdk from '@maptiler/sdk'
import '@maptiler/sdk/dist/maptiler-sdk.css'
import type { HazardPoint, MapMode, OverlayMode, ReliefSite } from '../types'

const INDIA_CENTER: [number, number] = [78.9629, 22.5937]
const BBOX = '68,6,98,38'

type MapInstance = maptilersdk.Map

function riskColor(score: number) {
  return score >= 85 ? '#dc2626' : score >= 70 ? '#ea580c' : score >= 45 ? '#f59e0b' : '#16a34a'
}

function esc(value: string) {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c))
}

interface Props {
  mode: MapMode
  overlay: OverlayMode
  points: HazardPoint[]
  sites: ReliefSite[]
  onMapClick?: (lat: number, lon: number) => void
}

export function MapView({ mode, overlay, points, sites, onMapClick }: Props) {
  const root = useRef<HTMLDivElement | null>(null)
  const map = useRef<MapInstance | null>(null)
  const markers = useRef<maptilersdk.Marker[]>([])
  const onMapClickRef = useRef(onMapClick)
  const key = String(import.meta.env.VITE_MAPTILER_KEY || '').trim()
  const [mapError, setMapError] = useState('')
  const skipFirstModeChange = useRef(true)

  useEffect(() => {
    onMapClickRef.current = onMapClick
  }, [onMapClick])

  useEffect(() => {
    if (!root.current || map.current || !key) return

    let mounted = true

    try {
      maptilersdk.config.apiKey = key

      const m = new maptilersdk.Map({
        container: root.current,
        style: maptilersdk.MapStyle.HYBRID,
        center: INDIA_CENTER,
        zoom: 4.3,
        minZoom: 3,
        maxZoom: 15,
        projection: 'globe',
        pitch: 18,
        maxPitch: 70,
        attributionControl: true,
        renderWorldCopies: false,
      })

      const clickHandler = (evt: maptilersdk.MapMouseEvent) => onMapClickRef.current?.(evt.lngLat.lat, evt.lngLat.lng)
      m.on('click', clickHandler)
      m.on('error', evt => {
        const message = (evt as any)?.error?.message || 'MapTiler reported a map rendering error.'
        console.error('MapTiler error:', evt)
        if (mounted) setMapError(message)
      })

      map.current = m
      setMapError('')

      return () => {
        mounted = false
        try {
          m.off('click', clickHandler)
          m.remove()
        } catch (error) {
          console.warn('Map cleanup warning:', error)
        }
        markers.current.forEach(marker => marker.remove())
        markers.current = []
        map.current = null
      }
    } catch (error) {
      console.error('MapTiler initialization failed:', error)
      if (mounted) setMapError(error instanceof Error ? error.message : String(error))
      return () => {
        mounted = false
      }
    }
  }, [key])

  useEffect(() => {
    const m = map.current
    if (!m) return
    if (skipFirstModeChange.current) {
      skipFirstModeChange.current = false
      return
    }

    const applyMode = () => {
      try {
        const projection = mode === 'globe' ? 'globe' : 'mercator'
        m.setProjection(projection)

        if (mode === 'globe' || mode === 'terrain') {
          m.enableTerrain(1.05)
          m.easeTo({ pitch: mode === 'globe' ? 18 : 48, duration: 450 })
        } else {
          m.disableTerrain()
          m.easeTo({ pitch: 0, duration: 350 })
        }
      } catch (error) {
        console.error('Map mode change failed:', error)
        setMapError(error instanceof Error ? error.message : String(error))
      }
    }

    const styles: Record<MapMode, any> = {
      globe: maptilersdk.MapStyle.HYBRID,
      streets: maptilersdk.MapStyle.STREETS.LIGHT,
      satellite: maptilersdk.MapStyle.SATELLITE,
      terrain: maptilersdk.MapStyle.OUTDOOR,
    }

    try {
      m.setStyle(styles[mode])
      if (m.isStyleLoaded()) applyMode()
      else m.once('style.load', applyMode)
    } catch (error) {
      console.error('Map style switch failed:', error)
      setMapError(error instanceof Error ? error.message : String(error))
    }
  }, [mode])

  useEffect(() => {
    const m = map.current
    if (!m) return

    const render = () => {
      try {
        markers.current.forEach(marker => marker.remove())
        markers.current = []

        points.forEach(point => {
          const el = document.createElement('button')
          el.type = 'button'
          el.className = 'hazard-marker'
          el.style.background = riskColor(point.riskScore)
          el.style.boxShadow = `0 0 0 7px ${riskColor(point.riskScore)}22`
          el.title = `${point.name}: risk ${point.riskScore}/100`
          el.innerHTML = '<span></span>'

          const popup = new maptilersdk.Popup({ offset: 15, closeButton: false, maxWidth: '330px' }).setHTML(
            `<div class="map-popup"><strong>${esc(point.name)}, ${esc(point.state)}</strong><span>${esc(point.primaryHazard)} · Risk ${point.riskScore}/100 · confidence ${point.confidence}%</span><small>${esc(point.reasons.join(' · '))}</small>${point.provisionalRedZone ? '<b>PROVISIONAL RED-ZONE SCREENING</b>' : ''}</div>`,
          )

          markers.current.push(new maptilersdk.Marker({ element: el }).setLngLat([point.lon, point.lat]).setPopup(popup).addTo(m))
        })

        sites.filter(site => site.status !== 'pending').forEach(site => {
          const el = document.createElement('button')
          el.type = 'button'
          el.className = 'site-marker'
          el.innerHTML = '<span>+</span>'
          el.title = site.name
          const available = Math.max(0, site.capacity - site.occupied)
          const popup = new maptilersdk.Popup({ offset: 15, closeButton: false }).setHTML(
            `<div class="map-popup"><strong>${esc(site.name)}</strong><span>${esc(site.type.replaceAll('_', ' '))} · ${esc(site.state)}</span><b>${available.toLocaleString()} spaces available</b><small>${site.medical ? 'Medical · ' : ''}${site.water ? 'Water · ' : ''}${site.power ? 'Power' : ''}</small></div>`,
          )
          markers.current.push(new maptilersdk.Marker({ element: el }).setLngLat([site.lon, site.lat]).setPopup(popup).addTo(m))
        })

        const source = 'risk-zones'
        const layer = 'risk-zone-circles'
        try {
          if (m.getLayer(layer)) m.removeLayer(layer)
          if (m.getSource(source)) m.removeSource(source)
        } catch {
          // The style may still be rebuilding; the next style event will retry.
        }

        if (overlay === 'hazard') {
          const geojson = {
            type: 'FeatureCollection',
            features: points
              .filter(point => point.provisionalRedZone)
              .map(point => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [point.lon, point.lat] },
                properties: { risk: point.riskScore },
              })),
          }
          m.addSource(source, { type: 'geojson', data: geojson as any })
          m.addLayer({
            id: layer,
            type: 'circle',
            source,
            paint: {
              'circle-color': ['interpolate', ['linear'], ['get', 'risk'], 70, '#ea580c', 85, '#dc2626'],
              'circle-opacity': 0.14,
              'circle-radius': ['interpolate', ['linear'], ['get', 'risk'], 70, 25, 100, 65],
              'circle-stroke-color': ['interpolate', ['linear'], ['get', 'risk'], 70, '#ea580c', 85, '#dc2626'],
              'circle-stroke-opacity': 0.32,
              'circle-stroke-width': 1.4,
            },
          } as any)
        } else if (overlay === 'rainfall') {
          const geojson = {
            type: 'FeatureCollection',
            features: points.map(point => ({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [point.lon, point.lat] },
              properties: { rain: point.rainfall24h },
            })),
          }
          m.addSource(source, { type: 'geojson', data: geojson as any })
          m.addLayer({
            id: layer,
            type: 'circle',
            source,
            paint: {
              'circle-color': ['interpolate', ['linear'], ['get', 'rain'], 0, '#dbeafe', 40, '#60a5fa', 100, '#2563eb', 200, '#1e1b4b'],
              'circle-opacity': 0.24,
              'circle-radius': ['interpolate', ['linear'], ['get', 'rain'], 0, 8, 150, 42],
            },
          } as any)
        } else if (overlay === 'population') {
          const geojson = {
            type: 'FeatureCollection',
            features: points.map(point => ({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [point.lon, point.lat] },
              properties: { pop: point.populationExposure },
            })),
          }
          m.addSource(source, { type: 'geojson', data: geojson as any })
          m.addLayer({
            id: layer,
            type: 'circle',
            source,
            paint: {
              'circle-color': '#7c2d12',
              'circle-opacity': 0.15,
              'circle-radius': ['interpolate', ['linear'], ['get', 'pop'], 0, 8, 250000, 42],
            },
          } as any)
        }

        const bhUrl = String(import.meta.env.VITE_BHUVAN_WMS_URL || '').trim()
        const bhLayers = String(import.meta.env.VITE_BHUVAN_WMS_LAYERS || '').trim()
        const gsiUrl = String(import.meta.env.VITE_GSI_WMS_URL || '').trim()
        const gsiLayers = String(import.meta.env.VITE_GSI_WMS_LAYERS || '').trim()

        for (const id of ['bhuvan-raster', 'gsi-raster']) {
          try {
            if (m.getLayer(id)) m.removeLayer(id)
            if (m.getSource(id)) m.removeSource(id)
          } catch {
            // Ignore stale style state during a map switch.
          }
        }

        const addWms = (id: string, url: string, layers: string, opacity: number) => {
          const wms = `${url}${url.includes('?') ? '&' : '?'}service=WMS&request=GetMap&version=1.3.0&layers=${encodeURIComponent(layers)}&styles=&format=image/png&transparent=true&crs=EPSG:3857&width=256&height=256&bbox={bbox-epsg-3857}`
          m.addSource(id, { type: 'raster', tiles: [wms], tileSize: 256 } as any)
          m.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': opacity } } as any)
        }

        if (overlay === 'official') {
          if (bhUrl && bhLayers) addWms('bhuvan-raster', bhUrl, bhLayers, 0.34)
          if (gsiUrl && gsiLayers) addWms('gsi-raster', gsiUrl, gsiLayers, 0.48)
        }
      } catch (error) {
        console.error('Map overlay render failed:', error)
        setMapError(error instanceof Error ? error.message : String(error))
      }
    }

    if (m.isStyleLoaded()) render()
    else m.once('style.load', render)

    return () => {
      markers.current.forEach(marker => marker.remove())
      markers.current = []
    }
  }, [points, sites, overlay, mode])

  if (!key) {
    return (
      <div className="map-fallback">
        <div className="fallback-globe"><div className="india-outline" /></div>
        <div>
          <strong>3D India map</strong>
          <p>Add <code>VITE_MAPTILER_KEY</code> to load the interactive globe, terrain, satellite and street layers.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="map-wrap">
      <div ref={root} className="map-canvas" />
      {mapError && (
        <div className="map-error-banner">
          <strong>Interactive map unavailable.</strong>
          <span>{mapError}</span>
          <small>Check VITE_MAPTILER_KEY and the browser console. The dashboard remains usable.</small>
        </div>
      )}
      <div className="map-corner-tag"><span />INDIA · LIVE GIS</div>
      <div className="map-coordinate">Monitoring envelope {BBOX.replaceAll(',', '° · ')}°</div>
    </div>
  )
}
