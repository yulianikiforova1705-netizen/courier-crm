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
    } else {
        document.getElementById('courier-error').style.display = 'block';
        document.getElementById('header-avatar').style.display = 'block'; // Показываем аватарку курьеру
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