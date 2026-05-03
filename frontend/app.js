import { initPushNotifications } from './push.js';
// ==========================================
// ⚙️ БАЗОВЫЕ НАСТРОЙКИ И API
// ==========================================
const API_URL = 'https://courier-crm-api.onrender.com';
const ACCESS_PASSWORD = "vsystem2026";
let currentTab = 'active';
let notifiedTasks = new Set();
let notifiedNewOrders = new Set(); // Память для пуш-уведомлений о заказах
// Делаем функцию доступной для кнопок в HTML
window.initPushNotifications = () => initPushNotifications(API_URL);
// 🪄 МАГИЯ WEBSOCKETS: Слушаем сервер в реальном времени
const socket = io(API_URL);

socket.on('update_data', () => {
    console.log('⚡ Сигнал от сервера: Данные обновились!');
    // 👇 ДОБАВЛЯЕМ ЭТУ СТРОЧКУ (она вызовет всплывашку и системный писк)
    //showNotification('🔄 Обновление: проверьте новые заказы или статусы!');
    // Умное обновление: обновляем только ту вкладку, которая сейчас открыта
    if (currentTab === 'active' || currentTab === 'archive') loadOrders();
    if (currentTab === 'accounting') loadAccounting();
    if (currentTab === 'plan') loadTasks();
    drawFinanceChart();
});
// Ловим сигнал о новом заказе от сервера
socket.on('new_order_alert', (address) => {
    console.log('🚨 СЕРВЕР ПРИСЛАЛ СИГНАЛ О НОВОМ ЗАКАЗЕ:', address);
    showNotification(`🚀 <b>Новый заказ!</b> Нужно забрать: ${address}`);
});

// Универсальная функция для общения с сервером (чтобы не писать fetch 100 раз)
async function apiCall(endpoint, method = 'GET', body = null) {
    try {
        const options = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) options.body = JSON.stringify(body);
        const res = await fetch(`${API_URL}${endpoint}`, options);
        return await res.json();
    } catch (err) {
        console.error(`Ошибка запроса к ${endpoint}:`, err);
        return null;
    }
}

// ==========================================
// 🔐 АВТОРИЗАЦИЯ И ТЕМА
// ==========================================
const themeBtn = document.getElementById('theme-btn');
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-theme');
    themeBtn.innerText = '☀️';
}

function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeBtn.innerText = isDark ? '☀️' : '🌙';
}

let currentUserRole = null; // 'admin' или 'courier'
let currentCourierName = '';

function checkAuth() {
    const savedRole = localStorage.getItem('trackflow_role');
    const savedName = localStorage.getItem('trackflow_name');

    if (savedRole) {
        // Если уже входили, восстанавливаем сессию
        currentUserRole = savedRole;
        currentCourierName = savedName || '';
        document.getElementById('login-screen').style.display = 'none';
        applyRoleRestrictions();
        loadOrders();
    } else {
        // Если нет — показываем экран выбора роли
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('role-selection').style.display = 'block';
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('courier-login').style.display = 'none';
    }
}

// Управление экранами входа
function selectRole(role) {
    document.getElementById('role-selection').style.display = 'none';
    if (role === 'admin') document.getElementById('admin-login').style.display = 'block';
    if (role === 'courier') document.getElementById('courier-login').style.display = 'block';
}

function backToRoles() {
    document.getElementById('admin-login').style.display = 'none';
    document.getElementById('courier-login').style.display = 'none';
    document.getElementById('role-selection').style.display = 'block';
    document.getElementById('password-input').value = '';
    document.getElementById('courier-name-input').value = '';
    document.getElementById('login-error').style.display = 'none';
    document.getElementById('courier-error').style.display = 'none';
}

// Вход для Админа
function checkPassword() {
    if (document.getElementById('password-input').value === ACCESS_PASSWORD) {
        localStorage.setItem('trackflow_role', 'admin');
        checkAuth();
    } else {
        document.getElementById('login-error').style.display = 'block';
        document.getElementById('password-input').value = '';
    }
}

// Вход для Курьера
function loginAsCourier() {
    const name = document.getElementById('courier-name-input').value.trim();
    if (name) {
        localStorage.setItem('trackflow_role', 'courier');
        localStorage.setItem('trackflow_name', name);
        checkAuth();
    } else {
        document.getElementById('courier-error').style.display = 'block';
    }
}

// 🛡️ ГЛАВНАЯ ФУНКЦИЯ: Скрываем лишнее от курьера
function applyRoleRestrictions() {
    const isCourier = currentUserRole === 'courier';
    
    // Курьер не видит вкладки Финансы и План
    document.getElementById('tab-accounting').style.display = isCourier ? 'none' : 'block';
    document.getElementById('tab-plan').style.display = isCourier ? 'none' : 'block';
    
    // Курьер не может создавать заказы
    document.getElementById('create-order-form').style.display = isCourier ? 'none' : 'block';
}

// Кнопка выхода из аккаунта
function logout() {
    localStorage.removeItem('trackflow_role');
    localStorage.removeItem('trackflow_name');
    location.reload(); // Перезагружаем страницу
}

// ==========================================
// 📑 НАВИГАЦИЯ (ВКЛАДКИ И АРХИВ)
// ==========================================
function switchTab(tab) {
    currentTab = tab;
    
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');

    document.getElementById('orders-view').style.display = 'none';
    document.getElementById('accounting-view').style.display = 'none';
    document.getElementById('plan-view').style.display = 'none';

    if (tab === 'active' || tab === 'archive') {
        document.getElementById('orders-view').style.display = 'block';
       // В Архиве или для Курьера прячем форму создания заказа!
        const userRole = localStorage.getItem('trackflow_role');
        document.getElementById('create-order-form').style.display = (tab === 'active' && userRole !== 'courier') ? 'block' : 'none';
        loadOrders();
    } else if (tab === 'accounting') {
        document.getElementById('accounting-view').style.display = 'block';
        loadAccounting();
    } else if (tab === 'plan') {
        document.getElementById('plan-view').style.display = 'block';
        loadTasks();
    }
}

// ==========================================
// 📦 ЛОГИКА ЗАКАЗОВ
// ==========================================
async function loadOrders() {
    const orders = await apiCall('/api/orders');
    if (!orders) return;

    const list = document.getElementById('orders-list');
    const searchQuery = (document.getElementById('search-input')?.value || '').toLowerCase();

    // Фильтруем заказы (Активные vs Архив + Поиск)
    const filteredOrders = orders.filter(order => {
        const isArchive = order.status === 'completed';
        const tabMatch = (currentTab === 'active') ? !isArchive : isArchive;
        const textStr = `${order.client_name} ${order.pickup_address} ${order.delivery_address}`.toLowerCase();
        return tabMatch && textStr.includes(searchQuery);
    });

    if (filteredOrders.length === 0) {
        list.innerHTML = currentTab === 'archive' 
            ? '<p style="color: #64748b;">В архиве пока пусто. Пора доставить первый заказ!</p>' 
            : '<p style="color: #64748b;">Активных заказов нет.</p>';
        return;
    }

    list.innerHTML = filteredOrders.map(order => createOrderCardHTML(order)).join('');
}

// Вынесли гигантский HTML карточки отдельно, чтобы не засорять код
function createOrderCardHTML(order) {
    const isCompleted = order.status === 'completed';
    const yandexUrl = `https://yandex.ru/maps/?text=${encodeURIComponent(order.status === 'new' ? order.pickup_address : order.delivery_address)}`;
    const routeText = order.status === 'new' ? '📍 Показать откуда забрать' : '🏁 Показать куда доставить';
    
    let actionBtn = '';
    if (order.status === 'new') {
        const userRole = localStorage.getItem('trackflow_role');
        
        if (userRole === 'courier') {
            actionBtn = `<button class="btn" onclick="updateOrderStatus(${order.id}, 'in_progress')">🟡 ВЗЯТЬ В РАБОТУ</button>`;
        } else {
            actionBtn = `<div style="text-align: center; color: #a0aec0; padding: 10px; font-weight: bold;">⏳ Ожидает курьера</div>`;
        }

    } else if (order.status === 'in_progress') {
        // Кнопка вызова камеры для телефона (или выбора файла на ПК)
        actionBtn = `
            <div style="display: flex; gap: 10px; margin-top: 10px;">
                <label class="btn" style="background: #3b82f6; cursor: pointer; flex: 1; text-align: center; margin: 0; padding: 12px 0;">
                    📸 Фото
                    <input type="file" id="photo-${order.id}" accept="image/*" capture="environment" style="display: none;">
                </label>
                <button class="btn btn-complete" style="flex: 2; margin: 0;" onclick="updateOrderStatus(${order.id}, 'completed')">🟢 Доставлено</button>
            </div>
            <p style="font-size: 0.75em; color: #64748b; margin-top: 5px; text-align: center;">*Сначала выбери фото (по желанию), затем жми Доставлено</p>
        `;
    }

    // Если фото есть в базе, показываем его!
    let photoHTML = '';
    if (order.photo_proof) {
        photoHTML = `
            <div style="margin-top: 15px; text-align: center;">
                <p style="margin-bottom: 5px; font-size: 0.9em; color: #64748b;">📸 Фото доставки:</p>
                <img src="${order.photo_proof}" style="max-width: 100%; border-radius: 8px; border: 1px solid var(--border);">
            </div>
        `;
    }

    let timeInfo = '';
    if (isCompleted && order.created_at && order.completed_at) {
        const diffMins = Math.round((new Date(order.completed_at) - new Date(order.created_at)) / 60000);
        timeInfo = `<p style="color: var(--primary); font-weight: bold;">⏱ Выполнено за: ${diffMins < 60 ? diffMins + ' мин.' : Math.floor(diffMins/60) + ' ч. ' + diffMins%60 + ' мин.'}</p>`;
    }

    const dlDate = order.deadline ? new Date(order.deadline) : null;
    const deadlineText = (dlDate && !isNaN(dlDate)) ? dlDate.toLocaleString('ru-RU', {day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit'}) : 'Как можно скорее';

    return `
        <div class="order-card ${isCompleted ? 'archived-card' : ''}">
            <h3>Заказ #${order.id}</h3>
            <p>👤 <strong>Клиент:</strong> ${order.client_name}</p>
            <p>💵 <strong>Сумма:</strong> ${order.price || 0} ₽</p>
            <p>📅 <strong>К какому времени:</strong> <span style="color: var(--accent); font-weight: bold;">${deadlineText}</span></p>
            
            <div style="background: rgba(100, 116, 139, 0.05); padding: 12px; border-radius: 8px; margin: 15px 0; border: 1px solid var(--border);">
                <p style="margin-top: 0;">📍 <strong>Откуда:</strong> ${order.pickup_address}</p>
                <p style="margin-bottom: 0;">🏁 <strong>Куда:</strong> ${order.delivery_address}</p>
            </div>
            
            <p>Статус: <span class="status">${order.status}</span> ${order.courier_name && order.status === 'in_progress' ? `(🏃 Везет: ${order.courier_name})` : ''}</p>
            ${timeInfo}
            ${photoHTML}
            ${actionBtn ? `<div style="margin-top: 15px;">${actionBtn}</div>` : ''}
            ${!isCompleted ? `<div style="margin-top: 10px;"><a class="btn btn-map" href="${yandexUrl}" target="_blank">${routeText}</a></div>` : ''}
            <button onclick="copyTrackingLink(${order.id})" style="background: transparent; color: #a0a0b0; border: 1px dashed #a0a0b0; padding: 10px; border-radius: 8px; width: 100%; margin-top: 10px; cursor: pointer; font-family: inherit; font-size: 12px;">
    🔗 СКОПИРОВАТЬ ССЫЛКУ КЛИЕНТУ
</button>
        </div>
    `;
}

async function updateOrderStatus(id, status) {
    let photoBase64 = null;
    
    if (status === 'completed') {
        const fileInput = document.getElementById(`photo-${id}`);
        if (fileInput && fileInput.files.length > 0) {
            showNotification('⏳ Загружаем фото на сервер...');
            const file = fileInput.files[0];
            photoBase64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
        }
    }

    // Отправляем запрос. Если это курьер, прикрепляем его имя к заказу!
    await apiCall(`/api/orders/${id}/status`, 'PUT', { 
        status, 
        photo: photoBase64,
        courier_name: currentUserRole === 'courier' ? currentCourierName : 'Админ'
    });
    
    loadOrders();
}
async function createOrder() {
    const pickup = document.getElementById('pickup').value;
    const delivery = document.getElementById('delivery').value;
    const client = document.getElementById('client').value;
    const price = document.getElementById('price').value;
    const deadlineVal = document.getElementById('deadline-input').value;

    if (!pickup || !delivery || !client) return alert('Заполни все поля!');

    const deadline = deadlineVal ? new Date(deadlineVal).toISOString() : null;

    await apiCall('/api/orders', 'POST', { 
        pickup_address: pickup, delivery_address: delivery, client_name: client, 
        deadline, client_phone: "Не указан", cargo_details: "Обычная", price: price || 0 
    });

    if (deadline) await apiCall('/api/tasks', 'POST', { description: `🚚 Заказ: ${client} (${delivery})`, remind_at: deadline });

    ['pickup', 'delivery', 'client', 'price', 'deadline-input'].forEach(id => document.getElementById(id).value = '');
    loadOrders(); loadTasks();
}

// ==========================================
// 💰 ФИНАНСЫ И ПЛАНЕР
// ==========================================
async function loadAccounting() {
    const orders = await apiCall('/api/orders') || [];
    const expenses = await apiCall('/api/expenses') || [];

    const income = orders.filter(o => o.status === 'completed').reduce((sum, o) => sum + (Number(o.price) || 0), 0);
    const expense = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    document.getElementById('acc-income').innerText = `${income} ₽`;
    document.getElementById('acc-expense').innerText = `${expense} ₽`;
    document.getElementById('acc-profit').innerText = `${income - expense} ₽`;

    const list = document.getElementById('expenses-list');
    list.innerHTML = expenses.length ? expenses.map(e => `
        <div class="card">
            <p style="margin: 0; font-size: 1.1em;">💸 <strong>${e.description}</strong></p>
            <p style="margin: 5px 0 0 0; color: #ef4444; font-weight: bold;">- ${e.amount} ₽</p>
        </div>
    `).join('') : '<p style="color: #64748b; text-align: center;">Расходов пока нет. Вы великолепны! 💰</p>';
// 👇 ВОТ ЭТИ ДВЕ СТРОЧКИ ОЖИВЯТ НАШИ ГРАФИКИ!
    drawFinanceChart();
    drawProfitChart(); // Добавили линейный график сюда!
}

async function addExpense() {
    const desc = document.getElementById('expense-desc').value;
    const amount = document.getElementById('expense-amount').value;
    if (!desc || !amount) return alert('Заполни поля!');
    
    await apiCall('/api/expenses', 'POST', { description: desc, amount });
    document.getElementById('expense-desc').value = '';
    document.getElementById('expense-amount').value = '';
    loadAccounting();
}

async function loadTasks() {
    const tasks = await apiCall('/api/tasks') || [];
    const list = document.getElementById('tasks-list');
    
    list.innerHTML = tasks.length ? tasks.map(t => `
        <div class="task-item ${t.is_completed ? 'task-done' : ''}">
            <div>
                <strong style="color: var(--primary);">${new Date((t.remind_at.endsWith('Z') ? t.remind_at : t.remind_at + 'Z')).toLocaleString('ru-RU', {hour:'2-digit', minute:'2-digit', day:'numeric', month:'short'})}</strong><br>
                <span>${t.description}</span>
            </div>
            <div>${!t.is_completed ? `<button class="btn btn-complete" style="padding: 6px 12px;" onclick="completeTask(${t.id})">✔</button>` : ''}</div>
        </div>
    `).join('') : '<p style="color: #64748b; text-align: center;">План чист. Можно отдыхать!</p>';
}

async function addTask() {
    const desc = document.getElementById('task-desc').value;
    const time = document.getElementById('task-time').value;
    if (!desc || !time) return alert('Заполни поля!');
    await apiCall('/api/tasks', 'POST', { description: desc, remind_at: new Date(time).toISOString() });
    document.getElementById('task-desc').value = ''; document.getElementById('task-time').value = '';
    loadTasks();
}

async function completeTask(id) { await apiCall(`/api/tasks/${id}/complete`, 'PUT'); loadTasks(); }

// ==========================================
// 🎙️ ГОЛОС И УВЕДОМЛЕНИЯ
// ==========================================
// === УМНЫЕ ВСПЛЫВАЮЩИЕ УВЕДОМЛЕНИЯ ===
function showNotification(message) {
    const notif = document.createElement('div');
    
    // Стилизуем табличку (чтобы она была красивой и висела поверх всего)
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

    // Магия: через 5 секунд табличка начнет плавно растворяться...
    setTimeout(() => {
        notif.style.opacity = '0';
        // ...а еще через полсекунды полностью удалится из системы!
        setTimeout(() => notif.remove(), 500);
    }, 5000); 
}

function startVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Браузер не поддерживает голос. Нужен Chrome!");
    const rec = new SpeechRecognition(); rec.lang = 'ru-RU';
    rec.onstart = () => showNotification("🎤 Говори! 'Откуда... Куда... Клиент...'");
    rec.onresult = (e) => parseVoiceCommand(e.results[0][0].transcript.toLowerCase());
    rec.start();
}

function parseVoiceCommand(text) {
    const clean = text.replace(/[,.?!;:]/g, ' ').replace(/\s+/g, ' ').trim();
    const pickup = clean.match(/(?:^|\s)откуда\s+(.*?)(?=\s+куда|\s+клиент|\s+имя|$)/i);
    const delivery = clean.match(/(?:^|\s)куда\s+(.*?)(?=\s+откуда|\s+клиент|\s+имя|$)/i);
    const client = clean.match(/(?:^|\s)(?:клиент|имя)\s+(.*?)(?=\s+откуда|\s+куда|$)/i);

    document.getElementById('pickup').value = pickup ? pickup[1].trim() : '';
    document.getElementById('delivery').value = delivery ? delivery[1].trim() : '';
    document.getElementById('client').value = client ? client[1].trim() : text;
    showNotification(pickup || delivery ? "✨ Распознано!" : "🤔 Записал всё в 'Имя'.");
}
// ==========================================
// 🗺️ УМНАЯ МАРШРУТИЗАЦИЯ (TSP Lite)
// ==========================================
async function buildSmartRoute() {
    const orders = await apiCall('/api/orders');
    if (!orders) return;

    // Берем только активные заказы
    const activeOrders = orders.filter(o => o.status !== 'completed');
    
    if (activeOrders.length === 0) {
        return showNotification("Нет активных заказов для построения маршрута!");
    }

    let points = [];
    
    // 🧠 ИСПРАВЛЕННАЯ ЛОГИКА:
    activeOrders.forEach(o => {
        if (o.status === 'new') {
            points.push(o.pickup_address);   // Точка А (забрать)
            points.push(o.delivery_address); // Точка Б (отвезти)
        } else if (o.status === 'in_progress') {
            points.push(o.delivery_address); // Только Точка Б (т.к. уже забрали)
        }
    });

    if (points.length === 0) {
        return showNotification("Не удалось найти адреса для маршрута!");
    }

    // Секретный трюк Яндекса: склеиваем адреса через тильду (~)
    const routeQuery = points.map(p => encodeURIComponent(p)).join('~');
    
    // Открываем Яндекс Карты с готовым мульти-маршрутом
    window.open(`https://yandex.ru/maps/?rtext=${routeQuery}`, '_blank');
    
    showNotification("🗺️ Маршрут построен в новой вкладке!");
}
// ==========================================
// 🚀 ЗАПУСК И СИСТЕМНЫЕ ФОНОВЫЕ ПРОЦЕССЫ
// ==========================================
checkAuth();

setInterval(async () => {
    // 1. Новая проверка авторизации (теперь по ролям)
    if (!localStorage.getItem('trackflow_role')) return;
    
    const now = new Date();
    // Получаем список задач
    const tasks = await apiCall('/api/tasks') || [];

    tasks.forEach(t => {
        // Устанавливаем правильный часовой пояс для времени
        const taskTime = new Date(t.remind_at.endsWith('Z') ? t.remind_at : t.remind_at + 'Z');
        
        // 2. Усиленная проверка: пропускаем завершенные задачи И завершенные заказы!
        // Проверяем время и то, что мы еще не показывали эту табличку
        if (!t.is_completed && t.status !== 'completed' && t.status !== 'archive' && taskTime <= now && !notifiedTasks.has(t.id)) {
            showNotification(`Время пришло: <b>${t.description}</b>`);
            notifiedTasks.add(t.id);
        }
    });
}, 10000); // Проверяем каждые 10 секунд
// Функция для копирования трекинг-ссылки клиенту
window.copyTrackingLink = function(orderId) {
    // Формируем ту самую ссылку с правильным номером заказа
    const link = `https://yulianikiforova1705-netizen.github.io/courier-crm/frontend/track.html?id=${orderId}`;
    
    // Копируем её в буфер обмена телефона/компьютера
    navigator.clipboard.writeText(link).then(() => {
        alert('✅ Ссылка скопирована! Можно отправлять клиенту.');
    }).catch(err => {
        console.error('Ошибка копирования: ', err);
        alert('Не удалось скопировать ссылку 😔');
    });
};// === КАРТА ЯНДЕКСА ===
let myMap;

async function showMap() {
    // 1. Показываем контейнер с картой
    document.getElementById('map-box').style.display = 'block';

    // 2. Если карта уже была открыта раньше, удаляем её, чтобы нарисовать свежую
    if (myMap) {
        myMap.destroy();
    }

    // 3. Ждем, пока Яндекс загрузит все свои скрипты
    ymaps.ready(async function () {
        myMap = new ymaps.Map("map", {
            center: [55.751574, 37.573856], // По умолчанию центр Москвы
            zoom: 10
        });

        // 4. Берем только активные заказы (новые и в пути)
        // 4. Скачиваем свежие заказы с сервера
const allOrders = await apiCall('/api/orders'); 
const activeOrders = allOrders.filter(o => o.status === 'new' || o.status === 'in_progress');

        if (activeOrders.length === 0) {
            alert('Нет активных заказов для отображения!');
            return;
        }

       // 5. Проходимся по каждому заказу и ставим точки (с защитой от ошибок)
        for (const order of activeOrders) {
            try {
                // Ищем координаты точки А (Откуда)
                const pickupRes = await ymaps.geocode(order.pickup_address);
                const pickupGeo = pickupRes.geoObjects.get(0);
                
                if (pickupGeo) { // Если Яндекс нашел адрес
                    const pickupCoords = pickupGeo.geometry.getCoordinates();
                    const pickupPlacemark = new ymaps.Placemark(pickupCoords, {
                        balloonContent: `<b>Заказ #${order.id}</b><br>📦 Забрать: ${order.pickup_address}`
                    }, { preset: 'islands#redDotIcon' });
                    myMap.geoObjects.add(pickupPlacemark);
                } else {
                    console.warn(`Не найден адрес отправки: ${order.pickup_address}`);
                }

                // Ищем координаты точки Б (Куда)
                const deliveryRes = await ymaps.geocode(order.delivery_address);
                const deliveryGeo = deliveryRes.geoObjects.get(0);
                
                if (deliveryGeo) { // Если Яндекс нашел адрес
                    const deliveryCoords = deliveryGeo.geometry.getCoordinates();
                    const deliveryPlacemark = new ymaps.Placemark(deliveryCoords, {
                        balloonContent: `<b>Заказ #${order.id}</b><br>🚩 Доставить: ${order.delivery_address}`
                    }, { preset: 'islands#greenDotIcon' });
                    myMap.geoObjects.add(deliveryPlacemark);
                } else {
                    console.warn(`Не найден адрес доставки: ${order.delivery_address}`);
                }
            } catch (err) {
                console.error(`Ошибка при поиске координат для заказа #${order.id}`, err);
            }
        }

        // 6. Автоматически отдаляем/приближаем карту, чтобы все точки влезли в экран
        myMap.setBounds(myMap.geoObjects.getBounds(), { checkZoomRange: true, zoomMargin: 20 });
    });
}

function closeMap() {
    document.getElementById('map-box').style.display = 'none';
}
// === ГРАФИК СТАТИСТИКИ (CHART.JS) ===
let financeChartInstance = null; // Переменная для хранения графика

async function drawFinanceChart() {
    console.log('🚀 Рисую график финансов...');
    // 1. Скачиваем свежие данные
    const allOrders = await apiCall('/api/orders');
    
    // 2. Считаем, сколько заказов в каком статусе
    const completed = allOrders.filter(o => o.status === 'completed').length;
    const inProgress = allOrders.filter(o => o.status === 'in_progress').length;
    const newOrders = allOrders.filter(o => o.status === 'new').length;

    // 3. Находим наш холст
    const ctx = document.getElementById('financeChart');
    if (!ctx) return;

    // 4. Если график уже был нарисован, стираем его, чтобы нарисовать новый
    if (financeChartInstance) {
        financeChartInstance.destroy();
    }

    // 5. Рисуем красивый неоновый график!
    financeChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Доставлено ✅', 'В пути 🚚', 'Ждет курьера ⏳'],
            datasets: [{
                data: [completed, inProgress, newOrders],
                backgroundColor: [
                    '#00f5d4', // Неоново-зеленый
                    '#fee440', // Ярко-желтый
                    '#f15bb5'  // Неоново-розовый
                ],
                borderWidth: 0, // Убираем рамки для стиля
                hoverOffset: 10 // Эффект вылета при наведении
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // <-- Говорим графику слушаться наших размеров
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#a0a0b0',
                        font: { size: 14, family: 'Montserrat' }
                    }
                }
            }
        }
    });
}
// === ЛИНЕЙНЫЙ ГРАФИК ПРИБЫЛИ ===
let profitChartInstance = null;

async function drawProfitChart() {
    console.log('📈 Рисую график прибыли...');
    const orders = await apiCall('/api/orders') || [];
    const expenses = await apiCall('/api/expenses') || [];

    const dailyData = {};

    // 1. Считаем доходы по дням (только завершенные заказы)
    orders.filter(o => o.status === 'completed').forEach(o => {
        // Берем дату формата ГГГГ-ММ-ДД
        const dateStr = new Date(o.completed_at || o.created_at).toISOString().split('T')[0];
        if (!dailyData[dateStr]) dailyData[dateStr] = { income: 0, expense: 0 };
        dailyData[dateStr].income += Number(o.price) || 0;
    });

    // 2. Считаем расходы по дням
    expenses.forEach(e => {
        const dateStr = new Date(e.created_at).toISOString().split('T')[0];
        if (!dailyData[dateStr]) dailyData[dateStr] = { income: 0, expense: 0 };
        dailyData[dateStr].expense += Number(e.amount) || 0;
    });

    // 3. Сортируем даты по порядку (от старых к новым)
    const sortedDates = Object.keys(dailyData).sort();

    const labels = [];
    const profitData = [];

    // 4. Формируем финальные данные для графика
    sortedDates.forEach(date => {
        // Превращаем '2026-05-03' в красивое '3 мая'
        const niceDate = new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        labels.push(niceDate);
        
        // Чистая прибыль за день = Доходы - Расходы
        const dayProfit = dailyData[date].income - dailyData[date].expense;
        profitData.push(dayProfit);
    });

    const ctx = document.getElementById('profitChart');
    if (!ctx) return;

    if (profitChartInstance) {
        profitChartInstance.destroy();
    }

    // 5. Рисуем красоту!
    profitChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Чистая прибыль (₽)',
                data: profitData,
                borderColor: '#00f5d4', // Неоново-зеленый
                backgroundColor: 'rgba(0, 245, 212, 0.1)', // Полупрозрачная заливка под линией
                borderWidth: 3,
                tension: 0.4, // Делает линию плавной и изогнутой 🌊
                fill: true,
                pointBackgroundColor: '#1e1e2f',
                pointBorderColor: '#00f5d4',
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false } // Прячем лишнюю легенду
            },
            scales: {
                y: { ticks: { color: '#a0a0b0' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                x: { ticks: { color: '#a0a0b0' }, grid: { display: false } }
            }
        }
    });
}
// ==========================================
// 📊 ЭКСПОРТ В EXCEL
// ==========================================
async function downloadExcelReport() {
    showNotification('⏳ Собираем данные для отчета...');

    // 1. Скачиваем свежие заказы с сервера
    const orders = await apiCall('/api/orders');
    if (!orders) return alert('Не удалось получить данные с сервера.');

    // 2. Оставляем только те заказы, которые уже доставлены (completed)
    const completedOrders = orders.filter(o => o.status === 'completed');

    if (completedOrders.length === 0) {
        return showNotification('Нет завершенных заказов для выгрузки!');
    }

    // 3. Форматируем данные: переводим их на русский язык для таблицы
    const excelData = completedOrders.map(order => {
        // Красиво форматируем дату завершения
        const dateObj = new Date(order.completed_at);
        const niceDate = !isNaN(dateObj) ? dateObj.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Неизвестно';

        return {
            'Номер заказа': order.id,
            'Дата завершения': niceDate,
            'Клиент': order.client_name,
            'Откуда': order.pickup_address,
            'Куда': order.delivery_address,
            'Сумма (₽)': order.price
        };
    });

    // 4. Магия SheetJS: создаем лист (worksheet) и книгу (workbook)
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Настраиваем ширину колонок, чтобы текст не слипался
    worksheet['!cols'] = [
        { wch: 15 }, // Номер
        { wch: 20 }, // Дата
        { wch: 25 }, // Клиент
        { wch: 35 }, // Откуда
        { wch: 35 }, // Куда
        { wch: 15 }  // Сумма
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Выполненные заказы");

    // 5. Генерируем красивое имя файла с сегодняшней датой
    const today = new Date().toLocaleDateString('ru-RU').replace(/\./g, '-');
    const fileName = `Отчет_TrackFlow_${today}.xlsx`;

    // 6. Скачиваем файл на компьютер/телефон
    XLSX.writeFile(workbook, fileName);
    
    showNotification('✅ Отчет успешно скачан!');
}
