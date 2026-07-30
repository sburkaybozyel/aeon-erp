import crypto from 'crypto';

export function hashPin(pin) {
  return `sha256:${crypto.createHash('sha256').update(String(pin)).digest('hex')}`;
}
