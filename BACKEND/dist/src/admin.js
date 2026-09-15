import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
function init() {
    if (getApps().length)
        return getApps()[0];
    const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64;
    if (b64) {
        return initializeApp({ credential: cert(JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))) });
    }
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        return initializeApp({ credential: applicationDefault() });
    }
    return initializeApp({ credential: applicationDefault() });
}
init();
export const adminAuth = getAuth();
export const db = getFirestore();
export { FieldValue };
export async function verifyBearer(authHeader) {
    if (!authHeader?.startsWith('Bearer '))
        throw new Error('Authentication required.');
    const token = authHeader.slice(7);
    return adminAuth.verifyIdToken(token);
}
export async function requireGoogle(authHeader) {
    const claims = await verifyBearer(authHeader);
    if (claims.firebase?.sign_in_provider !== 'google.com')
        throw new Error('Google sign-in is required.');
    if (claims.email_verified !== true)
        throw new Error('A verified Google account is required.');
    return claims;
}
export async function requireAdmin(authHeader) {
    const claims = await requireGoogle(authHeader);
    if (claims.admin !== true && claims.role !== 'admin')
        throw new Error('Authority admin privileges are required.');
    return claims;
}
export function writeAudit(event) {
    return db.collection('moderation_audit').add({ ...event, createdAt: FieldValue.serverTimestamp() });
}
