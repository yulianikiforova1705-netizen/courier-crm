self.addEventListener('install', (e) => {
    console.log('[Service Worker] Установлен');
});

self.addEventListener('fetch', (e) => {
    // Пока мы просто пропускаем все запросы в интернет как обычно, 
    // чтобы не сломать работу нашей базы данных
});