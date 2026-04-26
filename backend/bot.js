const { Telegraf } = require('telegraf');
require('dotenv').config();
const db = require('./db');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Обработка команды /start
bot.start((ctx) => {
    ctx.reply('Привет! Я бот курьерской системы. Скоро здесь будут появляться новые заказы для доставки.');
});

// Временная команда, чтобы узнать свой ID
bot.command('myid', (ctx) => {
    ctx.reply(`Твой Chat ID: ${ctx.chat.id}`);
});
// Обработка нажатий на кнопки изменения статуса
bot.action(/status_(.+)_(\d+)/, async (ctx) => {
    const newStatus = ctx.match[1]; // Получаем статус (in_progress или completed)
    const orderId = ctx.match[2];   // Получаем ID заказа

    try {
        // Обновляем статус в базе данных
        await db.query('UPDATE orders SET status = $1 WHERE id = $2', [newStatus, orderId]);
        
        // Всплывающее уведомление в самом Telegram
        await ctx.answerCbQuery('Статус успешно обновлен!');
        
        // Отправляем сообщение в чат для подтверждения
        const statusText = newStatus === 'in_progress' ? 'в работе 🟡' : 'доставлен 🟢';
        await ctx.reply(`✅ Заказ #${orderId} теперь ${statusText}`);
    } catch (err) {
        console.error('Ошибка при обновлении из Telegram:', err);
        await ctx.answerCbQuery('Ошибка при обновлении статуса', { show_alert: true });
    }
});
// Запуск бота
bot.launch().then(() => {
    console.log('🤖 Telegram-бот успешно запущен!');
});

// Безопасная остановка бота при выключении сервера
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = bot;