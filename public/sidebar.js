// public/sidebar.js — ІДЕАЛЬНА ВЕРСІЯ (кнопка зникає + усе працює)
document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.getElementById('mySidebar');
  const openBtn = document.querySelector('.openbtn');
  const closeBtn = document.querySelector('.closebtn');

  if (!sidebar || !openBtn) return;

  const mainContent = document.getElementById('main') || document.body;

  window.openNav = () => {
    sidebar.style.width = '320px';
    mainContent.style.marginLeft = '320px';
    openBtn.style.display = 'none';  // кнопка "Меню" зникає
  };

  window.closeNav = () => {
    sidebar.style.width = '0';
    mainContent.style.marginLeft = '0';
    openBtn.style.display = 'block'; // кнопка "Меню" з’являється назад
  };

  openBtn.addEventListener('click', e => {
    e.stopPropagation();
    openNav();
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', e => {
      e.stopPropagation();
      closeNav();
    });
  }

  document.addEventListener('click', e => {
    if (sidebar.style.width === '320px' &&
        !sidebar.contains(e.target) &&
        !openBtn.contains(e.target)) {
      closeNav();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeNav();
  });
});