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