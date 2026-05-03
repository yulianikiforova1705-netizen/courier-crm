// Название нашей "заначки" в памяти телефона
const CACHE_NAME = 'trackflow-cache-v1';

// Список файлов, которые нужны для работы сайта без интернета
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// 1. УСТАНОВКА: Скачиваем файлы при первом заходе на сайт
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('📦 Service Worker: Кэширую файлы для офлайна...');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// 2. АКТИВАЦИЯ: Очищаем старый мусор, если мы обновили версию
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// 3. ПЕРЕХВАТ ЗАПРОСОВ: Умная логика работы
self.addEventListener('fetch', (event) => {
    // Мы перехватываем только запросы на получение данных (GET)
    if (event.request.method !== 'GET') return;

    event.respondWith(
        // Сначала всегда пытаемся сходить в интернет (Network First)
        fetch(event.request)
            .then((networkResponse) => {
                // Если интернет есть, мы сохраняем свежие данные в кэш
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });
            })
            .catch(() => {
                // 🔴 ИНТЕРНЕТА НЕТ! Достаем последние данные из "заначки"
                console.log('📶 Нет интернета. Достаю данные из кэша:', event.request.url);
                return caches.match(event.request);
            })
    );
});
self.addEventListener('push', (event) => {
    const data = event.data.json();
    const options = {
        body: data.body,
        icon: './icon-192.png',
        vibrate: [100, 50, 100],
        data: { url: data.url }
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(clients.openWindow(event.notification.data.url));
});