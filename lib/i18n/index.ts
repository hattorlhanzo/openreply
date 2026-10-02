import ru from "./ru.json";
import zhTW from "./zh-TW.json";

export const LOCALE_COOKIE = "openreply-locale";
export type Locale = "en" | "zh-TW" | "ru";
export type MessageKey = keyof typeof zhTW;

// Every catalog carries exactly the zh-TW keys: a key missing here is a type
// error, not an English string leaking into a translated page.
const catalogs: Record<Exclude<Locale, "en">, Record<MessageKey, string>> = {
  "zh-TW": zhTW,
  ru: ru satisfies Record<MessageKey, string>,
};

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "zh-TW" || value === "ru";
}

/**
 * `fallback` is what a visitor with no saved choice gets. English unless the
 * deployment says otherwise — see DEFAULT_LOCALE in lib/i18n/server.ts.
 */
export function resolveLocale(value: unknown, fallback: Locale = "en"): Locale {
  return isLocale(value) ? value : fallback;
}

// The order plural forms are written in: `{count|пост|поста|постов}` is
// one|few|many. Languages with fewer categories simply use fewer forms.
const PLURAL_ORDER: Intl.LDMLPluralRule[] = ["one", "few", "many", "other"];

function pluralForm(rules: Intl.PluralRules, forms: string[], value: unknown) {
  // Counts sometimes arrive pre-formatted ("1 234"), so drop group separators
  // before reading the number back.
  const n = Number(String(value).replace(/[\s,]/g, ""));
  const index = PLURAL_ORDER.indexOf(rules.select(Number.isFinite(n) ? n : 0));
  return forms[Math.min(index, forms.length - 1)];
}

type Placeholders<S extends string> =
  S extends `${string}{${infer Name}}${infer Rest}`
    ? Name | Placeholders<Rest>
    : never;
export type StaticMessageKey = {
  [K in MessageKey]: [Placeholders<K>] extends [never] ? K : never;
}[MessageKey];
type MessageArgs<K extends MessageKey> = [Placeholders<K>] extends [never]
  ? []
  : [values: Record<Placeholders<K>, string | number>];

// English is the source language. Only application-owned copy belongs here;
// campaign messages, account names and API values are never translation keys.
const labels: Record<string, StaticMessageKey> = {
  ALL: "All",
  SENT: "Sent",
  FAILED: "Failed",
  PENDING: "Pending",
  SKIPPED_RATE_LIMIT: "Rate limited",
  SKIPPED_PLAN_LIMIT: "Plan limit",
  SKIPPED_DEDUP: "Dedup",
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  all: "All",
  active: "Active",
  paused: "Paused",
  waiting: "Waiting",
  delayed: "Delayed",
  failed: "Failed",
  Mon: "Mon",
  Tue: "Tue",
  Wed: "Wed",
  Thu: "Thu",
  Fri: "Fri",
  Sat: "Sat",
  Sun: "Sun",
};

export function createI18n(locale: Locale) {
  const rules = new Intl.PluralRules(locale);

  function t<K extends MessageKey>(key: K, ...args: MessageArgs<K>): string {
    const message = locale === "en" ? key : catalogs[locale][key];
    const values = args[0] as Record<string, string | number> | undefined;
    // One pass over the template, so a value that itself contains braces is
    // inserted verbatim and never read as another placeholder. `{name|a|b|c}`
    // picks a plural form by the value of `name` — Russian needs three where
    // English gets by with a singular key and a plural key.
    return message.replace(
      /\{(\w+)(?:\|([^{}]*))?\}/g,
      (placeholder, name: string, forms: string | undefined) => {
        const value = values?.[name];
        if (value === undefined) return placeholder;
        return forms === undefined
          ? String(value)
          : pluralForm(rules, forms.split("|"), value);
      },
    );
  }

  return {
    locale,
    t,
    label: (value: string) =>
      Object.hasOwn(labels, value) ? t(labels[value]) : value,
  };
}

export type I18n = ReturnType<typeof createI18n>;
