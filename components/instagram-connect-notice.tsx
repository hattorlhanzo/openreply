"use client";

import { useSearchParams } from "next/navigation";
import { IconAlert, IconCheck } from "@/components/ui/icons";

type Tone = "error" | "warning" | "success";

const TONE_TILE: Record<Tone, string> = {
  error: "icon-tile-error",
  warning: "icon-tile-warning",
  success: "icon-tile-success",
};

const MESSAGES: Record<string, { tone: Tone; title: string; detail: string }> = {
  denied: {
    tone: "warning",
    title: "Подключение Instagram отменено",
    detail:
      "Вы отклонили запрос разрешений в Instagram. Начните заново и подтвердите все запрошенные разрешения.",
  },
  invalid: {
    tone: "error",
    title: "Срок подключения Instagram истёк",
    detail:
      "Ссылка входа отсутствует или старше 10 минут. Нажмите «Подключить Instagram», чтобы начать заново.",
  },
  forbidden: {
    tone: "error",
    title: "Недостаточно прав",
    detail:
      "Подключать Instagram-аккаунт могут только владелец и администраторы рабочего пространства.",
  },
  already_connected: {
    tone: "warning",
    title: "Аккаунт уже подключён",
    detail:
      "Этот Instagram-аккаунт подключён к другому рабочему пространству. Сначала отключите его там или подключите другой аккаунт.",
  },
};

export function InstagramConnectNotice() {
  const searchParams = useSearchParams();
  const status = searchParams.get("instagram");

  if (!status) return null;

  if (status === "misconfigured") {
    const missing = (searchParams.get("missing") ?? "")
      .split(",")
      .filter(Boolean);

    return (
      <Notice tone="error" title="Приложение Instagram не настроено">
        <p>
          Задайте{" "}
          {missing.length > 0
            ? "эти переменные окружения"
            : "обязательные переменные окружения"}{" "}
          и перезапустите сервер:
        </p>
        {missing.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {missing.map((name) => (
              <li key={name} className="chip chip-outline font-mono !text-[11px]">
                {name}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2">
          Где взять каждое значение — в инструкции по установке. Обратите
          внимание: <span className="font-mono text-xs">ENCRYPTION_KEY</span>{" "}
          должен быть hex-строкой из 64 символов.
        </p>
      </Notice>
    );
  }

  if (status === "failed") {
    const reason = searchParams.get("reason");

    return (
      <Notice tone="error" title="Не удалось подключить Instagram">
        <p>
          Instagram принял вход, но завершить подключение не получилось. Обычно
          причина — несовпадающий redirect URI или приложение без нужных
          разрешений.
        </p>
        {reason && (
          <p className="mt-2 break-words font-mono text-xs text-muted">{reason}</p>
        )}
      </Notice>
    );
  }

  const known = MESSAGES[status];
  if (!known) return null;

  return (
    <Notice tone={known.tone} title={known.title}>
      <p>{known.detail}</p>
    </Notice>
  );
}

function Notice({
  tone,
  title,
  children,
}: {
  tone: Tone;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card" role={tone === "error" ? "alert" : "status"}>
      <div className="flex items-start gap-4 p-4">
        <span className={`icon-tile ${TONE_TILE[tone]}`}>
          {tone === "success" ? <IconCheck size={18} /> : <IconAlert size={18} />}
        </span>
        <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-muted-2">
          <p className="text-[14px] font-semibold text-foreground">{title}</p>
          <div className="mt-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
