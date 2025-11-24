// public/auth-helper.js — ОСТАННЯ ВЕРСІЯ
(() => {
  const saved = localStorage.getItem('currentUser');
  if (!saved) {
    if (!location.pathname.includes('login.html') && !location.pathname.includes('register.html')) {
      location.href = '/login.html';
    }
    window.user = null;
    return;
  }

  try {
    window.user = JSON.parse(saved);
  } catch {
    localStorage.removeItem('currentUser');
    location.href = '/login.html';
    return;
  }

  // Додаємо authUserId у всі запити
  const oldFetch = window.fetch;
  window.fetch = (url, options = {}) => {
    if (typeof url === 'string' && url.startsWith('/api/')) {
      const sep = url.includes('?') ? '&' : '?';
      url = `${url}${sep}authUserId=${window.user.id}`;
    }
    return oldFetch(url, options);
  };

  // Показуємо ім'я в меню
  document.addEventListener('DOMContentLoaded', () => {
    const name = window.user.name && window.user.name.trim() ? window.user.name : window.user.email.split('@')[0];
    document.querySelectorAll('#userName, .user-name, .username').forEach(el => {
      el.textContent = name;
    });
  });
})();