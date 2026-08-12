import path from 'path';
import { fileURLToPath } from 'url';

// Shared runtime configuration constants used across server.js and its
// split-out middleware/route modules. Extracted verbatim from server.js —
// no behavior change.

export const isCloudflareWorker = process.env.CLOUDFLARE_WORKER === '1';
export const __dirname = isCloudflareWorker ? '/' : path.dirname(fileURLToPath(import.meta.url));
export const publicDir = path.join(__dirname, 'public');
export const PORT = Number(process.env.PORT || 3000);
export const isHostedRuntime = isCloudflareWorker;
export const shouldListen = !isHostedRuntime && process.env.AEON_DISABLE_LISTEN !== 'true';
export const trustProxy = isHostedRuntime || process.env.AEON_TRUST_PROXY === 'true';
export const ENABLE_STOCK_ALGORITHM = process.env.ENABLE_STOCK_ALGORITHM !== 'false';
export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
export const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:operations@example.com';
export const aeonDataDir = process.env.AEON_DATA_PATH || (isHostedRuntime ? path.join('/tmp', 'aeon') : path.join(__dirname, '.data', 'aeon'));
