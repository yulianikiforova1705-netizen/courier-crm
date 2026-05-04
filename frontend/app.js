import { initPushNotifications } from './push.js';
import { API_URL, apiCall } from './api.js'; // 👈 ДОБАВЛЯЕМ ЭТО=========================================
import { showNotification, toggleTheme, initTheme, showSettings, hideSettings, handleAvatarUpload, saveProfile, updateProfileUI } from './ui.js';
import { drawFinanceChart, drawProfitChart, downloadExcelReport } from './analytics.js';
import { showMap, closeMap, buildSmartRoute } from './map.js';
import { loadOrders, updateOrderStatus, createOrder } from './orders.js';
import { loadAccounting, addExpense, loadTasks, addTask, completeTask } from './finances.js';
import { startVoiceInput } from './voice.js';
initTheme();
updateProfileUI();
// ==========================================
// ⚙️ БАЗОВЫЕ НАСТРОЙКИ И API
// ==========================================
const ACCESS_PASSWORD = "vsystem2026";
// 👇 Вставляем мост для пушей сюда, когда API_URL уже существует!
window.initPushNotifications = () => initPushNotifications(API_URL); // это у тебя уже должно быть
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
// ==========================================
// 🔐 АВТОРИЗАЦИЯ И ТЕМА
// ==========================================
initTheme(); // 👈 Просто запускаем проверку темы из модуля ui.js

let currentUserRole = null;
let currentCourierName = '';
function checkAuth() {
    const savedRole = localStorage.getItem('trackflow_role');
    const savedName = localStorage.getItem('trackflow_name');

    if (savedRole) {
        currentUserRole = savedRole;
        currentCourierName = savedName || '';
        document.getElementById('login-screen').style.display = 'none';
        applyRoleRestrictions();
        loadOrders();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('role-selection').style.display = 'block';
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('courier-login').style.display = 'none';
    }
} // 👈 ВОТ ЭТА СКОБКА СПАСЕТ МИР!

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
        updateProfileUI();
    } else {
        document.getElementById('login-error').style.display = 'block';
        document.getElementById('password-input').value = '';
        document.getElementById('header-avatar').style.display = 'none'; // Прячем аватарку от админа
    }
}

// Вход для Курьера
function loginAsCourier() {
    const name = document.getElementById('courier-name-input').value.trim();
    if (name) {
        localStorage.setItem('trackflow_role', 'courier');
        localStorage.setItem('trackflow_name', name);
        checkAuth();
        
        // ДОБАВЛЯЕМ СЮДА (при успешном входе)
        updateProfileUI(); 
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
window.switchTab = function(tab) {
    // 1. Скрываем абсолютно все экраны
    const screens = ['orders-view', 'accounting-view', 'plan-view', 'courier-finances-tab'];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // 2. Убираем класс 'active' у всех кнопок
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    // 3. Логика показа нужного экрана и загрузки данных
    if (tab === 'active' || tab === 'archive') {
        document.getElementById('orders-view').style.display = 'block';
        
        // Скрываем форму создания заказа для курьера или если это архив
        const userRole = localStorage.getItem('trackflow_role');
        const form = document.getElementById('create-order-form');
        if (form) {
            form.style.display = (tab === 'active' && userRole === 'admin') ? 'block' : 'none';
        }
        if (typeof loadOrders === 'function') loadOrders();

    } else if (tab === 'accounting') {
        const accView = document.getElementById('accounting-view');
        if (accView) accView.style.display = 'block';
        if (typeof loadAccounting === 'function') loadAccounting();

    } else if (tab === 'plan') {
        const planView = document.getElementById('plan-view');
        if (planView) planView.style.display = 'block';
        if (typeof loadTasks === 'function') loadTasks();

    } else if (tab === 'courier-finances') {
        const finTab = document.getElementById('courier-finances-tab');
        if (finTab) finTab.style.display = 'block';
        if (typeof loadCourierFinances === 'function') loadCourierFinances();
    }

    // 4. Подсвечиваем кнопку (ищем по ID или по тексту в onclick)
    const activeBtn = document.getElementById('tab-' + tab) || 
                      document.getElementById('btn-courier-finances') ||
                      document.querySelector(`[onclick*="${tab}"]`);
    
    if (activeBtn) activeBtn.classList.add('active');
};
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
};

// 🌉 МОСТ ДЛЯ HTML-КНОПОК (т.к. мы используем type="module")
// ==========================================
window.logout = logout;
window.toggleTheme = toggleTheme;
window.switchTab = switchTab;
window.selectRole = selectRole;
window.backToRoles = backToRoles;
window.checkPassword = checkPassword;
window.loginAsCourier = loginAsCourier;
window.createOrder = createOrder;
window.updateOrderStatus = updateOrderStatus;
window.loadTasks = loadTasks;
window.addExpense = addExpense;
window.showSettings = showSettings;
window.hideSettings = hideSettings;
window.handleAvatarUpload = handleAvatarUpload;
window.saveProfile = saveProfile;
window.addTask = addTask;
window.completeTask = completeTask;
window.buildSmartRoute = buildSmartRoute;
window.startVoiceInput = startVoiceInput;
window.downloadExcelReport = downloadExcelReport;
window.showMap = showMap;
window.closeMap = closeMap;
window.checkAuth = checkAuth;
checkAuth();
// Функция для копирования ссылки на страницу трекинга
window.copyTrackingLink = function(orderId) {
    // Автоматически получаем текущий адрес сайта (чтобы работало и на локалке, и на GitHub)
    const currentUrl = window.location.href.split('?')[0]; 
    const baseUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/')); 
    
    // Формируем итоговую ссылку
    const trackingUrl = `${baseUrl}/track.html?id=${orderId}`;

    // Копируем в буфер обмена
    navigator.clipboard.writeText(trackingUrl).then(() => {
        // Показываем красивое уведомление (используем стандартный alert или твой тост, если он есть)
        alert(`✅ Ссылка скопирована!\nМожешь отправлять её клиенту:\n${trackingUrl}`);
    }).catch(err => {
        console.error('Ошибка при копировании: ', err);
        alert('❌ Не удалось скопировать ссылку. Проверь разрешения браузера.');
    });
};
// === КОРРЕКТНАЯ ИНТЕГРАЦИЯ ВКЛАДКИ ЗАРАБОТКА (Apple Style) ===

function injectCourierFinances() {
    // Теперь используем ТВОИ ключи из функций входа
    const role = localStorage.getItem('trackflow_role');
    const tabsContainer = document.querySelector('.tabs');
    let btn = document.getElementById('btn-courier-finances');

    // Если зашел курьер и кнопки еще нет — добавляем её
    if (role === 'courier' && tabsContainer && !btn) {
        tabsContainer.insertAdjacentHTML('beforeend', `
            <button class="tab-btn" id="btn-courier-finances" 
                    onclick="switchTab('courier-finances'); loadCourierFinances()" 
                    style="flex-basis: 100%; margin-top: 8px;">
                💰 Заработок
            </button>
        `);
    }
}

// Следим за изменениями интерфейса (чтобы кнопка не исчезала при обновлении заказов)
const uiObserver = new MutationObserver(() => {
    injectCourierFinances();
});

// Запускаем наблюдение
uiObserver.observe(document.body, { childList: true, subtree: true });

// Первичный запуск
injectCourierFinances();

// === УЛУЧШЕННЫЙ РАСЧЕТ ЗАРАБОТКА (УМНЫЙ ФИЛЬТР) ===
window.loadCourierFinances = async function() {
    const rawName = localStorage.getItem('trackflow_name') || '';
    const userName = rawName.trim().toLowerCase(); // Убираем пробелы и приводим к нижнему регистру

    if (!userName) return;

    try {
        const res = await fetch('https://courier-crm-api.onrender.com/api/orders');
        const orders = await res.json();
        
        // Фильтруем заказы: проверяем статус и имя курьера без учета регистра
        const myOrders = orders.filter(o => {
            const status = (o.status || '').toLowerCase();
            const courier = (o.courier_name || '').trim().toLowerCase();
            
            return (status === 'completed' || status === 'archive') && 
                   courier === userName;
        });
        
        const totalEarned = myOrders.reduce((sum, order) => sum + (Number(order.price) || 0), 0);
        
        const display = document.getElementById('courier-total-earned');
        if (display) {
            display.innerText = totalEarned + ' ₽';
        }
    } catch (err) {
        console.error('Ошибка загрузки заработка:', err);
    }
};

// 3. Добавляем расход с пометкой имени курьера
window.addCourierExpense = async function() {
    const desc = document.getElementById('courier-expense-desc').value;
    const amount = document.getElementById('courier-expense-amount').value;
    const userName = localStorage.getItem('userName') || 'Курьер';

    if (!desc || !amount) return alert('Пожалуйста, заполните все поля!');

    // Формируем описание для админа (например: "[Иван] Бензин")
    const finalDesc = `[${userName}] ${desc}`;

    try {
        await fetch('https://courier-crm-api.onrender.com/api/finances/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: finalDesc, amount: Number(amount) })
        });
        
        alert('✅ Расход успешно добавлен и передан администратору!');
        document.getElementById('courier-expense-desc').value = '';
        document.getElementById('courier-expense-amount').value = '';
    } catch (err) {
        console.error(err);
        alert('❌ Ошибка при добавлении расхода.');
    }
};