/*
 * VΛNTAGE FORGE — Storage
 * SECURITY: localStorage is accessible to JS on same origin.
 * Production: use backend proxy, store keys server-side.
 */

const K = {
    API_KEY: 'vf_api_key',
    HISTORY: 'vf_history',
    SETTINGS: 'vf_settings',
};

function get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
function set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* ignore */ } }
function del(k) { try { localStorage.removeItem(k); } catch (_) { /* ignore */ } }

export function loadApiKey() { return get(K.API_KEY); }
export function saveApiKey(key) { set(K.API_KEY, key); }
export function clearApiKey() { del(K.API_KEY); }

export function loadHistory() {
    const r = get(K.HISTORY);
    if (!r) return [];
    try { const p = JSON.parse(r); return Array.isArray(p) ? p : []; } catch (_) { return []; }
}
export function saveHistory(h) { set(K.HISTORY, JSON.stringify(h)); }
export function clearHistory() { del(K.HISTORY); }

export function loadSettings() {
    const r = get(K.SETTINGS);
    if (!r) return null;
    try { return JSON.parse(r); } catch (_) { return null; }
}
export function saveSettings(s) { set(K.SETTINGS, JSON.stringify(s)); }
export function clearAll() { del(K.API_KEY); del(K.HISTORY); del(K.SETTINGS); }