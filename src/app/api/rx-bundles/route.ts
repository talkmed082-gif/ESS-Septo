import { NextResponse } from "next/server";
import * as z from "zod";
import { pcJson } from "@/lib/pc-api";
import { findUserForProgram } from "@/lib/device-auth";
import { calcPedItem, withVisitDays } from "@/lib/rx-bundles";
import { kstDate } from "@/lib/hospital-link";
import { getRxBundles } from "@/lib/rx-bundles-store";

// GET: 진료실 프로그램이 처방 묶음 목록을 받아 간다
export async function GET(request: Request) {
  const user = await findUserForProgram(request);
  if (!user) return new NextResponse("Not found", { status: 404 });
  return pcJson({ bundles: await getRxBundles(user.id) });
}

// POST {bundleId, ageMonths, weightKg, nextVisit?}: 소아 묶음의 1회량·용법 계산(KIMS 허가 용량 규칙). 성인 묶음은 그대로 돌려줌.
// nextVisit(고른 다음 외래)이 있으면 "외래까지 늘리기" 약만 days = 오늘부터 그날까지 일수(서울 기준). 나머지 약은 정해진 기간 그대로
const CalcSchema = z.object({
  bundleId: z.string().min(1).max(40),
  ageMonths: z.number().min(0).max(240).nullable(),
  weightKg: z.number().min(0.5).max(200).nullable(),
  nextVisit: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});
export async function POST(request: Request) {
  const user = await findUserForProgram(request);
  if (!user) return new NextResponse("Not found", { status: 404 });
  const parsed = CalcSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: "형식이 올바르지 않습니다." }, { status: 400 });
  const b = (await getRxBundles(user.id)).find((x) => x.id === parsed.data.bundleId);
  if (!b) return pcJson({ error: "묶음이 없습니다." }, { status: 404 });
  const { ageMonths, weightKg, nextVisit } = parsed.data;
  const items = b.items.map((i) =>
    b.audience === "child"
      ? ageMonths == null
        ? { code: i.code, name: i.name, dose: "", freq: "", days: i.days, untilVisit: i.untilVisit, use: false, why: "나이 필요" }
        : calcPedItem(i, ageMonths, weightKg)
      : { code: i.code, name: i.name, dose: i.dose, freq: i.freq, days: i.days, untilVisit: i.untilVisit, use: true, why: i.note },
  );
  return pcJson({ title: b.title, audience: b.audience, items: withVisitDays(items, kstDate(new Date()), nextVisit) });
}
