import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { logout } from "@/app/actions/auth";
import { PatientsNavLink } from "@/components/patients-nav-link";

// 메인 앱 화면(app 레이아웃)과 인쇄용 화면(레이아웃 밖, 프린트 전용)에서
// 똑같이 써야 해서 공용 컴포넌트로 뺐다. 인쇄용 화면에서는 실제 인쇄
// 결과에는 안 나오게 print:hidden을 붙여서 쓴다.
export async function AppNavBar() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <nav className="flex items-center gap-5">
          <Link href="/" className="text-base font-semibold">
            Op Plan &amp; 기록지
          </Link>
          <PatientsNavLink />
          <Link href="/settings" className="text-sm text-slate-600 hover:text-slate-900">
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
  );
}
