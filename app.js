document.documentElement.classList.add('js');

const themeToggle = document.querySelector('#theme-toggle');
const menuToggle = document.querySelector('#menu-toggle');
const navigation = document.querySelector('#navigation-links');
const filterButtons = document.querySelectorAll('#project-filters [data-filter]');
const projects = document.querySelectorAll('.project-card[data-category]');
const projectCount = document.querySelector('#project-count');
const copyEmail = document.querySelector('#copy-email');
const copyStatus = document.querySelector('#copy-status');
const year = document.querySelector('#year');

if (year) year.textContent = new Date().getFullYear();

let savedTheme;
try {
  savedTheme = localStorage.getItem('theme');
} catch {
  // Storage may be disabled; the preference still works for this page.
}

function setTheme(theme) {
  const dark = theme === 'dark';
  document.documentElement.dataset.theme = theme;
  if (themeToggle) {
    themeToggle.setAttribute('aria-pressed', String(dark));
    themeToggle.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`);
    themeToggle.setAttribute('title', `Switch to ${dark ? 'light' : 'dark'} theme`);
  }
}

setTheme(savedTheme === 'light' || savedTheme === 'dark'
  ? savedTheme
  : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

themeToggle?.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(theme);
  try {
    localStorage.setItem('theme', theme);
  } catch {
    // Keep the selected theme for this page even without storage.
  }
});

function setMenuOpen(open) {
  menuToggle?.setAttribute('aria-expanded', String(open));
  navigation?.classList.toggle('is-open', open);
}

menuToggle?.addEventListener('click', () => {
  setMenuOpen(menuToggle.getAttribute('aria-expanded') !== 'true');
});
navigation?.addEventListener('click', event => {
  if (event.target.closest('a')) setMenuOpen(false);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuToggle?.getAttribute('aria-expanded') === 'true') {
    setMenuOpen(false);
    menuToggle.focus();
  }
});

filterButtons.forEach(button => {
  button.addEventListener('click', () => {
    const filter = button.dataset.filter;
    filterButtons.forEach(option => option.setAttribute('aria-pressed', String(option === button)));
    let visible = 0;
    projects.forEach(project => {
      project.hidden = filter !== 'all' && project.dataset.category !== filter;
      if (!project.hidden) visible++;
    });
    if (projectCount) projectCount.textContent = `${visible} ${visible === 1 ? 'project' : 'projects'}`;
  });
});

copyEmail?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(copyEmail.dataset.email);
    if (copyStatus) copyStatus.textContent = 'Email copied to clipboard.';
  } catch {
    if (copyStatus) copyStatus.textContent = 'Could not copy. Use the email link instead.';
  }
});
