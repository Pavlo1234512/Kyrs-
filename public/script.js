document.addEventListener('DOMContentLoaded', () => {
  const registerForm = document.getElementById('registerForm');
  const loginForm = document.getElementById('loginForm');

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok) {
          alert('Реєстрація успішна! Тепер увійдіть.');
          window.location.href = 'login.html';
        } else {
          alert(data.error);
        }
      } catch (err) {
        alert('Помилка: ' + err.message);
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok) {
          localStorage.setItem('token', data.token);  // Зберігаємо токен
          alert('Вхід успішний!');
          window.location.href = 'index.html';  // Переходимо на головну
        } else {
          alert(data.error);
        }
      } catch (err) {
        alert('Помилка: ' + err.message);
      }
    });
  }
});