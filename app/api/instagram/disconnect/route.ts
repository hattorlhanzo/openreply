import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";
import { API_ERRORS } from "@/lib/i18n/common";

export async function POST(request: NextRequest) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json(
      { success: false, error: API_ERRORS.unauthorized },
      { status: 401 }
    );
  }

  if (!canManageWorkspace(context.role)) {
    return NextResponse.json(
      { success: false, error: API_ERRORS.ownersAndAdminsOnlyDisconnect },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const instagramAccountId =
    typeof body.instagramAccountId === "string" ? body.instagramAccountId : null;

  await prisma.instagramAccount.deleteMany({
    where: {
      workspaceId: context.workspaceId,
      ...(instagramAccountId ? { id: instagramAccountId } : {}),
    },
  });

  return NextResponse.json({ success: true });
}
