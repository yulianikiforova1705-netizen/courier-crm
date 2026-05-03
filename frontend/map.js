// frontend/map.js

import { apiCall } from './api.js';
import { showNotification } from './ui.js';

// === КАРТА ЯНДЕКСА ===
let myMap;

export async function showMap() {
    document.getElementById('map-box').style.display = 'block';

    if (myMap) {
        myMap.destroy();
    }

    // @ts-ignore (чтобы редактор не ругался на ymaps)
    ymaps.ready(async function () {
        // @ts-ignore
        myMap = new ymaps.Map("map", {
            center: [55.751574, 37.573856], // По умолчанию центр Москвы
            zoom: 10
        });

        const allOrders = await apiCall('/api/orders'); 
        if (!allOrders) return;
        const activeOrders = allOrders.filter(o => o.status === 'new' || o.status === 'in_progress');

        if (activeOrders.length === 0) {
            alert('Нет активных заказов для отображения!');
            return;
        }

        for (const order of activeOrders) {
            try {
                // Ищем координаты Точки А
                // @ts-ignore
                const pickupRes = await ymaps.geocode(order.pickup_address);
                const pickupGeo = pickupRes.geoObjects.get(0);
                
                if (pickupGeo) {
                    const pickupCoords = pickupGeo.geometry.getCoordinates();
                    // @ts-ignore
                    const pickupPlacemark = new ymaps.Placemark(pickupCoords, {
                        balloonContent: `<b>Заказ #${order.id}</b><br>📦 Забрать: ${order.pickup_address}`
                    }, { preset: 'islands#redDotIcon' });
                    myMap.geoObjects.add(pickupPlacemark);
                }

                // Ищем координаты Точки Б
                // @ts-ignore
                const deliveryRes = await ymaps.geocode(order.delivery_address);
                const deliveryGeo = deliveryRes.geoObjects.get(0);
                
                if (deliveryGeo) {
                    const deliveryCoords = deliveryGeo.geometry.getCoordinates();
                    // @ts-ignore
                    const deliveryPlacemark = new ymaps.Placemark(deliveryCoords, {
                        balloonContent: `<b>Заказ #${order.id}</b><br>🚩 Доставить: ${order.delivery_address}`
                    }, { preset: 'islands#greenDotIcon' });
                    myMap.geoObjects.add(deliveryPlacemark);
                }
            } catch (err) {
                console.error(`Ошибка при поиске координат для заказа #${order.id}`, err);
            }
        }

        myMap.setBounds(myMap.geoObjects.getBounds(), { checkZoomRange: true, zoomMargin: 20 });
    });
}

export function closeMap() {
    document.getElementById('map-box').style.display = 'none';
}

// === УМНАЯ МАРШРУТИЗАЦИЯ (TSP Lite) ===
export async function buildSmartRoute() {
    const orders = await apiCall('/api/orders');
    if (!orders) return;

    const activeOrders = orders.filter(o => o.status !== 'completed');
    
    if (activeOrders.length === 0) {
        return showNotification("Нет активных заказов для построения маршрута!");
    }

    let points = [];
    
    activeOrders.forEach(o => {
        if (o.status === 'new') {
            points.push(o.pickup_address);
            points.push(o.delivery_address);
        } else if (o.status === 'in_progress') {
            points.push(o.delivery_address);
        }
    });

    if (points.length === 0) {
        return showNotification("Не удалось найти адреса для маршрута!");
    }

    const routeQuery = points.map(p => encodeURIComponent(p)).join('~');
    window.open(`https://yandex.ru/maps/?rtext=${routeQuery}`, '_blank');
    
    showNotification("🗺️ Маршрут построен в новой вкладке!");
}