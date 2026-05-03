// frontend/api.js

export const API_URL = 'https://courier-crm-api.onrender.com';
// Универсальная функция для общения с сервером (чтобы не писать fetch 100 раз)
export async function apiCall(endpoint, method = 'GET', body = null) {
    try {
        const options = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) options.body = JSON.stringify(body);
        const res = await fetch(`${API_URL}${endpoint}`, options);
        return await res.json();
    } catch (err) {
        console.error(`Ошибка запроса к ${endpoint}:`, err);
        return null;
    }
}