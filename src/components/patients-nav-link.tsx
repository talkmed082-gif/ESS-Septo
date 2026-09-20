"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

// 검색/정렬 중이던 상태에서 눌러도 항상 깨끗한 기본 목록으로 돌아가고,
// 다른 화면에서 방금 바뀐 데이터도 캐시 없이 새로 받아오게 한다.
export function PatientsNavLink() {
  const router = useRouter();

  return (
    <Link
      href="/patients"
      onClick={(e) => {
        e.preventDefault();
        router.push("/patients");
        router.refresh();
      }}
      className="text-sm text-slate-600 hover:text-slate-900"
    >
      환자
    </Link>
  );
}
