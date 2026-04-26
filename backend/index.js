const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db'); // Подключаем базу данных
const bot = require('./bot'); // Подключаем нашего Telegram-бота

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- МАРШРУТЫ API ---

// 1. Получить список всех заказов (для PWA курьера)
app.get('/api/orders', async (req, res) => {
    try {
        // Запрашиваем все заказы, сортируем свежие сверху
        const result = await db.query('SELECT * FROM orders ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера при получении заказов' });
    }
});

// 2. Создать новый заказ (от диспетчера или системы магазина)
app.post('/api/orders', async (req, res) => {
    try {
        const {
            pickup_address, delivery_address, deadline,
            client_name, client_phone, cargo_details
        } = req.body;

        const query = `
            INSERT INTO orders (pickup_address, delivery_address, deadline, client_name, client_phone, cargo_details)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `;
        const values = [pickup_address, delivery_address, deadline, client_name, client_phone, cargo_details];

        const newOrder = await db.query(query, values);
        
        // --- ВОТ ТА САМАЯ ВАЖНАЯ СТРОЧКА ---
        const order = newOrder.rows[0]; 
        
        // --- НОВЫЙ БЛОК: Отправка уведомления в Telegram ---
        if (process.env.TELEGRAM_CHAT_ID) {
            const message = `🚨 <b>НОВЫЙ ЗАКАЗ #${order.id}</b>\n\n` +
                            `📍 <b>Откуда:</b> ${order.pickup_address}\n` +
                            `🏁 <b>Куда:</b> ${order.delivery_address}\n` +
                            `👤 <b>Клиент:</b> ${order.client_name}`;
            
            await bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, message, { parse_mode: 'HTML' });
        }
        // ---------------------------------------------------

        res.status(201).json(order);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при создании заказа' });
    }
});
// 3. Обновить статус заказа (для курьера)
app.patch('/api/orders/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // Получаем новый статус (например, 'in_progress')

        const query = `
            UPDATE orders 
            SET status = $1 
            WHERE id = $2 
            RETURNING *;
        `;
        const result = await db.query(query, [status, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при обновлении статуса' });
    }
});
// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер работает на порту ${PORT}`);
});