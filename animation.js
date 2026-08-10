import { $ } from './utils.js';

let pCtx = null, pAnimId = null, particles = [];
let particlesOn = true, reduced = false;

export function initAnimations() {
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    initCursorGlow();
    initParticles();
    updateClock();
    setInterval(updateClock, 30000);
}

export function setReducedMotion(val) {
    reduced = val;
    document.body.classList.toggle('reduced-motion', val);
    if (val) { stopParticles(); const cg = $('#cursor-glow'); if (cg) cg.classList.remove('visible'); }
    else { if (particlesOn) startParticles(); }
}

export function setParticlesEnabled(val) {
    particlesOn = val;
    val && !reduced ? startParticles() : stopParticles();
}

function initCursorGlow() {
    const el = $('#cursor-glow');
    if (!el || reduced || window.matchMedia('(hover:none)').matches) return;
    document.addEventListener('mousemove', e => {
        if (reduced) return;
        el.style.left = e.clientX + 'px';
        el.style.top = e.clientY + 'px';
        el.classList.add('visible');
    });
    document.addEventListener('mouseleave', () => el.classList.remove('visible'));
}

function initParticles() {
    const canvas = $('#bg-particles');
    if (!canvas || reduced) return;
    pCtx = canvas.getContext('2d');
    resize(canvas);
    window.addEventListener('resize', () => resize(canvas));
    for (let i = 0; i < 40; i++) particles.push(mkParticle(canvas));
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { cancelAnimationFrame(pAnimId); pAnimId = null; }
        else if (particlesOn && !reduced) startParticles();
    });
    if (particlesOn) startParticles();
}

function resize(c) { c.width = window.innerWidth; c.height = window.innerHeight; }

function mkParticle(c) {
    return {
        x: Math.random() * c.width, y: Math.random() * c.height,
        vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.5, alpha: Math.random() * 0.3 + 0.05,
        color: Math.random() > 0.7 ? '255,107,0' : '0,243,255',
    };
}

function startParticles() {
    if (pAnimId || !pCtx) return;
    const c = pCtx.canvas;
    function frame() {
        pCtx.clearRect(0, 0, c.width, c.height);
        for (const p of particles) {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0) p.x = c.width; if (p.x > c.width) p.x = 0;
            if (p.y < 0) p.y = c.height; if (p.y > c.height) p.y = 0;
            pCtx.beginPath();
            pCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            pCtx.fillStyle = `rgba(${p.color},${p.alpha})`;
            pCtx.fill();
        }
        pAnimId = requestAnimationFrame(frame);
    }
    frame();
}

function stopParticles() {
    if (pAnimId) { cancelAnimationFrame(pAnimId); pAnimId = null; }
    if (pCtx) pCtx.clearRect(0, 0, pCtx.canvas.width, pCtx.canvas.height);
}

function updateClock() {
    const el = $('#status-time');
    if (!el) return;
    const d = new Date();
    const p = n => n.toString().padStart(2, '0');
    el.textContent = `${p(d.getHours())}:${p(d.getMinutes())}`;
}