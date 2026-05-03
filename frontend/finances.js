// frontend/finances.js

import { apiCall } from './api.js';
import { showNotification } from './ui.js';
import { drawFinanceChart, drawProfitChart } from './analytics.js';

// ==========================================
// 💰 ФИНАНСЫ И УЧЕТ
// ==========================================
export async function loadAccounting() {
    const orders = await apiCall('/api/orders') || [];
    const expenses = await apiCall('/api/expenses') || [];

    const income = orders.filter(o => o.status === 'completed').reduce((sum, o) => sum + (Number(o.price) || 0), 0);
    const expenseTotal = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const profit = income - expenseTotal;

    const incomeEl = document.getElementById('total-income');
    const expenseEl = document.getElementById('total-expense');
    const profitEl = document.getElementById('net-profit');

    if (incomeEl) incomeEl.innerText = `${income} ₽`;
    if (expenseEl) expenseEl.innerText = `${expenseTotal} ₽`;
    if (profitEl) profitEl.innerText = `${profit} ₽`;

    // Обновляем графики
    drawFinanceChart();
    drawProfitChart();
}

export async function addExpense() {
    const amount = document.getElementById('expense-amount').value;
    const description = document.getElementById('expense-desc').value;

    if (!amount || !description) return showNotification('Заполните сумму и описание расхода!');

    await apiCall('/api/expenses', 'POST', { amount, description });
    
    document.getElementById('expense-amount').value = '';
    document.getElementById('expense-desc').value = '';
    
    showNotification('💸 Расход успешно записан!');
    loadAccounting(); // Пересчитываем цифры
}

// ==========================================
// 📝 ЗАДАЧИ И НАПОМИНАНИЯ
// ==========================================
export async function loadTasks() {
    const tasks = await apiCall('/api/tasks') || [];
    const list = document.getElementById('tasks-list');
    if (!list) return;

    const activeTasks = tasks.filter(t => t.status !== 'completed');

    if (activeTasks.length === 0) {
        list.innerHTML = '<p style="color: #64748b;">Задач пока нет. Вы великолепны! 🥇</p>';
        return;
    }

    list.innerHTML = activeTasks.map(task => {
        const dateStr = task.remind_at ? new Date(task.remind_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Без срока';
        return `
            <div style="background: rgba(100, 116, 139, 0.05); padding: 12px; margin-bottom: 10px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border);">
                <div>
                    <p style="margin: 0; font-weight: bold; color: var(--text-main);">${task.description}</p>
                    <p style="margin: 5px 0 0 0; font-size: 0.8em; color: var(--accent);">⏳ ${dateStr}</p>
                </div>
                <button onclick="completeTask(${task.id})" style="background: transparent; border: none; font-size: 1.5em; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">✅</button>
            </div>
        `;
    }).join('');
}

export async function addTask() {
    const desc = document.getElementById('task-desc').value;
    const date = document.getElementById('task-date').value;

    if (!desc) return showNotification('Введите описание задачи!');

    const remind_at = date ? new Date(date).toISOString() : null;
    await apiCall('/api/tasks', 'POST', { description: desc, remind_at });

    document.getElementById('task-desc').value = '';
    document.getElementById('task-date').value = '';
    
    showNotification('📝 Задача добавлена!');
    loadTasks();
}

export async function completeTask(id) {
    await apiCall(`/api/tasks/${id}/complete`, 'PUT');
    showNotification('✅ Задача выполнена!');
    loadTasks();
}