import 'dotenv/config';
import { getAuth } from 'firebase-admin/auth';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
if (!getApps().length)
    initializeApp({ credential: applicationDefault() });
const email = process.argv[2];
if (!email) {
    console.error('Usage: npm run admin:set -- user@example.com');
    process.exit(1);
}
const user = await getAuth().getUserByEmail(email);
const existing = user.customClaims || {};
await getAuth().setCustomUserClaims(user.uid, { ...existing, admin: true, role: 'admin' });
console.log(`Admin role granted to ${email}. Ask the user to refresh/sign in again to receive the updated ID token.`);
