// Name-based UUIDs (version 5): the same name always gives the same id, on
// every phone. Monthly repeats use them, so two phones adding March's rent
// make one expense, not two (onlinedb.md §9.5). expo-crypto only hashes
// asynchronously, and repeats are added inside synchronous state updates,
// hence this small SHA-1.

function sha1(bytes: Uint8Array): Uint8Array {
  const size = ((bytes.length + 9 + 63) >> 6) << 6;
  const m = new Uint8Array(size);
  m.set(bytes);
  m[bytes.length] = 0x80;
  const view = new DataView(m.buffer);
  const bits = bytes.length * 8;
  view.setUint32(size - 8, Math.floor(bits / 2 ** 32));
  view.setUint32(size - 4, bits >>> 0);

  const h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const w = new Uint32Array(80);
  for (let off = 0; off < size; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 80; i++) {
      const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = (x << 1) | (x >>> 31);
    }
    let [a, b, c, d, e] = h;
    for (let i = 0; i < 80; i++) {
      let f: number;
      let k: number;
      if (i < 20) [f, k] = [(b & c) | (~b & d), 0x5a827999];
      else if (i < 40) [f, k] = [b ^ c ^ d, 0x6ed9eba1];
      else if (i < 60) [f, k] = [(b & c) | (b & d) | (c & d), 0x8f1bbcdc];
      else [f, k] = [b ^ c ^ d, 0xca62c1d6];
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0;
      e = d;
      d = c;
      c = ((b << 30) | (b >>> 2)) >>> 0;
      b = a;
      a = t;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
  }
  const out = new Uint8Array(20);
  const outView = new DataView(out.buffer);
  h.forEach((v, i) => outView.setUint32(i * 4, v));
  return out;
}

const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Exposed for its test only. */
export const sha1Hex = (text: string) => hex(sha1(new TextEncoder().encode(text)));

/** The version 5 UUID of `name` in `namespace` (itself a UUID). */
export function uuid5(name: string, namespace: string): string {
  const ns = namespace.replace(/-/g, '').match(/../g)!.map((b) => parseInt(b, 16));
  const nameBytes = new TextEncoder().encode(name);
  const input = new Uint8Array(16 + nameBytes.length);
  input.set(ns);
  input.set(nameBytes, 16);
  const b = sha1(input).slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const s = hex(b);
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
