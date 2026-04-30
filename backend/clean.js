const db = require('./db');

async function cleanDatabase() {
    try {
        console.log('🧹 Начинаем генеральную уборку базы данных...');
        
        // Команда TRUNCATE полностью очищает таблицу, 
        // а RESTART IDENTITY сбрасывает нумерацию ID обратно на 1
        await db.query('TRUNCATE TABLE orders RESTART IDENTITY CASCADE');
        
        console.log('✨ Готово! Все безумные и тестовые заказы уничтожены.');
        console.log('🚀 Твоя CRM чиста, следующий заказ будет под номером #1!');
        
    } catch (err) {
        console.error('❌ Ошибка при уборке:', err);
    } finally {
        process.exit(); // Выключаем скрипт после завершения
    }
}

cleanDatabase();