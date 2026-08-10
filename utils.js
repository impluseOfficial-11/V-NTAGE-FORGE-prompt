export function $(s) { return document.querySelector(s); }
export function $$(s) { return document.querySelectorAll(s); }

export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

export function truncate(str, len = 60) {
    if (!str) return '';
    const c = str.trim().replace(/\s+/g, ' ');
    return c.length <= len ? c : c.substring(0, len - 3) + '...';
}

export function formatTimestamp(iso) {
    try {
        const d = new Date(iso);
        const p = n => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    } catch (_) { return iso; }
}

export function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024, s = ['B','KB','MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + s[i];
}

export function debounce(fn, ms) {
    let t;
    return function(...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
}

export function escapeHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

export function simpleDiff(oldText, newText) {
    const oldLines = (oldText || '').split('\n');
    const newLines = (newText || '').split('\n');
    const result = [];
    const max = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < max; i++) {
        const o = i < oldLines.length ? oldLines[i] : null;
        const n = i < newLines.length ? newLines[i] : null;
        if (o === n) { if (o !== null) result.push({ type: 'same', text: o }); }
        else {
            if (o !== null) result.push({ type: 'removed', text: o });
            if (n !== null) result.push({ type: 'added', text: n });
        }
    }
    return result;
}

export function downloadFile(content, filename, mime = 'text/plain') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
}

export async function copyToClipboard(text) {
    try {
        if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
    } catch (_) { /* fallback */ }
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;opacity:0;';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { /* ignore */ }
    document.body.removeChild(ta);
    return ok;
}