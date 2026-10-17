import { NextRequest, NextResponse } from "next/server";
import { API_ERRORS } from "@/lib/i18n/common";
import { duplicateCampaign } from "@/lib/campaigns/duplicate";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";

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
      { success: false, error: API_ERRORS.ownersAndAdminsOnlyCampaigns },
      { status: 403 }
    );
  }

  const automationId = request.nextUrl.searchParams.get("id");
  if (!automationId) {
    return NextResponse.json(
      { success: false, error: API_ERRORS.missingCampaignId },
      { status: 400 }
    );
  }

  const duplicate = await duplicateCampaign({
    automationId,
    workspaceId: context.workspaceId,
  });

  if (!duplicate) {
    return NextResponse.json(
      { success: false, error: API_ERRORS.campaignNotFound },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { success: true, data: duplicate },
    { status: 201 }
  );
}
