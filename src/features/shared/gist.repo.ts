// GistRepo.ts
export type CreateGistDTO = {
    description?: string;
    public?: boolean;
    files: Record<string, { content: string }>;
};

export type UpdateGistDTO = {
    description?: string;
    public?: boolean;
    files?: Record<string, { content: string }>;
};

type GistJobOp = 'create' | 'update' | 'delete';
type GistJob = {
    id: string;                // uuid
    op: GistJobOp;
    createdAt: number;
    attempts: number;
    nextAttemptAt: number;     // ms timestamp
    // payload (no token here!)
    body?: CreateGistDTO | UpdateGistDTO;
    gistId?: string;
};

class RateLimitError extends Error {
    resetAtMs: number;
    constructor(message: string, resetAtMs: number) {
        super(message);
        this.name = 'RateLimitError';
        this.resetAtMs = resetAtMs;
    }
}

const GIST_QUEUE_KEY = 'CJ_GIST_QUEUE';
const GIST_ALARM = 'cookie_jar_gist_retry_alarm';
const MAX_BACKOFF_MS = 15 * 60 * 1000; // cap 15m

import { LocalStorageRepo } from '../shared';
import { LOCAL_STORAGE_KEYS } from '@/lib';
import { CjSecrets } from '@/domains';

export class GistRepo {
    private _ROOT_URL = 'https://api.github.com';
    private static _instance: GistRepo;
    private storage = LocalStorageRepo.getInstance();

    // optional notifier, set by PushService to surface events to UI
    private notifier?: (msg: { level: 'info' | 'warn' | 'error', title: string, detail?: string }) => void;

    private constructor() {
        // ensure alarm listener is attached once
        chrome.alarms.onAlarm.addListener((alarm) => {
            if (alarm.name === GIST_ALARM) {
                // fire and forget; queue processor handles scheduling next if needed
                void this.processQueue();
            }
        });
    }

    public static getInstance(): GistRepo {
        if (!GistRepo._instance) {
            GistRepo._instance = new GistRepo();
        }
        return GistRepo._instance;
    }

    public setNotifier(fn?: (msg: { level: 'info' | 'warn' | 'error', title: string, detail?: string }) => void) {
        this.notifier = fn;
    }

    // ---------------- core fetch with rate-limit detection ----------------

    private async _fetch<T>(
        method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
        url: string,
        token: string,
        headers?: Record<string, string>,
        body?: any,
    ): Promise<T> {
        const res = await fetch(`${this._ROOT_URL}${url}`, {
            method,
            headers: {
                'Content-Type': 'application/vnd.github+json',
                Authorization: `Bearer ${token}`,
                'X-GitHub-Api-Version': '2022-11-28',
                ...headers,
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        });

        if (!res.ok) {
            const text = await res.text().catch(() => '');
            const remaining = res.headers.get('X-RateLimit-Remaining');
            const reset = res.headers.get('X-RateLimit-Reset');
            const retryAfter = res.headers.get('Retry-After');

            // GitHub uses 403 for primary/secondary rate limits; sometimes 429
            if ((res.status === 403 || res.status === 429) && (remaining === '0' || retryAfter || reset)) {
                let resetAtMs = Date.now() + 60_000; // default 60s
                if (retryAfter) {
                    const ra = parseInt(retryAfter, 10);
                    if (!Number.isNaN(ra)) resetAtMs = Date.now() + ra * 1000;
                } else if (reset) {
                    const epochSec = parseInt(reset, 10);
                    if (!Number.isNaN(epochSec)) resetAtMs = epochSec * 1000;
                }
                throw new RateLimitError(`GitHub rate limit hit (${res.status}).`, resetAtMs);
            }

            console.error(`Failed to ${method} ${url}: ${res.status} ${res.statusText}`);
            if (text) console.error('Response:', text);
            throw new Error(`HTTP error! status: ${res.status}`);
        }

        return res.json() as Promise<T>;
    }

    // ---------------- public API (unchanged signatures) ----------------

    public async getGist(gistId: string, token: string): Promise<any> {
        return this._fetch('GET', `/gists/${gistId}`, token);
    }

    public async createGist(token: string, body: CreateGistDTO): Promise<string> {
        try {
            const response = await this._fetch<{ id: string }>('POST', `/gists`, token, {}, body);
            return response.id;
        } catch (err) {
            if (err instanceof RateLimitError) {
                await this.enqueue({ op: 'create', body });
                await this.scheduleAt(err.resetAtMs);
                this.notify('warn', 'GitHub rate limit — queued create', `Will retry after ${new Date(err.resetAtMs).toLocaleTimeString()}`);
            }
            throw err;
        }
    }

    public async updateGist(gistId: string, gistData: UpdateGistDTO, token: string): Promise<any> {
        try {
            return await this._fetch('PATCH', `/gists/${gistId}`, token, {}, gistData);
        } catch (err) {
            if (err instanceof RateLimitError) {
                await this.enqueue({ op: 'update', gistId, body: gistData });
                await this.scheduleAt(err.resetAtMs);
                this.notify('warn', 'GitHub rate limit — queued update', `Will retry after ${new Date(err.resetAtMs).toLocaleTimeString()}`);
            }
            throw err;
        }
    }

    public async deleteGist(gistId: string, token: string): Promise<any> {
        try {
            return await this._fetch('DELETE', `/gists/${gistId}`, token);
        } catch (err) {
            if (err instanceof RateLimitError) {
                await this.enqueue({ op: 'delete', gistId });
                await this.scheduleAt(err.resetAtMs);
                this.notify('warn', 'GitHub rate limit — queued delete', `Will retry after ${new Date(err.resetAtMs).toLocaleTimeString()}`);
            }
            throw err;
        }
    }

    // ---------------- queue impl ----------------

    private notify(level: 'info' | 'warn' | 'error', title: string, detail?: string) {
        try { this.notifier?.({ level, title, detail }); } catch { }
    }

    private async readQueue(): Promise<GistJob[]> {
        const list = await this.storage.getItem<GistJob[]>(GIST_QUEUE_KEY);
        return Array.isArray(list) ? list : [];
    }

    private async writeQueue(list: GistJob[]): Promise<void> {
        await this.storage.setItem(GIST_QUEUE_KEY, list);
    }

    private async enqueue(job: Omit<GistJob, 'id' | 'createdAt' | 'attempts' | 'nextAttemptAt'>) {
        const list = await this.readQueue();
        const now = Date.now();
        const newJob: GistJob = {
            id: crypto.randomUUID(),
            createdAt: now,
            attempts: 0,
            nextAttemptAt: now,  // can be updated by scheduleAt
            ...job,
        };
        list.push(newJob);
        await this.writeQueue(list);
    }

    private async scheduleAt(tsMs: number) {
        // schedule alarm at tsMs, but cap minimum to +5s in future
        const when = Math.max(tsMs, Date.now() + 5000);
        await chrome.alarms.clear(GIST_ALARM);
        await chrome.alarms.create(GIST_ALARM, { when });
    }

    public async processQueue(): Promise<void> {
        const list = await this.readQueue();
        if (list.length === 0) return;

        // get token on demand (not stored in queue)
        const secrets = await this.storage.getItem<CjSecrets>(LOCAL_STORAGE_KEYS.SECRETS);
        if (!secrets?.ghp) {
            this.notify('error', 'Missing token for queued Gist jobs');
            return; // keep queue; user can add token later
        }
        const token = atob(secrets.ghp);

        let soonestNext: number | null = null;

        const remaining: GistJob[] = [];
        for (const job of list) {
            if (job.nextAttemptAt > Date.now()) {
                // not yet; keep and track soonest
                soonestNext = soonestNext === null ? job.nextAttemptAt : Math.min(soonestNext, job.nextAttemptAt);
                remaining.push(job);
                continue;
            }

            try {
                if (job.op === 'create') {
                    await this._fetch('POST', `/gists`, token, {}, job.body as CreateGistDTO);
                } else if (job.op === 'update') {
                    await this._fetch('PATCH', `/gists/${job.gistId}`, token, {}, job.body as UpdateGistDTO);
                } else if (job.op === 'delete') {
                    await this._fetch('DELETE', `/gists/${job.gistId}`, token);
                }
                this.notify('info', `Queued Gist ${job.op} sent`);
            } catch (err) {
                if (err instanceof RateLimitError) {
                    // backoff to resetAt; also exponential jitter if repeated
                    const base = err.resetAtMs;
                    const backoff = Math.min(MAX_BACKOFF_MS, (2 ** job.attempts) * 1000);
                    job.attempts += 1;
                    job.nextAttemptAt = base + Math.floor(Math.random() * backoff);
                    remaining.push(job);
                    soonestNext = soonestNext === null ? job.nextAttemptAt : Math.min(soonestNext, job.nextAttemptAt);
                    continue;
                } else {
                    // permanent error → drop and notify
                    this.notify('error', `Queued Gist ${job.op} failed`, (err as Error)?.message);
                    // do NOT requeue
                }
            }
        }

        await this.writeQueue(remaining);

        if (remaining.length > 0 && soonestNext != null) {
            await this.scheduleAt(soonestNext);
        } else {
            // clear alarm when empty
            await chrome.alarms.clear(GIST_ALARM);
        }
    }

    // --------------- (optional) utility from your original code ---------------

    public async findLatestGistByFilename(filename: string, token: string): Promise<any | null> {
        try {
            const pageSize = 100;
            let page = 1;
            let gists: any[] = [];
            while (true) {
                const response = await this._fetch<any[]>('GET', `/gists/public?per_page=${pageSize}&page=${page}`, token);
                if (response.length === 0) break;
                gists = gists.concat(response);
                page++;
            }
            const sorted = gists.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 10);
            for (const gist of sorted) if (gist.files && gist.files[filename]) return gist;
            return null;
        } catch (error) {
            console.error('Error finding latest gist by filename:', error);
            return null;
        }
    }
}
