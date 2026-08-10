/*
 * VΛNTAGE FORGE — API Module
 * SECURITY: API key never hardcoded, never logged, never in URLs.
 * Production: use backend proxy. Frontend → Backend → OpenRouter.
 */

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'deepseek/deepseek-chat';
const TIMEOUT = 30000;

const STYLES = {
    principal_engineer: 'Principal Engineer yang memberikan spesifikasi teknis presisi',
    security_architect: 'Security Architect yang memprioritaskan keamanan',
    creative_director: 'Creative Director yang mengutamakan pengalaman dan estetika',
    product_architect: 'Product Architect yang berpikir holistik end-to-end',
    senior_developer: 'Senior Developer yang fokus pada implementasi clean',
    research_analyst: 'Research Analyst yang mendalam berbasis data',
    technical_writer: 'Technical Writer yang mengutamakan kejelasan',
};

const MODES = {
    strict: 'Minimal kata. Setiap kalimat berisi instruksi konkret. Tanpa penjelasan tambahan.',
    balanced: 'Seimbangkan kejelasan dan kepadatan. Konteks cukup tanpa berlebihan.',
    detailed: 'Detail mendalam. Jelaskan reasoning. Sertakan edge cases.',
    extreme: 'Paling komprehensif. Semua edge case, validasi, constraint, error handling, security, testing.',
};

function sysOptions(style, mode) {
    return `Kamu adalah VΛNTAGE FORGE, mesin mutator prompt tingkat ${STYLES[style] || STYLES.principal_engineer}.

Tugas:
1. Analisis prompt: tujuan, domain, kekurangan, ambiguitas, kompleksitas.
2. Deteksi domain (programming, web, mobile, security, AI, data, business, writing, design, devops, game, dll).
3. Identifikasi informasi yang hilang.
4. Hasilkan konfigurasi dinamis RELEVAN.

Jumlah opsi: simple=5-10, medium=10-25, complex=25-50, extreme=50-100. Kualitas lebih penting dari kuantitas.

Tipe: multiple_choice, checkbox, dropdown, multi_select, text_input, textarea, number, slider, boolean, color, code_style.

Kelompokkan ke phases logis (max 8).

Mode output: ${MODES[mode] || MODES.balanced}

ATURAN:
- Jangan gunakan AI Slop (Delve, Tapestry, Bustling, Symphony, Furthermore, Moreover, Embark, Realm, Navigating, Testament, Myriad)
- Jangan mengarang detail yang tidak ada
- Jangan tambah requirement tidak relevan

OUTPUT: JSON ONLY, no markdown.
Format: {"analysis":{"intent":"","domain":"","complexity":"simple|medium|complex|extreme","summary":"","missing_information":[],"recommendations":[],"suggested_files":[]},"configuration":{"phases":[{"id":"","title":"","options":[{"id":"","type":"","question":"","description":"","choices":[],"placeholder":"","min":0,"max":100,"step":1,"default":null,"required":false,"recommended":null}]}]}}`;
}

function sysFinal(style, mode) {
    return `Kamu adalah VΛNTAGE FORGE FINAL PROMPT ENGINE, ${STYLES[style] || STYLES.principal_engineer}.

Gabungkan Original Prompt + Analysis + User Configuration + File Context menjadi satu Super Prompt.

Mode: ${MODES[mode] || MODES.balanced}

Jangan ubah tujuan user. Jangan tambah requirement tidak diminta kecuali menghilangkan ambiguitas.
Gunakan bahasa teknis jelas. Hilangkan AI Slop.
Jangan gunakan: Delve, Tapestry, Bustling, Symphony, Furthermore, Moreover, Embark, Realm, Navigating, Testament, Myriad.
Jangan buka dengan: "Berikut adalah...", "tentu saja...", "sebagai AI..."

Gunakan struktur teknis jika relevan: ROLE, OBJECTIVE, CONTEXT, REQUIREMENTS, CONSTRAINTS, SECURITY, ERROR HANDLING, EDGE CASES, VALIDATION, OUTPUT FORMAT.

OUTPUT: JSON ONLY, no markdown.
Format: {"finalPrompt":"","quality":{"overall":0,"clarity":0,"specificity":0,"completeness":0,"constraints":0,"security":0},"warnings":[],"improvements":[]}`;
}

function sysImprove() {
    return `Kamu adalah VΛNTAGE FORGE QUALITY AUDITOR.

Terima final prompt, lakukan audit:
1. Temukan kelemahan, ambiguitas, kontradiksi
2. Perbaiki tanpa mengubah tujuan utama
3. Tingkatkan kejelasan, spesifisitas, constraint
4. Hilangkan AI Slop

OUTPUT: JSON ONLY, no markdown.
Format: {"improvedPrompt":"","quality":{"overall":0,"clarity":0,"specificity":0,"completeness":0,"constraints":0,"security":0},"changes":[],"warnings":[]}`;
}

async function req(apiKey, messages, forceJson = false) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    const body = { model: MODEL, messages, temperature: 0.7, max_tokens: 8000 };
    if (forceJson) body.response_format = { type: 'json_object' };

    try {
        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!res.ok) {
            let msg = '';
            try { msg = (await res.json())?.error?.message || ''; } catch (_) { /* ignore */ }
            const errs = { 401:'API Key tidak valid.', 403:'Akses ditolak.', 429:'Rate limit OpenRouter.', 500:'Server error.', 502:'Bad gateway.', 503:'Service unavailable.' };
            throw new Error(errs[res.status] || msg || `Request failed (${res.status}).`);
        }
        return await res.json();
    } catch (e) {
        clearTimeout(timer);
        if (e.name === 'AbortError') throw new Error('AI tidak merespons dalam 30 detik.');
        throw e;
    }
}

function cleanJson(raw) {
    if (!raw) throw new Error('Response AI kosong.');
    let c = raw.trim();
    const m = c.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) c = m[1].trim();
    const f = c.indexOf('{'), l = c.lastIndexOf('}');
    if (f !== -1 && l > f) c = c.substring(f, l + 1);
    try { return JSON.parse(c); }
    catch (_) { throw new Error('AI mengembalikan format tidak valid. Generate ulang.'); }
}

function validateOptions(d) {
    if (!d || typeof d !== 'object') throw new Error('Invalid: bukan object.');
    if (!d.analysis || typeof d.analysis !== 'object') throw new Error('Invalid: analysis missing.');
    if (!d.configuration?.phases || !Array.isArray(d.configuration.phases)) throw new Error('Invalid: phases missing.');
    for (const p of d.configuration.phases) {
        if (!p.id || !p.title || !Array.isArray(p.options)) throw new Error(`Invalid phase: ${p.id}`);
        for (const o of p.options) {
            if (!o.id || !o.type || !o.question) throw new Error(`Invalid option in ${p.id}`);
        }
    }
}

export async function validateApiKey(apiKey) {
    if (!apiKey?.trim() || apiKey.trim().length < 10) throw new Error('API Key tidak valid.');
    const d = await req(apiKey.trim(), [{ role:'system', content:'Respond with exactly: OK' }, { role:'user', content:'ping' }]);
    if (!d?.choices?.[0]?.message?.content) throw new Error('Response tidak terbaca.');
    return true;
}

export async function generateOptions(apiKey, basePrompt, fileCtx, engineStyle, outputMode) {
    if (!basePrompt?.trim()) throw new Error('Prompt tidak boleh kosong.');
    let uc = `Analisis prompt berikut dan hasilkan konfigurasi dinamis.\n\nPROMPT:\n${basePrompt.trim()}`;
    if (fileCtx) uc += `\n\nFILE CONTEXT:\n${fileCtx}`;
    const d = await req(apiKey, [{ role:'system', content:sysOptions(engineStyle, outputMode) }, { role:'user', content:uc }], true);
    const raw = d?.choices?.[0]?.message?.content;
    if (!raw) throw new Error('AI tidak mengembalikan response.');
    const parsed = cleanJson(raw);
    validateOptions(parsed);
    return parsed;
}

export async function generateFinalPrompt(apiKey, basePrompt, analysis, selections, fileCtx, engineStyle, outputMode) {
    if (!basePrompt?.trim()) throw new Error('Prompt tidak boleh kosong.');
    const selText = Object.entries(selections).filter(([,v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length))
        .map(([k,v]) => `- ${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n') || 'Tidak ada konfigurasi.';
    let uc = `ORIGINAL PROMPT:\n${basePrompt.trim()}\n\nANALYSIS:\n${analysis}\n\nUSER CONFIGURATION:\n${selText}`;
    if (fileCtx) uc += `\n\nFILE CONTEXT:\n${fileCtx}`;
    uc += '\n\nGenerate Super Prompt. Output JSON only.';
    const d = await req(apiKey, [{ role:'system', content:sysFinal(engineStyle, outputMode) }, { role:'user', content:uc }], true);
    const raw = d?.choices?.[0]?.message?.content;
    if (!raw) throw new Error('AI tidak merespons.');
    const parsed = cleanJson(raw);
    if (!parsed.finalPrompt) throw new Error('Response tidak mengandung finalPrompt.');
    return parsed;
}

export async function improvePrompt(apiKey, currentPrompt) {
    if (!currentPrompt?.trim()) throw new Error('Tidak ada prompt untuk diperbaiki.');
    const d = await req(apiKey, [{ role:'system', content:sysImprove() }, { role:'user', content:`CURRENT PROMPT:\n${currentPrompt.trim()}\n\nAudit dan perbaiki. Output JSON only.` }], true);
    const raw = d?.choices?.[0]?.message?.content;
    if (!raw) throw new Error('AI tidak merespons.');
    const parsed = cleanJson(raw);
    if (!parsed.improvedPrompt) throw new Error('Response tidak mengandung improvedPrompt.');
    return parsed;
}