"use client";

/**
 * Import Campaigns Page
 *
 * Paste a CSV of everything except the post. Each row is queued and opened in
 * the campaign builder prefilled and editable, one at a time, so you review
 * each campaign and pick its reel before saving.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import { parseCsv } from "@/lib/utils/csv";
import { IMPORT_QUEUE_KEY, IMPORT_ACCOUNT_KEY } from "@/lib/import-queue";
import { IconAlert, IconChevronLeft, IconList } from "@/components/ui/icons";

const COLUMNS: { name: string; required?: boolean; desc: string }[] = [
  { name: "keywords", required: true, desc: "ключевые слова через запятую" },
  { name: "dm_message", required: true, desc: "сообщение в Direct" },
  { name: "name", desc: "название кампании" },
  { name: "public_reply", desc: "публичный ответ под публикацией" },
  { name: "tracked_url", desc: "отслеживаемая ссылка" },
  { name: "opening_dm", desc: "первое сообщение" },
  { name: "opening_dm_button", desc: "подпись кнопки первого сообщения" },
];

const SAMPLE = `keywords,dm_message,public_reply,tracked_url,opening_dm,opening_dm_button
"МЕНЮ","Вот наше меню: {link}","Ответили в Direct 📩","https://vash-sait.ru/menu","Здравствуйте! Нажмите кнопку — пришлём меню","Получить меню"
"ЦЕНА,ПРАЙС","Вот прайс: {link}","Написали в Direct",,,`;

export default function ImportCampaignsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [csv, setCsv] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then((payload) => {
        if (payload.success) {
          const next = payload.data.instagramAccounts ?? [];
          setAccounts(next);
          setSelectedAccountId(next[0]?.id ?? "");
        }
      })
      .catch(() => setAccounts([]));
  }, []);

  function startImport() {
    setError(null);
    const parsed = parseCsv(csv);
    if (parsed.length === 0) {
      setError("Вставьте CSV со строкой заголовков и хотя бы одной кампанией.");
      return;
    }

    const rows = [];
    for (let i = 0; i < parsed.length; i++) {
      const r = parsed[i];
      const keywords = (r.keywords ?? "")
        .split(/[,;]/)
        .map((k) => k.trim())
        .filter(Boolean)
        .slice(0, 10);
      const dmMessage = (r.dm_message ?? r.message ?? "").trim();
      if (keywords.length === 0 || !dmMessage) {
        setError(`В строке ${i + 1} нет ключевых слов или сообщения.`);
        return;
      }
      rows.push({
        name: (r.name ?? "").trim(),
        keywords,
        dmMessage,
        publicReply: (r.public_reply ?? "").trim(),
        trackedUrl: (r.tracked_url ?? "").trim(),
        openingDmMessage: (r.opening_dm ?? "").trim(),
        openingDmButtonLabel: (r.opening_dm_button ?? "").trim(),
      });
    }

    try {
      window.localStorage.setItem(IMPORT_QUEUE_KEY, JSON.stringify(rows));
      if (selectedAccountId) {
        window.localStorage.setItem(IMPORT_ACCOUNT_KEY, selectedAccountId);
      }
    } catch {
      setError("Не удалось подготовить импорт в этом браузере.");
      return;
    }
    router.push("/campaigns/new");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <button
          type="button"
          onClick={() => router.push("/campaigns")}
          className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted hover:text-foreground"
        >
          <IconChevronLeft size={15} />
          Кампании
        </button>
        <div className="page-head !mb-0">
          <div>
            <h1 className="page-title">Импорт кампаний</h1>
            <p className="page-sub">
              Вставьте CSV — одна строка на кампанию. Каждая откроется в
              конструкторе с заполненными полями: вы проверите её и выберете Reels
              перед сохранением.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="flex items-center gap-3">
            <span className="icon-tile !h-8 !w-8 !rounded-[9px]">
              <IconList size={16} />
            </span>
            <span className="card-title">Колонки CSV</span>
          </div>
        </div>
        <div className="card-body !p-0">
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Колонка</th>
                  <th>Что содержит</th>
                  <th className="!text-right">Обязательна</th>
                </tr>
              </thead>
              <tbody>
                {COLUMNS.map((c) => (
                  <tr key={c.name}>
                    <td>
                      <code className="rounded-[6px] bg-surface-2 px-1.5 py-0.5 font-mono text-[12px] text-accent-hi">
                        {c.name}
                      </code>
                    </td>
                    <td className="text-muted-2">{c.desc}</td>
                    <td className="text-right">
                      {c.required ? (
                        <span className="badge badge-accent badge-plain">да</span>
                      ) : (
                        <span className="text-[12px] text-muted">нет</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint border-t border-border-subtle px-5 py-3 !mt-0">
            Ключевые слова — в одной ячейке через запятую. Чтобы вставить
            отслеживаемую ссылку, используйте в сообщении{" "}
            <code className="font-mono text-accent-hi">{"{link}"}</code>.
          </p>
        </div>
      </div>

      {error && (
        <div className="card flex items-start gap-3 p-4">
          <span className="icon-tile !h-8 !w-8 !rounded-[9px] icon-tile-error">
            <IconAlert size={16} />
          </span>
          <div>
            <span className="badge badge-error">Не удалось импортировать</span>
            <p className="mt-1.5 text-[13px] text-foreground">{error}</p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <span className="card-title">Данные</span>
          <button
            type="button"
            onClick={() => setCsv(SAMPLE)}
            className="btn btn-ghost btn-sm"
          >
            Заполнить примером
          </button>
        </div>
        <div className="card-body space-y-4">
          {accounts.length > 1 && (
            <AccountSelect
              accounts={accounts}
              value={selectedAccountId}
              onChange={setSelectedAccountId}
              includeAll={false}
              label="Instagram-аккаунт"
            />
          )}
          <div>
            <label className="label" htmlFor="import-csv">
              CSV
            </label>
            <textarea
              id="import-csv"
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={SAMPLE}
              rows={10}
              spellCheck={false}
              className="textarea font-mono !text-[13px]"
            />
            <p className="hint">Первая строка — заголовки колонок.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle px-5 py-4">
          <button
            type="button"
            onClick={() => router.push("/campaigns")}
            className="btn btn-secondary"
          >
            Отмена
          </button>
          <button type="button" onClick={startImport} className="btn btn-primary">
            Проверить и импортировать
          </button>
        </div>
      </div>
    </div>
  );
}
