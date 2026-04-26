const { exec } = require('child_process');
const path = require('path');
require('dotenv').config();

const date = new Date().toISOString().replace(/[:.]/g, '-');
const fileName = `backup-${date}.sql`;
const backupPath = path.join(__dirname, 'backups', fileName);

// Команда для Neon (используем DATABASE_URL напрямую)
const cmd = `pg_dump "${process.env.DATABASE_URL}" > "${backupPath}"`;

console.log(`🚀 Начинаем бэкап в файл: ${fileName}...`);

exec(cmd, (error) => {
    if (error) {
        console.error(`❌ Ошибка: ${error.message}`);
        return;
    }
    console.log(`✅ Успех! Файл сохранен в папке backups`);
});