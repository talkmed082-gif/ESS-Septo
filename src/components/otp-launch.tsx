"use client";

import { useState } from "react";
import Link from "next/link";

// 오늘의 번호를 누르면 진료실 PC의 진료 어시스트를 켜고 그 번호로 바로 연결(사용자 2026-10-27).
// 프로그램이 처음 켜질 때 C:\.opdh\에 복사되고 opdhelper: 주소를 등록한다 — 등록 전(이 PC에 없음)이면 1.5초 안에 창이 바뀌지 않으므로 내려받기.
// Windows가 아니면(폰) 예전처럼 설정의 번호 칸으로
export function OtpLaunch({ code }: { code: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const cls = "shrink-0 rounded-md bg-emerald-50 px-2 py-1 font-mono text-sm font-semibold tracking-widest whitespace-nowrap text-emerald-800";
  const label = `${code.slice(0, 3)} ${code.slice(3)}`;
  const launch = (e: React.MouseEvent) => {
    if (!/Windows/i.test(navigator.userAgent)) return; // 폰·맥: 링크 그대로(설정)
    e.preventDefault();
    let left = false;
    const onBlur = () => { left = true; };
    window.addEventListener("blur", onBlur, { once: true });
    window.location.href = `opdhelper://open?code=${code}`;
    // 크롬은 처음 한 번 "열까요?"를 묻는데 그동안 창이 안 바뀐다 → 바로 내려받지 않고 버튼을 보여 준다(설치된 PC에서 괜히 받지 않게)
    setTimeout(() => {
      window.removeEventListener("blur", onBlur);
      setMsg(left ? null : "show");
    }, 3000);
  };
  return (
    <span className="relative shrink-0">
      <Link href="/settings#otp" onClick={launch} title="누르면 진료 어시스트를 켜고 이 번호로 연결(서울 자정에 바뀜)" className={cls}>
        {label}
      </Link>
      {msg && (
        <span className="absolute top-full right-0 z-50 mt-1 w-64 space-y-1 rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-600 shadow">
          <span className="block">진료 어시스트가 안 켜졌으면 이 PC에 없는 것입니다. 받은 파일을 한 번 실행하면 다음부터 번호만 누르면 켜집니다.</span>
          <a href="/templates/download" className="inline-block rounded bg-emerald-700 px-2 py-1 text-white" onClick={() => setMsg(null)}>
            내려받기
          </a>{" "}
          <button type="button" className="underline" onClick={() => setMsg(null)}>닫기</button>
        </span>
      )}
    </span>
  );
}
