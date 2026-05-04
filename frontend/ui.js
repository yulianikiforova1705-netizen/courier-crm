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
    // Получаем текущее состояние (светлая ли сейчас тема?)
    const isCurrentlyLight = document.body.classList.contains('light-mode');
    
    if (isCurrentlyLight) {
        // Если была светлая -> делаем темную
        document.body.classList.remove('light-mode');
        localStorage.setItem('trackflow_theme', 'dark');
        document.getElementById('theme-btn').innerText = '☀️';
    } else {
        // Если была темная -> делаем светлую
        document.body.classList.add('light-mode');
        localStorage.setItem('trackflow_theme', 'light');
        document.getElementById('theme-btn').innerText = '🌙';
    }
}

export function initTheme() {
    const savedTheme = localStorage.getItem('trackflow_theme');
    const btn = document.getElementById('theme-btn');
    
    // По умолчанию пусть будет темная (если ничего не сохранено)
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        if (btn) btn.innerText = '🌙';
    } else {
        document.body.classList.remove('light-mode'); // Явно убираем класс на всякий случай
        if (btn) btn.innerText = '☀️';
    }
}