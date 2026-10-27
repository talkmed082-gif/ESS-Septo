import Link from "next/link";

// 한 메뉴 안의 화면 탭.
// 외래 진료 관리(사용자 2026-10-27): 날짜별 외래 전 준비(명단·인쇄) · 외래 진행 중(진료 화면·진료 브리핑) · 외래 후(OSA·CPAP 안내, 수술환자 정리).
// 고른 날짜를 탭 사이에 들고 다닌다. 타과의뢰는 상단 메뉴로 따로, 외래 템플릿은 설정 > 외래
export function clinicTabs(date?: string) {
  const q = date ? `?date=${date}` : "";
  return [
    { href: `/outpatient${q}`, label: "외래 전 준비" },
    { href: `/clinic${q}`, label: "외래 진행 중" },
    { href: `/cpap${q}`, label: "외래 후" },
  ];
}
// 설정(2026-10-27): 일반 · 외래(외래 템플릿) · 수술(다가오는 수술·체크리스트·TSA·수술명 표기·수술 종류) · 병원 연동 · 엑셀 가져오기
export const SETTINGS_TABS = [
  { href: "/settings", label: "일반" },
  { href: "/templates", label: "외래" },
  { href: "/surgery", label: "수술" },
  { href: "/hospital", label: "병원 연동" },
  { href: "/import", label: "엑셀 가져오기" },
];

// current: 지금 화면 주소(쿼리 없이) — 탭 주소의 경로 부분과 비교
export function SectionTabs({ tabs, current }: { tabs: { href: string; label: string }[]; current: string }) {
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap ${
            t.href.split("?")[0] === current
              ? "border-slate-900 font-medium text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
