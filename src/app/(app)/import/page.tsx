import { SETTINGS_TABS, SectionTabs } from "@/components/section-tabs";
import { ImportForm } from "./import-form";

// 설정 > 엑셀 가져오기 — 메일로 받은 주간 수술 스케줄 엑셀
export default function ImportPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-4 text-xl font-semibold">설정</h1>
        <SectionTabs tabs={SETTINGS_TABS} current="/import" />
      </div>
      <h2 className="text-sm font-semibold text-slate-700">수술 스케줄 엑셀 가져오기</h2>
      <p className="text-sm text-slate-600">
        메일로 받은 주간 스케줄 엑셀을 올리면 내 이름으로 된 수술만 보여줍니다. 파일은 저장하지 않습니다.
      </p>
      <ImportForm />
    </div>
  );
}
