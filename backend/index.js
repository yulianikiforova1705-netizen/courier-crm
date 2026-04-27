const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db'); // Подключаем базу данных
// Автоматическое добавление колонки с ценой, если её нет
db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS price integer DEFAULT 0').catch(console.error);
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
            client_name, client_phone, cargo_details, price
        } = req.body;

        const query = `
            INSERT INTO orders (pickup_address, delivery_address, deadline, client_name, client_phone, cargo_details, price)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;
        // Если цену не указали, ставим 0
        const values = [pickup_address, delivery_address, deadline, client_name, client_phone, cargo_details, price || 0];

        const newOrder = await db.query(query, values);
        const order = newOrder.rows[0]; 

        // Отправка уведомления в Telegram
        if (process.env.TELEGRAM_CHAT_ID) {
            const message = `🚨 <b>НОВЫЙ ЗАКАЗ #${order.id}</b>\n\n` +
                            `📍 <b>Откуда:</b> ${order.pickup_address}\n` +
                            `🏁 <b>Куда:</b> ${order.delivery_address}\n` +
                            `👤 <b>Клиент:</b> ${order.client_name}\n` +
                            `💰 <b>Стоимость:</b> ${order.price} ₽`;

            const bot = require('./bot');
            await bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, message, { 
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🟡 Взять в работу', callback_data: `status_in_progress_${order.id}` }],
                        [{ text: '🟢 Доставлено', callback_data: `status_completed_${order.id}` }]
                    ]
                }
            });
        }
        res.status(201).json(order);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при создании заказа' });
    }
});
// 3. Обновить статус заказа (для курьера)
app.put('/api/orders/:id/status', async (req, res) => { // <-- Изменили patch на put
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