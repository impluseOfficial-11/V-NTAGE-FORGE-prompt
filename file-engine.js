import { formatBytes } from './utils.js';

const ALLOWED = new Set(['txt','md','json','csv','html','css','js','ts','py','java','php','sql','xml','yaml','yml','toml','cfg','ini','sh','rb','go','rs','swift','kt']);
const MAX_SIZE = 500 * 1024;
const MAX_CTX = 50000;

export function isAllowedFile(file) {
    return ALLOWED.has(file.name.split('.').pop().toLowerCase());
}

export function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        if (file.size > MAX_SIZE) { reject(new Error(`${file.name} exceeds ${formatBytes(MAX_SIZE)}.`)); return; }
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(new Error(`Failed to read ${file.name}.`));
        r.readAsText(file);
    });
}

export function buildFileContext(files) {
    return files.filter(f => f.content).map(f => {
        let c = f.content;
        if (c.length > MAX_CTX) c = c.substring(0, MAX_CTX) + '\n...[truncated]';
        return `--- FILE: ${f.name} ---\n${c}\n--- END ---`;
    }).join('\n\n');
}