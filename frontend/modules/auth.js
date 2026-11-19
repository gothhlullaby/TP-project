
import {
    apiRequest,
    getToken,
    saveToken,
    clearToken
} from "./api.js";

export async function register(email, password) {
    return await apiRequest("/auth/register", {
        method: "POST",
        body: {
            email: email.trim(),
            password
        }
    });
}

export async function login(email, password) {
    const data = await apiRequest("/auth/login", {
        method: "POST",
        body: {
            email: email.trim(),
            password
        }
    });

    saveToken(data.access_token);

    try {
        const user = await getCurrentUser();

        return user;
    } catch (error) {
        clearToken();
        throw error;
    }
}

export async function getCurrentUser() {
    return await apiRequest("/auth/me", {
        auth: true
    });
}

export async function checkSession() {
    if (!getToken()) {
        return null;
    }

    try {
        return await getCurrentUser();
    } catch (error) {
        if (error.status === 401) {
            clearToken();
            return null;
        }

        throw error;
    }
}

export function logout() {
    clearToken();
}
