const API_BASE_URL = window.SMART_ALARM_API_URL || "http://127.0.0.1:8000";

export class ApiError extends Error {
    constructor(message, { status = 0, detail = "", cause = null } = {}) {
        super(message);

        this.name = "ApiError";
        this.status = status;
        this.detail = detail;

        if (cause) {
            this.cause = cause;
        }
    }
}

function extractDetail(data, status) {
    if (typeof data?.detail === "string" && data.detail.trim()) {
        return data.detail;
    }

    if (Array.isArray(data?.detail)) {
        const messages = data.detail
            .map(item => item?.msg)
            .filter(Boolean);

        if (messages.length) {
            return messages.join(" ");
        }
    }

    return `Ошибка сервера: ${status}`;
}

async function request(path, options = {}) {
    const { method = "GET", token, body } = options;

    const headers = {
        "Accept": "application/json"
    };

    if (body !== undefined) {
        headers["Content-Type"] = "application/json";
    }

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    let response;

    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body)
        });
    } catch (error) {
        throw new ApiError("Не удалось подключиться к серверу", {
            cause: error
        });
    }

    if (response.status === 204) {
        return null;
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        const detail = extractDetail(data, response.status);

        throw new ApiError(detail, {
            status: response.status,
            detail
        });
    }

    return data;
}

function alarmPath(alarmId) {
    return encodeURIComponent(alarmId);
}

export const tasksApi = {
    // Данные будильника нужны, чтобы выбрать тип задания и показать время сигнала
    getAlarm(alarmId, token) {
        return request(`/alarms/${alarmPath(alarmId)}`, { token });
    },

    getMathTask(alarmId, token) {
        return request(`/tasks/math?alarm_id=${alarmPath(alarmId)}`, { token });
    },

    checkMathAnswer(answer, token) {
        return request("/tasks/math/check", {
            method: "POST",
            token,
            body: answer
        });
    },

    getPhraseTask(alarmId, token) {
        return request(`/tasks/phrase?alarm_id=${alarmPath(alarmId)}`, { token });
    },

    checkPhraseAnswer(answer, token) {
        return request("/tasks/phrase/check", {
            method: "POST",
            token,
            body: answer
        });
    }
};
