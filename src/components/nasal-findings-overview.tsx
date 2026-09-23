"use client";

// ESS P/E 안의 세 상세 소견 그룹(해부학적 이상/부비동염/비용종)을 항상 다
// 펼쳐서 보여주면 체크박스가 너무 많아 한눈에 들어오지 않는다 — 그래서
// "간략 소견"에서 해당하는 그룹만 먼저 체크하게 하고, 체크한 그룹만 아래에
// 상세 선택 칸(문제 있는지 → 방향/부위)이 열리게 한다. 실제 값 저장/해제는
// 상위(SurgeryPlanner/RecordForm)가 담당한다 — 이 컴포넌트는 어떤 그룹을
// 펼칠지만 알려준다.
export function NasalFindingsOverview({
  showAnatomic,
  showSinusitis,
  showPolyp,
  onToggleAnatomic,
  onToggleSinusitis,
  onTogglePolyp,
}: {
  showAnatomic: boolean;
  showSinusitis: boolean;
  showPolyp: boolean;
  onToggleAnatomic: (checked: boolean) => void;
  onToggleSinusitis: (checked: boolean) => void;
  onTogglePolyp: (checked: boolean) => void;
}) {
  return (
    <div className="space-y-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-medium text-slate-500">간략 소견</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-slate-700">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={showAnatomic}
            onChange={(e) => onToggleAnatomic(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          해부학적 이상 소견
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={showSinusitis}
            onChange={(e) => onToggleSinusitis(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          부비동염
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={showPolyp}
            onChange={(e) => onTogglePolyp(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          비용종
        </label>
      </div>
    </div>
  );
}
