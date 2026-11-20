
import {
    register,
    login,
    checkSession,
    logout
} from "./modules/auth.js";

import { alarmsApi } from "./modules/api.js";

import {
    createDefaultAlarm,
    readAlarmForm,
    renderAlarmForm
} from "./modules/alarm-form.js";

/* APP STATE */

const app = document.getElementById("app");

const state = {
    screen: "login",
    user: null,
    alarms: [],
    authMode: "login",
    authLoading: false,
    alarmsLoading: false,
    alarmsError: "",
    authMessage: "",
    authMessageType: "error",
    onboardingStep: 0,
    notificationPermission:
        "Notification" in window
            ? Notification.permission
            : "unsupported",
    editingId: null,
    draft: null,
    formError: "",
    fieldErrors: {},
    saving: false,
    busyId: null,
    deleteTarget: null,
    actionMessage: ""
};

const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const ONBOARDING_KEY = "smart_alarm_onboarding";

/* HELPERS */

// защищаем HTML от вставки пользовательских данных как разметки
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entities[char];
    });
}

function getOnboardingKey() {
    return `${ONBOARDING_KEY}_${state.user?.id ?? "guest"}`;
}

function isOnboardingCompleted() {
    if (!state.user) return false;

    return localStorage.getItem(getOnboardingKey()) === "true";
}

function completeOnboarding() {
    localStorage.setItem(getOnboardingKey(), "true");
}

function showMessage(message, type = "error") {
    state.authMessage = message;
    state.authMessageType = type;
}

function formatDays(days) {
    if (!Array.isArray(days) || days.length === 0) {
        return "Однократно";
    }

    return days
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
        .sort((a, b) => a - b)
        .map((day) => DAYS[day])
        .join(", ");
}

function getDayChips(days) {
    const activeDays = Array.isArray(days) ? days : [];

    return DAYS.map((day, index) => `
        <span class="day-chip ${activeDays.includes(index) ? "active" : ""}">
            ${day}
        </span>
    `).join("");
}

/* AUTH SCREEN */

function renderAuth() {
    const isRegister = state.authMode === "register";

    app.innerHTML = `
        <main class="auth-layout">

            <section class="auth-visual">
                <div class="auth-visual-content">
                    <span class="eyebrow">Ваше время под контролем</span>

                    <h1>Smart<br>Alarm</h1>

                    <p>
                        Начинайте утро осознанно.
                        Создайте свой ритм и не пропускайте важное.
                    </p>
                </div>

                <img
                    src="assets/clock.png"
                    alt="Иллюстрация часов"
                    class="auth-illustration"
                >

                <div class="auth-visual-footer">
                    Умный подход к каждому новому дню
                </div>
            </section>

            <section class="auth-panel">

                <div class="auth-panel-header">
                    <span class="eyebrow">
                        ${isRegister ? "Новый пользователь" : "С возвращением"}
                    </span>

                    <h2>
                        ${isRegister ? "Создать аккаунт" : "Добро пожаловать"}
                    </h2>

                    <p>
                        ${
                            isRegister
                                ? "Зарегистрируйтесь, чтобы пользоваться Smart Alarm."
                                : "Войдите в свой аккаунт, чтобы увидеть будильники."
                        }
                    </p>
                </div>

                ${
                    state.authMessage
                        ? `
                            <div class="form-message ${state.authMessageType || "error"}"
                                 role="alert">
                                ${escapeHTML(state.authMessage)}
                            </div>
                        `
                        : ""
                }

                <form class="form" id="auth-form">

                    <div class="form-group">
                        <label class="form-label" for="email">
                            Электронная почта
                        </label>

                        <input
                            class="form-input"
                            id="email"
                            name="email"
                            type="email"
                            placeholder="example@mail.com"
                            autocomplete="email"
                            maxlength="254"
                            required
                        >
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="password">
                            Пароль
                        </label>

                        <input
                            class="form-input"
                            id="password"
                            name="password"
                            type="password"
                            placeholder="Введите пароль"
                            autocomplete="${isRegister ? "new-password" : "current-password"}"
                            minlength="${isRegister ? "8" : "1"}"
                            maxlength="128"
                            required
                        >

                        ${
                            isRegister
                                ? `
                                    <span class="form-hint">
                                        Минимум 8 символов.
                                    </span>
                                `
                                : ""
                        }
                    </div>

                    ${
                        isRegister
                            ? `
                                <div class="form-group">
                                    <label class="form-label" for="password-confirm">
                                        Повторите пароль
                                    </label>

                                    <input
                                        class="form-input"
                                        id="password-confirm"
                                        name="passwordConfirm"
                                        type="password"
                                        placeholder="Повторите пароль"
                                        autocomplete="new-password"
                                        minlength="8"
                                        maxlength="128"
                                        required
                                    >
                                </div>
                            `
                            : ""
                    }

                    <button
                        class="button button-full"
                        type="submit"
                        ${state.authLoading ? "disabled" : ""}
                    >
                        ${
                            state.authLoading
                                ? "Подождите..."
                                : isRegister
                                    ? "Зарегистрироваться"
                                    : "Войти"
                        }
                    </button>

                </form>

                <div class="auth-footer">
                    ${
                        isRegister
                            ? `
                                Уже есть аккаунт?
                                <button
                                    class="text-button"
                                    type="button"
                                    data-action="show-login"
                                >
                                    Войти
                                </button>
                            `
                            : `
                                Ещё нет аккаунта?
                                <button
                                    class="text-button"
                                    type="button"
                                    data-action="show-register"
                                >
                                    Зарегистрироваться
                                </button>
                            `
                    }
                </div>

            </section>
        </main>
    `;
}

/* AUTH FORM SUBMISSION */

async function handleAuthSubmit(form) {
    if (state.authLoading) return;

    const formData = new FormData(form);

    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    state.authMessage = "";

    if (!email || !password) {
        showMessage("Заполните все обязательные поля.");
        renderAuth();
        return;
    }

    if (state.authMode === "register") {
        const passwordConfirm = String(
            formData.get("passwordConfirm") || ""
        );

        if (password.length < 8) {
            showMessage("Пароль должен содержать минимум 8 символов.");
            renderAuth();
            return;
        }

        if (password !== passwordConfirm) {
            showMessage("Пароли не совпадают.");
            renderAuth();
            return;
        }
    }

    state.authLoading = true;
    renderAuth();

    try {
        if (state.authMode === "register") {
            await register(email, password);

            // вackend после регистрации не выдаёт JWT, поэтому выполняем отдельный вход
            state.user = await login(email, password);
        } else {
            state.user = await login(email, password);
        }

        state.authLoading = false;
        state.authMessage = "";

        await enterApplication();

    } catch (error) {
        state.authLoading = false;

        showMessage(error.message || "Не удалось выполнить запрос.");
        renderAuth();
    }
}

/* ONBOARDING */

const onboardingSlides = [
    {
        eyebrow: "Шаг 1",
        title: "Просыпайтесь вовремя",
        description:
            "Smart Alarm помогает организовать утро и управлять своими будильниками в одном месте.",
        image: "assets/clock.png"
    },
    {
        eyebrow: "Шаг 2",
        title: "Настраивайте свой ритм",
        description:
            "Выбирайте время, дни повторения и параметры будильника под свой распорядок.",
        image: "assets/clock.png"
    },
    {
        eyebrow: "Шаг 3",
        title: "Начинайте день осознанно",
        description:
            "Следите за своими будильниками и постепенно формируйте удобный режим.",
        image: null
    }
];
function renderOnboarding() {
    const slide = onboardingSlides[state.onboardingStep];

    app.innerHTML = `
        <main class="onboarding-layout">
            <section class="onboarding-card">

                <span class="eyebrow">
                    ${slide.eyebrow}
                </span>

                ${
                    slide.image
                        ? `
                            <img
                                src="${slide.image}"
                                alt=""
                                class="onboarding-illustration"
                            >
                        `
                        : ""
                }

                <h1>${slide.title}</h1>

                <p>${slide.description}</p>

                <div class="onboarding-progress">
                    ${onboardingSlides.map((_, index) => `
                        <span class="progress-dot ${
                            index === state.onboardingStep ? "active" : ""
                        }"></span>
                    `).join("")}
                </div>

                <div class="onboarding-actions">

                    ${
                        state.onboardingStep > 0
                            ? `
                                <button
                                    class="button button-secondary"
                                    type="button"
                                    data-action="onboarding-back"
                                >
                                    Назад
                                </button>
                            `
                            : ""
                    }

                    <button
                        class="button"
                        type="button"
                        data-action="onboarding-next"
                    >
                        ${
                            state.onboardingStep === onboardingSlides.length - 1
                                ? "Продолжить"
                                : "Далее"
                        }
                    </button>

                    <button
                        class="text-button"
                        type="button"
                        data-action="onboarding-skip"
                    >
                        Пропустить
                    </button>

                </div>
            </section>
        </main>
    `;
}

/* PERMISSIONS */

function getNotificationDescription() {
    switch (state.notificationPermission) {
        case "granted":
            return "Уведомления разрешены.";

        case "denied":
            return "Вы запретили уведомления. Изменить разрешение можно в настройках браузера.";

        case "unsupported":
            return "Ваш браузер не поддерживает уведомления.";

        default:
            return "Вы ещё не дали разрешение на уведомления. Это можно сделать сейчас или позже.";
    }
}

function renderPermissions() {
    const permissionGranted = state.notificationPermission === "granted";

    app.innerHTML = `
        <main class="onboarding-layout">
            <section class="onboarding-card">

                <span class="eyebrow">Последний шаг</span>

                <img
                    src="assets/clock.png"
                    alt=""
                    class="onboarding-illustration"
                >

                <h1>Разрешите уведомления</h1>

                <p>
                    Браузерные уведомления помогут показывать сообщения
                    от приложения, если вы разрешите их получение.
                </p>

                <div class="form-message ${
                    permissionGranted ? "success" : ""
                }">
                    ${escapeHTML(getNotificationDescription())}
                </div>

                <p class="form-hint">
                    Важно: разрешение на уведомления не гарантирует
                    срабатывание будильника при закрытом браузере.
                </p>

                <div class="onboarding-actions">

                    ${
                        !permissionGranted &&
                        state.notificationPermission !== "unsupported" &&
                        state.notificationPermission !== "denied"
                            ? `
                                <button
                                    class="button"
                                    type="button"
                                    data-action="request-notifications"
                                >
                                    Разрешить уведомления
                                </button>
                            `
                            : ""
                    }

                    <button
                        class="button ${
                            permissionGranted ? "" : "button-secondary"
                        }"
                        type="button"
                        data-action="finish-onboarding"
                    >
                        Перейти к будильникам
                    </button>

                </div>
            </section>
        </main>
    `;
}

async function requestNotifications() {
    if (!("Notification" in window)) {
        state.notificationPermission = "unsupported";
        renderPermissions();
        return;
    }

    try {
        state.notificationPermission =
            await Notification.requestPermission();
    } catch {
        state.notificationPermission = "denied";
    }

    renderPermissions();
}

/* MAIN APP NAVIGATION */

function renderNavigation() {
    const links = [
        {
            page: "alarms",
            icon: "◷",
            label: "Будильники"
        },
        {
            page: "profile",
            icon: `
            <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
            >
                <circle cx="12" cy="8" r="4"></circle>
                <path d="M5 21v-2a7 7 0 0 1 14 0v2"></path>
        </svg>
        `,
        label: "Профиль"
    }
    ];

    return `
        <nav class="sidebar-nav">
            <span class="nav-label">Меню</span>

            ${links.map((link) => `
                <button
                    class="nav-link ${
                        state.screen === link.page ||
                        (link.page === "alarms" && state.screen === "editor")
                            ? "active"
                            : ""
                    }"
                    type="button"
                    data-page="${link.page}"
                >
                    <span class="nav-icon">${link.icon}</span>
                    <span>${link.label}</span>
                </button>
            `).join("")}
        </nav>
    `;
}

function renderMobileNavigation() {
    return `
        <nav class="mobile-nav">
            <button
                class="nav-link ${
                    state.screen === "alarms" || state.screen === "editor"
                        ? "active"
                        : ""
                }"
                type="button"
                data-page="alarms"
            >
                <span class="nav-icon">◷</span>
                <span>Будильники</span>
            </button>

            <button
                class="nav-link ${
                    state.screen === "profile" ? "active" : ""
                }"
                type="button"
                data-page="profile"
            >
                <span class="nav-icon">
    <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
    >
        <circle cx="12" cy="8" r="4"></circle>
        <path d="M5 21v-2a7 7 0 0 1 14 0v2"></path>
    </svg>
</span>
                <span>Профиль</span>
            </button>
        </nav>
    `;
}

function renderAppShell(content) {
    app.innerHTML = `
        <div class="app-shell">

            <aside class="sidebar">

                <div class="brand">
                    <img src="assets/clock.png" alt="Smart Alarm">

                    <div>
                        <div class="brand-name">Smart Alarm</div>
                        <div class="brand-caption">Ваше время</div>
                    </div>
                </div>

                ${renderNavigation()}

                <div class="sidebar-bottom">
                    <div class="sidebar-user">
                        <div class="sidebar-user-email">
                            ${escapeHTML(state.user?.email)}
                        </div>

                        <button
                            class="text-button sidebar-user-action"
                            type="button"
                            data-action="logout"
                        >
                            Выйти из аккаунта
                        </button>
                    </div>
                </div>

            </aside>

            <div class="mobile-header">
                <div class="brand">
                    <img src="assets/clock.png" alt="">

                    <div>
                        <div class="brand-name">Smart Alarm</div>
                    </div>
                </div>

                <button
                    class="text-button"
                    type="button"
                    data-action="logout"
                >
                    Выйти
                </button>
            </div>

            <main class="main-area">

                <header class="topbar">
                    <span class="topbar-date">
                        Личный кабинет Smart Alarm
                    </span>

                    <div class="topbar-actions">
                        <span class="muted">
                            ${escapeHTML(state.user?.email)}
                        </span>
                    </div>
                </header>

                <div class="page-content">
                    ${content}
                </div>

            </main>

            ${renderMobileNavigation()}

        </div>
    `;
}

/* ALARM CARDS */

function renderAlarmCard(alarm) {
    const enabled = Boolean(alarm.enabled);
    const busy = state.busyId === alarm.id;

    return `
        <article class="alarm-card ${enabled ? "" : "is-disabled"}">

            <div class="alarm-card-top">
                <div class="alarm-time">
                    ${escapeHTML(alarm.time)}
                </div>

                <span class="alarm-status ${
                    enabled ? "" : "disabled"
                }">
                    ${enabled ? "Включён" : "Выключен"}
                </span>
            </div>

            <div class="alarm-days">
                ${getDayChips(alarm.days)}
            </div>

            <div class="alarm-details">

                <div class="alarm-detail">
                    <span class="alarm-detail-label">Задание</span>
                    <span class="alarm-detail-value">
                        ${escapeHTML(alarm.task)}
                    </span>
                </div>

                <div class="alarm-detail">
                    <span class="alarm-detail-label">Сложность</span>
                    <span class="alarm-detail-value">
                        ${escapeHTML(alarm.level)}
                    </span>
                </div>

                <div class="alarm-detail">
                    <span class="alarm-detail-label">Мелодия</span>
                    <span class="alarm-detail-value">
                        ${escapeHTML(alarm.melody)}
                    </span>
                </div>

                <div class="alarm-detail">
                    <span class="alarm-detail-label">Громкость</span>
                    <span class="alarm-detail-value">
                        ${escapeHTML(alarm.volume)}%
                    </span>
                </div>

            </div>

            <div class="alarm-card-actions">
                <button
                    class="switch ${enabled ? "is-on" : ""}"
                    type="button"
                    data-action="toggle-alarm"
                    data-id="${alarm.id}"
                    aria-label="${enabled ? "Выключить" : "Включить"} будильник"
                    aria-pressed="${enabled}"
                    ${busy ? "disabled" : ""}
                >
                    <span class="switch-track" aria-hidden="true">
                        <span class="switch-thumb"></span>
                    </span>
                    <span class="switch-label">
                        ${busy
                            ? "Сохраняем…"
                            : (enabled ? "Выключить" : "Включить")}
                    </span>
                </button>

                <div class="alarm-card-buttons">
                    <button
                        class="button button-secondary button-small"
                        type="button"
                        data-action="edit-alarm"
                        data-id="${alarm.id}"
                        ${busy ? "disabled" : ""}
                    >
                        Изменить
                    </button>

                    <button
                        class="button button-danger button-small"
                        type="button"
                        data-action="delete-alarm"
                        data-id="${alarm.id}"
                        ${busy ? "disabled" : ""}
                    >
                        Удалить
                    </button>
                </div>
            </div>
        </article>
    `;
}

/* ALARMS PAGE */

function renderAlarmsPage() {
    let alarmContent = "";

    if (state.alarmsLoading) {
        alarmContent = `
            <section class="state-panel">
                <div class="loader"></div>
                <p>Загружаем ваши будильники...</p>
            </section>
        `;
    } else if (state.alarmsError) {
        alarmContent = `
            <section class="state-panel state-error">
                <h2>Не удалось загрузить будильники</h2>
                <p>${escapeHTML(state.alarmsError)}</p>

                <button
                    class="button button-primary"
                    type="button"
                    data-action="reload-alarms"
                >
                    Повторить
                </button>
            </section>
        `;
    } else if (state.alarms.length === 0) {
        alarmContent = `
            <section class="state-panel">
                <img
                    src="assets/clock.png"
                    alt=""
                    class="state-illustration"
                >

                <h2>Пока нет будильников</h2>

                <p>
                    Создайте первый будильник — задание поможет проснуться.
                </p>

                <button
                    class="button button-primary"
                    type="button"
                    data-action="create-alarm"
                >
                    Создать будильник
                </button>
            </section>
        `;
    } else {
        alarmContent = `
            <div class="alarm-grid">
                ${state.alarms.map(renderAlarmCard).join("")}
            </div>
        `;
    }

    return `
        <section>

            <div class="welcome-panel">
                <div class="welcome-content">
                    <span class="eyebrow">Ваш личный ритм</span>

                    <h1>
                        Добро пожаловать,
                        ${escapeHTML(state.user?.email)}
                    </h1>

                    <p>
                        Все ваши будильники собраны в одном месте.
                    </p>
                </div>

                <img
                    src="assets/clock.png"
                    alt=""
                    class="welcome-decoration"
                >
            </div>

            <div class="alarm-section">

                <div class="alarm-section-header">
                    <div>
                        <h2 class="section-title">
                            Мои будильники
                        </h2>

                        <p class="alarm-count">
                            ${
                                state.alarmsLoading
                                    ? "Получаем данные..."
                                    : `Всего: ${state.alarms.length}`
                            }
                        </p>
                    </div>

                    <button
                        class="button button-primary"
                        type="button"
                        data-action="create-alarm"
                        ${state.alarmsLoading ? "disabled" : ""}
                    >
                        + Создать
                    </button>
                </div>

                ${state.actionMessage
                    ? `
                        <div class="form-message error list-message" role="alert">
                            ${escapeHTML(state.actionMessage)}
                        </div>
                    `
                    : ""}

                ${alarmContent}

            </div>

        </section>
    `;
}

/* PROFILE PAGE */

function renderProfilePage() {
    return `
        <section>

            <div class="page-header">
                <div class="page-header-text">
                    <span class="eyebrow">Личный кабинет</span>
                    <h1 class="page-title">Профиль</h1>

                    <p class="page-description">
                        Информация о вашей учётной записи.
                    </p>
                </div>
            </div>

            <div class="profile-card">

                <div class="profile-row">
                    <span class="profile-label">
                        Электронная почта
                    </span>

                    <strong>
                        ${escapeHTML(state.user?.email)}
                    </strong>
                </div>

                <div class="profile-row">
                    <span class="profile-label">
                        Статус аккаунта
                    </span>

                    <span>
                        ${state.user?.is_active ? "Активен" : "Неактивен"}
                    </span>
                </div>

                <div class="profile-row">
                    <span class="profile-label">
                        Уведомления браузера
                    </span>

                    <span>
                        ${escapeHTML(state.notificationPermission)}
                    </span>
                </div>

                <div class="profile-row">
                    <span class="profile-label">
                        Идентификатор пользователя
                    </span>

                    <span>
                        ${escapeHTML(state.user?.id)}
                    </span>
                </div>

                <div class="profile-row">
                    <span class="profile-label">
                        Экран задания
                    </span>

                    <a class="text-button" href="task.html?demo=math">
                        Открыть демо-задание
                    </a>
                </div>

                <div style="padding-top: 22px;">
                    <button
                        class="button button-danger"
                        type="button"
                        data-action="logout"
                    >
                        Выйти из аккаунта
                    </button>
                </div>

            </div>

        </section>
    `;
}

/* ALARM EDITOR */

function renderAlarmEditorPage() {
    const alarm = state.editingId === null
        ? null
        : state.alarms.find((item) => item.id === state.editingId) || null;

    return renderAlarmForm({
        alarm,
        draft: state.draft,
        error: state.formError,
        fieldErrors: state.fieldErrors,
        saving: state.saving
    });
}

/* DELETE CONFIRMATION */

function renderDeleteDialog() {
    if (state.deleteTarget === null) {
        return "";
    }

    const alarm = state.alarms.find(
        (item) => item.id === state.deleteTarget
    );

    if (!alarm) {
        return "";
    }

    return `
        <div class="modal-backdrop" data-modal-backdrop>
            <section
                class="modal-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-dialog-title"
                data-dialog="delete"
            >
                <span class="eyebrow">Опасное действие</span>

                <h2 id="delete-dialog-title">Удалить будильник?</h2>

                <p>
                    Будильник на ${escapeHTML(alarm.time)} будет удалён
                    без возможности восстановления.
                </p>

                <div class="modal-actions">
                    <button
                        class="button button-danger"
                        type="button"
                        data-action="confirm-delete"
                        data-id="${alarm.id}"
                        ${state.busyId === alarm.id ? "disabled" : ""}
                    >
                        ${state.busyId === alarm.id ? "Удаляем…" : "Удалить"}
                    </button>

                    <button
                        class="button button-secondary"
                        type="button"
                        data-action="cancel-delete"
                        autofocus
                        ${state.busyId === alarm.id ? "disabled" : ""}
                    >
                        Отмена
                    </button>
                </div>
            </section>
        </div>
    `;
}

/* PAGE RENDERING */

function renderMainPage() {
    let content;

    if (state.screen === "profile") {
        content = renderProfilePage();
    } else if (state.screen === "editor") {
        content = renderAlarmEditorPage();
    } else {
        content = renderAlarmsPage();
    }

    renderAppShell(`${content}${renderDeleteDialog()}`);
}

function render() {
    switch (state.screen) {
        case "login":
            renderAuth();
            break;

        case "onboarding":
            renderOnboarding();
            break;

        case "permissions":
            renderPermissions();
            break;

        case "alarms":
        case "profile":
        case "editor":
            renderMainPage();
            break;

        default:
            state.screen = "login";
            renderAuth();
    }
}

/* API: LOAD ALARMS */

async function loadAlarms() {
    if (!state.user) return;

    state.alarmsLoading = true;
    state.alarmsError = "";
    state.actionMessage = "";
    render();

    try {
        const data = await alarmsApi.getAll();

        if (!Array.isArray(data)) {
            throw new Error("Сервер вернул некорректный список будильников.");
        }

        state.alarms = data;
        state.alarmsError = "";

    } catch (error) {
        // Сеть может быть недоступна, поэтому выходим из аккаунта
        // только при явном ответе 401, а не при любой ошибке запроса.
        if (error.status === 401) {
            handleLogout();
            showMessage("Сессия завершена. Войдите в аккаунт ещё раз.");
            render();
            return;
        }

        state.alarmsError =
            error.message || "Ошибка при получении списка будильников.";

    } finally {
        state.alarmsLoading = false;
    }

    render();
}

/* ALARM FORM AND ACTIONS */

function openAlarmEditor(alarm = null) {
    state.screen = "editor";
    state.editingId = alarm ? alarm.id : null;
    state.draft = alarm
        ? {
            ...alarm,
            days: Array.isArray(alarm.days) ? [...alarm.days] : []
        }
        : createDefaultAlarm();
    state.formError = "";
    state.fieldErrors = {};
    state.saving = false;
    state.deleteTarget = null;
    state.actionMessage = "";

    render();
}

function closeAlarmEditor() {
    state.screen = "alarms";
    state.editingId = null;
    state.draft = null;
    state.formError = "";
    state.fieldErrors = {};
    state.saving = false;
    state.actionMessage = "";

    render();
}

function openDeleteDialog(id) {
    const form = document.getElementById("alarm-form");

    // Сохраняем уже введённые значения, чтобы они не пропали
    // при перерисовке формы под модальным окном.
    if (form && state.screen === "editor") {
        state.draft = readAlarmForm(form);
    }

    state.deleteTarget = id;
    render();
}

function closeDeleteDialog() {
    state.deleteTarget = null;
    render();
}

async function saveAlarm(form) {
    if (state.saving) {
        return;
    }

    const data = readAlarmForm(form);

    state.draft = data;
    state.fieldErrors = {};

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.time)) {
        state.formError = "";
        state.fieldErrors = {
            time: "Укажите время в формате ЧЧ:ММ."
        };
        render();
        return;
    }

    if (!Number.isInteger(data.volume) || data.volume < 0 || data.volume > 100) {
        state.formError = "";
        state.fieldErrors = {
            volume: "Громкость должна быть от 0 до 100%."
        };
        render();
        return;
    }

    state.saving = true;
    state.formError = "";
    state.fieldErrors = {};
    render();

    try {
        if (state.editingId === null) {
            await alarmsApi.create(data);
        } else {
            await alarmsApi.update(state.editingId, data);
        }

        state.saving = false;
        state.screen = "alarms";
        state.editingId = null;
        state.draft = null;
        state.formError = "";
        state.fieldErrors = {};

        await loadAlarms();
    } catch (error) {
        state.saving = false;

        if (error.status === 401) {
            handleLogout();
            showMessage("Сессия завершена. Войдите в аккаунт ещё раз.");
            render();
            return;
        }

        state.formError =
            error.message || "Не удалось сохранить будильник.";
        render();
    }
}

async function toggleAlarm(id) {
    if (state.busyId !== null) {
        return;
    }

    state.busyId = id;
    state.alarmsError = "";
    state.actionMessage = "";
    render();

    try {
        const updated = await alarmsApi.toggle(id);

        state.alarms = state.alarms.map((alarm) =>
            alarm.id === id ? updated : alarm
        );
        state.actionMessage = "";
    } catch (error) {
        if (error.status === 401) {
            handleLogout();
            showMessage("Сессия завершена. Войдите в аккаунт ещё раз.");
            render();
            return;
        }

        state.actionMessage =
            error.message || "Не удалось переключить будильник.";
    } finally {
        state.busyId = null;
        render();
    }
}

async function deleteAlarm(id) {
    if (state.busyId !== null) {
        return;
    }

    state.busyId = id;
    state.alarmsError = "";
    state.actionMessage = "";
    render();

    try {
        await alarmsApi.remove(id);

        state.alarms = state.alarms.filter((alarm) => alarm.id !== id);
        state.deleteTarget = null;
        state.actionMessage = "";

        if (state.editingId === id) {
            state.screen = "alarms";
            state.editingId = null;
            state.draft = null;
            state.formError = "";
        }
    } catch (error) {
        if (error.status === 401) {
            handleLogout();
            showMessage("Сессия завершена. Войдите в аккаунт ещё раз.");
            render();
            return;
        }

        state.actionMessage =
            error.message || "Не удалось удалить будильник.";
        state.deleteTarget = null;
    } finally {
        state.busyId = null;
        render();
    }
}

/* APPLICATION FLOW */

async function enterApplication() {
    if (!state.user) {
        state.screen = "login";
        render();
        return;
    }

    if (!isOnboardingCompleted()) {
        state.onboardingStep = 0;
        state.screen = "onboarding";
        render();
        return;
    }

    state.screen = "alarms";
    await loadAlarms();
}

async function finishOnboarding() {
    completeOnboarding();
    state.screen = "alarms";
    await loadAlarms();
}

/* LOGOUT */

function handleLogout() {
    logout();

    state.user = null;
    state.alarms = [];
    state.alarmsError = "";
    state.authMessage = "";
    state.authMode = "login";
    state.screen = "login";
    state.editingId = null;
    state.draft = null;
    state.formError = "";
    state.fieldErrors = {};
    state.saving = false;
    state.busyId = null;
    state.deleteTarget = null;
    state.actionMessage = "";

    render();
}

/* CLICK HANDLER */

app.addEventListener("click", async (event) => {
    if (event.target.matches("[data-modal-backdrop]")) {
        closeDeleteDialog();
        return;
    }

    const actionElement = event.target.closest("[data-action]");
    const pageElement = event.target.closest("[data-page]");

    if (pageElement) {
        const page = pageElement.dataset.page;

        if (page === "alarms" || page === "profile") {
            state.screen = page;
            state.editingId = null;
            state.draft = null;
            state.formError = "";
            state.saving = false;
            state.deleteTarget = null;
            state.actionMessage = "";

            if (page === "alarms") {
                await loadAlarms();
            } else {
                render();
            }
        }

        return;
    }

    if (!actionElement) return;

    const action = actionElement.dataset.action;

    switch (action) {
        case "show-login":
            state.authMode = "login";
            state.authMessage = "";
            render();
            break;

        case "show-register":
            state.authMode = "register";
            state.authMessage = "";
            render();
            break;

        case "onboarding-next":
            if (state.onboardingStep < 2) {
                state.onboardingStep += 1;
                renderOnboarding();
            } else {
                await finishOnboarding();
            }
            break;

        case "onboarding-back":
            state.onboardingStep = Math.max(0, state.onboardingStep - 1);
            renderOnboarding();
            break;

        case "onboarding-skip":
            state.screen = "permissions";
            renderPermissions();
            break;

        case "request-notifications":
            await requestNotifications();
            break;

        case "finish-onboarding":
            await finishOnboarding();
            break;

        case "reload-alarms":
            await loadAlarms();
            break;

        case "create-alarm":
            openAlarmEditor();
            break;

        case "close-editor":
            closeAlarmEditor();
            break;

        case "edit-alarm": {
            const alarm = state.alarms.find(
                (item) => item.id === Number(actionElement.dataset.id)
            );

            if (alarm) {
                openAlarmEditor(alarm);
            }
            break;
        }

        case "delete-alarm":
            openDeleteDialog(Number(actionElement.dataset.id));
            break;

        case "cancel-delete":
            closeDeleteDialog();
            break;

        case "confirm-delete":
            await deleteAlarm(Number(actionElement.dataset.id));
            break;

        case "toggle-alarm":
            await toggleAlarm(Number(actionElement.dataset.id));
            break;

        case "toggle-day": {
            const selected = actionElement.classList.toggle("is-selected");
            actionElement.setAttribute("aria-pressed", String(selected));

            if (state.draft) {
                const day = Number(actionElement.dataset.day);
                const days = new Set(state.draft.days || []);

                if (selected) {
                    days.add(day);
                } else {
                    days.delete(day);
                }

                state.draft = {
                    ...state.draft,
                    days: Array.from(days).sort((a, b) => a - b)
                };
            }
            break;
        }

        case "logout":
            handleLogout();
            break;
    }
});

/* FORM HANDLER */

app.addEventListener("submit", async (event) => {
    if (event.target.id === "alarm-form") {
        event.preventDefault();
        await saveAlarm(event.target);
        return;
    }

    if (event.target.id !== "auth-form") return;

    event.preventDefault();

    await handleAuthSubmit(event.target);
});

/* INPUT HANDLER */

app.addEventListener("input", (event) => {
    if (event.target.id !== "alarm-volume") return;

    const output = event.target
        .closest(".alarm-form")
        ?.querySelector("[data-volume-value]");

    if (output) {
        output.textContent = event.target.value;
    }
});

/* KEYBOARD HANDLER */

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.deleteTarget !== null) {
        closeDeleteDialog();
    }
});

/* APP INITIALIZATION */

async function initializeApp() {
    try {
        const user = await checkSession();

        if (user) {
            state.user = user;
            await enterApplication();
        } else {
            state.screen = "login";
            render();
        }

    } catch (error) {
        console.error("Ошибка инициализации приложения:", error);

        state.screen = "login";
        showMessage("Не удалось проверить сессию. Попробуйте войти.");
        render();
    }
}

initializeApp();
