import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { logout } from "@/app/actions/auth";
import { AppNavLinks } from "@/components/app-nav-links";
import { OtpChip } from "@/components/otp-chip";

// 메인 앱 화면(app 레이아웃)과 인쇄용 화면(레이아웃 밖, 프린트 전용)에서
// 똑같이 써야 해서 공용 컴포넌트로 뺐다. 인쇄용 화면에서는 실제 인쇄
// 결과에는 안 나오게 print:hidden을 붙여서 쓴다.
// 폰 폭에서는 메뉴가 한 줄에 안 들어가서 이름·로그아웃 아래 줄로 내리고 좌우로 민다.
export async function AppNavBar() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center justify-between gap-3">
          <Link href="/dashboard" className="shrink-0 text-base font-semibold whitespace-nowrap">
            진료 어시스트
          </Link>
          <OtpChip />
          <LogoutBox name={user.name} className="ml-auto sm:hidden" />
        </div>
        <AppNavLinks />
        <LogoutBox name={user.name} className="ml-auto hidden sm:flex" />
      </div>
    </header>
  );
}

function LogoutBox({ name, className }: { name: string; className: string }) {
  return (
    <div className={`flex shrink-0 items-center gap-3 ${className}`}>
      <span className="text-sm whitespace-nowrap text-slate-500">{name}님</span>
      <form action={logout}>
        <button type="submit" className="text-sm whitespace-nowrap text-slate-500 underline hover:text-slate-900">
          로그아웃
        </button>
      </form>
    </div>
  );
}
