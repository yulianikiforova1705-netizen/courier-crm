const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Включаем polling, чтобы бот умел "слушать" нажатия на кнопки
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const CHAT_ID = process.env.CHAT_ID;

function sendOrderNotification(order) {
    const text = `🚨 <b>НОВЫЙ ЗАКАЗ #${order.id}</b>\n\n📍 Откуда: ${order.pickup}\n🏁 Куда: ${order.delivery}\n💰 Сумма: ${order.price} ₽`;

    // Создаем интерактивную кнопку (в callback_data прячем ID заказа)
    const options = {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: '🟡 Взять в работу', callback_data: `take_${order.id}` }]
            ]
        }
    };

    bot.sendMessage(CHAT_ID, text, options).catch(console.error);
}

// Слушаем нажатия на наши кнопки прямо в чате
bot.on('callback_query', async (query) => {
    const data = query.data;
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    // Если нажали кнопку "Взять в работу"
    if (data.startsWith('take_')) {
        const orderId = data.split('_')[1]; // Вытаскиваем ID заказа из кнопки

        try {
            // МАГИЯ: Бот сам дергает наш API-сервер и меняет статус в базе!
            await fetch(`https://courier-crm-api.onrender.com/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'in_progress' })
            });

            // Меняем кнопку на зеленое "В работе", чтобы не нажать дважды
            bot.editMessageReplyMarkup({
                inline_keyboard: [[{ text: '✅ В работе', callback_data: 'ignore' }]]
            }, { chat_id: chatId, message_id: messageId });

            // Показываем всплывашку в самом Telegram
            bot.answerCallbackQuery(query.id, { text: 'Заказ успешно взят в работу!' });

        } catch (err) {
            console.error('Ошибка при нажатии кнопки:', err);
            bot.answerCallbackQuery(query.id, { text: 'Произошла ошибка =(' });
        }
    } else {
        bot.answerCallbackQuery(query.id); // Игнорируем другие кнопки
    }
});

module.exports = { sendOrderNotification };