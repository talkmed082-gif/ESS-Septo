import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { parseFieldDefs } from "@/lib/field-types";
import { getSessionPayload } from "@/lib/session";
import type { NameStyle, SideNotation } from "@/lib/op-note-generator";
import { QuickTool } from "./quick-tool";

export default async function HomePage() {
  const [surgeryTypes, session] = await Promise.all([
    prisma.surgeryType.findMany({
      orderBy: [{ isBuiltIn: "desc" }, { createdAt: "asc" }],
    }),
    getSessionPayload(),
  ]);

  const user = session?.userId
    ? await prisma.user.findUnique({
        where: { id: session.userId as string },
        select: { sideNotation: true, abbreviateRegions: true },
      })
    : null;
  const nameStyle: NameStyle | undefined = user
    ? { sideNotation: user.sideNotation as SideNotation, abbreviateRegions: user.abbreviateRegions }
    : undefined;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-base font-semibold">Op Plan &amp; 기록지</span>
          <div className="flex items-center gap-3 text-sm">
            {session?.userId ? (
              <Link href="/patients" className="text-slate-600 hover:text-slate-900">
                환자 목록으로
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-slate-600 hover:text-slate-900">
                  로그인
                </Link>
                <Link
                  href="/signup"
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-white hover:bg-slate-700"
                >
                  회원가입
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <h1 className="mb-1 text-xl font-semibold">빠른 Op Plan / 수술기록지 작성</h1>
        <p className="mb-6 text-sm text-slate-500">
          로그인 없이 바로 작성해볼 수 있습니다. 환자 기록으로 저장하려면 로그인 후 이용해주세요.
        </p>
        <QuickTool
          surgeryTypes={surgeryTypes.map((st) => ({
            id: st.id,
            code: st.code,
            name: st.name,
            fields: parseFieldDefs(st.fields),
          }))}
          loggedIn={!!session?.userId}
          nameStyle={nameStyle}
        />
      </main>
    </div>
  );
}
