import { readFile } from "node:fs/promises";
import path from "node:path";
import { verifySession } from "@/lib/dal";

// 진료실 PC 프로그램(외래 도우미, OpdHelper.exe) 내려받기 — 로그인한 사람만.
// 파일은 emr-fill\build.ps1로 만든 것을 downloads\에 복사해 커밋한다(프로그램을 고치면 다시 복사).
export async function GET() {
  await verifySession();
  const file = await readFile(path.join(process.cwd(), "downloads", "OpdHelper.exe"));
  return new Response(new Uint8Array(file), {
    headers: {
      "content-type": "application/octet-stream",
      "content-disposition": 'attachment; filename="OpdHelper.exe"',
      "cache-control": "private, no-store",
    },
  });
}
