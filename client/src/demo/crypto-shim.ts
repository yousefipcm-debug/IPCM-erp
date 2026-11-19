// Browser stand-in for node:crypto (used by the migration code in the demo build).
const rnd = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
export const randomUUID = rnd;
export const randomBytes = (n: number) => {
  const a = new Uint8Array(n); globalThis.crypto.getRandomValues(a);
  return { toString: () => Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('') };
};
export default { randomUUID, randomBytes };
