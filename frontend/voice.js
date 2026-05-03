// frontend/voice.js

import { showNotification } from './ui.js';

// ==========================================
// 🎙️ ГОЛОСОВОЙ ВВОД ЗАКАЗОВ
// ==========================================
export function startVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Браузер не поддерживает голос. Нужен Chrome!");

    const recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.interimResults = false;

    recognition.onstart = () => {
        showNotification("🎙️ Говорите... (например: 'Забрать из центра, доставить в парк, клиент Иван, 500 рублей')");
    };

    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        showNotification(`Распознано: "${text}"`);
        parseVoiceCommand(text);
    };

    recognition.onerror = (event) => {
        showNotification("❌ Ошибка микрофона: " + event.error);
    };

    recognition.start();
}

export function parseVoiceCommand(text) {
    const textLower = text.toLowerCase();
    
    // Ищем ключевые слова в фразе
    const pickupMatch = textLower.match(/(?:забрать|откуда|из)\s+(.+?)(?=\s+доставить|\s+куда|\s+на|\s+клиент|\s+цена|\s+за|$)/i);
    const deliveryMatch = textLower.match(/(?:доставить|куда|на)\s+(.+?)(?=\s+забрать|\s+клиент|\s+цена|\s+за|$)/i);
    const clientMatch = textLower.match(/(?:клиент|от)\s+(.+?)(?=\s+забрать|\s+доставить|\s+цена|\s+за|$)/i);
    const priceMatch = textLower.match(/(?:цена|за|стоимость)\s+(\d+)/i);

    if (pickupMatch) document.getElementById('pickup').value = pickupMatch[1].trim();
    if (deliveryMatch) document.getElementById('delivery').value = deliveryMatch[1].trim();
    if (clientMatch) document.getElementById('client').value = clientMatch[1].trim();
    if (priceMatch) document.getElementById('price').value = priceMatch[1].trim();
    
    // Если фраза нестандартная, просто вставляем весь текст в первое поле
    if (!pickupMatch && !deliveryMatch && !clientMatch && !priceMatch) {
        document.getElementById('pickup').value = text;
    }
}