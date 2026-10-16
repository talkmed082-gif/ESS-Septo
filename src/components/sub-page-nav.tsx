import Link from "next/link";
import { buttonStyles } from "@/lib/ui";

// 하위 화면(인쇄·기록지 등) 맨 위 이동 링크 — "돌아가기"는 늘 환자 목록(환자 선택)으로 가고,
// 다른 화면으로 가는 링크는 "수술 계획 화면"처럼 이름으로 쓴다. 예전엔 "계획으로 돌아가기"처럼
// 앞으로 가는 링크도 "돌아가기"라고 써서 메뉴 이동이 헷갈렸다(사용자 2026-10-16).
export function SubPageNav({ links = [] }: { links?: { href: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <Link href="/patients" className={buttonStyles.link}>
        ← 환자 목록
      </Link>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={buttonStyles.link}>
          {l.label}
        </Link>
      ))}
    </div>
  );
}
