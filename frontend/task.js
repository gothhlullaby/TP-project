import { createTaskController } from "./modules/task-controller.js";

const params = new URLSearchParams(window.location.search);
const root = document.querySelector("#task-root");

function readStoredToken() {
    const keys = ["smart_alarm_token", "access_token", "token"];

    try {
        for (const key of keys) {
            const value = window.localStorage.getItem(key);

            if (value) {
                return value;
            }
        }
    } catch (error) {
        console.warn("Не удалось прочитать токен из localStorage", error);
    }

    return "";
}

const alarmIdParam = params.get("alarm_id");
const alarmId = alarmIdParam ? Number(alarmIdParam) : null;
const validAlarmId = Number.isInteger(alarmId) && alarmId > 0 ? alarmId : null;

const demo = params.has("demo") || !alarmIdParam;
const demoParam = params.get("demo");
const requestedType = params.get("type");

const demoType = demoParam === "phrase" || requestedType === "phrase"
    ? "phrase"
    : "math";

const token = params.get("token") || readStoredToken();

const level = ["лёгкая", "средняя", "сложная"].includes(params.get("level"))
    ? params.get("level")
    : "средняя";

const config = {
    demo,
    demoType,
    alarmId: validAlarmId,
    type: requestedType,
    token,
    level,
    alarmTime: params.get("time") || (demo ? "07:00" : ""),
    closeOnComplete: params.get("close") === "1"
};

const controller = createTaskController({
    root,
    config,
    onSolved(detail) {
        console.info("Smart Alarm: задание решено", {
            type: detail.type,
            level: detail.level,
            responseTimeSeconds: detail.responseTimeSeconds
        });
    },
    onCompleted(detail) {
        document.documentElement.dataset.taskCompleted = "true";
        console.info("Smart Alarm: задание завершено", {
            type: detail.type,
            level: detail.level,
            responseTimeSeconds: detail.responseTimeSeconds
        });
    }
});

// Удобно для отладки и интеграции из десктопной оболочки
window.smartAlarmTask = controller;

controller.init();
