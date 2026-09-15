# SIH 26191 → RakshaMap implementation map

| SIH requirement | Implementation |
|---|---|
| Intelligent GIS decision support | React + MapTiler 3D GIS client + Express API |
| Dynamic multi-hazard Red Zones | Explainable composite risk engine + provisional red-zone map layer |
| Hazard intensity | IMD warning adapter, Open-Meteo forecast, USGS earthquake feed |
| Population vulnerability | Authority-provided GeoJSON adapter + vulnerability-aware risk score |
| Disaster history | NASA EONET recent-event history + USGS seismic event count |
| Safer alternative sites | Relief site registry + community-approved sites |
| Carrying capacity assessment | Available capacity / target population / services score |
| Immediate relocation prioritisation | Risk × vulnerability ranking + relocation candidate scoring |
| Evidence-based state planning | Source registry, decision trace, confidence and rationale |
| Community crowdsourcing | Google-authenticated submission workflow; only approved records become map-visible |
| Spam/fake-location reduction | Google identity, rate limiting, coordinate validation, duplicate checks |
| Authority moderation | Claim-gated admin dashboard, approve/reject, moderation notes, audit log |
| Official data integration | IMD, NDMA/SACHET, state/UT SDMA, Bhuvan and GSI adapters / overlay slots |
| Real-time operation | Periodic backend cache refresh + live/open feeds + source health |
| Professional dashboard | Light white/orange UI with operational panels |

## Safety terminology used in UI

- **Official warning:** directly ingested/authoritatively labelled alert.
- **Modelled screening:** computed from available hazard/exposure inputs.
- **Provisional red-zone screening:** a risk-screening geometry, not a legal habitation-zoning decision.
- **Prototype planning data:** placeholder relocation locations that must be replaced with an official registry for operational use.
