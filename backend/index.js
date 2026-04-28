const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db'); // Подключаем базу данных
// Автоматическое добавление колонки с ценой, если её нет
db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS price integer DEFAULT 0').catch(console.error);
// Автоматическое добавление колонок для цены и времени
db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS price integer DEFAULT 0').catch(console.error);
db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT CURRENT_TIMESTAMP').catch(console.error);
db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at timestamp').catch(console.error);
// Автоматическое создание таблицы расходов
db.query(`
    CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        description VARCHAR(255) NOT NULL,
        amount INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`).catch(console.error);

// Автоматическое создание таблицы задач (План дня)
db.query(`
    CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        description VARCHAR(255) NOT NULL,
        remind_at TIMESTAMP NOT NULL,
        is_completed BOOLEAN DEFAULT FALSE
    )
`).catch(console.error);
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
// 2. Создать новый заказ
app.post('/api/orders', async (req, res) => {
    try {
        const {
            pickup_address, delivery_address, deadline,
            client_name, client_phone, cargo_details, price
        } = req.body;

        // --- БРОНЕБОЙНАЯ ЗАЩИТА ДАННЫХ ---
        const numericPrice = parseInt(price) || 0;
        // Если курьер выбрал время - берем его, иначе ставим текущее
        const safeDeadline = deadline ? new Date(deadline).toISOString() : new Date().toISOString(); 
        const safePhone = client_phone || "Не указан";
        const safeDetails = cargo_details || "Обычная доставка";

        const query = `
            INSERT INTO orders (pickup_address, delivery_address, deadline, client_name, client_phone, cargo_details, price)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;
        
        const values = [pickup_address, delivery_address, safeDeadline, client_name, safePhone, safeDetails, numericPrice];

        const newOrder = await db.query(query, values);
        const order = newOrder.rows[0]; 
        
        // Отправка уведомления в Telegram
        if (process.env.TELEGRAM_CHAT_ID) {
            try {
                const bot = require('./bot');
                const message = `🚨 <b>НОВЫЙ ЗАКАЗ #${order.id}</b>\n\n` +
                                `📍 <b>Откуда:</b> ${order.pickup_address}\n` +
                                `🏁 <b>Куда:</b> ${order.delivery_address}\n` +
                                `👤 <b>Клиент:</b> ${order.client_name}\n` +
                                `💰 <b>Стоимость:</b> ${order.price} ₽`;
                
                await bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, message, { 
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🟡 Взять в работу', callback_data: `status_in_progress_${order.id}` }],
                            [{ text: '🟢 Доставлено', callback_data: `status_completed_${order.id}` }]
                        ]
                    }
                });
            } catch (botErr) {
                console.log('Ошибка при отправке в Telegram:', botErr.message);
            }
        }
        res.status(201).json(order);
    } catch (err) {
        console.error('ОШИБКА БАЗЫ ДАННЫХ:', err);
        res.status(500).json({ error: 'Ошибка при создании заказа' });
    }
});
// 3. Обновить статус заказа (для курьера)
app.put('/api/orders/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        let query;
        let values;

        // Если заказ завершен — фиксируем время финиша
        if (status === 'completed') {
            query = `
                UPDATE orders 
                SET status = $1, completed_at = CURRENT_TIMESTAMP 
                WHERE id = $2 
                RETURNING *;
            `;
            values = [status, id];
        } else {
            // Для остальных статусов просто обновляем статус
            query = `
                UPDATE orders 
                SET status = $1 
                WHERE id = $2 
                RETURNING *;
            `;
            values = [status, id];
        }

        const result = await db.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Ошибка обновления статуса:', err);
        res.status(500).json({ error: 'Ошибка при обновлении статуса' });
    }
});
// ================= БУХГАЛТЕРИЯ =================

// Получить все расходы
app.get('/api/expenses', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM expenses ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка получения расходов:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Добавить новый расход
app.post('/api/expenses', async (req, res) => {
    try {
        const { description, amount } = req.body;
        const result = await db.query(
            'INSERT INTO expenses (description, amount) VALUES ($1, $2) RETURNING *',
            [description, parseInt(amount) || 0]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Ошибка добавления расхода:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});
// ================= ПЛАН ДНЯ И НАПОМИНАНИЯ =================

// Получить все задачи
app.get('/api/tasks', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM tasks ORDER BY remind_at ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Добавить задачу
app.post('/api/tasks', async (req, res) => {
    try {
        const { description, remind_at } = req.body;
        const result = await db.query(
            'INSERT INTO tasks (description, remind_at) VALUES ($1, $2) RETURNING *',
            [description, remind_at]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Выполнить задачу (зачеркнуть)
app.put('/api/tasks/:id/complete', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('UPDATE tasks SET is_completed = TRUE WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});
// ==========================================
// 🤖 TELEGRAM-СКАНЕР НАПОМИНАНИЙ
// ==========================================

// Вставь свои цифры от команды /myid в кавычки ниже!
const ADMIN_CHAT_ID = '765319326'; 

const notifiedTasksTg = new Set(); // Память сервера, чтобы бот не спамил

setInterval(async () => {
    try {
        // Берем из базы только НЕвыполненные задачи
        const result = await db.query('SELECT * FROM tasks WHERE is_completed = FALSE');
        const now = new Date();

        result.rows.forEach(t => {
            const taskTime = new Date(t.remind_at);
            
            // Если время настало, и мы еще не писали об этом в ТГ:
            // (А также проверяем, что задача просрочена не более чем на 2 часа, чтобы при перезагрузке сервера бот не прислал тебе уведомления за прошлый год)
            if (taskTime <= now && (now - taskTime) < 2 * 60 * 60 * 1000 && !notifiedTasksTg.has(t.id)) {
                
                // Отправляем красивое сообщение
                bot.telegram.sendMessage(
                    ADMIN_CHAT_ID, 
                    `⏰ <b>ПЛАН ДНЯ!</b>\n\n📌 <i>${t.description}</i>`, 
                    { parse_mode: 'HTML' }
                ).catch(err => console.error('Ошибка отправки в Telegram:', err));
                
                // Запоминаем, что уже отправили
                notifiedTasksTg.add(t.id);
            }
        });
    } catch (err) {
        console.error('Ошибка сканера задач Telegram:', err);
    }
}, 10000); // Сервер проверяет планы каждые 10 секунд
// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер работает на порту ${PORT}`);
});