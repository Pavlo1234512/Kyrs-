// public/auth-helper.js — ОСТАННЯ ВЕРСІЯ (більше ніколи нічого не зламається)
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

  // Автоматично додаємо authUserId у всі запити
  const oldFetch = window.fetch;
  window.fetch = (url, options = {}) => {
    if (typeof url === 'string' && url.startsWith('/api/')) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}authUserId=${window.user.id}`;
    }
    return oldFetch(url, options);
  };

  // Показуємо ім’я в меню НА ВСІХ СТОРІНКАХ
  document.addEventListener('DOMContentLoaded', () => {
    const displayName = window.user.name && window.user.name.trim() !== ''
      ? window.user.name
      : window.user.email.split('@')[0];

    document.querySelectorAll('#userName, .user-name, .username, [data-username]').forEach(el => {
      el.textContent = displayName;
    });
  });
  // ЦЕ ТРЕБА ДОДАТИ ОДИН РАЗ — І ВСЕ ПРАЦЮЄ НА ХОСТИНГУ!
const API_URL = 'https://твій-бекенд-на-railway.up.railway.app';  
// ← замість цього встав своє справжнє посилання після деплою бекенду
// наприклад: const API_URL = 'https://nakazy-viti-backend.up.railway.app';

// Тепер усі запити автоматично йдуть на правильний бекенд
const originalFetch = window.fetch;
window.fetch = function(url, options = {}) {
  if (url.startsWith('/api/')) {
    url = API_URL + url;  // ← магія: /api/auth/login → https://.../api/auth/login
  }
  return originalFetch(url, options);
};
})();