import { createDecipheriv } from 'crypto';

const key = Buffer.from('6e65766572676f6e6e6167697665796f757570757775696c6f76657577757321', 'hex');

/** Return a private plaintext copy; the 12-byte nonce/header remains in place. */
export function DecodeSceneBuffer(buffer: Buffer): Buffer {
    const result = Buffer.from(buffer);
    if (result.length <= 12 || result[1] !== 0xcc) return result;
    result[1] = 0;
    // OpenSSL ChaCha20 takes a 16-byte IV: counter followed by the 96-bit nonce.
    const iv = Buffer.alloc(16);
    result.copy(iv, 4, 0, 12);
    const cipher = createDecipheriv('chacha20', key, iv);
    const payload = Buffer.concat([cipher.update(result.subarray(12)), cipher.final()]);
    payload.copy(result, 12);
    return result;
}
