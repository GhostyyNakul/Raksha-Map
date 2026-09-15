import { db, FieldValue, requireAdmin, requireGoogle, writeAudit } from './admin.js';
export function indiaCoordinate(lat, lon) { return Number.isFinite(lat) && Number.isFinite(lon) && lat >= 6 && lat <= 38 && lon >= 68 && lon <= 98; }
function distanceKm(aLat, aLon, bLat, bLon) { const r = Math.PI / 180; const p1 = aLat * r, p2 = bLat * r; const dp = (bLat - aLat) * r, dl = (bLon - aLon) * r; const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2; return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)); }
function asIso(v) { if (!v)
    return new Date().toISOString(); if (typeof v.toDate === 'function')
    return v.toDate().toISOString(); return new Date(v).toISOString(); }
function sanitise(d) { return { id: d.id, userId: String(d.userId), userName: String(d.userName || 'Verified contributor'), userEmail: d.userEmail ?? null, type: d.type, name: d.name, description: d.description, lat: Number(d.lat), lon: Number(d.lon), capacity: Number(d.capacity ?? 0), state: d.state || '', district: d.district || '', status: d.status, moderationNote: d.moderationNote || '', createdAt: asIso(d.createdAt), updatedAt: d.updatedAt ? asIso(d.updatedAt) : undefined, duplicateScore: Number(d.duplicateScore ?? 0) }; }
export async function createContribution(req) {
    const claims = await requireGoogle(req.headers.authorization);
    const { type, name, description, lat, lon, capacity, state = '', district = '' } = req.body || {};
    if (typeof name !== 'string' || name.trim().length < 3)
        throw new Error('A clear report name is required.');
    if (typeof description !== 'string' || description.trim().length < 12)
        throw new Error('Please provide enough field detail for verification.');
    const nlat = Number(lat), nlon = Number(lon), ncap = Number(capacity);
    if (!indiaCoordinate(nlat, nlon))
        throw new Error('Coordinates must fall inside the India monitoring envelope.');
    if (!Number.isFinite(ncap) || ncap < 0 || ncap > 100000)
        throw new Error('Capacity must be between 0 and 100000.');
    const supported = new Set(['relief_centre', 'shelter', 'medical', 'food_water', 'road_blockage', 'flood_report', 'landslide_report', 'other']);
    if (!supported.has(String(type)))
        throw new Error('Unsupported contribution type.');
    const cell = `${nlat.toFixed(1)}:${nlon.toFixed(1)}`;
    const nearby = await db.collection('contributions').where('geoCell', '==', cell).where('status', 'in', ['pending', 'approved']).limit(40).get();
    const duplicateDistances = nearby.docs.map(d => distanceKm(nlat, nlon, Number(d.data().lat), Number(d.data().lon))).filter(d => d <= 1);
    const duplicateScore = duplicateDistances.length ? Math.max(50, 100 - duplicateDistances[0] * 50) : 0;
    const ref = await db.collection('contributions').add({ userId: claims.uid, userName: claims.name || 'Verified contributor', userEmail: claims.email || null, provider: 'google.com', type: String(type), name: name.trim(), description: description.trim(), lat: nlat, lon: nlon, capacity: ncap, state: String(state).slice(0, 80), district: String(district).slice(0, 100), status: 'pending', geoCell: cell, duplicateScore, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    await writeAudit({ action: 'contribution.created', actorUid: claims.uid, targetId: ref.id, note: duplicateScore >= 50 ? 'Potential duplicate detected and queued for manual review.' : 'New community contribution', status: 'pending' });
    return { id: ref.id, status: 'pending', duplicateFlag: duplicateScore >= 50 };
}
export async function myContributions(req) {
    const claims = await requireGoogle(req.headers.authorization);
    const snap = await db.collection('contributions').where('userId', '==', claims.uid).limit(100).get();
    return snap.docs.map(d => sanitise({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function approvedSites() {
    const snap = await db.collection('contributions').where('status', '==', 'approved').limit(200).get();
    return snap.docs.map(d => {
        const x = d.data();
        return { id: d.id, name: String(x.name || 'Approved community site'), type: (String(x.type || 'shelter').includes('medical') ? 'hospital' : String(x.type || '').includes('relief') ? 'relief_centre' : 'shelter'), lat: Number(x.lat), lon: Number(x.lon), capacity: Number(x.capacity ?? 0), occupied: 0, medical: String(x.type || '').includes('medical'), water: String(x.type || '').includes('food_water'), power: false, accessibility: false, hazardScore: 0, source: 'community', status: 'verified', state: String(x.state || ''), district: String(x.district || '') };
    }).filter(x => Number.isFinite(x.lat) && Number.isFinite(x.lon));
}
export async function adminSummary(req) {
    await requireAdmin(req.headers.authorization);
    const [pending, approved, rejected] = await Promise.all([
        db.collection('contributions').where('status', '==', 'pending').limit(500).get(),
        db.collection('contributions').where('status', '==', 'approved').limit(500).get(),
        db.collection('contributions').where('status', '==', 'rejected').limit(500).get(),
    ]);
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const within24 = (d) => new Date(asIso(d)).getTime() >= cutoff;
    const recent = [...pending.docs, ...approved.docs, ...rejected.docs].map(d => sanitise({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);
    return { pending: pending.size, approved24h: approved.docs.filter(d => within24(d.data().updatedAt || d.data().createdAt)).length, rejected24h: rejected.docs.filter(d => within24(d.data().updatedAt || d.data().createdAt)).length, recent };
}
export async function adminContributions(req, status) {
    await requireAdmin(req.headers.authorization);
    if (!['pending', 'approved', 'rejected'].includes(status))
        throw new Error('Invalid moderation status.');
    const snap = await db.collection('contributions').where('status', '==', status).limit(200).get();
    return snap.docs.map(d => sanitise({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function moderate(req, id) {
    const claims = await requireAdmin(req.headers.authorization);
    const status = req.body?.status;
    const moderationNote = String(req.body?.moderationNote || '').slice(0, 800);
    if (status !== 'approved' && status !== 'rejected')
        throw new Error('Status must be approved or rejected.');
    const ref = db.collection('contributions').doc(id);
    const snap = await ref.get();
    if (!snap.exists)
        throw new Error('Contribution not found.');
    await ref.update({ status, moderationNote, updatedAt: FieldValue.serverTimestamp(), moderatedBy: claims.uid });
    await writeAudit({ action: `contribution.${status}`, actorUid: claims.uid, targetId: id, note: moderationNote, status });
    return { ok: true };
}
