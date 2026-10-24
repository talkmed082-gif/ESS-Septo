import type { FieldValues } from "@/lib/field-types";

// 수술기록 → EMR 수술 오더(수술료, 분류 07). 진료실 프로그램 [수술 오더 넣기]가 오더창에 코드로 한 줄씩 넣고 좌우는 비고(Rt./Lt.)에 적는다.
// 측마다: 부비동 조합 코드(내시경). "복잡" = 재수술 / 그 측 용종 / 접형·전두 시행 중 하나(행정해석 보험급여과-2502, 2014.8.1, 사용자 확인).
// 표에 없는 조합은 부위별 코드로 나눠 넣는다(예: 상악+접형 → O1051 + O1121, 사용자 2026-10-25). 전두동은 사골동과 함께만 한다.
export type SurgeryOrder = { code: string; name: string; side: "Rt." | "Lt." | null; complex?: boolean; why?: string };

const on = (v: unknown) => v === true || v === "true";

type Set4 = { M: boolean; E: boolean; S: boolean; F: boolean };
// [M, E, S, F] → [일반, 복잡(없으면 null), 이름]
const COMBOS: [string, string, string | null, string][] = [
  ["M", "O1051", null, "상악동비내수술-내시경"],
  ["E", "O1101", null, "사골동비내수술-내시경"],
  ["S", "O1121", null, "접형골동비내수술-내시경"],
  ["ME", "O1141", null, "상악동사골동근본수술-내시경"],
  ["ES", "O1181", "O1182", "사골동접형골동수술-내시경"],
  ["MES", "O1151", "O1152", "상악동사골동접형골동근본수술-내시경"],
  ["EF", "O1161", "O1162", "전두동사골동근본수술-내시경"],
  ["ESF", "O1171", "O1172", "전두동사골동접형골동근본수술-내시경"],
  ["MEF", "O1176", "O1177", "전두동,사골동,상악동근본수술-내시경"],
  ["MESF", "O1131", null, "전부비강근본수술-내시경"],
];
const keyOf = (s: Set4) => (s.M ? "M" : "") + (s.E ? "E" : "") + (s.S ? "S" : "") + (s.F ? "F" : "");

function sinusOrders(s: Set4, complex: boolean, side: "Rt." | "Lt.", why: string): SurgeryOrder[] {
  const k = keyOf(s);
  if (!k) return [];
  const hit = COMBOS.find((c) => c[0] === k);
  if (hit) {
    const cx = complex && hit[2] != null;
    return [{ code: cx ? hit[2]! : hit[1], name: hit[3] + (cx ? "-복잡" : ""), side, complex: cx, why: cx ? why : undefined }];
  }
  // 표에 없는 조합(사실상 상악+접형): 부위별 단독 코드. 사골 없는 전두는 코드가 없어 직접 확인(code 빈칸 — 넣지 않음)
  const singles = (["M", "E", "S"] as const).filter((x) => s[x]).flatMap((x) => sinusOrders({ M: x === "M", E: x === "E", S: x === "S", F: false }, complex, side, why));
  return s.F ? [...singles, { code: "", name: "전두동(사골동 없이) — 코드 없음, 직접 확인", side }] : singles;
}

export function surgeryOrdersFor(surgeryCode: string, v: FieldValues): SurgeryOrder[] {
  const out: SurgeryOrder[] = [];
  const hasEss = surgeryCode === "ESS" || surgeryCode === "COMBO";
  const hasSepto = surgeryCode === "SEPTOPLASTY" || surgeryCode === "COMBO";
  if (hasSepto) {
    const pick = String(v.o_septo_code ?? "골 (O1006)");
    const code = /O100[567]/.exec(pick)?.[0] ?? "O1006";
    out.push({ code, name: { O1005: "비중격교정술-연골(내시경)", O1006: "비중격교정술-골(내시경)", O1007: "비중격재건술(내시경)" }[code]!, side: null });
  }
  if (hasEss)
    for (const [side, lr] of [["Rt.", "right"], ["Lt.", "left"]] as const) {
      const s: Set4 = {
        M: on(v[`f_${lr}_mma`]),
        E: on(v[`f_${lr}_ant_eth`]) || on(v[`f_${lr}_post_eth`]),
        S: on(v[`f_${lr}_sphenoid`]),
        F: on(v[`f_${lr}_frontal`]),
      };
      const revision = on(v[`f_revision_ess_${lr}`]);
      const polyp = Object.keys(v).some((k) => k.startsWith(`n_polyp_${lr}_site_`) && on(v[k]));
      const why = [revision && "재수술", polyp && "용종", (s.S || s.F) && "접형·전두"].filter(Boolean).join("·");
      out.push(...sinusOrders(s, revision || polyp || s.S || s.F, side, why));
    }
  // 하비갑개(중비갑개 포함) 점막하절제 — 측마다 한 줄
  for (const [side, lr] of [["Rt.", "right"], ["Lt.", "left"]] as const)
    if (on(v[`turb_inferior_${lr}`]) || on(v[`turb_middle_${lr}`])) out.push({ code: "O1022", name: "하비갑개점막하 절제술-내시경", side });
  if (on(v.f_nav)) out.push({ code: "ORIB994", name: "네비게이션 사용", side: null });
  const spg = String(v.o_spg_block ?? "양측");
  if (spg !== "안 함")
    for (const side of spg === "양측" ? (["Rt.", "Lt."] as const) : spg === "우측" ? (["Rt."] as const) : (["Lt."] as const))
      out.push({ code: "LA235", name: "내시경하 접구개신경절차단술", side });
  return out;
}
