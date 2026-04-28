// 🌓 Логика темы
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

// 🔐 Логика авторизации
const ACCESS_PASSWORD = "vsystem2026";

function checkAuth() {
    if (localStorage.getItem('trackflow_auth') === 'true') {
        document.getElementById('login-screen').style.display = 'none';
        loadOrders();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
    }
}

function checkPassword() {
    const input = document.getElementById('password-input').value;
    if (input === ACCESS_PASSWORD) {
        localStorage.setItem('trackflow_auth', 'true');
        document.getElementById('login-screen').style.display = 'none';
        loadOrders();
    } else {
        document.getElementById('login-error').style.display = 'block';
        document.getElementById('password-input').value = '';
    }
}

// 📑 Обновленная логика вкладок
let currentTab = 'active';
function switchTab(tab) {
    currentTab = tab;
    
    // Сбрасываем стили со всех кнопок
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');

    // Скрываем все экраны
    document.getElementById('orders-view').style.display = 'none';
    document.getElementById('accounting-view').style.display = 'none';
    document.getElementById('plan-view').style.display = 'none';

    // Показываем нужный экран
    document.getElementById(`${tab}-view`).style.display = 'block';

    // Загружаем нужные данные
    if (tab === 'accounting') loadAccounting();
    else if (tab === 'plan') loadTasks();
    else loadOrders();
}

// 📡 API
const API_URL = 'https://courier-crm-api.onrender.com';

// 📦 Обновление статуса
async function updateOrderStatus(id, status) {
    try {
        await fetch(`${API_URL}/api/orders/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        loadOrders();
    } catch (err) {
        console.error('Ошибка обновления статуса:', err);
    }
}

async function loadOrders() {
    try {
        const response = await fetch(`${API_URL}/api/orders`);
        const orders = await response.json();
        const list = document.getElementById('orders-list');
        list.innerHTML = '';
        
        const searchInput = document.getElementById('search-input');
        const searchQuery = searchInput ? searchInput.value.toLowerCase() : '';

        let totalIncome = 0;
        orders.forEach(o => {
            if (o.status === 'completed') {
                totalIncome += Number(o.price) || 0;
            }
        });

        const incomeBadge = document.getElementById('income-badge');
        if (currentTab === 'archive') {
            incomeBadge.style.display = 'inline-block';
            incomeBadge.innerText = `💰 Выручка: ${totalIncome} ₽`;
        } else {
            incomeBadge.style.display = 'none';
        }

        const filteredOrders = orders.filter(order => {
            let tabMatch = false;
            if (currentTab === 'active') {
                tabMatch = order.status !== 'completed';
            } else {
                tabMatch = order.status === 'completed';
            }
            const textString = `${order.client_name} ${order.pickup_address} ${order.delivery_address}`.toLowerCase();
            const searchMatch = textString.includes(searchQuery);
            return tabMatch && searchMatch;
        });

        if (filteredOrders.length === 0) {
            list.innerHTML = '<p style="color: #64748b;">В этой категории пока пусто.</p>';
            return;
        }

        filteredOrders.forEach(order => {
            const card = document.createElement('div');
            card.className = 'order-card';
            
            const currentStatus = order.status.toLowerCase();

            // Логика умных ссылок на Я.Карты
            let yandexUrl = '';
            let routeBtnText = '';
            if (currentStatus === 'new') {
                yandexUrl = `https://yandex.ru/maps/?text=${encodeURIComponent(order.pickup_address)}`;
                routeBtnText = '📍 Показать откуда забрать';
            } else {
                yandexUrl = `https://yandex.ru/maps/?text=${encodeURIComponent(order.delivery_address)}`;
                routeBtnText = '🏁 Показать куда доставить';
            }

            // Кнопки статусов
            let actionButton = '';
            if (currentStatus === 'new') {
                actionButton = `<button class="btn" onclick="updateOrderStatus(${order.id}, 'in_progress')">🟡 Взять в работу</button>`;
            } else if (currentStatus === 'in_progress') {
                actionButton = `<button class="btn btn-complete" onclick="updateOrderStatus(${order.id}, 'completed')">🟢 Доставлено</button>`;
            }

            // Время выполнения
            let timeInfo = '';
            if (currentStatus === 'completed' && order.created_at && order.completed_at) {
                const start = new Date(order.created_at);
                const end = new Date(order.completed_at);
                const diffMins = Math.round((end - start) / 60000);
                let timeStr = diffMins < 60 ? `${diffMins} мин.` : `${Math.floor(diffMins / 60)} ч. ${diffMins % 60} мин.`;
                timeInfo = `<p style="color: var(--primary); font-weight: bold; margin-top: 5px;">⏱ Время выполнения: ${timeStr}</p>`;
            }

            let deadlineText = 'Как можно скорее';
            if (order.deadline) {
                const dlDate = new Date(order.deadline);
                if (!isNaN(dlDate)) {
                    deadlineText = dlDate.toLocaleString('ru-RU', {
                        day: 'numeric', month: 'short', 
                        hour: '2-digit', minute:'2-digit'
                    });
                }
            }

            card.innerHTML = `
                <h3>Заказ #${order.id}</h3>
                <p>👤 <strong>Клиент:</strong> ${order.client_name}</p>
                <p>💵 <strong>Сумма:</strong> ${order.price || 0} ₽</p>
                <p>📅 <strong>К какому времени:</strong> <span style="color: var(--accent); font-weight: bold;">${deadlineText}</span></p>
                
                <div style="background: rgba(100, 116, 139, 0.05); padding: 12px; border-radius: 8px; margin: 15px 0; border: 1px solid var(--border);">
                    <p style="margin-top: 0;">📍 <strong>Откуда:</strong> ${order.pickup_address}</p>
                    <p style="margin-bottom: 0;">🏁 <strong>Куда:</strong> ${order.delivery_address}</p>
                </div>
                
                <p>Статус: <span class="status">${order.status}</span></p>
                ${timeInfo}
                
                <div style="margin-top: 15px;">
                    ${actionButton}
                </div>
                <div style="margin-top: 10px;">
                    <a class="btn btn-map" href="${yandexUrl}" target="_blank">${routeBtnText}</a>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (err) {
        document.getElementById('orders-list').innerHTML = '<p style="color:red">Ошибка загрузки. Подождите 30 сек и обновите страницу.</p>';
    }
}

async function createOrder() {
    const pickup = document.getElementById('pickup').value;
    const delivery = document.getElementById('delivery').value;
    const client = document.getElementById('client').value;
    const price = document.getElementById('price').value;
    const deadlineVal = document.getElementById('deadline-input').value;

    if (!pickup || !delivery || !client) return alert('Заполни все поля!');

    // 🕒 МАГИЯ ВРЕМЕНИ: Переводим локальное время в абсолютный международный формат (ISO)
    const safeDeadline = deadlineVal ? new Date(deadlineVal).toISOString() : null;

    await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            pickup_address: pickup, 
            delivery_address: delivery, 
            client_name: client, 
            deadline: safeDeadline, // <-- Отправляем исправленное время
            client_phone: "Не указан",
            cargo_details: "Обычная доставка",
            price: price || 0
        })
    });

    document.getElementById('pickup').value = '';
    document.getElementById('delivery').value = '';
    document.getElementById('client').value = '';
    document.getElementById('price').value = '';
    document.getElementById('deadline-input').value = '';
    loadOrders();
}

// ==========================================
// ЛОГИКА ФИНАНСОВ (БУХГАЛТЕРИЯ)
// ==========================================
async function loadAccounting() {
    try {
        const resOrders = await fetch(`${API_URL}/api/orders`);
        const orders = await resOrders.json();
        
        const resExp = await fetch(`${API_URL}/api/expenses`);
        const expenses = await resExp.json();

        let totalIncome = 0;
        orders.forEach(o => {
            if (o.status === 'completed') totalIncome += Number(o.price) || 0;
        });

        let totalExpense = 0;
        expenses.forEach(e => {
            totalExpense += Number(e.amount) || 0;
        });

        const profit = totalIncome - totalExpense;

        document.getElementById('acc-income').innerText = `${totalIncome} ₽`;
        document.getElementById('acc-expense').innerText = `${totalExpense} ₽`;
        document.getElementById('acc-profit').innerText = `${profit} ₽`;

        const list = document.getElementById('expenses-list');
        list.innerHTML = '';
        
        if (expenses.length === 0) {
            list.innerHTML = '<p style="color: #64748b; text-align: center;">Расходов пока нет. Вы великолепны! 💰</p>';
            return;
        }

        expenses.forEach(e => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <p style="margin: 0; font-size: 1.1em;">💸 <strong>${e.description}</strong></p>
                <p style="margin: 5px 0 0 0; color: #ef4444; font-weight: bold;">- ${e.amount} ₽</p>
            `;
            list.appendChild(card);
        });

    } catch (error) {
        console.error('Ошибка загрузки финансов:', error);
    }
}

async function addExpense() {
    const desc = document.getElementById('expense-desc').value;
    const amount = document.getElementById('expense-amount').value;

    if (!desc || !amount) return alert('Заполни описание и сумму расхода!');

    await fetch(`${API_URL}/api/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc, amount: amount })
    });

    document.getElementById('expense-desc').value = '';
    document.getElementById('expense-amount').value = '';
    loadAccounting();
}

// Первый запуск
checkAuth();

// Умное автообновление
setInterval(() => {
    if (localStorage.getItem('trackflow_auth') !== 'true') return;
    const pickup = document.getElementById('pickup').value;
    const delivery = document.getElementById('delivery').value;
    const client = document.getElementById('client').value;

    // Обновляем только если юзер не вводит текст в форму прямо сейчас
    if (pickup === '' && delivery === '' && client === '') {
        if (currentTab === 'accounting') {
            loadAccounting();
        } else {
            loadOrders();
        }
    }
}, 3000);
// ==========================================
// ЛОГИКА ПЛАНЕРА И НАПОМИНАНИЙ
// ==========================================

let notifiedTasks = new Set(); // Память: чтобы не спамить одним и тем же уведомлением

// Функция показа красивого всплывающего окна + звук
function showNotification(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `🔔 <strong>Внимание!</strong><br><span style="font-size: 0.9em;">${message}</span>`;
    container.appendChild(toast);
    
    // Писк при уведомлении
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        osc.type = 'sine'; osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.15);
    } catch(e) {}

    // Убираем уведомление через 6 секунд
    setTimeout(() => toast.remove(), 6000);
}

// Загрузка задач
async function loadTasks() {
    try {
        const response = await fetch(`${API_URL}/api/tasks`);
        const tasks = await response.json();
        const list = document.getElementById('tasks-list');
        list.innerHTML = '';

        if (tasks.length === 0) {
            list.innerHTML = '<p style="color: #64748b; text-align: center;">План чист. Можно отдыхать!</p>';
            return;
        }

        tasks.forEach(t => {
            const isDone = t.is_completed ? 'task-done' : '';
            const btn = t.is_completed ? '' : `<button class="btn btn-complete" style="padding: 6px 12px; margin: 0;" onclick="completeTask(${t.id})">✔</button>`;
            
            // Красивая дата
            const timeObj = new Date(t.remind_at);
            const timeStr = timeObj.toLocaleString('ru-RU', { hour: '2-digit', minute:'2-digit', day: 'numeric', month: 'short' });

            const item = document.createElement('div');
            item.className = `task-item ${isDone}`;
            item.innerHTML = `
                <div>
                    <strong style="color: var(--primary); font-size: 1.1em;">${timeStr}</strong><br>
                    <span>${t.description}</span>
                </div>
                <div>${btn}</div>
            `;
            list.appendChild(item);
        });
    } catch (error) {
        console.error('Ошибка загрузки задач', error);
    }
}

// Добавление задачи
async function addTask() {
    const desc = document.getElementById('task-desc').value;
    const time = document.getElementById('task-time').value;

    if (!desc || !time) return alert('Заполни описание и время!');

    // 🕒 МАГИЯ ВРЕМЕНИ ДЛЯ ЗАДАЧ
    const safeTime = new Date(time).toISOString();

    await fetch(`${API_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc, remind_at: safeTime }) // <-- Отправляем исправленное время
    });

    document.getElementById('task-desc').value = '';
    document.getElementById('task-time').value = '';
    loadTasks();
}

// Завершение задачи
async function completeTask(id) {
    await fetch(`${API_URL}/api/tasks/${id}/complete`, { method: 'PUT' });
    loadTasks();
}

// Фоновый сканер напоминаний (запускается каждые 10 секунд)
setInterval(async () => {
    if (localStorage.getItem('trackflow_auth') !== 'true') return;
    
    try {
        const response = await fetch(`${API_URL}/api/tasks`);
        const tasks = await response.json();
        const now = new Date();

        tasks.forEach(t => {
            const taskTime = new Date(t.remind_at);
            // Если задача не выполнена, время настало (или прошло), и мы еще о ней не напоминали
            if (!t.is_completed && taskTime <= now && !notifiedTasks.has(t.id)) {
                showNotification(`Время пришло: <b>${t.description}</b>`);
                notifiedTasks.add(t.id); // Запоминаем, чтобы не дублировать
            }
        });
    } catch(e) {}
}, 10000);