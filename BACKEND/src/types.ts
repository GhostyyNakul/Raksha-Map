export type Severity = 'low' | 'medium' | 'high' | 'critical'
export type HazardType = 'flood' | 'landslide' | 'earthquake' | 'cyclone' | 'heat' | 'wildfire' | 'multi'

export interface HazardPoint {
  id:string; name:string; state:string; district:string; lat:number; lon:number
  rainfall24h:number; rainfall72h:number; windKmh:number; tempC:number; humidityPct:number; elevationM:number
  earthquakeCount:number; disasterHistoryCount90d:number; populationExposure:number; vulnerabilityScore:number
  riskScore:number; primaryHazard:HazardType; confidence:number; provisionalRedZone:boolean; relocationPriority:'immediate'|'short-term'|'medium-term'; gsiLandslideCount?:number; reasons:string[]
  componentScores:{flood:number;landslide:number;cyclone:number;heat:number;seismic:number;history:number;vulnerability:number}
}

export interface Alert { id:string; type:HazardType; title:string; severity:Severity; region:string; district?:string; details:string; lat:number; lon:number; timestamp:string; validUntil?:string; source:string; authority?:string; official:boolean; link?:string }
export interface ReliefSite { id:string; name:string; type:'relief_centre'|'shelter'|'hospital'; lat:number; lon:number; capacity:number; occupied:number; beds?:number; water?:boolean; power?:boolean; medical?:boolean; accessibility?:boolean; hazardScore:number; source:'official'|'community'|'prototype'; status:'verified'|'pending'|'provisional'; state:string; district?:string }
export interface SourceHealth { id:string; name:string; authority:string; status:'live'|'configured'|'auth-required'|'error'|'optional'; updatedAt:string|null; latencyMs?:number; detail:string; official:boolean; url:string }
