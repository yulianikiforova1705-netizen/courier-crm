const { NewMessage } = require('telegram/events');
const pool = require('./db');
const { sendOrderNotification } = require('./bot');

// Добавили io в аргументы
async function startParser(client, io, sendPushNotification) {
    client.addEventHandler(async (event) => {
        const message = event.message;
        if (message && message.text) {
            // БРОНЯ ОТ БЕСКОНЕЧНОЙ ПЕТЛИ 🛡️ (Обновленная)
            if (message.text.includes('НОВЫЙ ЗАКАЗ') || 
                message.text.includes('Взять в работу') || 
                message.text.includes('Отметить как доставленный') || // 👈 Добавили защиту для новой кнопки
                message.text.includes('Заказ завершен') ||            // 👈 Добавили защиту для финальной кнопки
                message.text.includes('Сумма: 0 ₽')) {
                return; // Сразу блокируем и выходим!
            }

            const text = message.text.replace(/\n/g, ' ');
        
            
            const matchPickup = text.match(/откуда[:\s]+(.*?)(?=\.|цена|(?<!от)куда|$)/i);
            const matchDelivery = text.match(/(?<!от)куда[:\s]+(.*?)(?=\.|цена|откуда|$)/i);
            const matchPrice = text.match(/цена[:\s]+(\d+)/i);

            if (!matchPickup && !matchDelivery) return;

            const pickup = matchPickup ? matchPickup[1].trim() : "Уточнить адрес";
            const delivery = matchDelivery ? matchDelivery[1].trim() : "Уточнить адрес";
            const price = matchPrice ? parseInt(matchPrice[1]) : 0;
            
            try {
                // ВАЖНО: здесь должно быть const result = 
                const result = await pool.query(
                    `INSERT INTO orders (pickup_address, delivery_address, client_name, client_phone, deadline, price, status) 
                    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6) RETURNING id`,
                    [pickup, delivery, "Telegram Чат", "Не указан", price, 'new']
                );
                
                console.log(`✅ Заказ в базе! Откуда: ${pickup} | Куда: ${delivery} | Цена: ${price}₽`);
                
                // Передаем ID из созданной переменной result
                sendOrderNotification({ id: result.rows[0].id, pickup, delivery, price });

                if (io) {
                    io.emit('update_data');
                    io.emit('new_order_alert', pickup); // 👈 ВОТ ОНА, МАГИЯ! Сигнал для красивого уведомления
                }
                
                // 👇 ВЫЗЫВАЕМ СИСТЕМНЫЙ PUSH ДЛЯ АЙФОНА!
                if (sendPushNotification) {
                    try {
                        await sendPushNotification('🚀 Новый заказ!', `Нужно забрать: ${pickup}`);
                    } catch(e) {
                        console.error('Ошибка отправки пуша из парсера:', e);
                    }
                }
                try {
                    await fetch('https://courier-crm-api.onrender.com/api/trigger-update', { method: 'POST' });
                } catch(e) {}

            } catch (err) {
                console.error('❌ Ошибка базы:', err);
            }
        }
    }, new NewMessage({}));
}

module.exports = { startParser };