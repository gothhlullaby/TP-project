
const API_BASE_URL = "http://127.0.0.1:8000";

const TOKEN_KEY = "smart_alarm_access_token";

export function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
}

export function saveToken(token) {
    sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
}

export async function apiRequest(path, options = {}) {
    const {
        method = "GET",
        body,
        auth = false
    } = options;

    const headers = {};

    if (body !== undefined) {
        headers["Content-Type"] = "application/json";
    }

    if (auth) {
        const token = getToken();

        if (!token) {
            throw new Error("Необходимо авторизоваться");
        }

        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined
    });

    let data = null;

    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        const message =
            typeof data?.detail === "string"
                ? data.detail
                : `Ошибка сервера (${response.status})`;

        const error = new Error(message);
        error.status = response.status;

        throw error;
    }

    return data;
}
