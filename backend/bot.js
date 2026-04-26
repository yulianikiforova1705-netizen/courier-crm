const { Telegraf } = require('telegraf');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// Обработка команды /start
bot.start((ctx) => {
    ctx.reply('Привет! Я бот курьерской системы. Скоро здесь будут появляться новые заказы для доставки.');
});

// Запуск бота
bot.launch().then(() => {
    console.log('🤖 Telegram-бот успешно запущен!');
});

// Безопасная остановка бота при выключении сервера
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = bot;