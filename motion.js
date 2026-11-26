/* Motion layer for the portfolio.
 * app.js owns all state and changes it synchronously; this file only listens to
 * its portfolio:* events and animates on top. Every effect is skipped when the
 * visitor prefers reduced motion, so the site behaves identically without it.
 * Durations and easings come from the CSS custom properties (see DESIGN.md).
 */
(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const wide = matchMedia('(min-width: 761px)');
  const calm = () => reduce.matches;

  const css = getComputedStyle(root);
  const token = name => css.getPropertyValue(name).trim();
  const ms = name => parseFloat(token(name)) || 0;
  const supportsLinear = CSS.supports?.('transition-timing-function', 'linear(0, 1)');
  const EASE = {
    out: token('--ease-out') || 'ease-out',
    in: token('--ease-in') || 'ease-in',
    inOut: token('--ease-in-out') || 'ease-in-out',
    spring: supportsLinear ? token('--ease-spring') : 'cubic-bezier(.34,1.56,.64,1)',
    stiff: supportsLinear ? token('--ease-spring-stiff') : 'cubic-bezier(.22,1.2,.36,1)',
  };
  const D = {
    micro: ms('--dur-micro'), small: ms('--dur-small'), medium: ms('--dur-medium'),
    large: ms('--dur-large'), hero: ms('--dur-hero'), stagger: ms('--stagger'), char: ms('--stagger-char'),
  };

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const make = (tag, className, parent) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    parent?.append(node);
    return node;
  };
  const cancelWithin = scope => scope.getAnimations?.({ subtree: true }).forEach(animation => {
    if (animation instanceof CSSAnimation || animation instanceof CSSTransition) return;
    animation.cancel();
  });

  const phone = $('.phone');
  const screen = $('.phone-screen');
  const home = $('#phone-home-screen');
  const sheet = $('#phone-sheet');
  const sheetBody = $('#phone-sheet-body');
  const island = $('.dynamic-island');
  const order = ['overview', 'about', 'projects', 'stack', 'contact', 'canteen', 'workout', 'pos', 'inventory', 'ohman'];
  const depth = key => (key === 'overview' ? 0 : order.indexOf(key) > 4 ? 2 : 1);
  const projects = {
    canteen: { glyph: '▤', label: 'Smart Canteen' },
    workout: { glyph: '◉', label: 'Workout Tracker' },
    pos: { glyph: '₹', label: 'POS System' },
    inventory: { glyph: '▦', label: 'Core Inventory' },
    ohman: { glyph: '✺', label: 'ohman · fork' },
  };

  /* ---------- Split text ----------------------------------------------------
   * Screen readers get the sentence once, from a visually hidden copy; the
   * animated letters are aria-hidden.
   */
  function splitLetters(el) {
    if (el.dataset.split) return;
    el.dataset.split = 'letters';
    const plain = el.cloneNode(true);
    plain.querySelectorAll('br').forEach(br => br.replaceWith(' '));
    const sr = make('span', 'sr-only');
    sr.textContent = plain.textContent.replace(/\s+/g, ' ').trim();
    const visual = make('span');
    visual.setAttribute('aria-hidden', 'true');
    visual.append(...[...el.childNodes].map(node => node.cloneNode(true)));
    const walk = node => [...node.childNodes].forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        const fragment = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { fragment.append(part); return; }
          const word = make('span', 'split-w', fragment);
          [...part].forEach(letter => { make('span', 'split-c', word).textContent = letter; });
        });
        child.replaceWith(fragment);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') walk(child);
    });
    walk(visual);
    el.replaceChildren(sr, visual);
  }

  // Eyebrows decode from noise into their words.
  function prepareScramble(el) {
    if (el.dataset.split) return;
    const text = el.firstChild;
    if (!text || text.nodeType !== Node.TEXT_NODE) return;
    el.dataset.split = 'scramble';
    const sr = make('span', 'sr-only');
    sr.textContent = text.textContent;
    const visual = make('span', 'scramble');
    visual.setAttribute('aria-hidden', 'true');
    visual.dataset.text = text.textContent;
    visual.textContent = text.textContent;
    text.replaceWith(sr, visual);
  }
  const noise = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/✳·';
  function scramble(el, delay = 0) {
    const target = $('.scramble', el);
    if (!target) return;
    const text = target.dataset.text;
    const start = performance.now() + delay;
    const length = 520 + text.length * 14;
    cancelAnimationFrame(target._raf);
    const frame = now => {
      const t = clamp((now - start) / length, 0, 1);
      target.textContent = [...text].map((char, i) => {
        if (char === ' ' || t >= 1 || t > (i / text.length) * 0.85 + 0.15) return char;
        return now < start ? ' ' : noise[(Math.random() * noise.length) | 0];
      }).join('');
      if (t < 1) target._raf = requestAnimationFrame(frame);
    };
    target._raf = requestAnimationFrame(frame);
  }

  /* ---------- Panel entrances --------------------------------------------- */
  function animateLetters(el, delay) {
    const letters = $$('.split-c', el);
    const step = Math.min(D.char + 6, 560 / Math.max(letters.length, 1));
    letters.forEach((letter, i) => letter.animate([
      { transform: 'translateY(.85em) rotate(14deg) scale(.5)', opacity: 0 },
      { transform: 'none', opacity: 1 },
    ], { duration: D.hero, delay: delay + i * step, easing: EASE.spring, fill: 'backwards' }));
  }

  function enterPanel(panel, direction) {
    cancelWithin(panel);
    // Transforms count toward scroll width, so never travel past the viewport edge.
    const room = Math.max(0, innerWidth - panel.getBoundingClientRect().right - 2);
    const dx = direction > 0 ? Math.min(46, room) : -46;
    let i = 0;
    for (const child of panel.children) {
      if (child.classList.contains('detail-title')) { animateLetters(child, 70 + i * D.stagger); i++; continue; }
      if (child.classList.contains('eyebrow')) scramble(child, 40);
      const targets = child.matches('.project-list, .tag-list') ? [...child.children].filter(node => !node.hidden) : [child];
      targets.forEach(target => {
        target.animate([
          { opacity: 0, transform: `translate(${dx}px, 22px)`, filter: 'blur(10px)' },
          { opacity: 1, transform: 'none', filter: 'blur(0)' },
        ], { duration: D.large + 260, delay: 90 + i * D.stagger * 1.6, easing: EASE.out, fill: 'backwards' });
        i++;
      });
    }
  }

  function enterSheet(delay = 120) {
    [...sheetBody.children].forEach((child, i) => child.animate([
      { opacity: 0, transform: 'translateY(26px) scale(.97)' },
      { opacity: 1, transform: 'none' },
    ], { duration: D.large + 140, delay: delay + i * D.stagger * 1.3, easing: EASE.spring, fill: 'backwards' }));
  }

  /* ---------- Giant odometer index behind the panels ---------------------- */
  const column = $('.detail-column');
  const odometer = make('div', 'panel-index');
  odometer.setAttribute('aria-hidden', 'true');
  const strips = [0, 1].map(() => {
    const strip = make('span', 'odo-strip', make('span', 'odo', odometer));
    for (let n = 0; n < 10; n++) make('span', '', strip).textContent = n;
    return strip;
  });
  column.prepend(odometer);
  function indexFor(key) {
    const eyebrow = $(`.detail-panel[data-panel="${key}"] .eyebrow`);
    const match = eyebrow?.textContent.match(/(\d)(\d)/);
    return match ? [Number(match[1]), Number(match[2])] : [0, 0];
  }
  function setIndex(key) {
    indexFor(key).forEach((digit, i) => { strips[i].style.transform = `translateY(${-digit}em)`; });
  }

  /* ---------- Dynamic island ---------------------------------------------- */
  const islandText = make('span', 'island-text', island);
  let islandTimer;
  function islandSay(text, { hold = 1800, width } = {}) {
    if (calm()) return;
    islandText.replaceChildren(make('i'), document.createTextNode(text));
    island.style.setProperty('--island-w', `${width || Math.max(130, text.length * 6.2 + 52)}px`);
    island.classList.add('is-expanded');
    clearTimeout(islandTimer);
    islandTimer = setTimeout(() => island.classList.remove('is-expanded'), hold);
  }

  /* ---------- Phone: app open and close morphs ----------------------------- */
  let pendingHome = null;
  let originRect = null;
  const clearGhosts = () => $$('.phone-ghost', screen).forEach(ghost => ghost.remove());
  const relative = (rect, frame) => ({ top: rect.top - frame.top, left: rect.left - frame.left, right: frame.right - rect.right, bottom: frame.bottom - rect.bottom });

  // A visual-only copy of the home screen. It can never be focused or matched as a link.
  function cloneHome() {
    const ghost = home.cloneNode(true);
    ghost.removeAttribute('id');
    ghost.className = 'phone-ghost home-ghost';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.inert = true;
    ghost.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
    ghost.querySelectorAll('a').forEach(link => {
      const div = document.createElement('div');
      div.className = link.className.replace('app-launcher', 'app-launcher-ghost');
      div.style.cssText = 'display:flex;align-items:center;flex-direction:column;gap:5px;text-align:center;min-height:68px';
      if (link.classList.contains('projects-widget')) div.style.cssText = '';
      div.append(...link.childNodes);
      link.replaceWith(div);
    });
    return ghost;
  }

  function launcherIcon(key) {
    return $(`.app-launcher[data-open="${key}"] .app-icon`, home) || $(`[data-open="${key}"]`, home);
  }

  function iconColor(icon) {
    return icon ? getComputedStyle(icon).backgroundColor : 'rgba(191,104,73,1)';
  }

  function openFrom(key, source) {
    const frame = sheet.getBoundingClientRect();
    const fromSource = source && home.contains(source) ? (source.querySelector('.app-icon') || source) : null;
    const icon = fromSource || launcherIcon(key);
    const rect = originRect || icon?.getBoundingClientRect();
    const color = iconColor(fromSource?.classList.contains('app-icon') ? fromSource : launcherIcon(key));
    const r = rect ? relative(rect, frame) : { top: frame.height * 0.45, left: frame.width * 0.45, right: frame.width * 0.45, bottom: frame.height * 0.45 };
    const duration = D.large + 160;
    sheet.animate([
      { clipPath: `inset(${r.top}px ${r.right}px ${r.bottom}px ${r.left}px round 14px)` },
      { clipPath: 'inset(0px 0px 0px 0px round 23px 23px 35px 35px)' },
    ], { duration, easing: EASE.out });
    const splash = make('div', 'phone-ghost', sheet);
    splash.setAttribute('aria-hidden', 'true');
    splash.style.cssText = `inset:0;border-radius:inherit;background:${color};z-index:5;display:grid;place-items:center;color:#fff;font-size:44px`;
    splash.textContent = icon?.classList.contains('app-icon') ? icon.textContent.trim() : '';
    splash.animate([{ opacity: 1 }, { opacity: 1, offset: 0.35 }, { opacity: 0 }], { duration: duration + 80, easing: EASE.inOut }).finished.then(() => splash.remove(), () => splash.remove());
    if (pendingHome) {
      screen.insertBefore(pendingHome, sheet);
      const ghost = pendingHome;
      ghost.animate([
        { transform: 'scale(1)', opacity: 1, filter: 'blur(0)' },
        { transform: 'scale(.86)', opacity: 0, filter: 'blur(6px)' },
      ], { duration, easing: EASE.out, fill: 'forwards' }).finished.then(() => ghost.remove(), () => ghost.remove());
      pendingHome = null;
    }
    enterSheet(200);
  }

  function closeTo(key, title) {
    const icon = launcherIcon(key);
    const ghost = make('div', 'phone-ghost sheet-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.textContent = title;
    screen.append(ghost);
    const frame = ghost.getBoundingClientRect();
    const r = icon ? relative(icon.getBoundingClientRect(), frame) : { top: frame.height * 0.5, left: frame.width * 0.5, right: frame.width * 0.5, bottom: frame.height * 0.5 };
    const color = iconColor(icon);
    const duration = D.large;
    ghost.animate([
      { clipPath: 'inset(0px 0px 0px 0px round 23px 23px 35px 35px)', backgroundColor: getComputedStyle(ghost).backgroundColor, color: getComputedStyle(ghost).color },
      { backgroundColor: color, color: 'transparent', offset: 0.55 },
      { clipPath: `inset(${r.top}px ${r.right}px ${r.bottom}px ${r.left}px round 14px)`, backgroundColor: color, color: 'transparent', opacity: 0.2 },
    ], { duration, easing: EASE.inOut, fill: 'forwards' }).finished.then(() => ghost.remove(), () => ghost.remove());
    home.animate([
      { transform: 'scale(1.1)', opacity: 0, filter: 'blur(6px)' },
      { transform: 'none', opacity: 1, filter: 'blur(0)' },
    ], { duration: D.large + 120, delay: 60, easing: EASE.out, fill: 'backwards' });
    // Icons ripple outward from the one the app closed into.
    const center = icon?.getBoundingClientRect();
    $$('.app-launcher .app-icon, .profile-widget, .motto-widget, .projects-widget', home).forEach(node => {
      const box = node.getBoundingClientRect();
      const distance = center ? Math.hypot(box.left - center.left, box.top - center.top) : 0;
      node.animate([
        { transform: node === icon ? 'scale(1.35)' : 'scale(.82)' },
        { transform: 'none' },
      ], { duration: D.hero, delay: 120 + distance * 0.9, easing: EASE.spring, fill: 'backwards' });
    });
  }

  /* ---------- Reveal wiring ----------------------------------------------- */
  let closingTitle = '';
  document.addEventListener('portfolio:beforereveal', ({ detail }) => {
    if (calm()) return;
    clearGhosts();
    pendingHome = null;
    originRect = null;
    if (detail.from === 'overview' && detail.to !== 'overview') {
      pendingHome = cloneHome();
      const source = detail.source && home.contains(detail.source) ? (detail.source.querySelector('.app-icon') || detail.source) : launcherIcon(detail.to);
      originRect = source?.getBoundingClientRect() || null;
    }
    closingTitle = $('#phone-sheet-title').textContent;
  });

  document.addEventListener('portfolio:reveal', ({ detail }) => {
    const { from, to, source } = detail;
    setIndex(to);
    // The element under a still pointer may have changed; drop any stale cursor label.
    ring.classList.remove('is-hover', 'is-label');
    if (calm() || from === to) return;
    const direction = Math.sign(depth(to) - depth(from)) || Math.sign(order.indexOf(to) - order.indexOf(from)) || 1;
    const panel = $(`.detail-panel[data-panel="${to}"]`);
    if (panel) enterPanel(panel, direction);
    if (from === 'overview' && to !== 'overview') openFrom(to, source);
    else if (from !== 'overview' && to === 'overview') closeTo(from, closingTitle);
    else if (to !== 'overview') {
      sheetBody.animate([{ opacity: 0.2, transform: `translateX(${direction * 40}px)` }, { opacity: 1, transform: 'none' }], { duration: D.medium + 120, easing: EASE.out });
      enterSheet(60);
    }
    ripple(phoneCenter(), 1);
  });

  /* ---------- Project filter: sliding pill and FLIP reflow --------------- */
  const filters = $('#project-filters');
  const pill = make('span', 'filter-pill');
  pill.setAttribute('aria-hidden', 'true');
  filters.prepend(pill);
  root.classList.add('has-pill');
  function placePill(instant = false) {
    const active = $('[aria-pressed="true"]', filters);
    if (!active || !active.offsetParent) return;
    if (instant) pill.style.transition = 'none';
    pill.style.width = `${active.offsetWidth}px`;
    pill.style.height = `${active.offsetHeight}px`;
    pill.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
    if (instant) { pill.getBoundingClientRect(); pill.style.transition = ''; }
  }
  new ResizeObserver(() => placePill(true)).observe(filters);
  const flipItems = () => [...$$('.project-card'), ...$$('.screen-project-list a', sheetBody)];
  let before = new Map();
  document.addEventListener('portfolio:beforefilter', () => {
    before = new Map(flipItems().filter(node => !node.hidden).map(node => [node, node.getBoundingClientRect()]));
  });
  document.addEventListener('portfolio:filter', () => {
    placePill();
    if (calm()) return;
    let fresh = 0;
    flipItems().filter(node => !node.hidden).forEach(node => {
      const last = node.getBoundingClientRect();
      const first = before.get(node);
      if (first) {
        node.animate([{ transform: `translate(${first.left - last.left}px, ${first.top - last.top}px)` }, { transform: 'none' }], { duration: D.large + 100, easing: EASE.spring });
      } else {
        node.animate([
          { opacity: 0, transform: 'translateX(-28px) scale(.96)', filter: 'blur(6px)' },
          { opacity: 1, transform: 'none', filter: 'blur(0)' },
        ], { duration: D.large + 100, delay: fresh++ * D.stagger * 1.5, easing: EASE.out, fill: 'backwards' });
      }
    });
    $('#project-count').animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: D.medium, easing: EASE.out });
  });

  /* ---------- Theme: circular reveal from the toggle ---------------------- */
  const toggle = $('#theme-toggle');
  document.addEventListener('portfolio:theme', event => {
    const { theme, animate, origin } = event.detail;
    if (!animate || calm()) return;
    toggle.classList.toggle('is-flipping');
    islandSay(theme === 'dark' ? 'Dark mode' : 'Light mode', { hold: 1300 });
    if (!document.startViewTransition || !origin) return;
    event.preventDefault();
    const radius = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y));
    const transition = document.startViewTransition(() => { root.dataset.look = theme; });
    transition.ready.then(() => {
      root.animate({ clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${radius}px at ${origin.x}px ${origin.y}px)`] },
        { duration: D.hero, easing: EASE.inOut, pseudoElement: '::view-transition-new(root)' });
    }).catch(() => { root.dataset.look = theme; });
    ripple(origin, 1.4);
  });
  // The preference can change without the toggle (another theme call); keep the look in step.
  new MutationObserver(() => {
    if ((!document.startViewTransition || calm()) && root.dataset.look !== root.dataset.theme) root.dataset.look = root.dataset.theme;
    readColors();
  }).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-look'] });

  /* ---------- Copy email: confetti + island ------------------------------- */
  document.addEventListener('portfolio:copied', ({ detail }) => {
    if (calm()) return;
    if (!detail.ok) {
      detail.source.animate([{ translate: '0' }, { translate: '-6px' }, { translate: '6px' }, { translate: '-3px' }, { translate: '0' }], { duration: D.medium + 80, easing: 'linear', composite: 'add' });
      return;
    }
    islandSay('Email copied', { hold: 1600 });
    const box = detail.source.getBoundingClientRect();
    burst(box.left + box.width / 2, box.top + box.height / 2);
  });

  function burst(x, y, amount = 26) {
    const colors = [token('--accent'), '#8c9774', '#b08c58', '#687b69', '#d7a087'];
    for (let i = 0; i < amount; i++) {
      const piece = make('span', 'burst', document.body);
      piece.setAttribute('aria-hidden', 'true');
      piece.style.background = colors[i % colors.length];
      const angle = (i / amount) * Math.PI * 2 + Math.random() * 0.4;
      const distance = 60 + Math.random() * 90;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance - 30;
      piece.animate([
        { transform: `translate(${x}px, ${y}px) rotate(0deg) scale(1)`, opacity: 1 },
        { transform: `translate(${x + dx}px, ${y + dy}px) rotate(${Math.random() * 540}deg) scale(1)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${x + dx * 1.1}px, ${y + dy + 70}px) rotate(${Math.random() * 720}deg) scale(.4)`, opacity: 0 },
      ], { duration: 900 + Math.random() * 400, easing: EASE.out }).finished.then(() => piece.remove(), () => piece.remove());
    }
  }

  /* ---------- Tap ripple on app icons (feedback for touch, too) ----------- */
  document.addEventListener('pointerdown', event => {
    if (calm()) return;
    ripple({ x: event.clientX, y: event.clientY }, 0.8);
    const icon = event.target.closest?.('.app-icon, .app-launcher');
    const target = icon?.classList.contains('app-icon') ? icon : icon?.querySelector('.app-icon');
    if (!target) return;
    const box = target.getBoundingClientRect();
    const dot = make('span', 'tap-ripple', target);
    dot.style.left = `${event.clientX - box.left}px`;
    dot.style.top = `${event.clientY - box.top}px`;
    dot.animate([{ transform: 'scale(0)', opacity: 0.7 }, { transform: 'scale(6)', opacity: 0 }], { duration: D.large, easing: EASE.out }).finished.then(() => dot.remove(), () => dot.remove());
  });

  /* ---------- Pointer-driven effects: one ticker for all of them ---------- */
  const pointer = { x: innerWidth / 2, y: innerHeight / 2, active: false, down: false, lastMove: 0 };
  const ring = make('div', 'cursor-ring', document.body);
  const ringLabel = make('span', '', ring);
  const dot = make('div', 'cursor-dot', document.body);
  ring.setAttribute('aria-hidden', 'true');
  dot.setAttribute('aria-hidden', 'true');
  const ringPos = { x: pointer.x, y: pointer.y };
  const tilt = { rx: 0, ry: 0, px: 0, py: 0, trx: 0, try: 0, tpx: 0, tpy: 0 };
  const magnets = new Map();
  const peek = make('div', 'peek', document.body);
  peek.setAttribute('aria-hidden', 'true');
  const peekGlyph = make('b', '', peek);
  const peekLabel = make('small', '', peek);
  const peekPos = { x: 0, y: 0, vx: 0 };

  const labelFor = el => {
    if (el.closest('.app-launcher, .projects-widget, .screen-project-list a')) return 'open';
    if (el.closest('.project-card h3 a')) return 'view';
    const link = el.closest('a');
    if (link?.href.startsWith('mailto:')) return 'write';
    if (link?.target === '_blank') return 'visit';
    return '';
  };

  document.addEventListener('pointermove', event => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.lastMove = performance.now();
    if (event.pointerType !== 'mouse' || !finePointer.matches || calm()) return;
    if (!pointer.active) { pointer.active = true; ringPos.x = pointer.x; ringPos.y = pointer.y; root.classList.add('cursor-on'); }
    const interactive = event.target.closest?.('a, button, [role="button"]');
    const label = interactive ? labelFor(interactive) : '';
    ring.classList.toggle('is-hover', Boolean(interactive) && !label);
    ring.classList.toggle('is-label', Boolean(label));
    if (label) ringLabel.textContent = label;
    const fill = event.target.closest?.('.pill-link, #copy-email');
    if (fill) {
      const box = fill.getBoundingClientRect();
      fill.style.setProperty('--mx', `${((event.clientX - box.left) / box.width) * 100}%`);
      fill.style.setProperty('--my', `${((event.clientY - box.top) / box.height) * 100}%`);
    }
  }, { passive: true });
  document.addEventListener('pointerdown', () => { pointer.down = true; ring.classList.add('is-down'); });
  document.addEventListener('pointerup', () => { pointer.down = false; ring.classList.remove('is-down'); });
  document.documentElement.addEventListener('pointerleave', () => { pointer.active = false; root.classList.remove('cursor-on'); });

  document.addEventListener('pointerover', event => {
    const card = event.target.closest?.('.project-card');
    if (!card || calm() || !finePointer.matches) return;
    const key = card.querySelector('h3 a')?.dataset.open;
    const data = projects[key];
    if (!data) return;
    peek.className = `peek is-on hero-${key}`;
    if (peekGlyph.textContent !== data.glyph) {
      peekGlyph.textContent = data.glyph;
      peekGlyph.animate([{ transform: 'scale(.3) rotate(-90deg)' }, { transform: 'none' }], { duration: D.large, easing: EASE.spring });
    }
    peekLabel.textContent = data.label;
    if (!peek.dataset.shown) { peekPos.x = pointer.x; peekPos.y = pointer.y; peek.dataset.shown = '1'; }
  });
  document.addEventListener('pointerout', event => {
    const card = event.target.closest?.('.project-card');
    if (card && !card.contains(event.relatedTarget)) { peek.classList.remove('is-on'); delete peek.dataset.shown; }
  });

  $$('.pill-link, #copy-email, .theme-toggle, .nav-links a, .brand').forEach(el => magnets.set(el, { x: 0, y: 0 }));

  function updateMagnets() {
    magnets.forEach((state, el) => {
      let tx = 0;
      let ty = 0;
      if (pointer.active && el.offsetParent) {
        const box = el.getBoundingClientRect();
        const cx = box.left + box.width / 2;
        const cy = box.top + box.height / 2;
        const reach = 26;
        if (pointer.x > box.left - reach && pointer.x < box.right + reach && pointer.y > box.top - reach && pointer.y < box.bottom + reach) {
          tx = clamp((pointer.x - cx) * 0.28, -9, 9);
          ty = clamp((pointer.y - cy) * 0.35, -7, 7);
        }
      }
      const nx = lerp(state.x, tx, 0.18);
      const ny = lerp(state.y, ty, 0.18);
      state.x = Math.abs(nx - tx) < 0.05 ? tx : nx;
      state.y = Math.abs(ny - ty) < 0.05 ? ty : ny;
      el.style.setProperty('--mag-x', `${state.x.toFixed(2)}px`);
      el.style.setProperty('--mag-y', `${state.y.toFixed(2)}px`);
      if (!el.style.translate && (el.classList.contains('brand') || el.closest('.nav-links'))) el.style.translate = 'var(--mag-x) var(--mag-y)';
    });
  }

  function updateTilt() {
    const enabled = finePointer.matches && wide.matches && pointer.active;
    if (enabled) {
      // Tilt only near the phone: a rotated layer is resampled and slightly soft,
      // so the phone lies flat and sharp while the visitor reads elsewhere.
      const box = phone.getBoundingClientRect();
      const nx = clamp((pointer.x - (box.left + box.width / 2)) / (box.width / 2), -1, 1);
      const ny = clamp((pointer.y - (box.top + box.height / 2)) / (box.height / 2), -1, 1);
      const away = Math.hypot(Math.max(box.left - pointer.x, 0, pointer.x - box.right), Math.max(box.top - pointer.y, 0, pointer.y - box.bottom));
      const strength = clamp(1 - away / 220, 0, 1) * (phone.classList.contains('is-open') ? 0.5 : 1);
      tilt.trx = -ny * 6 * strength;
      tilt.try = nx * 8 * strength;
      tilt.tpx = nx * strength;
      tilt.tpy = ny * strength;
    } else {
      tilt.trx = tilt.try = tilt.tpx = tilt.tpy = 0;
    }
    const step = (key, target, snap) => {
      const next = lerp(tilt[key], target, 0.09);
      tilt[key] = Math.abs(next - target) < snap ? target : next;
    };
    step('rx', tilt.trx, 0.02);
    step('ry', tilt.try, 0.02);
    step('px', tilt.tpx, 0.002);
    step('py', tilt.tpy, 0.002);
    phone.style.transform = tilt.rx || tilt.ry ? '' : 'none';
    phone.style.setProperty('--rx', `${tilt.rx.toFixed(3)}deg`);
    phone.style.setProperty('--ry', `${tilt.ry.toFixed(3)}deg`);
    phone.style.setProperty('--px', tilt.px.toFixed(4));
    phone.style.setProperty('--py', tilt.py.toFixed(4));
    phone.style.setProperty('--gx', `${50 + tilt.px * 45}%`);
    phone.style.setProperty('--gy', `${30 + tilt.py * 40}%`);
    phone.style.setProperty('--go', (Math.abs(tilt.ry) / 8).toFixed(3));
  }

  /* ---------- The dot field ------------------------------------------------
   * A sheet of graph-paper dots under everything. The pointer pushes them
   * aside, clicks and page changes send ripples through them, and a slow
   * wave keeps the paper breathing.
   */
  const canvas = make('canvas');
  canvas.id = 'field';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  const gap = 30;
  let dots = [];
  let ripples = [];
  let colors = { base: '#cfc5b6', accent: '#bf6849' };
  let width = 0;
  let height = 0;
  let dpr = 1;
  function readColors() {
    const styles = getComputedStyle(root);
    colors = { base: styles.getPropertyValue('--muted').trim() || '#716a60', accent: styles.getPropertyValue('--accent').trim() || '#bf6849' };
  }
  function layout() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    width = innerWidth;
    height = innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dots = [];
    const offsetX = (width % gap) / 2;
    const offsetY = (height % gap) / 2;
    for (let y = offsetY; y <= height; y += gap) {
      for (let x = offsetX; x <= width; x += gap) dots.push({ x, y, ox: 0, oy: 0, vx: 0, vy: 0, heat: 0 });
    }
    if (calm()) draw(0);
  }
  function ripple(at, strength = 1) {
    if (calm() || !at) return;
    ripples.push({ x: at.x, y: at.y, start: performance.now(), strength });
    if (ripples.length > 6) ripples.shift();
  }
  function phoneCenter() {
    const box = phone.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  }
  function draw(now) {
    ctx.clearRect(0, 0, width, height);
    const radius = 150;
    const live = pointer.active || now - pointer.lastMove < 1500;
    ripples = ripples.filter(r => now - r.start < 1700);
    const hot = [];
    ctx.fillStyle = colors.base;
    for (const d of dots) {
      let fx = 0;
      let fy = 0;
      let heat = 0;
      if (live) {
        const dx = d.x - pointer.x;
        const dy = d.y - pointer.y;
        const dist = Math.hypot(dx, dy);
        if (dist < radius && dist > 0.01) {
          const force = (1 - dist / radius) ** 2;
          fx += (dx / dist) * force * 26;
          fy += (dy / dist) * force * 26;
          heat = Math.max(heat, force);
        }
      }
      for (const r of ripples) {
        const age = now - r.start;
        const front = age * 0.95;
        const dx = d.x - r.x;
        const dy = d.y - r.y;
        const dist = Math.hypot(dx, dy) || 1;
        const band = 1 - Math.abs(dist - front) / 70;
        if (band > 0) {
          const fade = (1 - age / 1700) * r.strength * band;
          fx += (dx / dist) * fade * 16;
          fy += (dy / dist) * fade * 16;
          heat = Math.max(heat, fade * 0.9);
        }
      }
      // Spring each dot towards its displaced target.
      d.vx = (d.vx + (fx - d.ox) * 0.14) * 0.74;
      d.vy = (d.vy + (fy - d.oy) * 0.14) * 0.74;
      d.ox += d.vx;
      d.oy += d.vy;
      d.heat = lerp(d.heat, heat, 0.2);
      const wave = Math.sin(d.x * 0.011 + now * 0.0005) * Math.cos(d.y * 0.013 - now * 0.00035);
      const size = 1.1 + wave * 0.45 + d.heat * 2.4;
      if (d.heat > 0.08) { hot.push([d.x + d.ox, d.y + d.oy, size, d.heat]); continue; }
      ctx.globalAlpha = 0.16 + wave * 0.06;
      ctx.fillRect(d.x + d.ox - size / 2, d.y + d.oy - size / 2, size, size);
    }
    ctx.fillStyle = colors.accent;
    for (const [x, y, size, heat] of hot) {
      ctx.globalAlpha = clamp(0.2 + heat * 0.8, 0, 0.9);
      ctx.beginPath();
      ctx.arc(x, y, size / 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  let frame = 0;
  function loop(now) {
    if (!calm()) {
      if (pointer.active) {
        ringPos.x = lerp(ringPos.x, pointer.x, 0.2);
        ringPos.y = lerp(ringPos.y, pointer.y, 0.2);
        ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0)`;
        dot.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`;
      }
      if (peek.classList.contains('is-on')) {
        const nx = lerp(peekPos.x, pointer.x, 0.16);
        peekPos.vx = lerp(peekPos.vx, nx - peekPos.x, 0.3);
        peekPos.x = nx;
        peekPos.y = lerp(peekPos.y, pointer.y, 0.16);
        peek.style.transform = `translate3d(${peekPos.x}px, ${peekPos.y}px, 0) rotate(${clamp(peekPos.vx * 0.9, -14, 14).toFixed(2)}deg)`;
      }
      updateTilt();
      updateMagnets();
      // When nothing is pushing the dots, the slow wave only needs ~20fps.
      const idle = !ripples.length && now - pointer.lastMove > 2000;
      if (!idle || ++frame % 3 === 0) draw(now);
    }
    requestAnimationFrame(loop);
  }

  /* ---------- First visit: the phone powers on --------------------------- */
  function intro() {
    let seen = false;
    try { seen = sessionStorage.getItem('intro') === '1'; sessionStorage.setItem('intro', '1'); } catch { /* Play it every time. */ }
    const panel = $('.detail-panel:not([hidden])');
    if (seen) { if (panel) enterPanel(panel, 1); return; }
    $('.phone-column').animate([
      { transform: 'translateY(90px) rotateX(28deg) rotate(-9deg) scale(.86)', opacity: 0 },
      { transform: 'none', opacity: 1 },
    ], { duration: 1300, easing: EASE.spring, fill: 'backwards' });
    const boot = make('div', 'boot', screen);
    boot.setAttribute('aria-hidden', 'true');
    const mark = make('span', '', boot);
    mark.append('v', make('b'));
    mark.lastChild.textContent = '.';
    mark.animate([{ opacity: 0, transform: 'scale(.6)', filter: 'blur(8px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: D.large, delay: 250, easing: EASE.spring, fill: 'backwards' });
    boot.animate([{ opacity: 1 }, { opacity: 0 }], { duration: D.large, delay: 900, easing: EASE.inOut, fill: 'forwards' }).finished.then(() => boot.remove(), () => boot.remove());
    $$('.profile-widget, .motto-widget, .projects-widget, .app-launcher, .phone-dock', home).forEach((node, i) => node.animate([
      { opacity: 0, transform: 'translateY(34px) scale(.55)' },
      { opacity: 1, transform: 'none' },
    ], { duration: D.hero, delay: 980 + i * 42, easing: EASE.spring, fill: 'backwards' }));
    $$('.site-header .brand, .site-header .nav-links a, .site-header .theme-toggle').forEach((node, i) => node.animate([
      { opacity: 0, transform: 'translateY(-22px)' },
      { opacity: 1, transform: 'none' },
    ], { duration: D.large + 200, delay: 120 + i * 60, easing: EASE.out, fill: 'backwards' }));
    $('.phone-hint').animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: D.large, delay: 1700, easing: EASE.out, fill: 'backwards' });
    if (panel) setTimeout(() => enterPanel(panel, 1), 260);
    setTimeout(() => islandSay("hi, I'm Vipul", { hold: 2200 }), 1500);
    setTimeout(() => ripple(phoneCenter(), 1.6), 1000);
  }

  /* ---------- Boot ------------------------------------------------------- */
  $$('.detail-title').forEach(splitLetters);
  $$('.detail-panel .eyebrow').forEach(prepareScramble);
  setIndex($('.detail-panel:not([hidden])')?.dataset.panel || 'overview');
  placePill(true);
  readColors();
  layout();
  addEventListener('resize', () => { layout(); placePill(true); });
  reduce.addEventListener?.('change', () => { layout(); root.dataset.look = root.dataset.theme; });
  if (!calm()) intro();
  requestAnimationFrame(loop);
})();
