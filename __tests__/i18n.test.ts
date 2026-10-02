import { describe, expect, it } from "vitest";
import { createI18n, resolveLocale } from "../lib/i18n";
import ru from "../lib/i18n/ru.json";
import zhTW from "../lib/i18n/zh-TW.json";

describe("interface translations", () => {
  it("keeps English as the default for absent or unsupported preferences", () => {
    for (const value of [undefined, null, "", "fr", "zh-CN", "../zh-TW"]) {
      expect(resolveLocale(value)).toBe("en");
    }
    expect(resolveLocale("zh-TW")).toBe("zh-TW");
  });

  it("renders both interface languages from the same keys", () => {
    expect(createI18n("en").t("Campaigns")).toBe("Campaigns");
    expect(createI18n("zh-TW").t("Campaigns")).toBe("自動回覆活動");
  });

  it("allows sentence order to differ between languages", () => {
    const values = { count: 2 };
    expect(createI18n("en").t("{count} connected accounts", values)).toBe(
      "2 connected accounts",
    );
    expect(createI18n("zh-TW").t("{count} connected accounts", values)).toBe(
      "已連接 2 個帳號",
    );
  });

  it("preserves interpolation values verbatim, including user content and zero", () => {
    const { t } = createI18n("zh-TW");
    expect(t("Hello, {name}!", { name: "{count} <b>Alex</b> $&" })).toBe(
      "你好，{count} <b>Alex</b> $&！",
    );
    expect(t("{count} campaigns", { count: 0 })).toBe("0 個活動");
  });

  it("translates display labels without changing stored codes or unknown values", () => {
    const codes = ["SENT", "OWNER", "active", "CUSTOM_STATUS"];
    expect(codes.map(createI18n("zh-TW").label)).toEqual([
      "已傳送",
      "擁有者",
      "啟用中",
      "CUSTOM_STATUS",
    ]);
    expect(codes).toEqual(["SENT", "OWNER", "active", "CUSTOM_STATUS"]);
    expect(createI18n("zh-TW").label("toString")).toBe("toString");
    expect(createI18n("zh-TW").label("__proto__")).toBe("__proto__");
  });

  it("has complete, plain-text translations with matching interpolation fields", () => {
    const placeholders = (text: string) =>
      [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    for (const [source, translation] of Object.entries(zhTW)) {
      expect(translation.trim(), source).not.toBe("");
      expect(placeholders(translation), source).toEqual(placeholders(source));
      expect(source, source).not.toMatch(/&(?:[a-z]+|#\d+);/i);
    }
  });
});

describe("Russian interface", () => {
  const { t, label } = createI18n("ru");

  it("is a supported preference", () => {
    expect(resolveLocale("ru")).toBe("ru");
    expect(resolveLocale(undefined, "ru")).toBe("ru");
    expect(resolveLocale("de", "ru")).toBe("ru");
  });

  it("keeps exactly the same keys as the other catalog", () => {
    // Catches a stale extra key after copy is removed upstream, which the
    // compile-time check (missing keys only) cannot see.
    expect(Object.keys(ru).sort()).toEqual(Object.keys(zhTW).sort());
  });

  it("has complete, plain-text translations with matching interpolation fields", () => {
    // `{count|пост|поста|постов}` is the same `count` field, with forms.
    const fields = (text: string) =>
      [...new Set([...text.matchAll(/\{(\w+)(?:\|[^{}]*)?\}/g)].map((m) => m[1]))].sort();
    for (const [source, translation] of Object.entries(ru)) {
      expect(translation.trim(), source).not.toBe("");
      expect(fields(translation), source).toEqual(fields(source));
    }
  });

  it("writes every plural as one|few|many", () => {
    for (const translation of Object.values(ru)) {
      for (const [, forms] of translation.matchAll(/\{\w+\|([^{}]*)\}/g)) {
        expect(forms.split("|"), translation).toHaveLength(3);
      }
    }
  });

  it("agrees the noun with the number", () => {
    const campaigns = (count: number) => t("{count} campaigns", { count });
    expect(campaigns(0)).toBe("0 кампаний");
    expect(campaigns(2)).toBe("2 кампании");
    expect(campaigns(5)).toBe("5 кампаний");
    expect(campaigns(11)).toBe("11 кампаний");
    expect(campaigns(21)).toBe("21 кампания");
    expect(campaigns(146)).toBe("146 кампаний");
    expect(t("{count} campaign", { count: 1 })).toBe("1 кампания");
  });

  it("agrees by the number a phrase is actually about", () => {
    // "из 146 кампаний" — the noun follows the total, not the count shown.
    expect(t("{count} of {total} campaigns", { count: 3, total: 146 })).toBe(
      "3 из 146 кампаний",
    );
    expect(t("{count} of {total} campaigns", { count: 1, total: 21 })).toBe(
      "1 из 21 кампании",
    );
  });

  it("reads a pre-formatted count back as a number", () => {
    expect(t("{count} posts", { count: "1\u00a0234" })).toBe("1\u00a0234 поста");
  });

  it("still inserts values verbatim, braces and all", () => {
    expect(t("Hello, {name}!", { name: "{count|a|b|c} $&" })).toBe(
      "Здравствуйте, {count|a|b|c} $&!",
    );
  });

  it("translates status, role and weekday labels", () => {
    expect(["SENT", "FAILED", "OWNER", "active", "Mon"].map(label)).toEqual([
      "Отправлено",
      "С ошибкой",
      "Владелец",
      "В работе",
      "Пн",
    ]);
  });

  it("leaves the other languages untouched by the plural syntax", () => {
    expect(createI18n("en").t("{count} campaigns", { count: 2 })).toBe("2 campaigns");
    expect(createI18n("zh-TW").t("{count} campaigns", { count: 0 })).toBe("0 個活動");
  });
});
