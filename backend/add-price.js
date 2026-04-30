const pool = require('./db');

pool.query('ALTER TABLE orders ADD COLUMN price INTEGER DEFAULT 0;')
    .then(() => {
        console.log('✅ Колонка price успешно добавлена!');
        process.exit();
    })
    .catch((err) => {
        console.error('❌ Ошибка:', err);
        process.exit(1);
    });