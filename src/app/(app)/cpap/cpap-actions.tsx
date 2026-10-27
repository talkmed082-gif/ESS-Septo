"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buttonStyles } from "@/lib/ui";
import { checkCpapMail, registerCpapRx } from "@/app/actions/cpap";
import { CPAP_VENDORS, cpapRxText, smsHref } from "@/lib/cpap";

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

type Pt = { date: string; time: string; name: string; chartNo: string; sex: string; age: string };

// CPAP 처방 나갈 때(사용자 2026-10-27): 환자 고르기 → 실명·연락처·AHI·회사 → [문자 열기](회사 담당자에게 의뢰 문자, 폰에서 직접 전송) + [OSA 시트 등록].
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
      <p className="font-medium">CPAP 처방 — 회사 의뢰 문자·OSA 시트 등록</p>
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
              const r = await registerCpapRx({ date: today, chartNo: pt!.chartNo, name, sex, age, phone, ahi, vendor });
              setMsg(r.ok ? "OSA 시트에 등록했습니다" : (r.error ?? "등록하지 못했습니다."));
              if (r.ok) router.refresh();
            })
          }
        >
          OSA 시트 등록
        </button>
        {msg && <span className="text-xs">{msg}</span>}
      </div>
    </div>
  );
}
