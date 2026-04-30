const Slimbot = require('slimbot');
require('dotenv').config();

const slimbot = new Slimbot(process.env.BOT_TOKEN);

function sendOrderNotification(order) {
    const message = `
🔔 *У ВАС НОВЫЙ ЗАКАЗ!*
📍 *Откуда:* ${order.pickup}
🏁 *Куда:* ${order.delivery}
💰 *Сумма:* ${order.price} ₽
    `;
    
    slimbot.sendMessage(process.env.MY_CHAT_ID, message, { parse_mode: 'Markdown' });
}

// Здесь теперь точно стоит равно!
module.exports = { sendOrderNotification };