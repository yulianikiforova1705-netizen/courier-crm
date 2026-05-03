const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db'); 
const { startParser } = require('./parser');
const { sendOrderNotification } = require('./bot'); 
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const webPush = require('web-push'); // 🔔 ПЕРЕНЕСЛИ СЮДА

// === ДОБАВЛЯЕМ МАГИЮ WEBSOCKETS ===
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json({ limit: '20mb' })); // Увеличиваем лимит, чтобы картинки пролезали

// --- НАСТРОЙКА БАЗЫ ДАННЫХ ---
db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS price integer DEFAULT 0').catch(console.error);
db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT CURRENT_TIMESTAMP').catch(console.error);
db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at timestamp').catch(console.error);
db.query(`CREATE TABLE IF NOT EXISTS expenses (id SERIAL PRIMARY KEY, description VARCHAR(255) NOT NULL, amount INTEGER NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`).catch(console.error);
db.query(`CREATE TABLE IF NOT EXISTS tasks (id SERIAL PRIMARY KEY, description VARCHAR(255) NOT NULL, remind_at TIMESTAMP NOT NULL, is_completed BOOLEAN DEFAULT FALSE)`).catch(console.error);
db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS photo_proof TEXT').catch(console.error);
// ==========================================
// 🔔 НАСТРОЙКА PUSH-УВЕДОМЛЕНИЙ
// ==========================================
webPush.setVapidDetails(
    'mailto:vsystem-admin@example.com', 
    process.env.VAPID_PUBLIC_KEY, 
    process.env.VAPID_PRIVATE_KEY
);

// Универсальная функция рассылки пушей
async function sendPushNotification(title, body) {
    try {
        const subs = await db.query('SELECT subscription FROM push_subscriptions');
        subs.rows.forEach(s => {
            const payload = JSON.stringify({ title, body, url: '/' });
            webPush.sendNotification(s.subscription, payload)
                .catch(err => {
                    if (err.statusCode === 410) {
                        db.query('DELETE FROM push_subscriptions WHERE subscription = $1', [s.subscription]);
                    }
                });
        });
    } catch (error) {
        console.error('Ошибка при рассылке пушей:', error);
    }
}

app.post('/api/push/subscribe', async (req, res) => {
    try {
        const subscription = req.body;
        await db.query('INSERT INTO push_subscriptions (subscription) VALUES ($1)', [subscription]);
        res.status(201).json({ success: true });
    } catch (err) {
        console.error('Ошибка сохранения подписки:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});


// --- МАРШРУТЫ API ---

app.get('/api/orders', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM orders ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.post('/api/trigger-update', (req, res) => {
    io.emit('update_data');
    res.json({ success: true });
});

app.post('/api/orders', async (req, res) => {
    try {
        const { pickup_address, delivery_address, deadline, client_name, client_phone, cargo_details, price } = req.body;
        const numericPrice = parseInt(price) || 0;
        const safeDeadline = deadline ? new Date(deadline).toISOString() : new Date().toISOString(); 
        
        const query = `INSERT INTO orders (pickup_address, delivery_address, deadline, client_name, client_phone, cargo_details, price) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;`;
        const newOrder = await db.query(query, [pickup_address, delivery_address, safeDeadline, client_name, client_phone || "Не указан", cargo_details || "Обычная", numericPrice]);
        
        sendOrderNotification({ id: newOrder.rows[0].id, pickup: pickup_address, delivery: delivery_address, price: numericPrice });
        
        io.emit('update_data'); 
        
        // 🔔 ИСПРАВЛЕНИЕ: Вызов пуша теперь ВНУТРИ функции создания заказа!
        await sendPushNotification('🚀 Новый заказ!', `Нужно забрать: ${pickup_address}`);
        
        res.status(201).json(newOrder.rows[0]);
    } catch (err) { 
        console.error(err); // Добавил вывод ошибки в консоль, чтобы было легче искать баги
        res.status(500).json({ error: 'Ошибка при создании заказа' }); 
    }
});

app.put('/api/orders/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, photo } = req.body; // Теперь мы ждем еще и фото
        
        let query;
        let params;

        if (status === 'completed') {
            // Если заказ завершен, сохраняем время и фото
            query = `UPDATE orders SET status = $1, completed_at = CURRENT_TIMESTAMP, photo_proof = $3 WHERE id = $2 RETURNING *;`;
            params = [status, id, photo || null];
        } else {
            // Если просто взяли в работу
            query = `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *;`;
            params = [status, id];
        }

        const result = await db.query(query, params);
        io.emit('update_data');
        res.json(result.rows[0]);
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: 'Ошибка при обновлении статуса' }); 
    }
});
// --- БУХГАЛТЕРИЯ ---
app.get('/api/expenses', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM expenses ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.post('/api/expenses', async (req, res) => {
    try {
        const result = await db.query('INSERT INTO expenses (description, amount) VALUES ($1, $2) RETURNING *', [req.body.description, parseInt(req.body.amount) || 0]);
        io.emit('update_data');
        res.status(201).json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// --- ПЛАН ДНЯ ---
app.get('/api/tasks', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM tasks ORDER BY remind_at ASC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.post('/api/tasks', async (req, res) => {
    try {
        const result = await db.query('INSERT INTO tasks (description, remind_at) VALUES ($1, $2) RETURNING *', [req.body.description, req.body.remind_at]);
        io.emit('update_data');
        res.status(201).json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.put('/api/tasks/:id/complete', async (req, res) => {
    try {
        await db.query('UPDATE tasks SET is_completed = TRUE WHERE id = $1', [req.params.id]);
        io.emit('update_data');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// Эндпоинт для отслеживания заказа клиентом
app.get('/api/track/:id', async (req, res) => {
    try {
        const orderId = req.params.id;
        const result = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Заказ не найден' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка базы данных: ' + error.message });
    }
});

// ==========================================
// ЗАПУСК СЕРВЕРА И ШПИОНА 🚀
// ==========================================
server.listen(PORT, async () => {
    console.log(`🌐 Сервер работает на порту ${PORT}`);
    
    try {
        const client = new TelegramClient(new StringSession(process.env.SESSION_STRING || ""), parseInt(process.env.API_ID), process.env.API_HASH, { connectionRetries: 5 });
        await client.connect();
        console.log('✅ Юзербот успешно подключен!');
        startParser(client, io); 
    } catch (err) { console.error('❌ Ошибка подключения Юзербота:', err.message); }
});