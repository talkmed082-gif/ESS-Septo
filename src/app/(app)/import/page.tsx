import { ImportForm } from "./import-form";

export default function ImportPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">수술 스케줄 엑셀 가져오기</h1>
      <p className="text-sm text-slate-600">
        메일로 받은 주간 스케줄 엑셀을 올리면 내 이름으로 된 수술만 보여줍니다. 파일은 저장하지 않습니다.
      </p>
      <ImportForm />
    </div>
  );
}
