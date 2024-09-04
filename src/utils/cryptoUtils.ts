import * as crypto from 'crypto';

const algorithm = 'aes-256-cbc';

export function encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const key = crypto.createHash('sha256').update(String(process.env.ENCRYPT_KEY)).digest('base64').substr(0, 32);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
}

export function decrypt(text: string): string {
    const key = crypto.createHash('sha256').update(String(process.env.ENCRYPT_KEY)).digest('base64').substr(0, 32);
    const [ivHex, encryptedText] = text.split(':');
    if (!ivHex || ivHex.length !== 32) { // 32 hex characters = 16 bytes
        throw new Error('Invalid IV length');
    }

    const ivBuffer = Buffer.from(ivHex, 'hex');
    if (ivBuffer.length !== 16) {
        throw new Error('Invalid IV buffer length');
    }

    const decipher = crypto.createDecipheriv(algorithm, key, ivBuffer);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
