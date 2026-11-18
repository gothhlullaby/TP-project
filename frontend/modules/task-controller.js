import { ApiError, tasksApi } from "./task-api.js";
import { formatClock, renderTaskScreen } from "./task-screen.js";

const MAX_ANSWER_LENGTH = 255;

const PHRASES = [
    "Я просыпаюсь вовремя",
    "Сегодня отличный день",
    "Пора начинать новое утро",
    "Мой день начинается сейчас",
    "Я готов к новым задачам",
    "Каждое утро дает новые возможности"
];

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalizeType(value) {
    const type = String(value ?? "").trim().toLocaleLowerCase("ru-RU");

    return type === "phrase" || type === "ввод фразы" ? "phrase" : "math";
}

function normalizePhrase(value) {
    return String(value ?? "")
        .toLocaleLowerCase("ru-RU")
        .replace(/\s+/g, " ")
        .trim();
}

function checkDemoMathAnswer(answer, expectedAnswer) {
    const normalized = String(answer)
        .trim()
        .replace(/\s+/g, "")
        .replace(",", ".");

    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) {
        return false;
    }

    return Number(normalized) === Number(expectedAnswer);
}

function createDemoMathChallenge(level) {
    let a;
    let b;
    let operation;
    let answer;

    if (level === "лёгкая") {
        a = randomInt(1, 20);
        b = randomInt(1, 20);
        operation = Math.random() < 0.5 ? "+" : "-";

        if (operation === "-") {
            const max = Math.max(a, b);
            const min = Math.min(a, b);
            a = max;
            b = min;
            answer = a - b;
        } else {
            answer = a + b;
        }
    } else if (level === "сложная") {
        operation = Math.random() < 0.5 ? "*" : "/";

        if (operation === "*") {
            a = randomInt(10, 30);
            b = randomInt(5, 20);
            answer = a * b;
        } else {
            b = randomInt(2, 12);
            answer = randomInt(2, 20);
            a = b * answer;
        }
    } else {
        a = randomInt(2, 15);
        b = randomInt(2, 15);
        operation = ["+", "-", "*"][randomInt(0, 2)];

        if (operation === "+") {
            answer = a + b;
        } else if (operation === "-") {
            const max = Math.max(a, b);
            const min = Math.min(a, b);
            a = max;
            b = min;
            answer = a - b;
        } else {
            answer = a * b;
        }
    }

    return {
        id: `demo-math-${Date.now()}`,
        task_type: "math",
        level,
        question: `${a} ${operation} ${b}`,
        expected_answer: String(answer),
        created_at: new Date().toISOString()
    };
}

function createDemoPhraseChallenge(level) {
    const phrase = PHRASES[randomInt(0, PHRASES.length - 1)];

    return {
        id: `demo-phrase-${Date.now()}`,
        task_type: "phrase",
        level,
        question: `Запомните фразу и введите её в поле ответа: ${phrase}`,
        expected_answer: phrase,
        created_at: new Date().toISOString()
    };
}

function createDemoChallenge(type, level) {
    return type === "phrase"
        ? createDemoPhraseChallenge(level)
        : createDemoMathChallenge(level);
}

function checkDemoChallenge(challenge, answer) {
    const isCorrect = challenge.task_type === "phrase"
        ? normalizePhrase(answer) === normalizePhrase(challenge.expected_answer)
        : checkDemoMathAnswer(answer, challenge.expected_answer);

    return {
        challenge_id: challenge.id,
        result_id: `demo-result-${Date.now()}`,
        is_correct: isCorrect,
        message: isCorrect
            ? "Правильный ответ!"
            : "Неправильный ответ. Попробуйте ещё раз в новом задании."
    };
}

export function createTaskController({
    root,
    config = {},
    api = tasksApi,
    onSolved = () => {},
    onCompleted = () => {}
}) {
    if (!root) {
        throw new Error("Не найден корневой элемент экрана задания");
    }

    const state = {
        phase: "loading",
        demo: Boolean(config.demo),
        demoType: config.demoType === "phrase" ? "phrase" : "math",
        type: config.demoType === "phrase" ? "phrase" : "math",
        alarmTime: config.alarmTime || (config.demo ? "07:00" : ""),
        level: config.level || "средняя",
        alarm: null,
        challenge: null,
        answer: "",
        fieldError: "",
        fatalError: null,
        result: null,
        elapsedSeconds: 0,
        submittedSeconds: null
    };

    let timerId = null;
    let startedAt = 0;
    let loadVersion = 0;
    let finishDispatched = false;

    function elapsedSeconds() {
        if (!startedAt) {
            return 0;
        }

        return Math.max(0, (performance.now() - startedAt) / 1000);
    }

    function focusAnswerInput() {
        window.requestAnimationFrame(() => {
            const input = root.querySelector("#answer-input");

            if (input && !input.disabled) {
                input.focus();
            }
        });
    }

    function focusResultAction() {
        window.requestAnimationFrame(() => {
            const action = root.querySelector(
                "button[data-action='finish'], " +
                "button[data-action='new-task'], " +
                "button[data-action='retry-load']"
            );

            action?.focus();
        });
    }

    function render() {
        root.innerHTML = renderTaskScreen(state);

        if (state.phase === "task") {
            focusAnswerInput();
        } else if (
            state.phase === "correct" ||
            state.phase === "incorrect" ||
            state.phase === "error"
        ) {
            focusResultAction();
        }
    }

    function stopTimer() {
        if (timerId !== null) {
            window.clearInterval(timerId);
            timerId = null;
        }
    }

    function startTimer() {
        stopTimer();

        timerId = window.setInterval(() => {
            if (!startedAt) {
                return;
            }

            state.elapsedSeconds = elapsedSeconds();

            const timer = root.querySelector("[data-timer]");

            if (timer) {
                timer.textContent = formatClock(state.elapsedSeconds);
            }
        }, 200);
    }

    function startChallenge(challenge) {
        state.challenge = challenge;
        state.type = normalizeType(challenge.task_type);
        state.demoType = state.type;
        state.level = challenge.level || state.level;
        state.phase = "task";
        state.answer = "";
        state.fieldError = "";
        state.fatalError = null;
        state.result = null;
        state.submittedSeconds = null;
        state.elapsedSeconds = 0;
        finishDispatched = false;

        startedAt = performance.now();
        startTimer();
        render();
    }

    function showFatal(title, message, options = {}) {
        stopTimer();

        state.phase = "error";
        state.fatalError = {
            title,
            message,
            canRetry: options.canRetry !== false,
            retryLabel: options.retryLabel || "Повторить",
            showDemo: options.showDemo !== false
        };

        render();
    }

    function handleLoadError(error) {
        const status = error instanceof ApiError ? error.status : 0;

        if (status === 401) {
            showFatal(
                "Сессия истекла",
                "Войдите в приложение заново и откройте экран задания.",
                { canRetry: true }
            );
            return;
        }

        if (status === 404) {
            showFatal(
                "Будильник не найден",
                "Возможно, он был удалён. Обновите список будильников и попробуйте снова.",
                { canRetry: true }
            );
            return;
        }

        if (status === 400 || status === 422) {
            showFatal(
                "Задание недоступно",
                error.message || "Для этого будильника выбрано другое задание.",
                { canRetry: true }
            );
            return;
        }

        showFatal(
            "Нет связи с сервером",
            "Проверьте, что backend запущен, и адрес API доступен.",
            { canRetry: true }
        );
    }

    async function load() {
        const version = ++loadVersion;

        stopTimer();
        startedAt = 0;
        finishDispatched = false;

        state.phase = "loading";
        state.answer = "";
        state.fieldError = "";
        state.fatalError = null;
        state.result = null;
        state.challenge = null;
        state.submittedSeconds = null;
        state.elapsedSeconds = 0;

        if (state.demo) {
            state.type = state.demoType;
        }

        render();

        if (state.demo) {
            const challenge = createDemoChallenge(state.type, state.level);

            if (version !== loadVersion) {
                return;
            }

            startChallenge(challenge);
            return;
        }

        if (!config.alarmId) {
            showFatal(
                "Будильник не указан",
                "Откройте экран задания из списка будильников или добавьте параметр alarm_id.",
                { canRetry: false, showDemo: true }
            );
            return;
        }

        if (!config.token) {
            showFatal(
                "Нужна авторизация",
                "Не найден токен пользователя. Войдите в приложение и откройте экран задания снова.",
                { canRetry: false, showDemo: true }
            );
            return;
        }

        try {
            let alarm = state.alarm;

            if (!alarm) {
                alarm = await api.getAlarm(config.alarmId, config.token);

                if (version !== loadVersion) {
                    return;
                }

                state.alarm = alarm;
            }

            if (alarm.task !== "Математика" && alarm.task !== "Ввод фразы") {
                showFatal(
                    "Неизвестный тип задания",
                    "Для этого будильника не настроено математическое задание или ввод фразы.",
                    { canRetry: false, showDemo: true }
                );
                return;
            }

            state.type = alarm.task === "Ввод фразы" ? "phrase" : "math";
            state.level = alarm.level || state.level;
            state.alarmTime = alarm.time || state.alarmTime;

            const challenge = state.type === "phrase"
                ? await api.getPhraseTask(config.alarmId, config.token)
                : await api.getMathTask(config.alarmId, config.token);

            if (version !== loadVersion) {
                return;
            }

            startChallenge(challenge);
        } catch (error) {
            if (version !== loadVersion) {
                return;
            }

            handleLoadError(error);
        }
    }

    function setFieldError(message) {
        state.fieldError = message;

        const field = root.querySelector(".field");
        const error = root.querySelector("#answer-error");
        const errorText = root.querySelector("[data-error-text]");
        const input = root.querySelector("#answer-input");

        field?.classList.add("field--error");

        if (error) {
            error.hidden = false;
        }

        if (errorText) {
            errorText.textContent = message;
        }

        if (input) {
            input.setAttribute("aria-invalid", "true");
            input.focus();
        }
    }

    function clearFieldError() {
        if (!state.fieldError) {
            return;
        }

        state.fieldError = "";

        root.querySelector(".field")?.classList.remove("field--error");

        const error = root.querySelector("#answer-error");

        if (error) {
            error.hidden = true;

            const errorText = error.querySelector("[data-error-text]");

            if (errorText) {
                errorText.textContent = "";
            }
        }

        root.querySelector("#answer-input")?.removeAttribute("aria-invalid");
    }

    function buildCompletionDetail(answer = state.answer) {
        return {
            type: state.type,
            level: state.level,
            alarmId: config.alarmId ?? null,
            challengeId: state.challenge?.id ?? null,
            resultId: state.result?.result_id ?? null,
            isCorrect: true,
            responseTimeSeconds: state.submittedSeconds,
            answer
        };
    }

    function notifySolved(result, answer) {
        if (state.demo) {
            return;
        }

        state.result = result;

        const detail = buildCompletionDetail(answer);

        root.dispatchEvent(new CustomEvent("task-solved", {
            bubbles: true,
            detail
        }));

        window.dispatchEvent(new CustomEvent("smart-alarm:task-solved", {
            detail
        }));

        onSolved(detail);
    }

    function finish() {
        if (state.demo) {
            load();
            return;
        }

        if (finishDispatched) {
            return;
        }

        finishDispatched = true;

        const detail = buildCompletionDetail();

        root.dispatchEvent(new CustomEvent("task-completed", {
            bubbles: true,
            detail
        }));

        window.dispatchEvent(new CustomEvent("smart-alarm:task-completed", {
            detail
        }));

        onCompleted(detail);

        if (config.closeOnComplete) {
            window.close();
        }
    }

    function handleCheckError(error) {
        const status = error instanceof ApiError ? error.status : 0;

        if (status === 400) {
            stopTimer();

            state.phase = "error";
            state.fatalError = {
                title: "Задание уже завершено",
                message: "Получите новое задание, чтобы продолжить.",
                canRetry: true,
                retryLabel: "Новое задание",
                showDemo: false
            };

            render();
            return;
        }

        state.phase = "task";

        if (status === 401) {
            state.fieldError = "Сессия истекла. Войдите в приложение заново.";
        } else if (status) {
            state.fieldError = error.message || "Не удалось проверить ответ.";
        } else {
            state.fieldError = "Не удалось отправить ответ. Проверьте соединение с сервером.";
        }

        render();
    }

    async function submitAnswer() {
        if (state.phase !== "task" || !state.challenge) {
            return;
        }

        const answer = state.answer.trim();

        if (!answer) {
            setFieldError(state.type === "phrase" ? "Введите фразу" : "Введите ответ");
            return;
        }

        if (answer.length > MAX_ANSWER_LENGTH) {
            setFieldError(`Не больше ${MAX_ANSWER_LENGTH} символов`);
            return;
        }

        const responseTime = Math.round(elapsedSeconds() * 10) / 10;
        const challengeId = state.challenge.id;

        state.submittedSeconds = responseTime;
        state.phase = "checking";
        state.fieldError = "";

        render();

        try {
            let result;

            if (state.demo) {
                result = checkDemoChallenge(state.challenge, answer);
            } else {
                const payload = {
                    challenge_id: state.challenge.id,
                    answer,
                    response_time_seconds: responseTime
                };

                result = state.type === "phrase"
                    ? await api.checkPhraseAnswer(payload, config.token)
                    : await api.checkMathAnswer(payload, config.token);
            }

            // Пока шёл запрос, пользователь мог запросить другое задание
            if (state.challenge?.id !== challengeId) {
                return;
            }

            state.result = result;
            state.phase = result.is_correct ? "correct" : "incorrect";
            state.elapsedSeconds = responseTime;

            stopTimer();
            render();

            if (result.is_correct) {
                notifySolved(result, answer);
            }
        } catch (error) {
            handleCheckError(error);
        }
    }

    function handleClick(event) {
        const target = event.target instanceof Element
            ? event.target.closest("[data-action]")
            : null;

        if (!target) {
            return;
        }

        const action = target.dataset.action;

        if (action === "retry-load" || action === "new-task") {
            load();
            return;
        }

        if (action === "finish") {
            finish();
            return;
        }

        if (action === "demo-type" && state.demo) {
            const type = target.dataset.type === "phrase" ? "phrase" : "math";

            if (state.demoType === type) {
                return;
            }

            state.demoType = type;
            state.type = type;
            state.alarm = null;
            load();
        }
    }

    function handleInput(event) {
        if (event.target.id !== "answer-input") {
            return;
        }

        state.answer = event.target.value;
        clearFieldError();
    }

    function handleSubmit(event) {
        if (event.target.id !== "answer-form") {
            return;
        }

        event.preventDefault();
        submitAnswer();
    }

    function init() {
        root.addEventListener("click", handleClick);
        root.addEventListener("input", handleInput);
        root.addEventListener("submit", handleSubmit);

        load();
    }

    function destroy() {
        stopTimer();

        root.removeEventListener("click", handleClick);
        root.removeEventListener("input", handleInput);
        root.removeEventListener("submit", handleSubmit);

        root.innerHTML = "";
    }

    return {
        init,
        destroy,
        reload: load,
        getState: () => ({ ...state })
    };
}
