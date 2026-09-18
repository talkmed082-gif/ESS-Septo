import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { logout } from "@/app/actions/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <nav className="flex items-center gap-5">
            <Link href="/patients" className="text-base font-semibold">
              Op Plan &amp; 기록지
            </Link>
            <Link
              href="/patients"
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              환자
            </Link>
            <Link
              href="/surgery-types"
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              수술 종류 관리
            </Link>
            <Link
              href="/settings"
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              설정
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{user.name}님</span>
            <form action={logout}>
              <button
                type="submit"
                className="text-sm text-slate-500 underline hover:text-slate-900"
              >
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
