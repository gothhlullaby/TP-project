const WEEK_DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const TASKS = [
    "Математика",
    "Ввод фразы"
];

const LEVELS = [
    { value: "лёгкая", label: "Лёгкая" },
    { value: "средняя", label: "Средняя" },
    { value: "сложная", label: "Сложная" }
];

const MELODIES = [
    "Утренний свет",
    "Птицы",
    "Рассвет",
    "Спокойное утро"
];

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

function renderOptions(items, selected) {
    return items.map((item) => {
        const value = typeof item === "string" ? item : item.value;
        const label = typeof item === "string" ? item : item.label;

        return `
            <option value="${escapeHTML(value)}" ${value === selected ? "selected" : ""}>
                ${escapeHTML(label)}
            </option>
        `;
    }).join("");
}

export function createDefaultAlarm() {
    return {
        time: "07:00",
        days: [0, 1, 2, 3, 4],
        task: "Математика",
        level: "средняя",
        melody: "Утренний свет",
        volume: 70,
        enabled: true
    };
}

export function renderAlarmForm({
    alarm = null,
    draft = null,
    error = "",
    fieldErrors = {},
    saving = false
} = {}) {
    const data = draft || alarm || createDefaultAlarm();
    const days = Array.isArray(data.days) ? data.days : [];
    const melodies = MELODIES.includes(data.melody)
        ? MELODIES
        : [data.melody || MELODIES[0], ...MELODIES];

    return `
        <section class="alarm-editor">
            <div class="page-header">
                <div class="page-header-text">
                    <span class="eyebrow">
                        ${alarm ? "Редактирование" : "Новый будильник"}
                    </span>

                    <h1 class="page-title">
                        ${alarm ? "Настройте будильник" : "Создайте будильник"}
                    </h1>

                    <p class="page-description">
                        Выберите время, дни повторения и задание, которое поможет проснуться.
                    </p>
                </div>

                <button
                    class="button button-secondary"
                    type="button"
                    data-action="close-editor"
                    ${saving ? "disabled" : ""}
                >
                    Назад
                </button>
            </div>

            <form class="alarm-form" id="alarm-form" novalidate>
                ${error
                    ? `
                        <div class="form-message error" role="alert">
                            ${escapeHTML(error)}
                        </div>
                    `
                    : ""}

                <div class="editor-grid">
                    <div class="form-group">
                        <label class="form-label" for="alarm-time">Время</label>

                        <input
                            class="form-input form-input-time ${fieldErrors.time ? "is-invalid" : ""}"
                            id="alarm-time"
                            name="time"
                            type="time"
                            value="${escapeHTML(data.time)}"
                            aria-invalid="${fieldErrors.time ? "true" : "false"}"
                            aria-describedby="${fieldErrors.time ? "alarm-time-error" : "alarm-time-hint"}"
                            required
                            ${saving ? "disabled" : ""}
                        >

                        ${fieldErrors.time
                            ? `
                                <span class="form-error" id="alarm-time-error">
                                    ${escapeHTML(fieldErrors.time)}
                                </span>
                            `
                            : `
                                <span class="form-hint" id="alarm-time-hint">
                                    Формат ЧЧ:ММ, например 07:30.
                                </span>
                            `}
                    </div>

                    <div class="form-group">
                        <span class="form-label">Состояние</span>

                        <label class="check-row" for="alarm-enabled">
                            <input
                                class="check-input"
                                id="alarm-enabled"
                                name="enabled"
                                type="checkbox"
                                ${data.enabled ? "checked" : ""}
                                ${saving ? "disabled" : ""}
                            >

                            <span class="check-box" aria-hidden="true"></span>
                            <span>Будильник включён</span>
                        </label>

                        <span class="form-hint">
                            Выключенный будильник останется в списке, но не сработает.
                        </span>
                    </div>
                </div>

                <fieldset class="form-group fieldset-reset">
                    <legend class="form-label">Дни недели</legend>

                    <div class="days-picker">
                        ${WEEK_DAYS.map((day, index) => `
                            <button
                                class="day-choice ${days.includes(index) ? "is-selected" : ""}"
                                type="button"
                                data-action="toggle-day"
                                data-day="${index}"
                                aria-pressed="${days.includes(index)}"
                                ${saving ? "disabled" : ""}
                            >
                                ${day}
                            </button>
                        `).join("")}
                    </div>

                    <span class="form-hint">
                        Если дни не выбраны, будильник сработает один раз.
                    </span>
                </fieldset>

                <div class="editor-grid">
                    <div class="form-group">
                        <label class="form-label" for="alarm-task">Задание</label>

                        <select
                            class="form-input"
                            id="alarm-task"
                            name="task"
                            ${saving ? "disabled" : ""}
                        >
                            ${renderOptions(TASKS, data.task)}
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="alarm-level">Сложность</label>

                        <select
                            class="form-input"
                            id="alarm-level"
                            name="level"
                            ${saving ? "disabled" : ""}
                        >
                            ${renderOptions(LEVELS, data.level)}
                        </select>
                    </div>
                </div>

                <div class="editor-grid">
                    <div class="form-group">
                        <label class="form-label" for="alarm-melody">Мелодия</label>

                        <select
                            class="form-input"
                            id="alarm-melody"
                            name="melody"
                            ${saving ? "disabled" : ""}
                        >
                            ${renderOptions(melodies, data.melody)}
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="alarm-volume">
                            Громкость:
                            <span data-volume-value>${Number(data.volume)}</span>%
                        </label>

                        <input
                            class="range-input ${fieldErrors.volume ? "is-invalid" : ""}"
                            id="alarm-volume"
                            name="volume"
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value="${Number(data.volume)}"
                            aria-invalid="${fieldErrors.volume ? "true" : "false"}"
                            aria-describedby="${fieldErrors.volume ? "alarm-volume-error" : ""}"
                            ${saving ? "disabled" : ""}
                        >

                        ${fieldErrors.volume
                            ? `
                                <span class="form-error" id="alarm-volume-error">
                                    ${escapeHTML(fieldErrors.volume)}
                                </span>
                            `
                            : ""}
                    </div>
                </div>

                <p class="form-hint form-hint-block">
                    «Ввод фразы» — короткое предложение, которое нужно правильно повторить.
                </p>

                <div class="editor-actions">
                    <button
                        class="button button-primary"
                        type="submit"
                        ${saving ? "disabled" : ""}
                    >
                        ${saving
                            ? "Сохраняем…"
                            : (alarm ? "Сохранить изменения" : "Создать будильник")}
                    </button>

                    <button
                        class="button button-secondary"
                        type="button"
                        data-action="close-editor"
                        ${saving ? "disabled" : ""}
                    >
                        Отмена
                    </button>

                    ${alarm
                        ? `
                            <button
                                class="button button-danger editor-delete"
                                type="button"
                                data-action="delete-alarm"
                                data-id="${alarm.id}"
                                ${saving ? "disabled" : ""}
                            >
                                Удалить будильник
                            </button>
                        `
                        : ""}
                </div>
            </form>
        </section>
    `;
}

export function readAlarmForm(form) {
    const formData = new FormData(form);

    const days = Array.from(
        form.querySelectorAll("[data-action='toggle-day'][aria-pressed='true']")
    )
        .map((button) => Number(button.dataset.day))
        .filter((day) => Number.isInteger(day));

    return {
        time: String(formData.get("time") || ""),
        days,
        task: String(formData.get("task") || "Математика"),
        level: String(formData.get("level") || "средняя"),
        melody: String(formData.get("melody") || "Утренний свет"),
        volume: Number(formData.get("volume") || 70),
        enabled: formData.get("enabled") === "on"
    };
}
