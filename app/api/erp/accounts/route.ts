import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { erpDenied, erpError, erpKeyMatches } from "@/lib/erp-auth";

export const dynamic = "force-dynamic";

// Аккаунты, которые бизнес СМАРТУЧЕТА вправе подключить: те, что лежат в рабочих
// пространствах, где участник — человек с этой почтой. Вход в OpenReply — по
// ссылке на почту, так что совпадение почты и есть доказательство владения.
export async function GET(request: NextRequest) {
  if (!erpKeyMatches(request)) return erpDenied();
  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email) return erpError("email required", 400);

  const accounts = await prisma.instagramAccount.findMany({
    where: {
      workspace: {
        OR: [
          { owner: { email: { equals: email, mode: "insensitive" } } },
          { members: { some: { user: { email: { equals: email, mode: "insensitive" } } } } },
        ],
      },
    },
    select: { instagramId: true, username: true, name: true },
    orderBy: { connectedAt: "desc" },
  });
  return NextResponse.json({ success: true, data: { accounts } });
}
