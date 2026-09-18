import { getCurrentUser } from "@/lib/dal";
import type { SideNotation } from "@/lib/op-note-generator";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const user = await getCurrentUser();

  return (
    <div className="max-w-lg">
      <h1 className="mb-1 text-xl font-semibold">설정</h1>
      <p className="mb-6 text-sm text-slate-500">
        자동 생성되는 수술명의 방향/부위 표기 방식을 정할 수 있습니다.
      </p>
      <SettingsForm
        initialSideNotation={user.sideNotation as SideNotation}
        initialAbbreviate={user.abbreviateRegions}
        initialDefaultAssistantName={user.defaultAssistantName ?? ""}
      />
    </div>
  );
}
