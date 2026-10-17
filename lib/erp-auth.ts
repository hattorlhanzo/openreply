/**
 * Служебный доступ СМАРТУЧЕТА (ERP) к Instagram-перепискам.
 *
 * CRM СМАРТУЧЕТА показывает директ рядом с WhatsApp и отвечает из него. Сессии
 * Auth.js у бэкенда ERP нет, поэтому он ходит с заголовком `X-Erp-Key: $ERP_API_KEY`.
 * Ключ платформенный: видит любой подключённый аккаунт, поэтому какой аккаунт
 * принадлежит какому бизнесу, решает ERP — по почте участника рабочего
 * пространства (см. app/api/erp/accounts). Ключ живёт только в env обеих сторон.
 */

import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";

export function erpKeyMatches(request: NextRequest): boolean {
  const expected = process.env.ERP_API_KEY;
  // Пустой ключ не открывает ничего, иначе пустой заголовок прошёл бы.
  if (!expected) return false;
  const presented = request.headers.get("x-erp-key") ?? "";
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Ответ на чужой или пустой ключ: без ключа в env ручек будто нет. */
export function erpDenied(): NextResponse {
  return NextResponse.json(
    { success: false, error: "Unauthorized" },
    { status: process.env.ERP_API_KEY ? 401 : 404 }
  );
}

export function erpError(message: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function erpAccount(instagramId: string | null) {
  if (!instagramId) return null;
  return prisma.instagramAccount.findUnique({ where: { instagramId } });
}
