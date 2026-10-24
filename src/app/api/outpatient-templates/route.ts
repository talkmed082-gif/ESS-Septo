import { NextResponse } from "next/server";
import { pcJson } from "@/lib/pc-api";
import { findUserForProgram } from "@/lib/device-auth";
import { getOutpatientTemplates } from "@/lib/outpatient-templates-store";

// 진료실 PC 프로그램이 시작할 때 내 외래 템플릿을 받아 가는 입구
export async function GET(request: Request) {
  const user = await findUserForProgram(request);
  if (!user) return new NextResponse("Not found", { status: 404 });
  return pcJson({ templates: await getOutpatientTemplates(user.id) });
}
