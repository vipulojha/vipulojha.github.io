const root = document.documentElement;
const panels = [...document.querySelectorAll('.detail-panel[data-panel]')];
const templates = new Map([...document.querySelectorAll('template[data-screen]')].map(template => [template.dataset.screen, template]));
const sheet = document.querySelector('#phone-sheet');
const phone = document.querySelector('.phone');
const homeScreen = document.querySelector('#phone-home-screen');
const sheetBody = document.querySelector('#phone-sheet-body');
const back = document.querySelector('#phone-back');
const sheetTitle = document.querySelector('#phone-sheet-title');
const themeToggle = document.querySelector('#theme-toggle');
const filterButtons = [...document.querySelectorAll('#project-filters [data-filter]')];
const cards = [...document.querySelectorAll('.project-card[data-category]')];
const count = document.querySelector('#project-count');
let selected = 'overview';
let invoker = null;
let filter = 'all';

document.querySelector('#year').textContent = new Date().getFullYear();

let savedTheme;
try { savedTheme = localStorage.getItem('theme'); } catch { /* Storage is optional. */ }
function setTheme(theme) {
  root.dataset.theme = theme;
  const label = `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`;
  themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
  themeToggle.setAttribute('aria-label', label);
  themeToggle.title = label;
}
setTheme(['light', 'dark'].includes(savedTheme) ? savedTheme :
  (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
themeToggle.addEventListener('click', () => {
  const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(theme);
  try { localStorage.setItem('theme', theme); } catch { /* Preference remains for this page. */ }
});

function applyFilter(value) {
  filter = value;
  let visible = 0;
  cards.forEach(card => {
    card.hidden = value !== 'all' && card.dataset.category !== value;
    if (!card.hidden) visible++;
  });
  sheetBody.querySelectorAll('.screen-project-list [data-category]').forEach(link => {
    link.hidden = value !== 'all' && link.dataset.category !== value;
  });
  filterButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === value)));
  count.textContent = `${visible} ${visible === 1 ? 'project' : 'projects'}`;
}
filterButtons.forEach(button => button.addEventListener('click', () => applyFilter(button.dataset.filter)));

function reveal(key, { source = null, updateHash = false, focus = false } = {}) {
  if (!panels.some(panel => panel.dataset.panel === key)) return;
  const leavingSheet = selected !== 'overview' && key === 'overview';
  if (key !== 'overview' && source?.isConnected && !sheet.contains(source)) invoker = source;
  selected = key;
  panels.forEach(panel => { panel.hidden = panel.dataset.panel !== key; });
  homeScreen.hidden = key !== 'overview';
  sheet.hidden = key === 'overview';
  phone.classList.toggle('is-open', key !== 'overview');
  sheetBody.replaceChildren();
  sheetBody.scrollTop = 0;
  if (key !== 'overview') {
    sheetBody.append(templates.get(key).content.cloneNode(true));
    sheetTitle.textContent = sheetBody.querySelector('.screen-title').textContent.trim();
    if (key === 'projects') applyFilter(filter);
  }
  document.querySelectorAll('.app-launcher[data-open]').forEach(link => {
    if (link.dataset.open === key) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (updateHash) history.replaceState(null, '', `#${key === 'overview' ? 'home' : key}`);
  if (focus) {
    if (leavingSheet) {
      if (invoker?.isConnected && !invoker.closest('[hidden]')) invoker.focus();
      else document.querySelector('.brand').focus();
    } else if (key !== 'overview') back.focus();
  }
}

document.addEventListener('click', event => {
  const link = event.target.closest('a[data-open]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target && link.target !== '_self') return;
  const key = link.dataset.open;
  if (!panels.some(panel => panel.dataset.panel === key)) return;
  event.preventDefault();
  reveal(key, { source: link, updateHash: true, focus: true });
});
back.addEventListener('click', () => reveal('overview', { updateHash: true, focus: true }));
document.querySelector('#phone-home').addEventListener('click', () => reveal('overview', { updateHash: true, focus: true }));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && selected !== 'overview') {
    event.preventDefault();
    reveal('overview', { updateHash: true, focus: true });
  }
});
window.addEventListener('hashchange', () => reveal(location.hash.slice(1) === 'home' ? 'overview' : location.hash.slice(1)));

const copyEmail = document.querySelector('#copy-email');
copyEmail.addEventListener('click', async () => {
  const status = document.querySelector('#copy-status');
  try {
    await navigator.clipboard.writeText(copyEmail.dataset.email);
    status.textContent = 'Email copied to clipboard.';
  } catch {
    status.textContent = 'Could not copy. Use the email link instead.';
  }
});

root.classList.add('js');
reveal(location.hash.slice(1) === 'home' ? 'overview' :
  (panels.some(panel => panel.dataset.panel === location.hash.slice(1)) ? location.hash.slice(1) : 'overview'));
