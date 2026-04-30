const { NewMessage } = require('telegram/events');
const pool = require('./db');
const { sendOrderNotification } = require('./bot');

// Добавили io в аргументы
async function startParser(client, io) {
    client.addEventHandler(async (event) => {
        const message = event.message;
        
        if (message && message.text) {
            if (message.text.includes('У ВАС НОВЫЙ ЗАКАЗ')) return;

            const text = message.text.replace(/\n/g, ' ');
            
            const matchPickup = text.match(/откуда[:\s]+(.*?)(?=\.|цена|(?<!от)куда|$)/i);
            const matchDelivery = text.match(/(?<!от)куда[:\s]+(.*?)(?=\.|цена|откуда|$)/i);
            const matchPrice = text.match(/цена[:\s]+(\d+)/i);

            if (!matchPickup && !matchDelivery) return;

            const pickup = matchPickup ? matchPickup[1].trim() : "Уточнить адрес";
            const delivery = matchDelivery ? matchDelivery[1].trim() : "Уточнить адрес";
            const price = matchPrice ? parseInt(matchPrice[1]) : 0;

            try {
                await pool.query(
                    `INSERT INTO orders (pickup_address, delivery_address, client_name, client_phone, deadline, price, status) 
                    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6)`,
                    [pickup, delivery, "Telegram Чат", "Не указан", price, 'new']
                );
                
                console.log(`✅ Заказ в базе! Откуда: ${pickup} | Куда: ${delivery} | Цена: ${price}₽`);
                
                sendOrderNotification({ pickup, delivery, price });

                // 📢 МАГИЯ: Заказ сохранен, кричим Фронтенду обновиться!
                if (io) {
                    io.emit('update_data');
                }

            } catch (err) {
                console.error('❌ Ошибка базы:', err);
            }
        }
    }, new NewMessage({}));
}

module.exports = { startParser };