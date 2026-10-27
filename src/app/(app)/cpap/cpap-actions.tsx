"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buttonStyles } from "@/lib/ui";
import { checkCpapMail, rememberCpapRx } from "@/app/actions/cpap";
import { recordCpapNotice } from "@/app/actions/clinic-plan";
import { CPAP_VENDORS, cpapNoticeText, cpapRxText, pressureOf, smsHref } from "@/lib/cpap";

// [메일 확인] — 앞으로의 CPAP F/U 환자 결과 메일을 Gmail(OSA 시트 웹앱)에서 찾는다
export function MailCheckButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2 text-xs">
      <button
        type="button"
        className={buttonStyles.secondarySmall}
        disabled={pending}
        onClick={() => start(async () => { const r = await checkCpapMail(); setMsg(r.ok ? `${r.checked}명 확인함` : (r.error ?? "확인하지 못했습니다.")); router.refresh(); })}
      >
        {pending ? "메일 찾는 중…" : "결과 메일 확인"}
      </button>
      {msg && <span className="text-slate-500">{msg}</span>}
    </span>
  );
}

// 외래 후 처방 안내 문자(사용자 2026-10-27) — 개월(기본 3)·압력(지금 설정이 기본, 바꾸면 "압력 ○으로 변경해서")을 고르고 [처방 안내 문자] → 폰 문자 창
// 누르면 보낸 기록을 남기고 다음 F/U를 그 외래 날짜 + 개월로 다시 잡는다(recordCpapNotice)
export function CpapNoticeSms({ name, tel, setting, chartNo, date, sentAt }: { name: string; tel: string; setting: string | null; chartNo: string; date: string; sentAt: string | null }) {
  const base = pressureOf(setting);
  const [months, setMonths] = useState(3);
  const [pressure, setPressure] = useState(base);
  const changed = pressure.trim() !== "" && pressure.trim() !== base;
  const text = cpapNoticeText({ name, months, pressure: changed ? pressure.trim() : null });
  return (
    <span className="flex flex-wrap items-center gap-1">
      <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="rounded border border-slate-300 px-1 py-0.5" aria-label="처방 개월">
        {[1, 2, 3, 6, 12].map((m) => <option key={m} value={m}>{m}개월</option>)}
      </select>
      <input value={pressure} onChange={(e) => setPressure(e.target.value)} className="w-16 rounded border border-slate-300 px-1 py-0.5" aria-label="압력" placeholder="압력" />
      <a href={smsHref(tel, text)} onClick={() => void recordCpapNotice({ chartNo, date, months, pressure: changed ? pressure.trim() : null, text })} className="rounded bg-emerald-700 px-2 py-1 text-white" title={text}>
        처방 안내 문자
      </a>
      {sentAt && <span className="text-xs text-emerald-700">✓ {sentAt} 보냄</span>}
      <span className="basis-full text-[11px] text-slate-500">{text}</span>
    </span>
  );
}

type Pt = { date: string; time: string; name: string; chartNo: string; sex: string; age: string };

// CPAP 처방 나갈 때(사용자 2026-10-27): 환자 고르기 → 실명·연락처·AHI·회사 → [문자 열기](회사 담당자에게 의뢰 문자, 폰에서 직접 전송) + [시트용 복사](OSA 시트는 남의 것이라 붙여넣기만).
// 연락처·AHI는 사이트에 저장하지 않는다(문자·시트로만). 실명은 F/U 문자용으로 그 환자에게만 남김
export function CpapRxForm({ patients, today }: { patients: Pt[]; today: string }) {
  const router = useRouter();
  const [chart, setChart] = useState("");
  const pt = patients.find((p) => `${p.date}|${p.chartNo}` === chart);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [ahi, setAhi] = useState("");
  const [vendor, setVendor] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const sex = pt?.sex === "M" ? "남" : pt?.sex === "F" ? "여" : (pt?.sex ?? "");
  const age = (pt?.age ?? "").replace(/세$/, "");
  const text = cpapRxText({ name: name || "○○○", sex: sex || "?", age: age ? `${age}세` : "?", phone: phone || "연락처", ahi: ahi || "?" });
  const tel = vendor ? CPAP_VENDORS[vendor]?.tel : null;
  const input = "rounded-md border border-slate-300 px-2 py-1.5 text-sm";

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-sm">
      <p className="font-medium">CPAP 처방 — 회사 의뢰 문자·OSA 시트용 복사</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <select className={input} value={chart} onChange={(e) => { setChart(e.target.value); setMsg(null); }} aria-label="환자">
          <option value="">환자 고르기(외래 명단)</option>
          {patients.map((p) => (
            <option key={`${p.date}|${p.chartNo}`} value={`${p.date}|${p.chartNo}`}>
              {p.date === today ? "오늘" : p.date.slice(5)} {p.time} {p.name} {p.chartNo}
            </option>
          ))}
        </select>
        <input className={input} placeholder="실명(문자·시트에 들어감)" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={input} placeholder="환자 연락처" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className={input} placeholder="AHI" inputMode="decimal" value={ahi} onChange={(e) => setAhi(e.target.value)} />
        <select className={input} value={vendor} onChange={(e) => setVendor(e.target.value)} aria-label="양압기 회사">
          <option value="">회사 고르기</option>
          {Object.entries(CPAP_VENDORS).map(([k, v]) => (
            <option key={k} value={k}>{k}{v.tel ? ` (${v.tel})` : " (연락처 모름)"}</option>
          ))}
        </select>
      </div>
      <p className="whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs text-slate-700">{text}</p>
      <p className="text-[11px] text-slate-500">시트용 한 줄: 날짜 · 이름 · 등록번호 · 성별/나이 · 연락처 · AHI · 회사</p>
      <div className="flex flex-wrap items-center gap-2">
        {tel && name && pt ? (
          <a href={smsHref(tel, text)} className={buttonStyles.accent}>문자 열기({vendor})</a>
        ) : (
          <span className="text-xs text-slate-400">환자·실명·회사(연락처 있는 곳)를 고르면 문자 버튼이 생깁니다</span>
        )}
        <button
          type="button"
          className={buttonStyles.secondarySmall}
          disabled={pending || !pt || !name || !vendor}
          onClick={() =>
            start(async () => {
              // 탭으로 나눈 한 줄 — 구글 시트 빈 줄 첫 칸에 붙이면 칸별로 들어간다
              const row = [today, name, pt!.chartNo, `${sex}/${age}`, phone, ahi, vendor].join("\t");
              let copied = false;
              try { await navigator.clipboard.writeText(row); copied = true; } catch { /* 권한 없으면 안내만 */ }
              const r = await rememberCpapRx({ chartNo: pt!.chartNo, name, vendor });
              setMsg(copied ? "복사했습니다 — OSA 시트 빈 줄 첫 칸에서 Ctrl+V" : "복사가 막혔습니다(브라우저 권한) — 다시 눌러 주세요");
              if (!r.ok) setMsg((m) => `${m} (회사·실명 저장 실패: ${r.error})`);
              router.refresh();
            })
          }
        >
          시트용 복사
        </button>
        {msg && <span className="text-xs">{msg}</span>}
      </div>
    </div>
  );
}
