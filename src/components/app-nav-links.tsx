"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// 상단 메뉴 — 메인·외래 진료 관리·타과의뢰·캘린더·수술환자 관리·설정(사용자 2026-10-27 개편).
// "진료" → "외래 진료 관리"(날짜별 외래 전 준비·진행 중·외래 후, 진료 브리핑도 그 안), 타과의뢰는 따로, 일정 알림은 캘린더 아래로 합침.
// OTP는 메뉴 대신 오늘의 번호를 바로 보여 준다(2026-10-25).
// match: 이 메뉴에 속하는 화면 주소(하위 화면에서도 지금 어느 메뉴인지 보이게)
const ITEMS = [
  { href: "/dashboard", label: "메인", match: ["/dashboard"] },
  // 순서(사용자 2026-10-27): 메인 · 외래 진료 관리 · 수술환자 관리 · 타과의뢰 · 캘린더 · 설정
  { href: "/clinic", label: "외래 진료 관리", match: ["/clinic", "/outpatient", "/cpap", "/m"] },
  // "환자" → "수술환자 관리"(사용자 2026-10-26). 수술 계획·기록 화면도 이 메뉴
  { href: "/patients", label: "수술환자 관리", match: ["/patients", "/plans", "/records"] },
  { href: "/consults", label: "타과의뢰", match: ["/consults"] },
  { href: "/er", label: "응급실", match: ["/er"] },
  { href: "/calendar", label: "캘린더", match: ["/calendar", "/reminders"] },
  // 외래 템플릿·수술 관련 설정은 설정의 외래·수술 탭(2026-10-27)
  { href: "/settings", label: "설정", match: ["/settings", "/surgery", "/hospital", "/import", "/templates", "/surgery-types"] },
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
