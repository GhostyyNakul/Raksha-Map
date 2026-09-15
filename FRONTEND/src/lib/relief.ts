import type { ReliefSite } from '../types'

// Prototype planning sites are visually labelled as prototype/verified only in the app.
// Replace them with an official or deployment-authority GeoJSON feed in production.
export const PROTOTYPE_RELIEF_SITES: ReliefSite[] = [
  { id:'prototype-1', name:'District Relief Centre — Dehradun', type:'relief_centre', lat:30.3165, lon:78.0322, capacity:1800, occupied:540, water:true, power:true, medical:true, accessibility:true, hazardScore:24, source:'prototype', status:'provisional', state:'Uttarakhand', district:'Dehradun' },
  { id:'prototype-2', name:'Community Shelter — Guwahati', type:'shelter', lat:26.15, lon:91.75, capacity:1200, occupied:730, water:true, power:true, medical:false, accessibility:true, hazardScore:31, source:'prototype', status:'provisional', state:'Assam', district:'Kamrup Metropolitan' },
  { id:'prototype-3', name:'Medical Relief Hub — Patna', type:'hospital', lat:25.60, lon:85.12, capacity:900, occupied:310, beds:180, water:true, power:true, medical:true, accessibility:true, hazardScore:28, source:'prototype', status:'provisional', state:'Bihar', district:'Patna' },
  { id:'prototype-4', name:'Cyclone Shelter Cluster — Bhubaneswar', type:'shelter', lat:20.30, lon:85.82, capacity:1500, occupied:240, water:true, power:true, medical:true, accessibility:true, hazardScore:35, source:'prototype', status:'provisional', state:'Odisha', district:'Khordha' },
  { id:'prototype-5', name:'Municipal Relief School — Ahmedabad', type:'relief_centre', lat:23.04, lon:72.58, capacity:760, occupied:100, water:true, power:true, medical:true, accessibility:false, hazardScore:22, source:'prototype', status:'provisional', state:'Gujarat', district:'Ahmedabad' },
  { id:'prototype-6', name:'Temporary Shelter — Kochi', type:'shelter', lat:9.97, lon:76.28, capacity:1100, occupied:520, water:true, power:true, medical:false, accessibility:true, hazardScore:29, source:'prototype', status:'provisional', state:'Kerala', district:'Ernakulam' },
]
