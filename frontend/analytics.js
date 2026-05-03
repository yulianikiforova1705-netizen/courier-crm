// frontend/analytics.js

// Импортируем инструменты, которые нам понадобятся
import { apiCall } from './api.js';
import { showNotification } from './ui.js';

let financeChartInstance = null;
let profitChartInstance = null;

// === ГРАФИК СТАТИСТИКИ (CHART.JS) ===
export async function drawFinanceChart() {
    console.log('🚀 Рисую график финансов...');
    const allOrders = await apiCall('/api/orders');
    if (!allOrders) return;
    
    const completed = allOrders.filter(o => o.status === 'completed').length;
    const inProgress = allOrders.filter(o => o.status === 'in_progress').length;
    const newOrders = allOrders.filter(o => o.status === 'new').length;

    const ctx = document.getElementById('financeChart');
    if (!ctx) return;

    if (financeChartInstance) {
        financeChartInstance.destroy();
    }

    // @ts-ignore (чтобы редактор не ругался на Chart, т.к. он подключен в HTML)
    financeChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Доставлено ✅', 'В пути 🚚', 'Ждет курьера ⏳'],
            datasets: [{
                data: [completed, inProgress, newOrders],
                backgroundColor: ['#00f5d4', '#fee440', '#f15bb5'],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#a0a0b0', font: { size: 14, family: 'Montserrat' } } }
            }
        }
    });
}

// === ЛИНЕЙНЫЙ ГРАФИК ПРИБЫЛИ ===
export async function drawProfitChart() {
    console.log('📈 Рисую график прибыли...');
    const orders = await apiCall('/api/orders') || [];
    const expenses = await apiCall('/api/expenses') || [];

    const dailyData = {};

    orders.filter(o => o.status === 'completed').forEach(o => {
        const dateStr = new Date(o.completed_at || o.created_at).toISOString().split('T')[0];
        if (!dailyData[dateStr]) dailyData[dateStr] = { income: 0, expense: 0 };
        dailyData[dateStr].income += Number(o.price) || 0;
    });

    expenses.forEach(e => {
        const dateStr = new Date(e.created_at).toISOString().split('T')[0];
        if (!dailyData[dateStr]) dailyData[dateStr] = { income: 0, expense: 0 };
        dailyData[dateStr].expense += Number(e.amount) || 0;
    });

    const sortedDates = Object.keys(dailyData).sort();
    const labels = [];
    const profitData = [];

    sortedDates.forEach(date => {
        const niceDate = new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        labels.push(niceDate);
        profitData.push(dailyData[date].income - dailyData[date].expense);
    });

    const ctx = document.getElementById('profitChart');
    if (!ctx) return;

    if (profitChartInstance) {
        profitChartInstance.destroy();
    }

    // @ts-ignore
    profitChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Чистая прибыль (₽)',
                data: profitData,
                borderColor: '#00f5d4',
                backgroundColor: 'rgba(0, 245, 212, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#1e1e2f',
                pointBorderColor: '#00f5d4',
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { ticks: { color: '#a0a0b0' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                x: { ticks: { color: '#a0a0b0' }, grid: { display: false } }
            }
        }
    });
}

// === ЭКСПОРТ В EXCEL ===
export async function downloadExcelReport() {
    showNotification('⏳ Собираем данные для отчета...');
    const orders = await apiCall('/api/orders');
    if (!orders) return alert('Не удалось получить данные с сервера.');

    const completedOrders = orders.filter(o => o.status === 'completed');
    if (completedOrders.length === 0) {
        return showNotification('Нет завершенных заказов для выгрузки!');
    }

    const excelData = completedOrders.map(order => {
        const dateObj = new Date(order.completed_at);
        const niceDate = !isNaN(dateObj.getTime()) ? dateObj.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Неизвестно';
        return {
            'Номер заказа': order.id,
            'Дата завершения': niceDate,
            'Клиент': order.client_name,
            'Откуда': order.pickup_address,
            'Куда': order.delivery_address,
            'Сумма (₽)': order.price
        };
    });

    // @ts-ignore
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    worksheet['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 25 }, { wch: 35 }, { wch: 35 }, { wch: 15 }];
    // @ts-ignore
    const workbook = XLSX.utils.book_new();
    // @ts-ignore
    XLSX.utils.book_append_sheet(workbook, worksheet, "Выполненные заказы");

    const today = new Date().toLocaleDateString('ru-RU').replace(/\./g, '-');
    const fileName = `Отчет_TrackFlow_${today}.xlsx`;
    // @ts-ignore
    XLSX.writeFile(workbook, fileName);
    
    showNotification('✅ Отчет успешно скачан!');
}