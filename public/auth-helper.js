// public/auth-helper.js — УНІВЕРСАЛЬНА ВЕРСІЯ 2025 (більше нічого не ламай!)
(() => {
  const saved = localStorage.getItem('currentUser');
  if (!saved) {
    if (!location.pathname.includes('login.html') && !location.pathname.includes('register.html') && !location.pathname.includes('help.html')) {
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

  // === АВТОМАТИЧНЕ ДОДАВАННЯ authUserId У ЗАПИТИ ===
  const oldFetch = window.fetch;
  window.fetch = (url, options = {}) => {
    if (typeof url === 'string' && url.startsWith('/api/')) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}authUserId=${window.user.id}`;
    }
    return oldFetch(url, options);
  };

  // === ПОКАЗ ІМЕНІ КОРИСТУВАЧА НА ВСІХ СТОРІНКАХ ===
  document.addEventListener('DOMContentLoaded', () => {
    const displayName = window.user.name && window.user.name.trim() !== ''
      ? window.user.name
      : window.user.email.split('@')[0];

    document.querySelectorAll('#userName, .user-name, .username, [data-username]').forEach(el => {
      el.textContent = displayName;
    });
  });

  // === УНІВЕРСАЛЬНИЙ API_URL — ПРАЦЮЄ ВСЮДИ АВТОМАТИЧНО ===
  // Якщо фронт і бекенд на одному домені (Render, Vercel тощо) — залишаємо просто '/api/'
  // Якщо на різних — підставляємо правильний бекенд
  const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? ''  // локально — запити йдуть на той самий порт[](http://localhost:3000/api/...)
    : ''; // на Render — теж той самий домен → просто '/api/...' 

  // Перехоплюємо всі fetch-запити
  const originalFetch = window.fetch;
  window.fetch = function(url, options = {}) {
    if (typeof url === 'string' && url.startsWith('/api/')) {
      url = API_URL + url; // додаємо префікс тільки якщо потрібно
    }
    return originalFetch(url, options);
  };

})();