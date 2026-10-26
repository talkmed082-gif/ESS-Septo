"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// 상단 메뉴 — 메인(대시보드)·진료(예전 외래)·수술·캘린더·환자·일정 알림·설정(사용자 2026-10-24 개편, 메인은 2026-10-25). OTP는 메뉴 대신 오늘의 번호를 바로 보여 준다(2026-10-25).
// match: 이 메뉴에 속하는 화면 주소(하위 화면에서도 지금 어느 메뉴인지 보이게)
const ITEMS = [
  { href: "/dashboard", label: "메인", match: ["/dashboard"] },
  // "외래" → "진료"(입원 타과의뢰도 들어 있음 — 사용자 2026-10-26). /clinic도 이 메뉴(예전엔 빠져서 진료 화면에서 메뉴 표시가 안 됐음)
  { href: "/outpatient", label: "진료", match: ["/clinic", "/outpatient", "/templates", "/consults"] },
  // 진료 브리핑(외래 중 폰에 띄워 두는 화면, 2026-10-26 "폰 진료"에서 이름 바꿈) — 메뉴 없는 따로 화면이라 여기서 들어간다
  { href: "/m", label: "진료 브리핑", match: ["/m"] },
  { href: "/surgery", label: "수술", match: ["/surgery", "/plans", "/records"] },
  { href: "/calendar", label: "캘린더", match: ["/calendar"] },
  { href: "/patients", label: "환자", match: ["/patients"] },
  { href: "/reminders", label: "일정 알림", match: ["/reminders"] },
  { href: "/settings", label: "설정", match: ["/settings", "/hospital", "/import"] },
];

export function AppNavLinks() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {ITEMS.map((item) => {
        const active = item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            // 환자: 검색/정렬 중이던 상태에서 눌러도 깨끗한 기본 목록으로, 다른 화면에서 바뀐 데이터도 새로 받아온다
            onClick={
              item.href === "/patients"
                ? (e) => {
                    e.preventDefault();
                    router.push("/patients");
                    router.refresh();
                  }
                : undefined
            }
            className={`shrink-0 rounded-md px-3 py-1.5 text-sm whitespace-nowrap ${
              active ? "bg-slate-900 font-medium text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
