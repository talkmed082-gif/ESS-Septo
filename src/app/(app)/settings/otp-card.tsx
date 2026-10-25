import { prisma } from "@/lib/prisma";
import { getDailyOtp } from "@/lib/device-auth";
import { rotateOtp, endAllDeviceSessions } from "@/app/actions/device";
import { buttonStyles } from "@/lib/ui";

// 오늘의 번호 관리(새 번호·연결 모두 끊기) — 번호 자체는 위쪽 메뉴에 늘 보이고, 대시보드에서는 뺐다(사용자 2026-10-25)
export async function OtpCard({ userId }: { userId: string }) {
  const now = new Date();
  const [otp, activeDevices] = await Promise.all([
    getDailyOtp(userId, now),
    prisma.deviceSession.count({ where: { createdById: userId, expiresAt: { gt: now } } }),
  ]);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-3">
      <div>
        <p className="font-mono text-2xl font-semibold tracking-[0.25em] text-slate-900">{otp.code}</p>
        <p className="text-xs text-slate-400">오늘 자정까지 여러 번 쓸 수 있음{activeDevices > 0 && ` · 연결된 프로그램 ${activeDevices}개`}</p>
      </div>
      <div className="flex gap-2">
        <form action={rotateOtp}>
          <button type="submit" className={buttonStyles.smallOutline}>
            새 번호
          </button>
        </form>
        {activeDevices > 0 && (
          <form action={endAllDeviceSessions}>
            <button type="submit" className={buttonStyles.smallOutline}>
              연결 모두 끊기
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
