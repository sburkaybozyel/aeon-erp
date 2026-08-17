// Shared helpers for the admin dashboard modules.

// Guest-facing endpoints (service requests, notes) accept free text with no
// authentication and no server-side sanitization — it is rendered here via
// innerHTML, so every such field must be escaped before interpolation.
export const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

export function moduleTypeLabel(moduleType) {
  return ({ bar: 'Bar', kitchen: 'Mutfak', housekeeping: 'Kat Hizmetleri', minibar: 'Minibar', linen: 'Kat Hizmetleri' })[moduleType] || 'Mutfak';
}
