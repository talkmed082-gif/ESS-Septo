import Link from "next/link";
import { buttonStyles } from "@/lib/ui";

// 진료실 PC 프로그램(외래 도우미, OpdHelper.exe) 내려받기·사용법 — 예전엔 외래 템플릿 화면에 있었다(처음엔 템플릿 채우기만 해서).
// 지금은 노트북 작업자·진단·오더·수술기록지까지 해서 설정 > 병원 연동으로 옮김(사용자 2026-10-26)
export function OpdHelperCard() {
  return (
  <div id="opd-helper" className="space-y-2 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-600">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="font-medium text-slate-800">진료실 PC 프로그램 (외래 도우미)</p>
      <a href="/templates/download" className={buttonStyles.accent}>
        OpdHelper.exe 내려받기
      </a>
    </div>
    <ol className="list-decimal space-y-1 pl-5">
      <li>설치 없이 파일 하나로 실행합니다. 관리자 권한 확인 창이 뜨면 &quot;예&quot;(YES가 관리자 권한으로 돌기 때문).</li>
      <li>
        Windows가 &quot;PC 보호&quot; 창을 띄우면 &quot;추가 정보 → 실행&quot;(서명하지 않은 프로그램이라 처음 한 번 뜰 수
        있음).
      </li>
      <li>
        켤 때마다 맨 위에 보이는{" "}
        <Link href="/settings#otp" className="underline">
          오늘의 번호
        </Link>
        (6자리, 서울 자정에 바뀜)를 넣습니다. 프로그램을 끄면 연결이 끊깁니다.
      </li>
      <li>
        YES에서 기록지(외래초진/경과)를 열면 통증 &quot;없음&quot;이 자동 체크되고, 환자 나이로 성인/소아 템플릿이 정해집니다(15세
        미만 소아, 프로그램에서 바꾸면 그 환자는 다음에도 그대로). F8 = 템플릿 고르기 창(숫자 또는 Enter, 0 = 템플릿 없이 비인강경만
        — 초진은 고른 CC에 맞는 템플릿이 먼저 선택됨), Alt+1~3 = 그 번호 템플릿 바로(맥 원격: Control+Shift+Q, Option+1~3). 이미 쓴
        칸은 지우지 않고 뒤에 덧붙입니다.
      </li>
    </ol>
  </div>
  );
}
