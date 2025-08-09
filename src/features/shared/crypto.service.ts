export type EnryptedContent = {
    v: number; // Version of the encryption format
    salt: string; // Base64 encoded salt used for key derivation
    iv: string; // Base64 encoded initialization vector for AES-GCM
    ct: string; // Base64 encoded ciphertext of the encrypted content
};

export class CryptoService {
    private _PBKDF_ITER = 200_000; // OWASP recommended minimum
    private _PBKDF_KEY_LENGTH = 256; // 256 bits
    private _PBKDF_IV_LENGTH = 12; // 12 bytes for AES-GCM (GCM Standard)
    private static _instance: CryptoService;

    private constructor() {}

    public static getInstance(): CryptoService {
        if (!CryptoService._instance) {
            CryptoService._instance = new CryptoService();
        }
        return CryptoService._instance;
    }

    protected buf2b64(buffer: ArrayBuffer): string {
        return btoa(String.fromCharCode(...new Uint8Array(buffer)));
    }

    protected b642buf(b64: string) {
        return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
    }

    protected async deriveKey(pass: string, salt?: Uint8Array) {
        if (!salt) salt = crypto.getRandomValues(new Uint8Array(16));

        const pbkdfKey = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(pass),
            'PBKDF2',
            false,
            ['deriveKey'],
        );

        const aesKey = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt,
                iterations: this._PBKDF_ITER,
                hash: 'SHA-256',
            },
            pbkdfKey,
            { name: 'AES-GCM', length: this._PBKDF_KEY_LENGTH },
            false,
            ['encrypt', 'decrypt'],
        );

        return { aesKey, salt };
    }

    public async encrypt(plain: any, passPhrase: string): Promise<string> {
        const { aesKey, salt } = await this.deriveKey(passPhrase);
        const iv = crypto.getRandomValues(
            new Uint8Array(this._PBKDF_IV_LENGTH),
        );
        const plaintext = new TextEncoder().encode(JSON.stringify(plain));

        const cipherBuf = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            aesKey,
            plaintext,
        );

        const content: EnryptedContent = {
            v: 1, // format version
            salt: this.buf2b64(salt),
            iv: this.buf2b64(iv),
            ct: this.buf2b64(cipherBuf),
        };

        return JSON.stringify(content);
    }

    public async decrypt(
        encrypted: string,
        passPhrase: string,
    ): Promise<string> {
        const { salt, iv, ct } = JSON.parse(encrypted) as EnryptedContent;
        const { aesKey } = await this.deriveKey(
            passPhrase,
            new Uint8Array(this.b642buf(salt)),
        );
        const plainBuf = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: new Uint8Array(this.b642buf(iv)) },
            aesKey,
            this.b642buf(ct),
        );
        return JSON.parse(new TextDecoder().decode(plainBuf));
    }
}
