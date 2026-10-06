import Link from "next/link";
import { ResetPasswordForm } from "./reset-form";

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold text-slate-900">새 비밀번호 정하기</h1>
        {typeof token === "string" && token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <p className="text-sm text-red-600">
            링크가 올바르지 않습니다.{" "}
            <Link href="/forgot-password" className="underline">
              비밀번호 찾기
            </Link>
            를 다시 해 주세요.
          </p>
        )}
      </div>
    </div>
  );
}
