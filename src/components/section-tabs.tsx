import Link from "next/link";

// 한 메뉴 안의 화면 탭 — 외래(명단·템플릿), 설정(일반·병원 연동·엑셀 가져오기)
export const OUTPATIENT_TABS = [
  { href: "/outpatient", label: "외래 명단" },
  { href: "/templates", label: "외래 템플릿" },
];
export const SETTINGS_TABS = [
  { href: "/settings", label: "일반" },
  { href: "/hospital", label: "병원 연동" },
  { href: "/import", label: "엑셀 가져오기" },
];

export function SectionTabs({ tabs, current }: { tabs: { href: string; label: string }[]; current: string }) {
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap ${
            t.href === current
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
