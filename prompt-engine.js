export function detectConflicts(phases, selections) {
    const rules = [
        { a: { q: /performance|speed/i, v: /maximum|high|extreme/i }, b: { q: /caching|cache/i, v: /no|disable|off|none/i }, msg: 'Maximum performance selected but caching is disabled.' },
        { a: { q: /security/i, v: /maximum|high|strict/i }, b: { q: /authentication/i, v: /none|no|disable/i }, msg: 'High security selected but authentication is disabled.' },
    ];
    const opts = [];
    for (const p of phases) for (const o of p.options) {
        const v = selections[o.id];
        if (v !== null && v !== undefined && v !== '') opts.push({ question: o.question, value: v });
    }
    const conflicts = [];
    for (const r of rules) {
        const a = opts.find(o => r.a.q.test(o.question) && r.a.v.test(String(o.value)));
        const b = opts.find(o => r.b.q.test(o.question) && r.b.v.test(String(o.value)));
        if (a && b) conflicts.push(r.msg);
    }
    return conflicts;
}

export function buildContextSummary(state) {
    const p = [];
    p.push(`BASE PROMPT:\n${state.basePrompt || '(empty)'}\n`);
    if (state.attachedFiles.length > 0) p.push(`ATTACHED FILES:\n${state.attachedFiles.map(f => `- ${f.name}`).join('\n')}\n`);
    if (state.customRequirements.length > 0) p.push(`CUSTOM REQUIREMENTS:\n${state.customRequirements.map(r => `- [${r.priority}] ${r.title}: ${r.value}`).join('\n')}\n`);
    const c = Object.values(state.selections).filter(v => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)).length;
    p.push(`CONFIGURED OPTIONS: ${c}`);
    p.push(`OUTPUT MODE: ${state.outputMode.toUpperCase()}`);
    p.push(`ENGINE STYLE: ${state.engineStyle.replace(/_/g,' ').toUpperCase()}`);
    return p.join('\n');
}

export function buildReadableSelections(phases, selections, customReqs) {
    const r = {};
    for (const ph of phases) for (const o of ph.options) {
        const v = selections[o.id];
        if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) continue;
        r[o.question] = v;
    }
    for (const cr of (customReqs || [])) r[`[Custom] ${cr.title}`] = cr.value;
    return r;
}

export function autoConfigureSelections(phases) {
    const s = {};
    for (const ph of phases) for (const o of ph.options) {
        if (o.recommended !== null && o.recommended !== undefined) { s[o.id] = o.recommended; continue; }
        if (o.default !== null && o.default !== undefined) { s[o.id] = o.default; continue; }
        switch (o.type) {
            case 'multiple_choice': case 'dropdown': case 'code_style': s[o.id] = o.choices?.[0] || null; break;
            case 'checkbox': case 'multi_select': s[o.id] = []; break;
            case 'text_input': case 'textarea': s[o.id] = ''; break;
            case 'number': s[o.id] = o.min ?? 0; break;
            case 'slider': s[o.id] = Math.round(((o.min||0)+(o.max||100))/2); break;
            case 'boolean': s[o.id] = false; break;
            case 'color': s[o.id] = '#ff6b00'; break;
            default: s[o.id] = null;
        }
    }
    return s;
}

export function initSelections(phases) {
    const s = {};
    for (const ph of phases) for (const o of ph.options) {
        switch (o.type) {
            case 'checkbox': case 'multi_select': s[o.id] = []; break;
            case 'text_input': case 'textarea': s[o.id] = ''; break;
            case 'number': s[o.id] = o.default ?? o.min ?? 0; break;
            case 'slider': s[o.id] = o.default ?? 50; break;
            case 'boolean': s[o.id] = o.default ?? false; break;
            case 'color': s[o.id] = o.default || '#ff6b00'; break;
            default: s[o.id] = o.default ?? null;
        }
    }
    return s;
}