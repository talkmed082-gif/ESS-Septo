import { applyFieldDefaults, type FieldValues } from "@/lib/field-types";
import { resolveSurgeryTypeFields } from "@/lib/op-note-defs";

export type ImportSurgeryCode = "ESS" | "SEPTOPLASTY" | "COMBO";

export interface ProcedureMapping {
  code: ImportSurgeryCode | null;
  overrides: FieldValues;
}

// 스케줄 엑셀의 수술 칸("ESS[B] ; Septoplasty ; ITR[B]")을 사이트 수술 종류와
// 미리 켜둘 체크 항목으로 바꾼다. 규칙(사용자 확정): 엑셀 Septoturbinoplasty는
// 괄호와 상관없이 Septoplasty + Inferior turbinoplasty 양측이다.
// EMR 수술장 화면의 수술명("Endoscopic sinus surgery (B)", 여러 개면 , 또는 +로 구분)도 받는다.
export function mapScheduleProcedure(text: string): ProcedureMapping {
  const tokens = text
    .split(/[;,+]/)
    .map((t) => t.trim())
    .filter(Boolean);
  let ess = false;
  let septo = false;
  let right = false;
  let left = false;
  let touchedInferior = false;

  for (const token of tokens) {
    // 측 표기: 엑셀 [B], EMR (B)
    const side = /[[(]([RLB])[\])]/i.exec(token)?.[1]?.toUpperCase();
    const name = token
      .replace(/\[.*?\]/g, "")
      .replace(/\(\s*[RLB]\s*\)/gi, "")
      .trim();
    if (/^f?ess$/i.test(name) || /^(functional\s+)?endoscopic\s+sinus\s+surgery$/i.test(name)) {
      ess = true;
    } else if (/^septoturbinoplasty$/i.test(name)) {
      septo = true;
      right = left = touchedInferior = true;
    } else if (/^septoplasty$/i.test(name)) {
      septo = true;
      touchedInferior = true;
    } else if (/^itr$/i.test(name) || /^(inferior\s+)?turbinoplasty$/i.test(name)) {
      touchedInferior = true;
      if (side !== "L") right = true;
      if (side !== "R") left = true;
    }
  }

  const code: ImportSurgeryCode | null = ess && septo ? "COMBO" : ess ? "ESS" : septo ? "SEPTOPLASTY" : null;
  const overrides: FieldValues =
    code && touchedInferior ? { turb_inferior_right: right, turb_inferior_left: left } : {};
  return { code, overrides };
}

// "41Y" → 41, "6Y1M" → 6, "16M" → 0 (개월만 있으면 0세)
export function parseScheduleAge(text: string): number | null {
  const t = text.trim();
  const years = /^(\d+)Y/i.exec(t);
  if (years) return Number(years[1]);
  if (/^\d+M$/i.test(t)) return 0;
  return null;
}

// 해당 수술 종류의 필드 기본값 위에 엑셀에서 읽은 값만 덮어쓴다.
export function buildImportPlanData(mapping: { code: ImportSurgeryCode; overrides: FieldValues }): FieldValues {
  const fields = resolveSurgeryTypeFields({ code: mapping.code, fields: [] });
  return { ...applyFieldDefaults({}, fields), ...mapping.overrides };
}

// 계획 화면에 보이는 메모(planNote) — 사이트는 OpPlan.diagnosis를 어느 화면에도
// 보여주지 않아서, 진단도 여기 같이 적어 둔다. 원본 수술 문자열은 괄호 표기 등
// 매핑에 안 쓴 정보까지 그대로 남기려는 것.
export function buildImportPlanNote(row: {
  procedure: string;
  diagnosis: string;
  room: string;
  order: string;
  assist: string;
  anesthesia: string;
  duration: string;
  note: string;
}): string {
  return [
    row.diagnosis && `진단: ${row.diagnosis}`,
    `스케줄: ${row.procedure}`,
    `${row.room} #${row.order} · assist ${row.assist}`,
    `마취 ${row.anesthesia} · 예상 ${row.duration}`,
    row.note && `비고 ${row.note}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export type PreviewStatus = "new" | "exists" | "unsupported" | "noChart";

// 미리보기 행 상태 — 등록번호가 없는 행은 환자를 찾거나 만들 기준이 없어서 가져오지
// 않는다(체크된 채로 보내면 그 한 줄 때문에 전체 가져오기가 실패했었다).
export function previewStatusOf(
  row: { chartNo: string },
  code: ImportSurgeryCode | null,
  exists: boolean,
): PreviewStatus {
  if (!code) return "unsupported";
  if (!row.chartNo.trim()) return "noChart";
  return exists ? "exists" : "new";
}
