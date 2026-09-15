import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDashboard, getWeather } from './upstream.js';
import { adminContributions, adminSummary, approvedSites, createContribution, moderate, myContributions } from './contributions.js';
const app = express();
const port = Number(process.env.PORT || 8787);
const origin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin, credentials: false }));
app.use(express.json({ limit: '256kb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }));
const contributeLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 8, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Contribution rate limit reached. Please try again later.' } });
function wrap(fn) { return async (req, res) => { try {
    res.json(await fn(req));
}
catch (e) {
    const msg = e instanceof Error ? e.message : 'Request failed';
    const auth = /Authentication|required|Google sign-in|admin privileges/i.test(msg);
    res.status(auth ? 401 : 400).json({ error: msg });
} }; }
app.get('/api/health', async (_req, res) => { res.json({ ok: true, service: 'rakshamap-api', time: new Date().toISOString(), official: process.env.IMD_AUTH_HEADER_VALUE || process.env.IMD_API_TOKEN ? 'imd-configured' : 'imd-auth-required' }); });
app.get('/api/dashboard', wrap(async () => getDashboard()));
app.get('/api/weather', async (req, res) => { const lat = Number(req.query.lat), lon = Number(req.query.lon); if (!Number.isFinite(lat) || !Number.isFinite(lon))
    return res.status(400).json({ error: 'lat and lon are required.' }); try {
    res.json(await getWeather(lat, lon));
}
catch (e) {
    res.status(503).json({ error: e instanceof Error ? e.message : 'Weather feed unavailable.' });
} });
app.post('/api/contributions', contributeLimiter, wrap(createContribution));
app.get('/api/contributions/mine', wrap(myContributions));
app.get('/api/approved-sites', wrap(approvedSites));
app.get('/api/admin/summary', wrap(adminSummary));
app.get('/api/admin/contributions', wrap(req => adminContributions(req, String(req.query.status || 'pending'))));
app.post('/api/admin/contributions/:id/status', wrap(req => moderate(req, String(req.params.id))));
if (process.env.NODE_ENV === 'production') {
    const here = dirname(fileURLToPath(import.meta.url));
    const frontendDist = join(here, '../../../dist');
    app.use(express.static(frontendDist, { index: 'index.html', maxAge: '1h' }));
    app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => res.sendFile(join(frontendDist, 'index.html')));
}
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
app.listen(port, () => console.log(`RakshaMap API listening at http://localhost:${port}`));
