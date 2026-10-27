"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// 상단 메뉴 — 메인(대시보드)·진료(예전 외래)·캘린더·수술환자 관리·일정 알림·설정(사용자 2026-10-24 개편, 메인은 2026-10-25). OTP는 메뉴 대신 오늘의 번호를 바로 보여 준다(2026-10-25).
// match: 이 메뉴에 속하는 화면 주소(하위 화면에서도 지금 어느 메뉴인지 보이게)
const ITEMS = [
  { href: "/dashboard", label: "메인", match: ["/dashboard"] },
  // "외래" → "진료"(입원 타과의뢰도 들어 있음 — 사용자 2026-10-26). /clinic도 이 메뉴(예전엔 빠져서 진료 화면에서 메뉴 표시가 안 됐음)
  // 누르면 바로 외래 진료(/clinic) 화면(사용자 2026-10-27). 명단·템플릿·타과의뢰는 그 안의 탭
  { href: "/clinic", label: "진료", match: ["/clinic", "/outpatient", "/templates", "/consults"] },
  // 진료 브리핑(외래 중 폰에 띄워 두는 화면, 2026-10-26 "폰 진료"에서 이름 바꿈) — 메뉴 안 화면((app)/m, 2026-10-26)
  { href: "/m", label: "진료 브리핑", match: ["/m"] },
  { href: "/calendar", label: "캘린더", match: ["/calendar"] },
  // "환자" → "수술환자 관리"(사용자 2026-10-26). 수술 계획·기록 화면도 이 메뉴
  { href: "/patients", label: "수술환자 관리", match: ["/patients", "/plans", "/records"] },
  { href: "/reminders", label: "일정 알림", match: ["/reminders"] },
  // 수술(다가오는 수술·체크리스트·TSA)은 메뉴에서 빼고 설정 탭으로(사용자 2026-10-26)
  { href: "/settings", label: "설정", match: ["/settings", "/surgery", "/hospital", "/import"] },
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
