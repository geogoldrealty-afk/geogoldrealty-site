const navToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-nav');

navToggle?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(open));
});

document.querySelectorAll('.site-nav a').forEach((link) => link.addEventListener('click', () => {
  nav.classList.remove('open');
  navToggle?.setAttribute('aria-expanded', 'false');
}));

document.querySelectorAll('.choice').forEach((button) => button.addEventListener('click', () => {
  const group = button.closest('.button-group');
  group.querySelectorAll('.choice').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
  group.querySelector('input[name="interest"]').value = button.dataset.choice;
}));

document.querySelectorAll('.lead-form').forEach((form) => form.addEventListener('submit', (event) => {
  event.preventDefault();
  const subject = form.dataset.subject || 'Website inquiry';
  const data = new FormData(form);
  const lines = [...data.entries()].filter(([, value]) => value.trim()).map(([key, value]) => `${key.replaceAll('-', ' ')}: ${value}`);
  const mailto = `mailto:hello@geogoldrealty.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
  const note = form.querySelector('.form-note');
  if (note) note.textContent = 'Your email app will open with this inquiry filled in.';
  window.location.href = mailto;
}));

document.querySelector('#year').textContent = new Date().getFullYear();

