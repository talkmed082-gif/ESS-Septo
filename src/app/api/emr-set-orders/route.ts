import { NextResponse } from "next/server";
import { pcJson } from "@/lib/pc-api";
import { findUserForProgram } from "@/lib/device-auth";
import { EmrSetOrderBodySchema } from "@/lib/outpatient-templates";
import { replaceEmrSetOrders } from "@/lib/outpatient-templates-store";
import { prisma } from "@/lib/prisma";
import { groupClinicSets } from "@/lib/set-groups";

// 진료실 PC 프로그램이 지금 YES에 로그인한 사람(사번)의 약속처방 트리를 올리는 입구.
// 다른 사람이 자기 아이디로 로그인한 PC에서 올리면 그 사람 세트가 내 계정에 따로 쌓인다.
export async function POST(request: Request) {
  const user = await findUserForProgram(request);
  if (!user) return new NextResponse("Not found", { status: 404 });

  const parsed = EmrSetOrderBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: "형식이 올바르지 않습니다." }, { status: 400 });
  return pcJson(await replaceEmrSetOrders(user.id, parsed.data));
}

// GET: 진료 어시스트 [약물치료]·[오더] 버튼 — 올려 둔 약속처방 중 코 외래 폴더를 성인/소아 · 약/오더로(src/lib/set-groups)
export async function GET(request: Request) {
  const user = await findUserForProgram(request);
  if (!user) return new NextResponse("Not found", { status: 404 });
  const rows = await prisma.emrSetOrder.findMany({ where: { createdById: user.id }, orderBy: { seq: "asc" }, select: { key: true, name: true, path: true, ownerEmpNo: true } });
  return pcJson(groupClinicSets(rows));
}
