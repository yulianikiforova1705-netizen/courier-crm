const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db'); // Подключаем базу данных

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
        // Вытаскиваем данные из тела запроса
        const {
            pickup_address, delivery_address, deadline,
            client_name, client_phone, cargo_details
        } = req.body;

        // SQL-запрос на добавление строки
        const query = `
            INSERT INTO orders (pickup_address, delivery_address, deadline, client_name, client_phone, cargo_details)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `;
        const values = [pickup_address, delivery_address, deadline, client_name, client_phone, cargo_details];

        const newOrder = await db.query(query, values);
        
        // Возвращаем созданный заказ обратно как подтверждение
        res.status(201).json(newOrder.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при создании заказа' });
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер работает на порту ${PORT}`);
});