const API_BASE_URL = window.SMART_ALARM_API_URL || "http://127.0.0.1:8000";

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

function getErrorMessage(data, status) {
    if (typeof data?.detail === "string" && data.detail.trim()) {
        return data.detail;
    }

    if (Array.isArray(data?.detail)) {
        const messages = data.detail
            .map((item) => item?.msg)
            .filter(Boolean);

        if (messages.length > 0) {
            return messages.join(" ");
        }
    }

    return `Ошибка сервера (${status})`;
}

export async function apiRequest(path, options = {}) {
    const {
        method = "GET",
        body,
        auth = false
    } = options;

    const headers = {
        "Accept": "application/json"
    };

    if (body !== undefined) {
        headers["Content-Type"] = "application/json";
    }

    if (auth) {
        const token = getToken();

        if (!token) {
            const error = new Error("Необходимо авторизоваться");
            error.status = 401;
            throw error;
        }

        headers["Authorization"] = `Bearer ${token}`;
    }

    let response;

    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined
        });
    } catch (cause) {
        const error = new Error(
            "Не удалось подключиться к серверу. Проверьте, что backend запущен."
        );

        error.status = 0;
        error.cause = cause;
        throw error;
    }

    if (response.status === 204) {
        return null;
    }

    let data = null;

    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        const error = new Error(getErrorMessage(data, response.status));
        error.status = response.status;
        error.detail = data?.detail;
        throw error;
    }

    return data;
}

export const alarmsApi = {
    getAll() {
        return apiRequest("/alarms", {
            auth: true
        });
    },

    getById(id) {
        return apiRequest(`/alarms/${encodeURIComponent(id)}`, {
            auth: true
        });
    },

    create(alarm) {
        return apiRequest("/alarms", {
            method: "POST",
            auth: true,
            body: alarm
        });
    },

    update(id, alarm) {
        return apiRequest(`/alarms/${encodeURIComponent(id)}`, {
            method: "PUT",
            auth: true,
            body: alarm
        });
    },

    toggle(id) {
        return apiRequest(`/alarms/${encodeURIComponent(id)}/toggle`, {
            method: "PATCH",
            auth: true
        });
    },

    remove(id) {
        return apiRequest(`/alarms/${encodeURIComponent(id)}`, {
            method: "DELETE",
            auth: true
        });
    }
};
