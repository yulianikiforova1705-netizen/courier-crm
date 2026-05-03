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
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    
    // Сохраняем в память телефона/браузера
    localStorage.setItem('trackflow_theme', isLight ? 'light' : 'dark');
    
    // Меняем иконку на кнопке
    const btn = document.getElementById('theme-btn');
    if (btn) btn.innerText = isLight ? '🌙' : '☀️';
}

export function initTheme() {
    const savedTheme = localStorage.getItem('trackflow_theme');
    const btn = document.getElementById('theme-btn');
    
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        if (btn) btn.innerText = '🌙';
    } else {
        if (btn) btn.innerText = '☀️';
    }
}