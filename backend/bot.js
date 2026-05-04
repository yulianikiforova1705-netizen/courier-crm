const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Включаем polling, чтобы бот умел "слушать" нажатия на кнопки
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

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

    // 1️⃣ Если нажали кнопку "Взять в работу"
    if (data.startsWith('take_')) {
        const orderId = data.split('_')[1]; // Вытаскиваем ID заказа из кнопки

        try {
            // Бот сам дергает наш API-сервер и меняет статус на in_progress
            await fetch(`https://courier-crm-api.onrender.com/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'in_progress' })
            });

            // МЕНЯЕМ КНОПКУ НА ПОНЯТНУЮ ДЛЯ КУРЬЕРА
            bot.editMessageReplyMarkup({
                inline_keyboard: [[{ text: '📦 Отметить как доставленный', callback_data: `deliver_${orderId}` }]]
            }, { chat_id: chatId, message_id: messageId });

            // Показываем всплывашку в самом Telegram
            bot.answerCallbackQuery(query.id, { text: 'Заказ у тебя! Удачной дороги 🏃‍♂️' });

        } catch (err) {
            console.error('Ошибка при нажатии кнопки взять в работу:', err);
            bot.answerCallbackQuery(query.id, { text: 'Произошла ошибка =(' });
        }
    } 
    // 2️⃣ Если нажали кнопку завершения доставки
    else if (data.startsWith('deliver_')) {
        const orderId = data.split('_')[1];

        try {
            // Дергаем API-сервер и меняем статус на completed (завершено)
            await fetch(`https://courier-crm-api.onrender.com/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'completed' }) // Заказ улетит в архив!
            });

            // Меняем кнопку на финальную некликабельную "🏁 Заказ завершен"
            bot.editMessageReplyMarkup({
                inline_keyboard: [[{ text: '🏁 Заказ завершен', callback_data: 'ignore' }]]
            }, { chat_id: chatId, message_id: messageId });

            // Радостная всплывашка
            bot.answerCallbackQuery(query.id, { text: 'Супер! Заказ доставлен 🎉' });

        } catch (err) {
            console.error('Ошибка при завершении заказа:', err);
            bot.answerCallbackQuery(query.id, { text: 'Произошла ошибка =(' });
        }
    } 
    // Игнорируем другие кнопки (например 'ignore')
    else {
        bot.answerCallbackQuery(query.id); 
    }
});

module.exports = { sendOrderNotification };