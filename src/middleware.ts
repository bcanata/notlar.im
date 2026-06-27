import { defineMiddleware } from 'astro:middleware';

/**
 * Auth gate for /admin* and /api/admin*.
 *
 * Cloudflare Access guards these paths at the edge on the custom domain, but
 * the Worker is also reachable via *.workers.dev (workers_dev: true), which
 * Access does NOT cover. So we additionally verify the Access JWT here —
 * fail-closed — which secures the admin regardless of hostname.
 *
 * The JWT (`Cf-Access-Jwt-Assertion` header / `CF_Authorization` cookie) is an
 * RS256 token signed by the team's keys at <team>/cdn-cgi/access/certs. We
 * verify the signature, issuer, audience (AUD tag of the Access app) and exp.
 */

const PROTECTED = /^\/(admin|api\/admin)(\/|$)/;

export const onRequest = defineMiddleware(async (context, next) => {
    if (!PROTECTED.test(context.url.pathname)) return next();

    // `astro dev` has no Access edge in front of it — allow on localhost.
    if (import.meta.env.DEV) return next();

    const env = context.locals.runtime.env;
    const teamDomain = env.CF_ACCESS_TEAM_DOMAIN;
    const aud = env.CF_ACCESS_AUD;

    // Fail closed: until Access is wired up (vars set in wrangler.jsonc), the
    // admin surface stays sealed rather than silently open.
    if (!teamDomain || !aud) {
        return new Response('Admin not configured: Cloudflare Access pending.', { status: 503 });
    }

    const token =
        context.request.headers.get('Cf-Access-Jwt-Assertion') ||
        readCookie(context.request, 'CF_Authorization');
    if (!token) return new Response('Unauthorized', { status: 401 });

    const ok = await verifyAccessJwt(token, teamDomain, aud);
    if (!ok) return new Response('Forbidden', { status: 403 });

    return next();
});

// --- minimal Cloudflare Access JWT verification (Web Crypto, no deps) ---

interface JwksCache {
    domain: string;
    keys: Map<string, CryptoKey>;
    fetchedAt: number;
}
let jwksCache: JwksCache | null = null;

async function keyFor(teamDomain: string, kid: string): Promise<CryptoKey | undefined> {
    const now = Date.now();
    if (!jwksCache || jwksCache.domain !== teamDomain || now - jwksCache.fetchedAt > 3_600_000) {
        const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
        if (!res.ok) return undefined;
        const jwks = (await res.json()) as { keys: (JsonWebKey & { kid: string })[] };
        const keys = new Map<string, CryptoKey>();
        for (const jwk of jwks.keys) {
            const key = await crypto.subtle.importKey(
                'jwk',
                jwk,
                { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
                false,
                ['verify'],
            );
            keys.set(jwk.kid, key);
        }
        jwksCache = { domain: teamDomain, keys, fetchedAt: now };
    }
    return jwksCache.keys.get(kid);
}

async function verifyAccessJwt(token: string, teamDomain: string, aud: string): Promise<boolean> {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [h, p, s] = parts;

    let header: { alg?: string; kid?: string };
    let payload: { exp?: number; nbf?: number; iss?: string; aud?: string | string[] };
    try {
        header = JSON.parse(b64urlToStr(h));
        payload = JSON.parse(b64urlToStr(p));
    } catch {
        return false;
    }
    if (header.alg !== 'RS256' || !header.kid) return false;

    const key = await keyFor(teamDomain, header.kid);
    if (!key) return false;

    const valid = await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        key,
        b64urlToBytes(s) as BufferSource,
        new TextEncoder().encode(`${h}.${p}`) as BufferSource,
    );
    if (!valid) return false;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && payload.exp < now) return false;
    if (typeof payload.nbf === 'number' && payload.nbf > now) return false;
    if (payload.iss !== `https://${teamDomain}`) return false;
    const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    return auds.includes(aud);
}

function b64urlToBytes(s: string): Uint8Array {
    let b = s.replace(/-/g, '+').replace(/_/g, '/');
    b += '='.repeat((4 - (b.length % 4)) % 4);
    const bin = atob(b);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

function b64urlToStr(s: string): string {
    return new TextDecoder().decode(b64urlToBytes(s));
}

function readCookie(request: Request, name: string): string | null {
    const cookie = request.headers.get('cookie');
    if (!cookie) return null;
    for (const part of cookie.split(';')) {
        const eq = part.indexOf('=');
        if (eq > -1 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
    }
    return null;
}
