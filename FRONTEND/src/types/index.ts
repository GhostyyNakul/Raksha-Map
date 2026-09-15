export type Severity = 'low' | 'medium' | 'high' | 'critical'
export type HazardType = 'flood' | 'landslide' | 'earthquake' | 'cyclone' | 'heat' | 'wildfire' | 'multi'
export type MapMode = 'globe' | 'streets' | 'satellite' | 'terrain'
export type OverlayMode = 'none' | 'hazard' | 'rainfall' | 'population' | 'relief' | 'official'
export type ContributionStatus = 'pending' | 'approved' | 'rejected'
export type ContributionType = 'relief_centre' | 'shelter' | 'medical' | 'food_water' | 'road_blockage' | 'flood_report' | 'landslide_report' | 'other'

export interface SourceHealth {
  id: string
  name: string
  authority: string
  status: 'live' | 'configured' | 'auth-required' | 'error' | 'optional'
  updatedAt: string | null
  latencyMs?: number
  detail: string
  official: boolean
  url: string
}

export interface ComponentScores {
  flood: number
  landslide: number
  cyclone: number
  heat: number
  seismic: number
  history: number
  vulnerability: number
}

export interface HazardPoint {
  id: string
  name: string
  state: string
  district: string
  lat: number
  lon: number
  rainfall24h: number
  rainfall72h: number
  windKmh: number
  tempC: number
  humidityPct: number
  elevationM: number
  earthquakeCount: number
  disasterHistoryCount90d: number
  gsiLandslideCount?: number
  populationExposure: number
  vulnerabilityScore: number
  riskScore: number
  primaryHazard: HazardType
  confidence: number
  provisionalRedZone: boolean
  relocationPriority: 'immediate' | 'short-term' | 'medium-term'
  reasons: string[]
  componentScores: ComponentScores
}

export interface HazardAlert {
  id: string
  type: HazardType
  title: string
  severity: Severity
  region: string
  district?: string
  details: string
  lat: number
  lon: number
  timestamp: string
  validUntil?: string
  source: string
  authority?: string
  official: boolean
  link?: string
}

export interface WeatherSnapshot {
  lat: number
  lon: number
  tempC: number
  precipitationMm24h: number
  precipitationMm72h: number
  windKmh: number
  humidityPct: number
  weatherCode: number
  elevationM: number
  updatedAt: string
}

export interface ReliefSite {
  id: string
  name: string
  type: 'relief_centre' | 'shelter' | 'hospital'
  lat: number
  lon: number
  capacity: number
  occupied: number
  beds?: number
  water?: boolean
  power?: boolean
  medical?: boolean
  accessibility?: boolean
  hazardScore: number
  source: 'community' | 'official' | 'prototype'
  status: 'verified' | 'pending' | 'provisional'
  state: string
  district?: string
}

export interface DashboardData {
  alerts: HazardAlert[]
  points: HazardPoint[]
  earthquakes: Array<{ id: string; lat: number; lon: number; magnitude: number; place: string; time: string }>
  weatherByPoint: Record<string, WeatherSnapshot>
  reliefSites: ReliefSite[]
  sourceHealth: SourceHealth[]
  officialCoverage: {
    imdConfigured: boolean
    ndmaConfigured: boolean
    sdmaConfigured: boolean
    bhuvanConfigured: boolean
    gsiConfigured: boolean
    vulnerabilityConfigured: boolean
    reliefConfigured: boolean
  }
  metrics: {
    activeAlerts: number
    officialAlerts: number
    peopleAtRiskEstimate: number
    provisionalRedZones: number
    relocationCandidates: number
    monitoredCells: number
  }
  generatedAt: string
}

export interface Contribution {
  id: string
  userId: string
  userName: string
  userEmail?: string | null
  type: ContributionType
  name: string
  description: string
  lat: number
  lon: number
  capacity: number
  state?: string
  district?: string
  status: ContributionStatus
  moderationNote?: string
  createdAt: string
  updatedAt?: string
  duplicateScore?: number
}

export interface AdminSummary {
  pending: number
  approved24h: number
  rejected24h: number
  recent: Contribution[]
}
