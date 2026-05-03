const db = require('./db');

const createTableQuery = `
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    status VARCHAR(50) NOT NULL DEFAULT 'new',
    courier_id INTEGER,
    
    pickup_address TEXT NOT NULL,
    pickup_lat DECIMAL(9,6),
    pickup_lon DECIMAL(9,6),
    delivery_address TEXT NOT NULL,
    delivery_lat DECIMAL(9,6),
    delivery_lon DECIMAL(9,6),
    
    deadline TIMESTAMP NOT NULL,
    
    client_name VARCHAR(100) NOT NULL,
    client_phone VARCHAR(20) NOT NULL,
    comment TEXT,
    cargo_details TEXT,
    
    is_paid BOOLEAN DEFAULT FALSE,
    payment_method VARCHAR(20),
    cancel_reason TEXT,
    photo_proof_url TEXT,
    signature_url TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

db.query(createTableQuery)
    .then(() => {
        console.log('✅ Таблица orders успешно создана!');
        process.exit();
    })
    .catch((err) => {
        console.error('❌ Ошибка при создании таблицы:', err);
        process.exit(1);
    });
    // Создаем таблицу для Push-уведомлений
db.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        subscription JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`)
.then(() => {
    console.log('✅ Таблица push_subscriptions успешно создана!');
    process.exit(0); // Теперь можно выходить
})
.catch(err => {
    console.error('❌ Ошибка при создании таблицы push_subscriptions:', err);
    process.exit(1);
});