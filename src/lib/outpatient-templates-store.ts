import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CHILD_TEMPLATES, DEFAULT_TEMPLATES, parseSetOrderRefs, type Audience, type EmrSetOrderBody } from "@/lib/outpatient-templates";

// 내 외래 템플릿(정한 순서 → 만든 순서). setOrders는 형식을 확인해 돌려준다
export async function getOutpatientTemplates(userId: string) {
  const rows = await prisma.outpatientTemplate.findMany({
    where: { createdById: userId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(({ createdById: _c, createdAt: _a, ...t }) => ({ ...t, setOrders: parseSetOrderRefs(t.setOrders) }));
}

// 그 대상(성인/소아) 템플릿이 하나도 없을 때만 기본 초안을 만든다(두 번 눌러도 겹치지 않게)
export async function createDefaultOutpatientTemplates(userId: string, audience: Audience = "adult") {
  const count = await prisma.outpatientTemplate.count({ where: { createdById: userId, audience } });
  if (count > 0) return 0;
  const drafts = audience === "child" ? DEFAULT_CHILD_TEMPLATES : DEFAULT_TEMPLATES;
  const r = await prisma.outpatientTemplate.createMany({
    data: drafts.map((t) => ({ ...t, setOrders: [], createdById: userId })),
  });
  return r.count;
}

// 진료실 PC가 올린 약속처방 목록으로 그 사번 것을 통째로 바꾼다(EMR에서 지운 세트는 여기서도 빠진다)
export async function replaceEmrSetOrders(userId: string, body: EmrSetOrderBody) {
  const now = new Date();
  await prisma.$transaction([
    prisma.emrSetOrder.deleteMany({ where: { createdById: userId, ownerEmpNo: body.ownerEmpNo } }),
    prisma.emrSetOrder.createMany({
      data: body.items.map((i, seq) => ({
        seq,
        ownerEmpNo: body.ownerEmpNo,
        ownerName: body.ownerName,
        key: i.key,
        path: i.path,
        name: i.name,
        level: i.level,
        lines: i.lines ?? undefined,
        createdById: userId,
        syncedAt: now,
      })),
      skipDuplicates: true,
    }),
  ]);
  return { ownerEmpNo: body.ownerEmpNo, count: body.items.length };
}

// 템플릿 화면의 약속처방 고르기용 목록(사번별, EMR 트리 순서 = 올린 순서)
export function getEmrSetOrders(userId: string) {
  return prisma.emrSetOrder.findMany({
    where: { createdById: userId },
    orderBy: [{ ownerEmpNo: "asc" }, { seq: "asc" }],
    select: { ownerEmpNo: true, ownerName: true, key: true, path: true, name: true, level: true, syncedAt: true },
  });
}
