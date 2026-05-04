// frontend/ui.js

// === УМНЫЕ ВСПЛЫВАЮЩИЕ УВЕДОМЛЕНИЯ ===
export function showNotification(message) {
    const notif = document.createElement('div');
    
    notif.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: var(--card-bg);
        border-left: 4px solid var(--accent);
        color: var(--text-main);
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        z-index: 10000;
        transition: opacity 0.5s ease;
    `;
    
    notif.innerHTML = message;
    document.body.appendChild(notif);

    setTimeout(() => {
        notif.style.opacity = '0';
        setTimeout(() => notif.remove(), 500);
    }, 5000); 
}

// === ТЕМЫ ОФОРМЛЕНИЯ ===
export function toggleTheme() {
    const body = document.body;
    const btn = document.getElementById('theme-btn');
    
    // Переключаем твой родной класс темной темы
    body.classList.toggle('dark-theme');
    
    if (body.classList.contains('dark-theme')) {
        localStorage.setItem('trackflow_theme', 'dark');
        if(btn) btn.innerText = '☀️'; // Горит солнышко (нажми, чтобы сделать светло)
    } else {
        localStorage.setItem('trackflow_theme', 'light');
        if(btn) btn.innerText = '🌙'; // Горит луна (нажми, чтобы сделать темно)
    }
}

export function initTheme() {
    const savedTheme = localStorage.getItem('trackflow_theme');
    const btn = document.getElementById('theme-btn');
    const body = document.body;
    
    // Если пользователь ранее выбрал светлую тему
    if (savedTheme === 'light') {
        body.classList.remove('dark-theme');
        if (btn) btn.innerText = '🌙';
    } else {
        // По умолчанию пусть всегда будет твоя крутая темная тема
        body.classList.add('dark-theme');
        if (btn) btn.innerText = '☀️';
    }
}
// === ПРОФИЛЬ И НАСТРОЙКИ ===
export function showSettings() {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    document.getElementById('tabs-container').style.display = 'none'; // Прячем табы
    document.getElementById('settings-screen').style.display = 'block';
}

export function hideSettings() {
    document.getElementById('settings-screen').style.display = 'none';
    document.getElementById('tabs-container').style.display = 'block'; // Возвращаем табы
    
    // Возвращаем пользователя на экран заказов
    document.getElementById('orders-view').style.display = 'block';
}

// Читаем картинку и показываем превью
export function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64Image = e.target.result;
            document.getElementById('settings-avatar-preview').src = base64Image;
            document.getElementById('settings-avatar-preview').dataset.tempImg = base64Image; // Сохраняем во временную память
        };
        reader.readAsDataURL(file);
    }
}

// Сохраняем всё в память браузера
export function saveProfile() {
    const newName = document.getElementById('profile-name').value;
    const newPass = document.getElementById('profile-pass').value;
    const newAvatar = document.getElementById('settings-avatar-preview').dataset.tempImg;

    if (newName) localStorage.setItem('trackflow_name', newName);
    if (newPass) localStorage.setItem('trackflow_pass', newPass); // Для реального проекта тут нужен был бы сервер
    if (newAvatar) localStorage.setItem('trackflow_avatar', newAvatar);

    updateProfileUI(); // Обновляем картинки на экране
    hideSettings();    // Закрываем настройки
    alert('✅ Профиль успешно обновлен!'); // Или используй свою красивую showNotification
}

// Загружаем данные при старте и обновляем интерфейс
export function updateProfileUI() {
    const savedName = localStorage.getItem('trackflow_name') || 'Курьер';
    
    // Та самая надежная встроенная картинка вместо via.placeholder
    const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NiZDVlMSI+PHBhdGggZD0iTTEyIDEyYzIuMjEgMCA0LTEuNzkgNC00cy0xLjc5LTQtNC00LTQgMS43OS00IDQgMS43OSA0IDQgNHptMCAyYy0yLjY3IDAtOCAxLjM0LTggNHYyaDE2di0yYzAtMi42Ni01LjMzLTQtOC00eiIvPjwvc3ZnPg==';
    const savedAvatar = localStorage.getItem('trackflow_avatar') || defaultAvatar;

    const headerAvatar = document.getElementById('header-avatar');
    const settingsPreview = document.getElementById('settings-avatar-preview');
    const profileInput = document.getElementById('profile-name');

    // Подставляем картинки и имя
    if (headerAvatar) headerAvatar.src = savedAvatar;
    if (settingsPreview) settingsPreview.src = savedAvatar;
    if (profileInput) profileInput.value = savedName;

    // ЖЕЛЕЗОБЕТОННАЯ ПРОВЕРКА: показываем аватарку ТОЛЬКО курьеру
    const currentRole = localStorage.getItem('trackflow_role');
    if (headerAvatar) {
        if (currentRole === 'courier') {
            headerAvatar.style.display = 'block'; // Показываем
        } else {
            headerAvatar.style.display = 'none';  // Прячем от админа
        }
    }
}