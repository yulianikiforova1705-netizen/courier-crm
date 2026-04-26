const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Обязательное условие для облачных баз
    }
});

pool.connect((err, client, release) => {
    if (err) {
        return console.error('Ошибка подключения к облачной базе:', err.stack);
    }
    console.log('✅ Успешное подключение к облачному PostgreSQL!');
    release();
});

module.exports = pool;