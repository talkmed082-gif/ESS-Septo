"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { kstDate, type OutpatientRow } from "@/lib/hospital-link";
import { callOsaScript } from "@/lib/osa-script";
import { CpapSchema, cpapMailQuery, isCpapFollowUp } from "@/lib/cpap";

// 설정 → OSA 시트 연결(웹앱 주소·키). 저장하면 바로 열 이름을 읽어 확인
export async function saveOsaScript(input: unknown): Promise<{ ok: boolean; error?: string; headers?: string[]; sheet?: string }> {
  const { userId } = await verifySession();
  const p = z.object({ url: z.string().trim().regex(/^https:\/\/script\.google\.com\/\S+$/), key: z.string().trim().min(8).max(200) }).safeParse(input);
  if (!p.success) return { ok: false, error: "웹앱 주소(https://script.google.com/…)와 키(8자 이상)를 넣어 주세요." };
  await prisma.user.update({ where: { id: userId }, data: { osaScriptUrl: p.data.url, osaScriptKey: p.data.key } });
  const r = await callOsaScript(userId, { action: "headers" });
  revalidatePath("/settings");
  if (r.error) return { ok: false, error: String(r.error) };
  return { ok: true, headers: (r.headers as string[]) ?? [], sheet: String(r.sheet ?? "") };
}

// CPAP 처방 등록 — OSA 시트에 한 줄(열 이름에 맞춰). 연락처·AHI는 사이트에 저장하지 않고 시트로만. 실명은 그 환자 PatientCare.cpap에 남김(F/U 문자용)
const RxSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  chartNo: z.string().trim().regex(/^\d{4,12}$/),
  name: z.string().trim().min(1).max(30),
  sex: z.string().trim().max(10),
  age: z.string().trim().max(20),
  phone: z.string().trim().max(30),
  ahi: z.string().trim().max(20),
  vendor: z.string().regex(/^[A-Z]{2}$/),
});
export async function registerCpapRx(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await verifySession();
  const p = RxSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "이름·등록번호·회사를 확인해 주세요." };
  const d = p.data;
  // 시트 열 이름은 시트마다 다를 수 있어 흔한 이름을 여럿 같이 보낸다(없는 열은 웹앱이 무시)
  const values: Record<string, string> = {};
  for (const k of ["날짜", "처방일", "의뢰일"]) values[k] = d.date;
  for (const k of ["이름", "성명", "환자명"]) values[k] = d.name;
  for (const k of ["등록번호", "환자번호"]) values[k] = d.chartNo;
  for (const k of ["성별"]) values[k] = d.sex;
  for (const k of ["나이"]) values[k] = d.age;
  for (const k of ["성별/나이"]) values[k] = `${d.sex}/${d.age}`;
  for (const k of ["연락처", "전화번호", "핸드폰"]) values[k] = d.phone;
  for (const k of ["AHI"]) values[k] = d.ahi;
  for (const k of ["회사", "양압기 회사", "업체"]) values[k] = d.vendor;
  const r = await callOsaScript(userId, { action: "append", values });
  if (r.error) return { ok: false, error: r.error === "no matching columns" ? `시트 열 이름이 맞지 않습니다: ${(r.headers as string[] | undefined)?.join(", ")}` : String(r.error) };
  const old = await prisma.patientCare.findUnique({ where: { createdById_chartNo: { createdById: userId, chartNo: d.chartNo } }, select: { cpap: true } });
  const prev = CpapSchema.safeParse(old?.cpap ?? {});
  const cpap = { ...(prev.success ? prev.data : CpapSchema.parse({})), vendor: d.vendor, realName: d.name };
  await prisma.patientCare.upsert({
    where: { createdById_chartNo: { createdById: userId, chartNo: d.chartNo } },
    create: { createdById: userId, chartNo: d.chartNo, cpap },
    update: { cpap },
  });
  revalidatePath("/cpap");
  return { ok: true };
}

// [메일 확인] — 앞으로의 CPAP F/U 환자마다 Gmail에서 양압기 결과 메일을 찾아 기록
export async function checkCpapMail(): Promise<{ ok: boolean; error?: string; checked?: number }> {
  const { userId } = await verifySession();
  const today = kstDate(new Date());
  const lists = await prisma.outpatientList.findMany({ where: { createdById: userId, date: { gte: today } }, select: { date: true, rows: true } });
  const visits = lists.flatMap((l) => (l.rows as OutpatientRow[]).map((r) => ({ date: l.date, chartNo: r.chartNo })));
  const cares = await prisma.patientCare.findMany({ where: { createdById: userId, chartNo: { in: [...new Set(visits.map((v) => v.chartNo))] } }, select: { chartNo: true, cpap: true } });
  const queries: { id: string; q: string }[] = [];
  const parsed = new Map<string, z.infer<typeof CpapSchema>>();
  for (const c of cares) {
    const p = CpapSchema.safeParse(c.cpap);
    if (!p.success) continue;
    const v = visits.find((x) => x.chartNo === c.chartNo && isCpapFollowUp(p.data, x.date));
    const q = v ? cpapMailQuery(p.data, v.date) : null;
    if (q) { queries.push({ id: c.chartNo, q }); parsed.set(c.chartNo, p.data); }
  }
  if (!queries.length) return { ok: true, checked: 0 };
  const r = await callOsaScript(userId, { action: "mail", queries });
  if (r.error) return { ok: false, error: String(r.error) };
  const now = new Date().toISOString();
  for (const x of (r.results as { id: string; hits: { date: string; subject: string }[] }[]) ?? []) {
    const c = parsed.get(x.id);
    if (!c) continue;
    await prisma.patientCare.update({
      where: { createdById_chartNo: { createdById: userId, chartNo: x.id } },
      data: { cpap: { ...c, mail: { checkedAt: now, hits: x.hits.slice(0, 5).map((h) => ({ date: h.date, subject: h.subject.slice(0, 120) })) } } },
    });
  }
  revalidatePath("/cpap");
  return { ok: true, checked: queries.length };
}
