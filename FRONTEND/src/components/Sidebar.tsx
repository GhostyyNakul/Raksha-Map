import { BarChart3, BellRing, ClipboardCheck, Home, Map, MapPinned, Settings2, ShieldAlert, UploadCloud, Database } from 'lucide-react'

export type Section = 'dashboard' | 'map' | 'alerts' | 'relief' | 'analytics' | 'admin' | 'sources'

interface Props { section: Section; setSection: (section: Section) => void; onContribute: () => void; isAdmin: boolean; pendingCount: number }

export function Sidebar({ section, setSection, onContribute, isAdmin, pendingCount }: Props) {
  const items = [
    { id:'dashboard' as const, label:'Command center', icon:Home },
    { id:'map' as const, label:'Live hazard map', icon:Map },
    { id:'alerts' as const, label:'Hazard desk', icon:BellRing },
    { id:'relief' as const, label:'Relocation planner', icon:MapPinned },
    { id:'analytics' as const, label:'Risk analytics', icon:BarChart3 },
    { id:'sources' as const, label:'Data & sources', icon:Database },
  ]
  return <aside className="sidebar">
    <div className="brand"><div className="brand-mark"><ShieldAlert size={22}/></div><div><strong>Raksha<span>Map</span></strong><small>DISASTER INTELLIGENCE</small></div></div>
    <div className="sidebar-rule"/>
    <p className="sidebar-section-label">WORKSPACE</p>
    <nav>{items.map(({id,label,icon:Icon}) => <button key={id} className={`nav-item ${section===id?'active':''}`} onClick={()=>setSection(id)}><Icon size={18}/><span>{label}</span>{id==='alerts' && <em className="nav-badge">LIVE</em>}</button>)}
      <button className="nav-item" onClick={onContribute}><UploadCloud size={18}/><span>Contribute data</span></button>
      {isAdmin && <button className={`nav-item ${section==='admin'?'active':''}`} onClick={()=>setSection('admin')}><ClipboardCheck size={18}/><span>Authority review</span>{pendingCount>0&&<em>{pendingCount}</em>}</button>}
    </nav>
    <div className="sidebar-bottom">
      <div className="status-card"><span className="status-pulse"/><div><strong>Monitoring active</strong><small>Official + modelled feeds</small></div></div>
      <button className="nav-item subtle"><Settings2 size={18}/><span>System settings</span></button>
      <p className="sidebar-note">Decision support for proactive planning. Official warnings always take precedence over modelled screening.</p>
    </div>
  </aside>
}
