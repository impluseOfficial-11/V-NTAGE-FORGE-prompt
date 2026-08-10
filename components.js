import state from './state.js';

export function createOptionCard(opt, index) {
    const card = document.createElement('div');
    card.className = 'option-card';
    card.style.animationDelay = `${Math.min(index * 40, 600)}ms`;

    const header = document.createElement('div');
    header.className = 'option-header';
    const num = document.createElement('span'); num.className = 'option-num'; num.textContent = `#${index+1}`;
    const q = document.createElement('span'); q.className = 'option-q'; q.textContent = opt.question;
    header.appendChild(num); header.appendChild(q); card.appendChild(header);

    if (opt.description) {
        const desc = document.createElement('div'); desc.className = 'option-desc'; desc.textContent = opt.description; card.appendChild(desc);
    }

    const body = document.createElement('div'); body.className = 'option-body';

    switch (opt.type) {
        case 'multiple_choice': case 'code_style': body.appendChild(buildRadio(opt)); break;
        case 'checkbox': case 'multi_select': body.appendChild(buildCheckbox(opt)); break;
        case 'dropdown': body.appendChild(buildDropdown(opt)); break;
        case 'text_input': body.appendChild(buildText(opt)); break;
        case 'textarea': body.appendChild(buildTextarea(opt)); break;
        case 'number': body.appendChild(buildNumber(opt)); break;
        case 'slider': body.appendChild(buildSlider(opt)); break;
        case 'boolean': body.appendChild(buildBoolean(opt)); break;
        case 'color': body.appendChild(buildColor(opt)); break;
        default: body.appendChild(buildText(opt));
    }
    card.appendChild(body);

    if (opt.recommended) {
        const rec = document.createElement('div'); rec.className = 'option-rec'; rec.textContent = `Recommended: ${opt.recommended}`; card.appendChild(rec);
    }
    return card;
}

function buildRadio(opt) {
    const w = document.createElement('div'); w.className = 'option-choices';
    const name = `r_${opt.id}`;
    for (const c of (opt.choices || [])) {
        const label = document.createElement('label'); label.className = 'option-choice';
        const inp = document.createElement('input'); inp.type = 'radio'; inp.name = name; inp.value = c;
        if (state.selections[opt.id] === c) inp.checked = true;
        inp.addEventListener('change', () => { state.selections[opt.id] = c; });
        label.appendChild(inp); label.appendChild(document.createTextNode(c)); w.appendChild(label);
    }
    return w;
}

function buildCheckbox(opt) {
    const w = document.createElement('div'); w.className = 'option-choices';
    for (const c of (opt.choices || [])) {
        const label = document.createElement('label'); label.className = 'option-choice';
        const inp = document.createElement('input'); inp.type = 'checkbox'; inp.value = c;
        const arr = state.selections[opt.id];
        if (Array.isArray(arr) && arr.includes(c)) inp.checked = true;
        inp.addEventListener('change', () => {
            if (!Array.isArray(state.selections[opt.id])) state.selections[opt.id] = [];
            if (inp.checked) { if (!state.selections[opt.id].includes(c)) state.selections[opt.id].push(c); }
            else { state.selections[opt.id] = state.selections[opt.id].filter(x => x !== c); }
        });
        label.appendChild(inp); label.appendChild(document.createTextNode(c)); w.appendChild(label);
    }
    return w;
}

function buildDropdown(opt) {
    const s = document.createElement('select'); s.setAttribute('aria-label', opt.question);
    const empty = document.createElement('option'); empty.value = ''; empty.textContent = '— Select —'; s.appendChild(empty);
    for (const c of (opt.choices || [])) {
        const o = document.createElement('option'); o.value = c; o.textContent = c;
        if (state.selections[opt.id] === c) o.selected = true; s.appendChild(o);
    }
    s.addEventListener('change', () => { state.selections[opt.id] = s.value || null; });
    return s;
}

function buildText(opt) {
    const inp = document.createElement('input'); inp.type = 'text';
    inp.placeholder = opt.placeholder || 'Enter text...';
    inp.value = state.selections[opt.id] || ''; inp.setAttribute('aria-label', opt.question);
    inp.addEventListener('input', () => { state.selections[opt.id] = inp.value; });
    return inp;
}

function buildTextarea(opt) {
    const ta = document.createElement('textarea'); ta.rows = 3;
    ta.placeholder = opt.placeholder || 'Enter text...';
    ta.value = state.selections[opt.id] || ''; ta.setAttribute('aria-label', opt.question);
    ta.addEventListener('input', () => { state.selections[opt.id] = ta.value; });
    return ta;
}

function buildNumber(opt) {
    const inp = document.createElement('input'); inp.type = 'number';
    if (opt.min !== undefined) inp.min = opt.min;
    if (opt.max !== undefined) inp.max = opt.max;
    inp.value = state.selections[opt.id] ?? opt.default ?? 0;
    inp.setAttribute('aria-label', opt.question);
    inp.addEventListener('input', () => { state.selections[opt.id] = parseFloat(inp.value) || 0; });
    return inp;
}

function buildSlider(opt) {
    const w = document.createElement('div'); w.className = 'slider-wrap';
    const inp = document.createElement('input'); inp.type = 'range';
    inp.min = opt.min ?? 0; inp.max = opt.max ?? 100; inp.step = opt.step ?? 1;
    inp.value = state.selections[opt.id] ?? opt.default ?? 50;
    inp.setAttribute('aria-label', opt.question);
    const val = document.createElement('span'); val.className = 'slider-val'; val.textContent = inp.value;
    inp.addEventListener('input', () => { state.selections[opt.id] = parseFloat(inp.value); val.textContent = inp.value; });
    w.appendChild(inp); w.appendChild(val);
    return w;
}

function buildBoolean(opt) {
    const w = document.createElement('div'); w.className = 'bool-toggle';
    const yes = document.createElement('button'); yes.type = 'button'; yes.className = 'bool-btn' + (state.selections[opt.id] === true ? ' on' : ''); yes.textContent = 'YES';
    const no = document.createElement('button'); no.type = 'button'; no.className = 'bool-btn' + (state.selections[opt.id] === false ? ' on' : ''); no.textContent = 'NO';
    yes.addEventListener('click', () => { state.selections[opt.id] = true; yes.classList.add('on'); no.classList.remove('on'); });
    no.addEventListener('click', () => { state.selections[opt.id] = false; no.classList.add('on'); yes.classList.remove('on'); });
    w.appendChild(yes); w.appendChild(no);
    return w;
}

function buildColor(opt) {
    const inp = document.createElement('input'); inp.type = 'color';
    inp.value = state.selections[opt.id] || opt.default || '#ff6b00';
    inp.setAttribute('aria-label', opt.question);
    inp.addEventListener('input', () => { state.selections[opt.id] = inp.value; });
    return inp;
}