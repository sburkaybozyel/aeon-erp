// Thin entrypoint: wires together the split guest portal modules under ./guest/.

// desktop-adapter.js defines setupDesktopGuestAdapter / loadGuestDesktopAdapterData,
// which were dead code in the original single-file guest.js (defined but never
// called or exported). Imported here for side-effect-free parity only; nothing
// invokes them, same as before the split.
import './guest/desktop-adapter.js';

export { setupGuestPortal } from './guest/portal-setup.js';
