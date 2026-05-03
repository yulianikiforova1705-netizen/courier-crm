// Вспомогательная функция для ключа
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Экспортируем функцию наружу, передавая API_URL как параметр
export async function initPushNotifications(apiUrl) {
    if (!('serviceWorker' in navigator)) return;

    const registration = await navigator.serviceWorker.ready;
    
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const publicKey = 'BHGbbImDIc6tpKcd9u36Qt7FzhZ7Qm-17ktmxAi1Y-PcSinodWiRliHVwXP8syM0CXl28bl1AyPPNgDxDfih-CE';
    
    try {
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey)
        });

        await fetch(`${apiUrl}/api/push/subscribe`, {
            method: 'POST',
            body: JSON.stringify(subscription),
            headers: { 'Content-Type': 'application/json' }
        });
        console.log('🔔 Push-уведомления активированы!');
    } catch (err) {
        console.error('Ошибка подписки на Push:', err);
    }
}