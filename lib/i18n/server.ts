import { cache } from "react";
import { cookies } from "next/headers";
import { createI18n, LOCALE_COOKIE, resolveLocale } from "./index";

// What a visitor sees before choosing a language — a colleague opening the
// sign-in page for the first time, say. Unset or unsupported means English,
// exactly as before; a saved choice in the cookie always wins over this.
const defaultLocale = () => resolveLocale(process.env.DEFAULT_LOCALE);

export const getI18n = cache(async () => {
  const cookieStore = await cookies();
  return createI18n(
    resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value, defaultLocale()),
  );
});
