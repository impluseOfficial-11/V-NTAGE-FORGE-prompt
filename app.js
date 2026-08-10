/*
 * VΛNTAGE FORGE — Main Application
 * Production: Frontend → Backend API Proxy → OpenRouter
 * API key harus di server environment variable.
 */

import state from './state.js';
import { $, $$, generateId, truncate, formatTimestamp, formatBytes, debounce, simpleDiff, downloadFile, copyToClipboard, escapeHtml } from './utils.js';
import { initSecurity, RateLimiter } from './security.js';
import { initAnimations, setReducedMotion, setParticlesEnabled } from './animation.js';
import { validateApiKey, generateOptions, generateFinalPrompt, improvePrompt } from './api.js';
import { isAllowedFile, readFileAsText, buildFileContext } from './file-engine.js';
import { detectConflicts, buildContextSummary, buildReadableSelections, autoConfigureSelections, initSelections } from './prompt-engine.js';
import { createOptionCard } from './components.js';
import * as storage from './storage.js';

const rateLimiter = new RateLimiter(3, 60000);

const STAGES_ANALYZE = ['ANALYZING INTENT','DETECTING DOMAIN','EVALUATING COMPLEXITY','EXTRACTING REQUIREMENTS','BUILDING CONFIGURATION','VALIDATING OPTIONS'];
const STAGES_FINAL = ['MAPPING CONFIGURATION','SYNTHESIZING PROMPT','APPLYING CONSTRAINTS','RUNNING QUALITY CHECK'];

// ================================================================
// INIT
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
    initSecurity();
    initAnimations();
    loadData();
    initSplash();
    bindAll();
});

function loadData() {
    state.history = storage.loadHistory();
    const s = storage.loadSettings();
    if (s) Object.assign(state.settings, s);
    applySettings();
}

function applySettings() {
    const bgv = $('#bg-video');
    if (bgv) bgv.classList.toggle('vid-off', !state.settings.bgVideo);
    setParticlesEnabled(state.settings.particles);
    setReducedMotion(state.settings.reducedMotion);
    const sBgV = $('#s-bg-video'), sPart = $('#s-particles'), sRed = $('#s-reduced-motion');
    if (sBgV) sBgV.checked = state.settings.bgVideo;
    if (sPart) sPart.checked = state.settings.particles;
    if (sRed) sRed.checked = state.settings.reducedMotion;
}

// ================================================================
// SPLASH
// ================================================================
function initSplash() {
    const splash = $('#splash-screen');
    const video = $('#splash-video');
    const logoWrap = $('#splash-logo-wrap');
    if (!splash || !video) return;

    video.addEventListener('contextmenu', e => e.preventDefault());

    video.addEventListener('ended', () => {
        video.style.display = 'none';
        logoWrap.classList.add('anim-in');
        setTimeout(() => {
            logoWrap.classList.remove('anim-in');
            logoWrap.classList.add('anim-hold');
            setTimeout(() => {
                logoWrap.classList.remove('anim-hold');
                logoWrap.classList.add('anim-out');
                setTimeout(() => {
                    splash.remove();
                    document.body.classList.add('loaded');
                    showApp();
                }, 1000);
            }, 2000);
        }, 1500);
    });

    video.addEventListener('error', () => {
        setTimeout(() => {
            if (splash.parentNode) {
                splash.remove();
                document.body.classList.add('loaded');
                showApp();
            }
        }, 1500);
    });
}

function showApp() {
    const app = $('#app');
    app.classList.remove('app-hidden');
    app.classList.add('app-visible');

    const stored = storage.loadApiKey();
    if (stored) {
        const inp = $('#api-key-input');
        if (inp) inp.value = stored;
        const cb = $('#remember-key');
        if (cb) cb.checked = true;
        state.rememberKey = true;
    }
}

// ================================================================
// BIND EVENTS
// ================================================================
function bindAll() {
    // Nav
    $$('.nav-btn').forEach(btn => btn.addEventListener('click', () => { switchPanel(btn.dataset.panel); closeMobile(); }));
    $('#mobile-toggle')?.addEventListener('click', toggleMobile);
    $('#sidebar-overlay')?.addEventListener('click', closeMobile);

    // API
    $('#toggle-key-vis')?.addEventListener('click', toggleKeyVis);
    $('#api-key-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') handleValidate(); });
    $('#validate-btn')?.addEventListener('click', handleValidate);
    $('#remember-key')?.addEventListener('change', e => { state.rememberKey = e.target.checked; });

    // Prompt
    const bp = $('#base-prompt');
    if (bp) {
        const debounced = debounce(() => {
            state.basePrompt = bp.value;
            updateCounter();
            updateUpgradeBtn();
        }, 300);
        bp.addEventListener('input', debounced);
    }

    // File
    initFiles();

    // Seg
    $$('#output-mode-control .seg-btn').forEach(btn => btn.addEventListener('click', () => {
        $$('#output-mode-control .seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.outputMode = btn.dataset.value;
    }));
    $('#engine-style')?.addEventListener('change', e => { state.engineStyle = e.target.value; });

    // Main actions
    $('#start-upgrade-btn')?.addEventListener('click', handleUpgrade);
    $('#generate-final-btn')?.addEventListener('click', handleFinal);
    $('#copy-btn')?.addEventListener('click', handleCopy);
    $('#regenerate-btn')?.addEventListener('click', handleFinal);
    $('#save-history-btn')?.addEventListener('click', handleSave);
    $('#improve-btn')?.addEventListener('click', handleImprove);
    $('#edit-mode-btn')?.addEventListener('click', toggleEdit);
    $('#download-txt-btn')?.addEventListener('click', () => {
        if (!state.finalPrompt) { toast('Nothing to export.', 'warning'); return; }
        downloadFile(state.finalPrompt, 'vantage-forge-prompt.txt');
        toast('TXT downloaded.', 'success');
    });
    $('#download-json-btn')?.addEventListener('click', () => {
        if (!state.finalPrompt) { toast('Nothing to export.', 'warning'); return; }
        const data = { application:'VΛNTAGE FORGE', basePrompt:state.basePrompt, outputMode:state.outputMode, engineStyle:state.engineStyle, configuration:state.selections, customRequirements:state.customRequirements, finalPrompt:state.finalPrompt, quality:state.qualityData, timestamp:new Date().toISOString() };
        downloadFile(JSON.stringify(data, null, 2), 'vantage-forge-prompt.json', 'application/json');
        toast('JSON downloaded.', 'success');
    });

    // Config
    $('#config-prev')?.addEventListener('click', () => navigatePhase(-1));
    $('#config-next')?.addEventListener('click', () => navigatePhase(1));
    $('#auto-config-btn')?.addEventListener('click', () => { state.selections = autoConfigureSelections(state.phases); renderPhaseOpts(); toast('Auto-configured.', 'info'); });
    $('#add-custom-req')?.addEventListener('click', showCustomModal);

    // Custom modal
    $('#cr-cancel')?.addEventListener('click', () => $('#custom-req-modal')?.classList.add('hidden'));
    $('#cr-save')?.addEventListener('click', saveCustomReq);

    // Rate modal
    $('#rate-modal-close')?.addEventListener('click', () => $('#rate-modal')?.classList.add('hidden'));

    // Settings
    $('#s-clear-key')?.addEventListener('click', clearKey);
    $('#s-clear-history')?.addEventListener('click', () => { state.history = []; storage.clearHistory(); renderHistory(); toast('History cleared.', 'info'); });
    $('#s-reset-app')?.addEventListener('click', () => { storage.clearAll(); window.location.reload(); });
    $('#s-bg-video')?.addEventListener('change', e => { state.settings.bgVideo = e.target.checked; $('#bg-video')?.classList.toggle('vid-off', !e.target.checked); storage.saveSettings(state.settings); });
    $('#s-particles')?.addEventListener('change', e => { state.settings.particles = e.target.checked; setParticlesEnabled(e.target.checked); storage.saveSettings(state.settings); });
    $('#s-reduced-motion')?.addEventListener('change', e => { state.settings.reducedMotion = e.target.checked; setReducedMotion(e.target.checked); storage.saveSettings(state.settings); });

    $$('video').forEach(v => v.addEventListener('contextmenu', e => e.preventDefault()));
}

// ================================================================
// PANEL
// ================================================================
function switchPanel(name) {
    state.currentPanel = name;
    $$('.nav-btn').forEach(b => { b.classList.toggle('active', b.dataset.panel === name); b.setAttribute('aria-current', b.dataset.panel === name ? 'page' : 'false'); });
    $$('.panel').forEach(p => p.classList.toggle('active', p.dataset.panel === name));
    if (name === 'history') renderHistory();
    if (name === 'settings') updateSettings();
}

function toggleMobile() { $('#sidebar')?.classList.toggle('open'); $('#sidebar-overlay')?.classList.toggle('show'); }
function closeMobile() { $('#sidebar')?.classList.remove('open'); $('#sidebar-overlay')?.classList.remove('show'); }

// ================================================================
// STATUS
// ================================================================
function setStatus(type, text) {
    ['#status-dot','#sidebar-status-dot'].forEach((sel, i) => {
        const el = $(sel); if (el) el.className = (i === 0 ? 'status-dot' : 'status-dot-sm') + ' s-' + type;
    });
    const st = $('#status-text'); if (st) st.textContent = text;
    const sl = $('#sidebar-status-label'); if (sl) sl.textContent = text;
}

// ================================================================
// TOAST
// ================================================================
function toast(msg, type = 'info', dur = 4000) {
    const c = $('#toast-container'); if (!c) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type}`; el.textContent = msg; c.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, dur);
}

// ================================================================
// BUTTON HELPERS
// ================================================================
function setLoading(btn, v) {
    if (!btn) return;
    btn.classList.toggle('loading', v);
    btn.disabled = v;
}

function flashBtn(btn, type) {
    if (!btn) return;
    btn.classList.add(`flash-${type}`);
    setTimeout(() => btn.classList.remove(`flash-${type}`), 700);
}

// ================================================================
// API KEY
// ================================================================
function toggleKeyVis() {
    const inp = $('#api-key-input');
    const show = $('.eye-show'), hide = $('.eye-hide');
    if (!inp) return;
    const isPass = inp.type === 'password';
    inp.type = isPass ? 'text' : 'password';
    if (show) show.style.display = isPass ? 'none' : 'block';
    if (hide) hide.style.display = isPass ? 'block' : 'none';
}

async function handleValidate() {
    const inp = $('#api-key-input');
    const btn = $('#validate-btn');
    const key = inp?.value?.trim();
    if (!key) { showGateMsg('Masukkan API Key.', 'error'); return; }
    setLoading(btn, true);
    showGateMsg('Memvalidasi...', '');
    setStatus('processing', 'VALIDATING...');
    try {
        await validateApiKey(key);
        state.apiKey = key; state.unlocked = true;
        if (state.rememberKey) storage.saveApiKey(key);
        showGateMsg('API Key valid. Engine unlocked.', 'success');
        setStatus('connected', 'API CONNECTED');
        toast('VΛNTAGE FORGE unlocked.', 'success');
        flashBtn(btn, 'success');
        unlockFeature();
        updateSettings();
    } catch (err) {
        showGateMsg(err.message, 'error');
        setStatus('error', 'VALIDATION FAILED');
        toast(err.message, 'error');
        flashBtn(btn, 'error');
    } finally { setLoading(btn, false); }
}

function showGateMsg(text, type) {
    const el = $('#api-gate-msg'); if (!el) return;
    el.textContent = text; el.className = 'gate-msg' + (type ? ` ${type}` : '');
}

function unlockFeature() {
    const f = $('#main-feature'); if (!f) return;
    f.classList.remove('feature-locked');
    f.style.cssText = 'display:block;opacity:0;transform:translateY(20px);transition:opacity 0.5s ease,transform 0.5s ease;';
    requestAnimationFrame(() => { f.style.opacity = '1'; f.style.transform = 'translateY(0)'; });
}

// ================================================================
// CHAR COUNTER
// ================================================================
function updateCounter() {
    const el = $('#char-counter'), warn = $('#char-warning'); if (!el) return;
    const l = state.basePrompt.length;
    el.textContent = `${l} character${l !== 1 ? 's' : ''}`;
    if (warn) warn.classList.toggle('hidden', l <= 10000);
}

function updateUpgradeBtn() {
    const btn = $('#start-upgrade-btn'); if (btn) btn.disabled = !state.basePrompt.trim();
}

// ================================================================
// FILES
// ================================================================
function initFiles() {
    const zone = $('#file-drop-zone'), inp = $('#file-input'); if (!zone || !inp) return;
    zone.addEventListener('click', () => inp.click());
    zone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') inp.click(); });
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('drag-over'); handleFiles(e.dataTransfer.files); });
    inp.addEventListener('change', () => { handleFiles(inp.files); inp.value = ''; });
}

async function handleFiles(list) {
    for (const file of list) {
        if (!isAllowedFile(file)) { toast(`Not supported: ${file.name}`, 'warning'); continue; }
        if (state.attachedFiles.some(f => f.name === file.name)) { toast(`Already attached: ${file.name}`, 'warning'); continue; }
        try {
            const content = await readFileAsText(file);
            state.attachedFiles.push({ name: file.name, type: file.type, size: file.size, content });
            toast(`Attached: ${file.name}`, 'info');
        } catch (e) { toast(e.message, 'error'); }
    }
    renderFiles();
}

function renderFiles() {
    const list = $('#file-list'), warn = $('#file-context-warn'); if (!list) return;
    list.innerHTML = '';
    for (const f of state.attachedFiles) {
        const item = document.createElement('div'); item.className = 'file-item';
        const info = document.createElement('div'); info.className = 'file-item-info';
        info.innerHTML = `<span class="file-item-name">${escapeHtml(f.name)}</span><span class="file-item-size">${formatBytes(f.size)}</span>`;
        const rm = document.createElement('button'); rm.className = 'file-item-remove'; rm.textContent = '✕'; rm.type = 'button';
        rm.setAttribute('aria-label', `Remove ${f.name}`);
        rm.addEventListener('click', () => { state.attachedFiles = state.attachedFiles.filter(x => x.name !== f.name); renderFiles(); toast(`Removed: ${f.name}`, 'info'); });
        item.appendChild(info); item.appendChild(rm); list.appendChild(item);
    }
    if (warn) warn.classList.toggle('hidden', state.attachedFiles.length === 0);
}

// ================================================================
// PROCESSING ANIMATION
// ================================================================
function showProcessing(stages) {
    const block = $('#processing-block'), statusEl = $('#processing-status'), phaseEl = $('#processing-phase');
    if (!block) return () => {};
    block.classList.remove('hidden');
    let i = 0;
    const interval = setInterval(() => {
        if (i < stages.length) { if (statusEl) statusEl.textContent = stages[i]; if (phaseEl) phaseEl.textContent = `Phase ${i+1} / ${stages.length}`; i++; }
    }, 2500);
    return () => { clearInterval(interval); block.classList.add('hidden'); };
}

// ================================================================
// RATE LIMIT
// ================================================================
function checkRate() {
    if (!rateLimiter.canProceed()) {
        const modal = $('#rate-modal'), cd = $('#rate-countdown');
        let rem = rateLimiter.getWaitSeconds();
        if (modal) modal.classList.remove('hidden');
        if (cd) cd.textContent = rem;
        setStatus('limited', 'RATE LIMITED');
        const intv = setInterval(() => {
            rem--; if (cd) cd.textContent = rem;
            if (rem <= 0) { clearInterval(intv); if (modal) modal.classList.add('hidden'); setStatus('connected', 'API CONNECTED'); }
        }, 1000);
        return false;
    }
    return true;
}

// ================================================================
// UPGRADE
// ================================================================
async function handleUpgrade() {
    if (!state.unlocked || !state.apiKey) { toast('Validate API Key first.', 'warning'); return; }
    if (!state.basePrompt.trim()) { toast('Enter a prompt.', 'warning'); return; }
    if (!checkRate()) return;
    const btn = $('#start-upgrade-btn');
    setLoading(btn, true);
    setStatus('processing', 'ANALYZING...');
    $('#analysis-block')?.classList.add('hidden');
    $('#config-block')?.classList.add('hidden');
    $('#final-block')?.classList.add('hidden');
    $('#conflict-block')?.classList.add('hidden');
    const stop = showProcessing(STAGES_ANALYZE);
    try {
        rateLimiter.record();
        const fileCtx = state.attachedFiles.length > 0 ? buildFileContext(state.attachedFiles) : '';
        const result = await generateOptions(state.apiKey, state.basePrompt, fileCtx, state.engineStyle, state.outputMode);
        stop();
        state.analysis = result.analysis;
        state.phases = result.configuration?.phases || [];
        state.currentPhase = 0;
        state.selections = initSelections(state.phases);
        state.generationVersions = []; state.currentVersion = -1;
        renderAnalysis(); renderConfig();
        setStatus('complete', 'ANALYSIS COMPLETE');
        const total = state.phases.reduce((s, p) => s + p.options.length, 0);
        toast(`Analysis complete. ${total} options generated.`, 'success');
        flashBtn(btn, 'success');
    } catch (e) {
        stop(); setStatus('error', 'FAILED'); toast(e.message, 'error'); flashBtn(btn, 'error');
    } finally { setLoading(btn, false); }
}

// ================================================================
// RENDER ANALYSIS
// ================================================================
function renderAnalysis() {
    const block = $('#analysis-block'); if (!block || !state.analysis) return;
    const a = state.analysis;
    $('#analysis-intent').textContent = a.intent || '—';
    $('#analysis-domain').textContent = a.domain || '—';
    $('#analysis-complexity').textContent = (a.complexity || '—').toUpperCase();
    $('#analysis-options-count').textContent = state.phases.reduce((s, p) => s + p.options.length, 0);
    $('#analysis-text').textContent = a.summary || '';

    const setList = (blockId, listId, items, prefix) => {
        const b = $(blockId), l = $(listId); if (!b || !l) return;
        if (items?.length > 0) { l.innerHTML = ''; items.forEach(x => { const li = document.createElement('li'); li.textContent = x; l.appendChild(li); }); b.classList.remove('hidden'); }
        else b.classList.add('hidden');
    };
    setList('#analysis-missing','#analysis-missing-list', a.missing_information);
    setList('#analysis-recommendations','#analysis-rec-list', a.recommendations);

    const fsb = $('#analysis-file-suggest'), fsl = $('#analysis-file-suggest-list');
    if (fsb && fsl && a.suggested_files?.length > 0) {
        fsl.innerHTML = '';
        a.suggested_files.forEach(f => { const t = document.createElement('span'); t.className = 'file-drop-sub'; t.textContent = f; t.style.cssText = 'display:inline-block;margin-right:8px;padding:2px 8px;border:1px solid var(--border);border-radius:var(--r);'; fsl.appendChild(t); });
        fsb.classList.remove('hidden');
    } else if (fsb) fsb.classList.add('hidden');

    block.classList.remove('hidden');
}

// ================================================================
// RENDER CONFIG
// ================================================================
function renderConfig() {
    const block = $('#config-block'); if (!block || !state.phases.length) return;
    renderPhaseTabs(); renderPhaseOpts(); updateProgress();
    block.classList.remove('hidden');
}

function renderPhaseTabs() {
    const tabs = $('#phase-tabs'); if (!tabs) return;
    tabs.innerHTML = '';
    state.phases.forEach((p, i) => {
        const tab = document.createElement('button'); tab.type = 'button';
        tab.className = 'phase-tab' + (i === state.currentPhase ? ' active' : '');
        tab.textContent = p.title.toUpperCase();
        tab.addEventListener('click', () => { state.currentPhase = i; renderPhaseTabs(); renderPhaseOpts(); updateProgress(); });
        tabs.appendChild(tab);
    });
}

function renderPhaseOpts() {
    const container = $('#options-container'); if (!container) return;
    container.innerHTML = '';
    const phase = state.phases[state.currentPhase]; if (!phase) return;
    const frag = document.createDocumentFragment();
    phase.options.forEach((opt, i) => frag.appendChild(createOptionCard(opt, i)));
    container.appendChild(frag);

    const prev = $('#config-prev'), next = $('#config-next');
    if (prev) prev.disabled = state.currentPhase === 0;
    if (next) next.textContent = state.currentPhase === state.phases.length - 1 ? 'DONE ✓' : 'NEXT ›';

    updateContextStack();
}

function updateProgress() {
    const fill = $('#config-progress-fill'), label = $('#config-phase-label'), count = $('#config-phase-count');
    const total = state.phases.length, cur = state.currentPhase + 1;
    if (fill) fill.style.width = (cur / total * 100) + '%';
    if (label) label.textContent = `PHASE ${String(cur).padStart(2, '0')}`;
    if (count) count.textContent = `${cur} / ${total}`;
}

function navigatePhase(dir) {
    const n = state.currentPhase + dir;
    if (n < 0 || n >= state.phases.length) return;
    state.currentPhase = n; renderPhaseTabs(); renderPhaseOpts(); updateProgress();
    $('#options-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateContextStack() {
    const b = $('#context-stack-body'); if (b) b.textContent = buildContextSummary(state);
}

// ================================================================
// CUSTOM REQ
// ================================================================
function showCustomModal() {
    const modal = $('#custom-req-modal'); if (!modal) return;
    $('#cr-title').value = ''; $('#cr-value').value = '';
    $('#cr-type').value = 'requirement'; $('#cr-priority').value = 'medium';
    modal.classList.remove('hidden');
}

function saveCustomReq() {
    const title = $('#cr-title')?.value?.trim(), value = $('#cr-value')?.value?.trim();
    const type = $('#cr-type')?.value || 'requirement', priority = $('#cr-priority')?.value || 'medium';
    if (!title || !value) { toast('Title and description required.', 'warning'); return; }
    state.customRequirements.push({ id: generateId(), title, value, type, priority });
    renderCustomReqs(); $('#custom-req-modal')?.classList.add('hidden');
    toast('Custom requirement added.', 'success'); updateContextStack();
}

function renderCustomReqs() {
    const list = $('#custom-req-list'); if (!list) return;
    list.innerHTML = '';
    for (const cr of state.customRequirements) {
        const item = document.createElement('div'); item.className = 'custom-req-item';
        const info = document.createElement('div'); info.className = 'custom-req-info';
        info.innerHTML = `<div class="custom-req-title">${escapeHtml(cr.title)}</div><div class="custom-req-desc">${escapeHtml(cr.value)}</div><div class="custom-req-meta">${cr.type} • ${cr.priority}</div>`;
        const rm = document.createElement('button'); rm.className = 'file-item-remove'; rm.textContent = '✕'; rm.type = 'button';
        rm.addEventListener('click', () => { state.customRequirements = state.customRequirements.filter(r => r.id !== cr.id); renderCustomReqs(); updateContextStack(); });
        item.appendChild(info); item.appendChild(rm); list.appendChild(item);
    }
}

// ================================================================
// GENERATE FINAL
// ================================================================
async function handleFinal() {
    if (!state.unlocked || !state.apiKey) { toast('Validate API Key first.', 'warning'); return; }
    if (!state.phases.length) { toast('Run analysis first.', 'warning'); return; }
    if (!checkRate()) return;

    const conflicts = detectConflicts(state.phases, state.selections);
    if (conflicts.length > 0) renderConflicts(conflicts);

    const btn = $('#generate-final-btn');
    setLoading(btn, true); setStatus('processing', 'GENERATING...');
    $('#final-block')?.classList.add('hidden');
    const stop = showProcessing(STAGES_FINAL);
    try {
        rateLimiter.record();
        const readable = buildReadableSelections(state.phases, state.selections, state.customRequirements);
        const fileCtx = state.attachedFiles.length > 0 ? buildFileContext(state.attachedFiles) : '';
        const result = await generateFinalPrompt(state.apiKey, state.basePrompt, state.analysis?.summary || '', readable, fileCtx, state.engineStyle, state.outputMode);
        stop();
        state.finalPrompt = result.finalPrompt; state.qualityData = result.quality || null;
        state.generationVersions.push({ prompt: result.finalPrompt, quality: result.quality, timestamp: new Date().toISOString() });
        state.currentVersion = state.generationVersions.length - 1;
        renderFinal(result);
        setStatus('complete', 'GENERATION COMPLETE');
        toast('Super Prompt generated.', 'success');
        flashBtn(btn, 'success');
    } catch (e) { stop(); setStatus('error', 'FAILED'); toast(e.message, 'error'); flashBtn(btn, 'error'); }
    finally { setLoading(btn, false); }
}

function renderConflicts(conflicts) {
    const block = $('#conflict-block'), list = $('#conflict-list'), desc = $('#conflict-desc');
    if (!block || !list) return;
    if (desc) desc.textContent = `${conflicts.length} conflict(s) detected`;
    list.innerHTML = '';
    conflicts.forEach(c => {
        const item = document.createElement('div'); item.className = 'conflict-item';
        const t = document.createElement('div'); t.className = 'conflict-item-text'; t.textContent = c;
        item.appendChild(t); list.appendChild(item);
    });
    block.classList.remove('hidden');
}

function renderFinal(result) {
    const block = $('#final-block'), ta = $('#final-prompt');
    if (!block || !ta) return;
    ta.value = result.finalPrompt; ta.readOnly = true;
    const eb = $('#edit-mode-btn'); if (eb) eb.textContent = 'EDIT MODE';
    if (result.quality) renderQuality(result.quality);

    const wb = $('#quality-warnings'), wl = $('#quality-warnings-list');
    if (wb && wl) {
        if (result.warnings?.length > 0) { wl.innerHTML = ''; result.warnings.forEach(w => { const li = document.createElement('li'); li.textContent = w; wl.appendChild(li); }); wb.classList.remove('hidden'); }
        else wb.classList.add('hidden');
    }
    renderGenVersions();
    $('#diff-block')?.classList.add('hidden');
    block.classList.remove('hidden');
    block.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderQuality(q) {
    const overall = $('#quality-overall'), bar = $('#quality-bar'), bd = $('#quality-breakdown');
    if (overall) overall.textContent = (q.overall || 0) + ' %';
    if (bar) setTimeout(() => { bar.style.width = (q.overall || 0) + '%'; }, 100);
    if (bd) {
        bd.innerHTML = '';
        const metrics = [['Clarity',q.clarity],['Specificity',q.specificity],['Completeness',q.completeness],['Constraints',q.constraints],['Security',q.security]];
        metrics.forEach(([l, v]) => {
            if (v === undefined || v === null) return;
            const item = document.createElement('div'); item.className = 'qb-item';
            item.innerHTML = `<span class="qb-label">${l}</span><span class="qb-val">${v}</span>`;
            bd.appendChild(item);
        });
    }
}

function renderGenVersions() {
    const block = $('#gen-versions'), list = $('#gen-versions-list');
    if (!block || !list) return;
    if (state.generationVersions.length <= 1) { block.classList.add('hidden'); return; }
    list.innerHTML = '';
    state.generationVersions.forEach((v, i) => {
        const btn = document.createElement('button'); btn.type = 'button';
        btn.className = 'gen-version-btn' + (i === state.currentVersion ? ' active' : '');
        btn.textContent = `Gen ${i+1}`;
        btn.addEventListener('click', () => {
            state.currentVersion = i; state.finalPrompt = v.prompt; state.qualityData = v.quality;
            const ta = $('#final-prompt'); if (ta) ta.value = v.prompt;
            if (v.quality) renderQuality(v.quality);
            renderGenVersions();
        });
        list.appendChild(btn);
    });
    block.classList.remove('hidden');
}

// ================================================================
// IMPROVE
// ================================================================
async function handleImprove() {
    if (!state.finalPrompt) { toast('No prompt to improve.', 'warning'); return; }
    if (!checkRate()) return;
    const btn = $('#improve-btn'); setLoading(btn, true); setStatus('processing', 'IMPROVING...');
    try {
        rateLimiter.record();
        const prev = state.finalPrompt;
        const result = await improvePrompt(state.apiKey, state.finalPrompt);
        state.finalPrompt = result.improvedPrompt; state.qualityData = result.quality || state.qualityData;
        state.generationVersions.push({ prompt: result.improvedPrompt, quality: result.quality, timestamp: new Date().toISOString() });
        state.currentVersion = state.generationVersions.length - 1;
        const ta = $('#final-prompt'); if (ta) ta.value = result.improvedPrompt;
        if (result.quality) renderQuality(result.quality);
        renderDiff(prev, result.improvedPrompt); renderGenVersions();
        setStatus('complete', 'IMPROVED'); toast('Prompt improved.', 'success'); flashBtn(btn, 'success');
    } catch (e) { setStatus('error', 'FAILED'); toast(e.message, 'error'); flashBtn(btn, 'error'); }
    finally { setLoading(btn, false); }
}

function renderDiff(oldT, newT) {
    const block = $('#diff-block'), content = $('#diff-content'); if (!block || !content) return;
    const diffs = simpleDiff(oldT, newT); content.innerHTML = '';
    diffs.forEach(d => {
        const line = document.createElement('div');
        line.className = d.type === 'added' ? 'diff-line-add' : d.type === 'removed' ? 'diff-line-rem' : 'diff-line-same';
        line.textContent = (d.type === 'added' ? '+ ' : d.type === 'removed' ? '- ' : '  ') + d.text;
        content.appendChild(line);
    });
    block.classList.remove('hidden');
}

// ================================================================
// EDIT MODE
// ================================================================
function toggleEdit() {
    const ta = $('#final-prompt'), btn = $('#edit-mode-btn'); if (!ta || !btn) return;
    ta.readOnly = !ta.readOnly;
    btn.textContent = ta.readOnly ? 'EDIT MODE' : 'LOCK';
    if (!ta.readOnly) ta.focus();
    else state.finalPrompt = ta.value;
}

// ================================================================
// COPY
// ================================================================
async function handleCopy() {
    const text = $('#final-prompt')?.value; if (!text) { toast('Nothing to copy.', 'warning'); return; }
    const ok = await copyToClipboard(text);
    if (ok) { toast('Copied.', 'success'); flashBtn($('#copy-btn'), 'success'); }
    else toast('Copy failed.', 'error');
}

// ================================================================
// HISTORY
// ================================================================
function handleSave() {
    if (!state.finalPrompt) { toast('No prompt to save.', 'warning'); return; }
    const entry = { id: generateId(), title: truncate(state.basePrompt), basePrompt: state.basePrompt, finalPrompt: state.finalPrompt, versions: [...state.generationVersions], quality: state.qualityData, timestamp: new Date().toISOString() };
    state.history.unshift(entry);
    if (state.history.length > 50) state.history = state.history.slice(0, 50);
    storage.saveHistory(state.history);
    toast('Saved to history.', 'success');
    flashBtn($('#save-history-btn'), 'success');
}

function renderHistory() {
    state.history = storage.loadHistory();
    const list = $('#history-list'); if (!list) return;
    if (!state.history.length) { list.innerHTML = '<div class="empty-state">No history saved yet.</div>'; return; }
    const frag = document.createDocumentFragment();
    for (const entry of state.history) {
        const item = document.createElement('div'); item.className = 'history-item';
        item.innerHTML = `<div class="hi-header"><span class="hi-title">${escapeHtml(entry.title)}</span><span class="hi-time">${formatTimestamp(entry.timestamp)}</span></div><div class="hi-base">${escapeHtml(entry.basePrompt)}</div><div class="hi-actions"></div>`;
        const actions = item.querySelector('.hi-actions');

        const viewBtn = document.createElement('button'); viewBtn.className = 'btn btn-outline'; viewBtn.type = 'button'; viewBtn.textContent = 'VIEW';
        viewBtn.addEventListener('click', () => showHistoryModal(entry)); actions.appendChild(viewBtn);

        const copyBtn = document.createElement('button'); copyBtn.className = 'btn btn-outline'; copyBtn.type = 'button'; copyBtn.textContent = 'COPY';
        copyBtn.addEventListener('click', async () => { const ok = await copyToClipboard(entry.finalPrompt); toast(ok ? 'Copied.' : 'Failed.', ok ? 'success' : 'error'); }); actions.appendChild(copyBtn);

        const delBtn = document.createElement('button'); delBtn.className = 'btn btn-danger'; delBtn.type = 'button'; delBtn.textContent = 'DELETE';
        delBtn.addEventListener('click', () => { state.history = state.history.filter(h => h.id !== entry.id); storage.saveHistory(state.history); renderHistory(); toast('Deleted.', 'info'); }); actions.appendChild(delBtn);

        frag.appendChild(item);
    }
    list.innerHTML = ''; list.appendChild(frag);
}

function showHistoryModal(entry) {
    const modal = $('#history-modal'); if (!modal) return;
    $('#hm-title').textContent = entry.title;
    $('#hm-time').textContent = formatTimestamp(entry.timestamp);
    $('#hm-base').textContent = entry.basePrompt;
    $('#hm-final').value = entry.finalPrompt;

    const vs = $('#hm-versions-section'), vc = $('#hm-versions');
    if (vs && vc && entry.versions?.length > 1) {
        vc.innerHTML = '';
        entry.versions.forEach((v, i) => {
            const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'gen-version-btn'; btn.textContent = `Gen ${i+1}`;
            btn.addEventListener('click', () => { const f = $('#hm-final'); if (f) f.value = v.prompt; }); vc.appendChild(btn);
        });
        vs.classList.remove('hidden');
    } else if (vs) vs.classList.add('hidden');

    const newModal = modal.cloneNode(true); modal.parentNode.replaceChild(newModal, modal);
    newModal.querySelector('.hm-copy')?.addEventListener('click', async () => { const ok = await copyToClipboard(newModal.querySelector('#hm-final').value); toast(ok ? 'Copied.' : 'Failed.', ok ? 'success' : 'error'); });
    newModal.querySelector('.hm-use')?.addEventListener('click', () => {
        const bp = $('#base-prompt');
        if (bp) { bp.value = entry.basePrompt; state.basePrompt = entry.basePrompt; updateCounter(); updateUpgradeBtn(); }
        newModal.classList.add('hidden'); switchPanel('dashboard'); toast('Loaded as base prompt.', 'info');
    });
    newModal.querySelector('.hm-close')?.addEventListener('click', () => newModal.classList.add('hidden'));
    newModal.addEventListener('click', e => { if (e.target === newModal) newModal.classList.add('hidden'); });
    newModal.classList.remove('hidden');
}

// ================================================================
// SETTINGS
// ================================================================
function updateSettings() {
    const el = $('#s-api-status'); if (!el) return;
    if (state.unlocked) { el.textContent = 'CONNECTED'; el.className = 'settings-val val-active'; }
    else { el.textContent = 'NOT SET'; el.style.color = 'var(--danger)'; }
}

function clearKey() {
    state.apiKey = null; state.unlocked = false;
    const inp = $('#api-key-input'); if (inp) { inp.value = ''; inp.type = 'password'; }
    const sh = $('.eye-show'), hd = $('.eye-hide');
    if (sh) sh.style.display = 'block'; if (hd) hd.style.display = 'none';
    const f = $('#main-feature'); if (f) { f.classList.add('feature-locked'); f.style.display = 'none'; }
    $('#analysis-block')?.classList.add('hidden'); $('#config-block')?.classList.add('hidden'); $('#final-block')?.classList.add('hidden');
    storage.clearApiKey(); showGateMsg('', ''); setStatus('ready', 'SYSTEM READY'); updateSettings();
    toast('API Key cleared.', 'info');
}