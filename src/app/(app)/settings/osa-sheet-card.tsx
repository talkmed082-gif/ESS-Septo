"use client";

import { useState, useTransition } from "react";
import { buttonStyles } from "@/lib/ui";
import { saveOsaScript } from "@/app/actions/cpap";

// 설정 → OSA 시트 연결(사용자 2026-10-27) — 구글 OSA 시트에 붙인 웹앱(osa_sheet_app.gs)의 주소와 키. 저장하면 시트 열 이름을 읽어 보여 준다
export function OsaSheetCard({ connected }: { connected: boolean }) {
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";
  return (
    <div className="space-y-2 text-sm">
      <p className="text-slate-500">{connected ? "연결됨 — 바꾸려면 다시 넣으세요." : "CPAP 처방 등록·양압기 결과 메일 확인에 씁니다."}</p>
      <input className={input} placeholder="웹 앱 URL (https://script.google.com/…/exec)" value={url} onChange={(e) => setUrl(e.target.value)} />
      <input className={input} placeholder="키(스크립트의 KEY와 같게)" type="password" value={key} onChange={(e) => setKey(e.target.value)} />
      <button
        type="button"
        className={buttonStyles.secondarySmall}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await saveOsaScript({ url, key });
            setMsg(r.ok ? `연결됨 — 시트 "${r.sheet}" 열: ${r.headers?.join(", ") || "(비어 있음)"}` : (r.error ?? "연결하지 못했습니다."));
            if (r.ok) setKey("");
          })
        }
      >
        저장하고 확인
      </button>
      {msg && <p className="text-xs">{msg}</p>}
    </div>
  );
}
