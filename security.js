/*
 * VΛNTAGE FORGE — Security (Deterrence Layer)
 * Frontend security is NOT absolute. These are deterrents only.
 * Production: Frontend → Backend Proxy → OpenRouter
 * Store API keys in server environment variables.
 * Implement CSP, HTTPS, server-side rate limiting.
 */

export function initSecurity() {
    document.addEventListener('contextmenu', e => e.preventDefault());
    blockDevShortcuts();
    printConsoleWarning();
}

function blockDevShortcuts() {
    const blocked = [
        { key: 'F12' },
        { ctrl: true, shift: true, key: 'I' },
        { ctrl: true, shift: true, key: 'i' },
        { ctrl: true, shift: true, key: 'J' },
        { ctrl: true, shift: true, key: 'j' },
        { ctrl: true, shift: true, key: 'C' },
        { ctrl: true, shift: true, key: 'c' },
        { ctrl: true, key: 'U' },
        { ctrl: true, key: 'u' },
    ];
    document.addEventListener('keydown', e => {
        for (const b of blocked) {
            if (b.key !== e.key) continue;
            const ctrl = b.ctrl ? (e.ctrlKey || e.metaKey) : true;
            const shift = b.shift ? e.shiftKey : true;
            if (ctrl && shift) { e.preventDefault(); e.stopPropagation(); return; }
        }
    });
}

function printConsoleWarning() {
    try {
        console.log('%cVΛNTAGE FORGE', 'color:#ff6b00;font-size:18px;font-weight:bold;font-family:monospace;');
        console.log('%cDynamic AI Prompt Mutation Engine', 'color:#00f3ff;font-size:11px;font-family:monospace;');
        console.log('%cDo not paste code here. Use a backend proxy for production.', 'color:#ff2244;font-size:11px;font-family:monospace;');
    } catch (_) { /* ignore */ }
}

export class RateLimiter {
    constructor(max, windowMs) {
        this._max = max; this._window = windowMs; this._ts = [];
    }
    canProceed() { this._clean(); return this._ts.length < this._max; }
    record() { this._ts.push(Date.now()); }
    getWaitSeconds() {
        this._clean();
        if (this._ts.length < this._max) return 0;
        return Math.ceil((this._ts[0] + this._window - Date.now()) / 1000);
    }
    _clean() { const n = Date.now(); this._ts = this._ts.filter(t => n - t < this._window); }
    reset() { this._ts = []; }
}