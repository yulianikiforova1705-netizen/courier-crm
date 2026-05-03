// frontend/orders.js

import { apiCall } from './api.js';
import { showNotification } from './ui.js';

// ==========================================
// 📦 ЛОГИКА ЗАКАЗОВ
// ==========================================
export async function loadOrders() {
    const orders = await apiCall('/api/orders');
    if (!orders) return;

    const list = document.getElementById('orders-list');
    const searchQuery = (document.getElementById('search-input')?.value || '').toLowerCase();

    // Умный поиск активной вкладки через HTML (чтобы не зависеть от app.js)
    const activeTabElement = document.querySelector('.tab-btn.active');
    const currentTab = activeTabElement ? activeTabElement.id.replace('tab-', '') : 'active';

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

function createOrderCardHTML(order) {
    const isCompleted = order.status === 'completed';
    const yandexUrl = `https://yandex.ru/maps/?text=${encodeURIComponent(order.status === 'new' ? order.pickup_address : order.delivery_address)}`;
    const routeText = order.status === 'new' ? '📍 Показать откуда забрать' : '🏁 Показать куда доставить';
    
    // Получаем роль прямо из памяти браузера
    const userRole = localStorage.getItem('trackflow_role');
    
    let actionBtn = '';
    if (order.status === 'new') {
        if (userRole === 'courier') {
            actionBtn = `<button class="btn" onclick="updateOrderStatus(${order.id}, 'in_progress')">🟡 ВЗЯТЬ В РАБОТУ</button>`;
        } else {
            actionBtn = `<div style="text-align: center; color: #a0aec0; padding: 10px; font-weight: bold;">⏳ Ожидает курьера</div>`;
        }
    } else if (order.status === 'in_progress') {
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
    const deadlineText = (dlDate && !isNaN(dlDate.getTime())) ? dlDate.toLocaleString('ru-RU', {day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit'}) : 'Как можно скорее';

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

export async function updateOrderStatus(id, status) {
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

    const userRole = localStorage.getItem('trackflow_role');
    const courierName = localStorage.getItem('trackflow_name') || 'Админ';

    await apiCall(`/api/orders/${id}/status`, 'PUT', { 
        status, 
        photo: photoBase64,
        courier_name: userRole === 'courier' ? courierName : 'Админ'
    });
    
    loadOrders();
}

export async function createOrder() {
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
    
    loadOrders(); 
    // Дергаем загрузку задач из глобального моста, если она есть
    if (window.loadTasks) window.loadTasks(); 
}