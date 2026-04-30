const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db'); 
const { startParser } = require('./parser');
const { sendOrderNotification } = require('./bot'); 
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');

// === ДОБАВЛЯЕМ МАГИЮ WEBSOCKETS ===
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 3000;

// Создаем сервер, который умеет работать и с обычными запросами, и с сокетами
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// --- НАСТРОЙКА БАЗЫ ДАННЫХ ---
db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS price integer DEFAULT 0').catch(console.error);
db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT CURRENT_TIMESTAMP').catch(console.error);
db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at timestamp').catch(console.error);
db.query(`CREATE TABLE IF NOT EXISTS expenses (id SERIAL PRIMARY KEY, description VARCHAR(255) NOT NULL, amount INTEGER NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`).catch(console.error);
db.query(`CREATE TABLE IF NOT EXISTS tasks (id SERIAL PRIMARY KEY, description VARCHAR(255) NOT NULL, remind_at TIMESTAMP NOT NULL, is_completed BOOLEAN DEFAULT FALSE)`).catch(console.error);

// --- МАРШРУТЫ API ---

app.get('/api/orders', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM orders ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.post('/api/orders', async (req, res) => {
    try {
        const { pickup_address, delivery_address, deadline, client_name, client_phone, cargo_details, price } = req.body;
        const numericPrice = parseInt(price) || 0;
        const safeDeadline = deadline ? new Date(deadline).toISOString() : new Date().toISOString(); 
        
        const query = `INSERT INTO orders (pickup_address, delivery_address, deadline, client_name, client_phone, cargo_details, price) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;`;
        const newOrder = await db.query(query, [pickup_address, delivery_address, safeDeadline, client_name, client_phone || "Не указан", cargo_details || "Обычная", numericPrice]);
        
        sendOrderNotification({ pickup: pickup_address, delivery: delivery_address, price: numericPrice });
        
        io.emit('update_data'); // 📢 КРИЧИМ ВСЕМ: ДАННЫЕ ОБНОВИЛИСЬ!
        res.status(201).json(newOrder.rows[0]);
    } catch (err) { res.status(500).json({ error: 'Ошибка при создании заказа' }); }
});

app.put('/api/orders/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const query = status === 'completed' 
            ? `UPDATE orders SET status = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *;`
            : `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *;`;

        const result = await db.query(query, [status, id]);
        
        io.emit('update_data'); // 📢 КРИЧИМ ВСЕМ: ДАННЫЕ ОБНОВИЛИСЬ!
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: 'Ошибка при обновлении статуса' }); }
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
        io.emit('update_data'); // 📢 КРИЧИМ ВСЕМ: ДАННЫЕ ОБНОВИЛИСЬ!
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
        io.emit('update_data'); // 📢 КРИЧИМ ВСЕМ: ДАННЫЕ ОБНОВИЛИСЬ!
        res.status(201).json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.put('/api/tasks/:id/complete', async (req, res) => {
    try {
        await db.query('UPDATE tasks SET is_completed = TRUE WHERE id = $1', [req.params.id]);
        io.emit('update_data'); // 📢 КРИЧИМ ВСЕМ: ДАННЫЕ ОБНОВИЛИСЬ!
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// ==========================================
// ЗАПУСК СЕРВЕРА И ШПИОНА 🚀
// ==========================================
// Обрати внимание: теперь мы запускаем server.listen вместо app.listen
server.listen(PORT, async () => {
    console.log(`🌐 Сервер работает на порту ${PORT}`);
    
    try {
        const client = new TelegramClient(new StringSession(process.env.SESSION_STRING || ""), parseInt(process.env.API_ID), process.env.API_HASH, { connectionRetries: 5 });
        await client.connect();
        console.log('✅ Юзербот успешно подключен и готов перехватывать заказы!');
        
        // ПЕРЕДАЕМ НАШ io (громкоговоритель) В ПАРСЕР
        startParser(client, io); 
        
    } catch (err) { console.error('❌ Ошибка подключения Юзербота:', err.message); }
});