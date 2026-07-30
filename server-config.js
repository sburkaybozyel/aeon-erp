import path from 'path';
import { fileURLToPath } from 'url';

// Shared runtime configuration constants used across server.js and its
// split-out middleware/route modules. Extracted verbatim from server.js —
// no behavior change.

export const isCloudflareWorker = process.env.CLOUDFLARE_WORKER === '1';
export const isVercel = Boolean(process.env.VERCEL);
export const __dirname = isCloudflareWorker ? '/' : path.dirname(fileURLToPath(import.meta.url));
export const publicDir = path.join(__dirname, 'public');
export const PORT = process.env.PORT || 3000;
export const isHostedRuntime = isCloudflareWorker || isVercel;
export const ENABLE_STOCK_ALGORITHM = process.env.ENABLE_STOCK_ALGORITHM !== 'false';
export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
export const aeonDataDir = process.env.AEON_DATA_PATH || path.join(__dirname, 'aeon');
