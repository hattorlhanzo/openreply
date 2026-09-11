import { redirect } from "next/navigation";

// Маркетингового лендинга у СМАРТУЧЕТ нет: корень ведёт в кабинет, а
// proxy.ts отправит неавторизованного на /login.
export default function RootPage() {
  redirect("/dashboard");
}
