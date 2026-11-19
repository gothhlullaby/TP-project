const TYPE_LABELS = {
    math: "Математика",
    phrase: "Ввод фразы"
};

const numberFormat = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 1
});

const calculatorIcon = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
        stroke-linecap="round" stroke-linejoin="round">
        <rect x="4" y="3" width="16" height="18" rx="3"></rect>
        <path d="M8 7.5h8"></path>
        <path d="M8 12h2"></path>
        <path d="M14 12h2"></path>
        <path d="M8 16h2"></path>
        <path d="M14 16h2"></path>
    </svg>
`;

const phraseIcon = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
        stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 7h16"></path>
        <path d="M4 12h16"></path>
        <path d="M4 17h10"></path>
    </svg>
`;

// Защита текста от некорректной вставки в HTML
export function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

export function formatClock(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const minutes = String(Math.floor(total / 60)).padStart(2, "0");
    const rest = String(total % 60).padStart(2, "0");

    return `${minutes}:${rest}`;
}

function formatDuration(seconds) {
    if (seconds === null || seconds === undefined || Number.isNaN(Number(seconds))) {
        return "—";
    }

    const value = Math.max(0, Number(seconds));

    if (value < 60) {
        return `${numberFormat.format(value)} с`;
    }

    const minutes = Math.floor(value / 60);
    const rest = Math.round(value % 60);

    return `${minutes} мин ${rest} с`;
}

// Вопрос фразового задания приходит в формате:
// "Запомните фразу и введите её в поле ответа: <фраза>"
function parsePhraseQuestion(question) {
    const text = String(question ?? "").trim();
    const prefix = text.match(/^Запомните фразу[^:]*:\s*/i);

    if (prefix) {
        return {
            instruction: "Запомните фразу",
            phrase: text.slice(prefix[0].length).trim()
        };
    }

    return {
        instruction: "Введите фразу",
        phrase: text
    };
}

function formatMathQuestion(question) {
    return String(question ?? "")
        .replace(/\*/g, "×")
        .replace(/\//g, "÷")
        .replace(/-/g, "−")
        .replace(/\s+/g, " ")
        .trim();
}

function renderTopbar(state) {
    const time = state.alarmTime || (state.demo ? "07:00" : "");
    const status = state.phase === "correct" ? "выключен" : "звонит";

    return `
        <header class="alarm-topbar">
            <span class="brand-mark">[ умный будильник ]</span>

            ${time ? `
                <div class="alarm-clock">
                    <span class="alarm-clock__time">${escapeHtml(time)}</span>
                    <span class="alarm-clock__label">${status}</span>
                </div>
            ` : ""}
        </header>
    `;
}

function renderLoading() {
    return `
        <div class="alarm-window__body">
            <div class="challenge-layout challenge-layout--loading" aria-busy="true">
                <section class="intro">
                    <div class="skeleton skeleton--tag"></div>
                    <div class="skeleton skeleton--title"></div>
                    <div class="skeleton skeleton--subtitle"></div>
                    <div class="skeleton skeleton--timer"></div>
                </section>

                <section class="challenge-card">
                    <div class="skeleton skeleton--question"></div>
                    <div class="skeleton skeleton--label"></div>
                    <div class="skeleton skeleton--field"></div>
                    <div class="skeleton skeleton--button"></div>
                </section>
            </div>

            <p class="loading-caption" role="status">
                <span class="spinner" aria-hidden="true"></span>
                Готовим задание…
            </p>
        </div>
    `;
}

function renderTask(state) {
    const isMath = state.type === "math";
    const level = state.challenge.level || state.level;
    const checking = state.phase === "checking";

    const phrase = isMath ? null : parsePhraseQuestion(state.challenge.question);
    const question = isMath ? formatMathQuestion(state.challenge.question) : "";

    const questionHtml = isMath
        ? `
            <div class="math-question" aria-label="Пример: ${escapeHtml(question)}">
                <span>${escapeHtml(question)}</span>
                <span class="math-question__sign">=</span>
                <span class="math-question__unknown">?</span>
            </div>
        `
        : `
            <blockquote class="phrase-quote">
                «${escapeHtml(phrase.phrase)}»
            </blockquote>
        `;

    return `
        <div class="alarm-window__body">
            <div class="challenge-layout">
                <section class="intro">
                    <div class="tag-row">
                        <span class="tag">${TYPE_LABELS[state.type]}</span>
                        <span class="meta-caption">сложность: ${escapeHtml(level)}</span>
                    </div>

                    <h1 class="screen-title">Пора вставать</h1>

                    <p class="screen-subtitle">
                        ${isMath
                            ? "Решите пример, чтобы выключить будильник."
                            : "Повторите фразу, чтобы выключить будильник."}
                    </p>

                    <div class="timer-card">
                        <span class="timer-card__label">Время ответа</span>
                        <strong class="timer-card__value" data-timer>
                            ${formatClock(state.elapsedSeconds)}
                        </strong>
                    </div>
                </section>

                <section class="challenge-card">
                    <div class="question-block">
                        <span class="question-label">
                            ${isMath ? "Пример" : phrase.instruction}
                        </span>

                        ${questionHtml}
                    </div>

                    <form class="answer-form" id="answer-form" novalidate>
                        <label class="field-label" for="answer-input">
                            ${isMath ? "Ваш ответ" : "Ваша фраза"}
                        </label>

                        <div class="field ${state.fieldError ? "field--error" : ""}">
                            <span class="field__icon" aria-hidden="true">
                                ${isMath ? calculatorIcon : phraseIcon}
                            </span>

                            <input
                                class="field__input"
                                id="answer-input"
                                name="answer"
                                type="text"
                                inputmode="${isMath ? "decimal" : "text"}"
                                autocomplete="off"
                                autocapitalize="off"
                                spellcheck="false"
                                maxlength="255"
                                placeholder="${isMath ? "Введите значение" : "Введите фразу"}"
                                value="${escapeHtml(state.answer)}"
                                aria-invalid="${state.fieldError ? "true" : "false"}"
                                aria-describedby="answer-error"
                                ${checking ? "disabled" : ""}
                            >
                        </div>

                        <p class="field-error" id="answer-error" ${state.fieldError ? "" : "hidden"}>
                            <span class="field-error__mark" aria-hidden="true">!</span>
                            <span data-error-text>${escapeHtml(state.fieldError)}</span>
                        </p>

                        <button
                            class="button button--primary button--wide"
                            type="submit"
                            ${checking ? "disabled" : ""}
                        >
                            ${checking
                                ? `<span class="button-spinner" aria-hidden="true"></span><span>Проверяем…</span>`
                                : "<span>Проверить</span>"}
                        </button>
                    </form>
                </section>
            </div>
        </div>
    `;
}

function renderResult(state) {
    const isCorrect = Boolean(state.result?.is_correct);
    const typeLabel = TYPE_LABELS[state.type] || "Задание";
    const message = state.result?.message || (
        isCorrect ? "Правильный ответ!" : "Неправильный ответ."
    );

    const badge = isCorrect
        ? `<div class="result-badge result-badge--success" aria-hidden="true">✓</div>`
        : `<div class="result-badge result-badge--error" aria-hidden="true">!</div>`;

    const tag = isCorrect
        ? `<span class="tag tag--mint">Задание выполнено</span>`
        : `<span class="tag tag--error">Задание не выполнено</span>`;

    const title = isCorrect ? "Будильник выключен" : "Неправильный ответ";

    const hint = isCorrect
        ? ""
        : `<p class="result-hint">Задание закрыто. Получите новое, чтобы выключить будильник.</p>`;

    const action = isCorrect
        ? `<button type="button" class="button button--primary button--wide" data-action="finish">
                ${state.demo ? "Пройти ещё раз" : "Готово"}
            </button>`
        : `<button type="button" class="button button--primary button--wide" data-action="new-task">
                Попробовать снова
            </button>`;

    return `
        <div class="alarm-window__body">
            <section class="result-card" aria-live="polite">
                ${badge}
                ${tag}

                <h1 class="result-title">${title}</h1>

                <p class="result-message">${escapeHtml(message)}</p>
                ${hint}

                <dl class="result-meta">
                    <div>
                        <dt>Задание</dt>
                        <dd>${typeLabel}</dd>
                    </div>
                    <div>
                        <dt>Время ответа</dt>
                        <dd>${formatDuration(state.submittedSeconds)}</dd>
                    </div>
                </dl>

                ${action}
            </section>
        </div>
    `;
}

function renderFatal(state) {
    const error = state.fatalError || {};
    const retryLabel = error.retryLabel || "Повторить";

    const retryButton = error.canRetry === false
        ? ""
        : `<button type="button" class="button button--primary" data-action="retry-load">
                ${escapeHtml(retryLabel)}
            </button>`;

    const demoLink = error.showDemo
        ? `<a class="button button--secondary" href="task.html?demo=math">Открыть демо</a>`
        : "";

    return `
        <div class="alarm-window__body">
            <section class="result-card" aria-live="polite">
                <div class="result-badge result-badge--error" aria-hidden="true">!</div>
                <span class="tag tag--error">Ошибка</span>

                <h1 class="result-title">
                    ${escapeHtml(error.title || "Не удалось загрузить задание")}
                </h1>

                <p class="result-message">
                    ${escapeHtml(error.message || "Попробуйте ещё раз.")}
                </p>

                <div class="result-actions">
                    ${retryButton}
                    ${demoLink}
                </div>
            </section>
        </div>
    `;
}

function renderDemoBar(state) {
    if (!state.demo) {
        return "";
    }

    return `
        <aside class="demo-bar" aria-label="Демонстрационный режим">
            

            <div class="demo-tabs" role="group" aria-label="Тип задания">
                <button
                    type="button"
                    class="demo-tab ${state.demoType === "math" ? "is-active" : ""}"
                    data-action="demo-type"
                    data-type="math"
                    aria-pressed="${state.demoType === "math"}"
                >
                    Математика
                </button>

                <button
                    type="button"
                    class="demo-tab ${state.demoType === "phrase" ? "is-active" : ""}"
                    data-action="demo-type"
                    data-type="phrase"
                    aria-pressed="${state.demoType === "phrase"}"
                >
                    Ввод фразы
                </button>
            </div>
        </aside>
    `;
}

export function renderTaskScreen(state) {
    let body;

    if (state.phase === "loading") {
        body = renderLoading();
    } else if (state.phase === "error") {
        body = renderFatal(state);
    } else if (state.phase === "correct" || state.phase === "incorrect") {
        body = renderResult(state);
    } else {
        body = renderTask(state);
    }

    return `
        <div class="task-stack">
            <section
                class="alarm-window"
                role="region"
                aria-label="Задание для отключения будильника"
            >
                ${renderTopbar(state)}
                ${body}
            </section>

            ${renderDemoBar(state)}
        </div>
    `;
}
