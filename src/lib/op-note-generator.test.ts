import { describe, expect, it } from "vitest";
import {
  buildPlanTable,
  buildProcedureName,
  generateOpNote,
  nasalFindingsSummary,
  nasalFindingsText,
  type NameStyle,
} from "./op-note-generator";
import type { FieldValues } from "./field-types";

const ALL_STEPS = ["mma", "ant_eth", "post_eth", "sphenoid", "frontal"] as const;

// 한쪽(또는 양쪽)에 FESS 시행 단계를 체크한 values를 만든다
function fessSteps(side: "right" | "left" | "both", steps: readonly string[] = ALL_STEPS): FieldValues {
  const sides = side === "both" ? ["right", "left"] : [side];
  const values: FieldValues = {};
  for (const s of sides) for (const step of steps) values[`f_${s}_${step}`] = true;
  return values;
}

function lines(text: string): string[] {
  return text.split("\n");
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("generateOpNote - ESS", () => {
  it("양측 ESS면 Microdebrider 문장을 [양측]으로 한 번만 쓴다", () => {
    const { procedureDetail } = generateOpNote("ESS", fessSteps("both"), "record");
    expect(count(procedureDetail, "Microdebrider")).toBe(1);
    expect(procedureDetail).toContain("[양측] Microdebrider");
  });

  it("편측 ESS면 Microdebrider 문장이 그 side 블록 안에 들어가고, 국소마취도 그 side로 표기한다", () => {
    const { procedureDetail } = generateOpNote("ESS", fessSteps("right"), "record");
    expect(procedureDetail).toContain("[우측] Microdebrider");
    expect(procedureDetail).not.toContain("[좌측]");
    expect(procedureDetail).toContain("우측 sphenopalatine fossa");
  });

  it("Sphenoidotomy 단독이면 uncinectomy를 자동으로 넣지 않는다", () => {
    const { procedureDetail } = generateOpNote("ESS", fessSteps("right", ["sphenoid"]), "plan");
    expect(procedureDetail).not.toContain("Uncinectomy");
  });

  it("MMA 등 다른 부위를 시행하면 uncinectomy를 자동으로 포함한다", () => {
    const { procedureDetail } = generateOpNote("ESS", fessSteps("right", ["mma"]), "plan");
    expect(procedureDetail).toContain("[우측] Uncinectomy 시행");
  });

  it("Revision side는 uncinectomy를 직접 체크한 값만 따른다", () => {
    const values = { ...fessSteps("both", ["mma"]), f_revision_ess_right: true, f_left_uncinectomy: false };
    const { procedureDetail } = generateOpNote("ESS", values, "plan");
    expect(procedureDetail).not.toContain("[우측] Uncinectomy");
    expect(procedureDetail).toContain("[좌측] Uncinectomy");
  });

  it("시행 순서를 좌측 먼저로 고르면 좌측 블록이 먼저 나온다", () => {
    const values = { ...fessSteps("both", ["mma"]), f_side_order: "좌측 먼저 → 우측" };
    const { procedureDetail } = generateOpNote("ESS", values, "plan");
    expect(procedureDetail.indexOf("[좌측]")).toBeLessThan(procedureDetail.indexOf("[우측]"));
  });

  it("부비동염/비용종 소견이 해당 단계 문장 뒤에 이어진다", () => {
    const values = {
      ...fessSteps("right", ["mma"]),
      n_sinusitis_maxillary_right: true,
      n_polyp_right_site_mm: true,
    };
    const { procedureDetail } = generateOpNote("ESS", values, "plan");
    expect(procedureDetail).toContain(
      "[우측] Middle meatal antrostomy를 통해 상악동 자연공 확장. Maxillary sinus의 염증 소견을 확인하고 배액로를 확보함. Maxillary sinus 내 비용종을 제거함",
    );
  });

  it("plan 모드에는 마취/수축 같은 도입 문장이 없고, record 모드는 마취 문장으로 시작한다", () => {
    const plan = generateOpNote("ESS", fessSteps("both"), "plan").procedureDetail;
    const record = generateOpNote("ESS", fessSteps("both"), "record", "Local").procedureDetail;
    expect(plan).not.toContain("앙와위");
    expect(lines(record)[0]).toBe("1. 환자를 앙와위로 눕히고 국소마취 하에 수술을 시작함");
  });

  it("Revision case면 record 모드에 revision 문장이 들어간다", () => {
    const values = { ...fessSteps("both"), f_revision_ess_left: true };
    const { procedureDetail } = generateOpNote("ESS", values, "record");
    expect(procedureDetail).toContain("이전 좌측 ESS 수술 부위에 대한 Revision case");
  });

  it("ESS 소견에는 ESS P/E를 안 했으면 아무 소견도 쓰지 않는다", () => {
    const values = { ...fessSteps("both"), n_cb_present: true };
    expect(generateOpNote("ESS", values, "record").findings).toBe("");
  });
});

describe("generateOpNote - 비중격교정술", () => {
  it("절개 방향을 고르면 그 방향에서 절개 문장이 시작된다", () => {
    const { procedureDetail } = generateOpNote("SEPTOPLASTY", { s_incision_side: "좌측" }, "plan");
    expect(lines(procedureDetail)[0]).toBe(
      "1. 좌측에서 Hemitransfixion incision을 시행한 후 편측 mucoperichondrial flap을 거상하고 반대측은 tunneling을 통해 flap을 거상함",
    );
  });

  it("Quilting suture는 체크했을 때만 들어가고, 절개 봉합 문장은 항상 남는다", () => {
    const off = generateOpNote("SEPTOPLASTY", {}, "plan").procedureDetail;
    const on = generateOpNote("SEPTOPLASTY", { s_quilting: true, s_quilting_suture: "5-0 Vicryl" }, "plan").procedureDetail;
    expect(off).toContain("Incision 부위 Vicryl로 suture 시행함");
    expect(off).not.toContain("quilting");
    expect(on).toContain("5-0 Vicryl를 사용하여 quilting suture 시행");
    expect(on).toContain("Incision 부위 Vicryl로 suture 시행함");
  });

  it("하비갑개 축소술 side가 문장에 반영된다", () => {
    const values = { turb_inferior_right: true, turb_inferior_left: true };
    const { procedureDetail } = generateOpNote("SEPTOPLASTY", values, "plan");
    expect(procedureDetail).toContain("양측 하비갑개에 대해 coblator");
  });
});

describe("generateOpNote - 병행(Combo)", () => {
  it("선택한 순서대로 블록이 나오고 번호가 끊기지 않고 이어진다", () => {
    const values = { ...fessSteps("both", ["mma"]), c_order: "좌 FESS → 비중격 → 우 FESS" };
    const { procedureDetail } = generateOpNote("COMBO", values, "record");
    const headers = lines(procedureDetail).filter((l) => l.startsWith("---"));
    expect(headers).toEqual(["--- FESS - 좌측 ---", "--- 비중격교정술 ---", "--- FESS - 우측 ---", "--- 종료 ---"]);

    const numbers = lines(procedureDetail)
      .map((l) => /^(\d+)\. /.exec(l)?.[1])
      .filter(Boolean)
      .map(Number);
    expect(numbers).toEqual(numbers.map((_, i) => i + 1));
  });

  it("FESS를 한쪽도 안 했으면 FESS 블록 헤더를 쓰지 않는다", () => {
    const { procedureDetail } = generateOpNote("COMBO", {}, "plan");
    expect(procedureDetail).not.toContain("FESS -");
  });
});

describe("nasalFindingsText / nasalFindingsSummary", () => {
  const septoFindings: FieldValues = {
    n_septo_pe_done: true,
    n_dev_side: "좌측",
    n_deviation: "중등도",
    n_chr: "양측",
  };

  it("Septo P/E를 체크 안 했으면 비중격 값이 남아 있어도 서술하지 않는다", () => {
    const values = { ...septoFindings, n_septo_pe_done: false, n_ess_pe_done: true };
    expect(nasalFindingsText(values)).not.toContain("비중격");
  });

  it("Septo P/E 소견은 한 줄에 하나씩 서술한다", () => {
    expect(lines(nasalFindingsText(septoFindings))).toEqual(["비중격: 좌측 중등도 편위", "하비갑개 비후(CHR): 양측"]);
  });

  it("비용종은 좌/우 위치를 나눠 서술한다", () => {
    const values = { n_ess_pe_done: true, n_polyp_right_site_mm: true, n_polyp_left_site_frontal: true };
    expect(nasalFindingsText(values)).toContain("비용종: 우측(Middle meatus), 좌측(Frontal sinus)");
  });

  it("UP attach는 양측 값이 같으면 '양측'으로 합친다", () => {
    const values = { n_ess_pe_done: true, n_uncinate_left: "LP", n_uncinate_right: "LP" };
    expect(lines(nasalFindingsText(values))[0]).toBe("UP attach: 양측 LP");
  });

  it("P/E를 하나도 안 했으면 요약은 빈 문자열이다", () => {
    expect(nasalFindingsSummary({ n_cb_present: true })).toBe("");
  });

  it("요약은 정상/기본값 소견은 빼고 의미 있는 것만 보여준다", () => {
    const values = { n_ess_pe_done: true, n_cb_present: true, n_cb_side: "우측" };
    expect(nasalFindingsSummary(values)).toBe("우측 concha bullosa");
  });
});

describe("buildProcedureName", () => {
  it("비중격교정술 + 양측 하비갑개 축소술은 Septoturbinoplasty로 합친다", () => {
    const values = { turb_inferior_right: true, turb_inferior_left: true };
    expect(buildProcedureName("SEPTOPLASTY", values)).toBe("Septoturbinoplasty");
  });

  it("하비갑개 축소술이 한쪽만이면 Septoplasty에 side를 붙인다", () => {
    expect(buildProcedureName("SEPTOPLASTY", { turb_inferior_right: true })).toBe(
      "Septoplasty + Rt. Turbinoplasty",
    );
  });

  it("좌우 시행 부위가 같으면 Both로 합친다", () => {
    expect(buildProcedureName("ESS", fessSteps("both"))).toBe("Both ESS(Frontal, Ethmoid, Maxillary, Sphenoid)");
  });

  it("한 부위만 시행하면 ESS(...) 대신 실제 술식명을 쓴다", () => {
    expect(buildProcedureName("ESS", fessSteps("both", ["sphenoid"]))).toBe("Both Sphenoidotomy");
    expect(buildProcedureName("ESS", fessSteps("right", ["ant_eth"]))).toBe("Rt. Ant. Ethmoidectomy");
  });

  it("Ethmoid 단독이라도 좌우 Ant./Post. 구성이 다르면 합치지 않는다", () => {
    const values = { f_right_ant_eth: true, f_left_post_eth: true };
    expect(buildProcedureName("ESS", values)).toBe("Rt. Ant. Ethmoidectomy, Lt. Post. Ethmoidectomy");
  });

  it("비대칭 turbinoplasty는 해당 side 뒤에 붙이고, 대칭이면 맨 뒤에 Both로 붙인다", () => {
    const asym = { ...fessSteps("both", ["mma"]), turb_inferior_right: true };
    expect(buildProcedureName("ESS", asym)).toBe("Rt. MMA Turbinoplasty, Lt. MMA");

    const sym = { ...fessSteps("both", ["mma"]), turb_inferior_right: true, turb_inferior_left: true };
    expect(buildProcedureName("ESS", sym)).toBe("Both MMA + Both Turbinoplasty");
  });

  it("Revision side의 sinus는 rev> 태그에만 나오고 뒤에서 반복되지 않는다", () => {
    const values = { ...fessSteps("both", ["mma", "ant_eth"]), f_revision_ess_right: true };
    const name = buildProcedureName("ESS", values);
    // 재수술 태그 뒤 다른 side 술식은 "+"로 끊어서 그 술식까지 재수술로 읽히지 않게 한다.
    expect(name).toBe("rev> Rt. ESS (Ethmoid, Maxillary) + Lt. ESS(Ethmoid, Maxillary)");
    expect(count(name, "Rt.")).toBe(1);
  });

  it("양측 모두 revision이면 rev> 태그 뒤에 군더더기 'ESS'가 남지 않는다", () => {
    const values = { ...fessSteps("both", ["frontal"]), f_revision_ess_right: true, f_revision_ess_left: true };
    expect(buildProcedureName("ESS", values)).toBe("rev> Both ESS (Frontal)");
  });

  it("약어 스타일은 side를 괄호형으로, 부위를 머리글자로 쓴다", () => {
    const style: NameStyle = { sideNotation: "bracket", abbreviateRegions: true };
    expect(buildProcedureName("ESS", fessSteps("both"), style)).toBe("B] ESS(FEMS)");
  });

  it("병행은 Septoplasty + ESS 이름에 turbinoplasty 접미사를 붙인다", () => {
    const values = { ...fessSteps("both", ["mma", "ant_eth"]), turb_inferior_right: true, turb_inferior_left: true };
    expect(buildProcedureName("COMBO", values)).toBe(
      "Septoplasty + Both ESS(Ethmoid, Maxillary) + Both Turbinoplasty",
    );
  });
});

describe("buildPlanTable", () => {
  it("Revision case면 표 맨 위에 Uncinectomy 행을 보여준다", () => {
    const table = buildPlanTable("ESS", { f_revision_ess_left: true, f_left_uncinectomy: true });
    expect(table.sideMatrix?.rows[0]).toMatchObject({ key: "uncinectomy", left: true, right: false });
  });

  it("Revision이 아니면 Uncinectomy 행이 없다", () => {
    const table = buildPlanTable("ESS", fessSteps("both"));
    expect(table.sideMatrix?.rows.map((r) => r.key)).not.toContain("uncinectomy");
  });

  it("Packing 칸은 체크한 재료만 모아 보여준다", () => {
    const table = buildPlanTable("ESS", { f_nasocel: true, dermacol: true });
    expect(table.keyValueRows.find((r) => r.label === "Packing / Material")?.value).toBe("Nasocel Plus + Dermacol");
  });
});

describe("ESS의 DSN(비중격 만곡) 소견", () => {
  const ess = { n_ess_pe_done: true, n_uncinate_left: "LP", n_uncinate_right: "LP" };

  it("ESS만 기록할 때는 UP attach 다음, Concha bullosa 앞에 DSN 방향/정도를 쓴다", () => {
    const text = nasalFindingsText({ ...ess, n_dev_side: "좌측", n_deviation: "중등도" });
    expect(lines(text).slice(0, 3)).toEqual(["UP attach: 양측 LP", "DSN: 좌측 중등도", "Concha bullosa 없음"]);
  });

  it("방향만 또는 정도만 있어도 있는 것만 쓴다", () => {
    expect(nasalFindingsText({ ...ess, n_dev_side: "우측" })).toContain("DSN: 우측");
    expect(nasalFindingsText({ ...ess, n_deviation: "고도" })).toContain("DSN: 고도");
  });

  it("기본값(특이 만곡 없음/해당없음)이면 DSN 줄을 쓰지 않는다", () => {
    const text = nasalFindingsText({ ...ess, n_dev_side: "특이 만곡 없음", n_deviation: "해당없음" });
    expect(text).not.toContain("DSN");
  });

  it("요약에도 의미 있는 DSN만 넣는다", () => {
    expect(nasalFindingsSummary({ ...ess, n_dev_side: "양측(S자형)", n_deviation: "경도" })).toContain("DSN 양측(S자형) 경도");
    expect(nasalFindingsSummary({ ...ess, n_dev_side: "특이 만곡 없음", n_deviation: "해당없음" })).not.toContain("DSN");
  });

  it("Septo 소견도 함께 기록하면 기존 '비중격' 줄만 쓰고 DSN을 중복해서 쓰지 않는다", () => {
    const both = { ...ess, n_septo_pe_done: true, n_dev_side: "좌측", n_deviation: "중등도" };
    const text = nasalFindingsText(both);
    expect(text).toContain("비중격: 좌측 중등도 편위");
    expect(text).not.toContain("DSN");
    expect(nasalFindingsSummary(both)).not.toContain("DSN");
  });

  it("병행이라도 Septo P/E를 안 했으면 ESS 쪽에서 DSN을 쓴다", () => {
    const text = nasalFindingsText({ ...ess, n_septo_pe_done: false, n_dev_side: "우측", n_deviation: "경도" });
    expect(text).toContain("DSN: 우측 경도");
  });
});

describe("부비동염/비용종 소견 문구의 순서", () => {
  it("부비동염은 실제 수술 순서(Maxillary → Ant. → Post. → Sphenoid → Frontal)로 쓴다", () => {
    const all: FieldValues = { n_ess_pe_done: true };
    for (const k of ["frontal", "ant_ethmoid", "post_ethmoid", "maxillary", "sphenoid"]) all[`n_sinusitis_${k}_right`] = true;
    const order = lines(nasalFindingsText(all))
      .filter((l) => l.includes("sinusitis"))
      .map((l) => l.split(" sinusitis")[0]);
    expect(order).toEqual(["Maxillary", "Ant. ethmoid", "Post. ethmoid", "Sphenoid", "Frontal"]);
  });

  it("비용종 위치도 같은 순서(Middle meatus·Maxillary ostium이 먼저, Frontal은 뒤)로 쓴다", () => {
    const right: FieldValues = { n_ess_pe_done: true };
    for (const k of ["mm", "maxillary", "ant_ethmoid", "post_ethmoid", "sphenoid", "frontal", "choana"]) right[`n_polyp_right_site_${k}`] = true;
    expect(nasalFindingsText(right)).toContain(
      "비용종: 우측(Middle meatus, Maxillary ostium, Ant. ethmoid, Post. ethmoid, Sphenoid, Frontal sinus, Extension to choana)",
    );
  });
});


describe("수술 기록 문장 — 병행·편측 조합", () => {
  const comboBase = {
    ...fessSteps("both", ["mma", "ant_eth"]),
    turb_inferior_right: true,
    turb_inferior_left: true,
  };

  it("병행에서 하비갑개 축소술은 비중격 블록에 한 번만 쓴다", () => {
    const { procedureDetail } = generateOpNote("COMBO", comboBase, "record");
    expect(count(procedureDetail, "축소술(Turbinoplasty)")).toBe(1);
    expect(procedureDetail).toContain("양측 하비갑개에 대해 coblator를 이용하여 축소술(Turbinoplasty)을 시행함");
  });

  it("병행에서 중비갑개 축소술은 해당 측 FESS 블록에만 쓴다", () => {
    const { procedureDetail } = generateOpNote("COMBO", { ...comboBase, turb_middle_right: true }, "record");
    expect(count(procedureDetail, "축소술(Mturbinoplasty)")).toBe(1);
    expect(procedureDetail).toContain("[우측] 중비갑개에 대해");
  });

  it("병행에도 비중격 국소 침윤마취 문장이 들어가고, 입력한 마취제를 쓴다", () => {
    const { procedureDetail } = generateOpNote(
      "COMBO",
      { ...comboBase, s_local_anesthetic: "2% lidocaine, 총 4cc" },
      "record",
    );
    expect(procedureDetail).toContain("2% lidocaine, 총 4cc를 비중격 점막에 국소 침윤 마취함");
  });

  it("Septo 단독에도 epinephrine patty 점막 수축 단계가 들어가고, packing은 Rhinocel만 쓴다", () => {
    const { procedureDetail } = generateOpNote("SEPTOPLASTY", {}, "record");
    expect(procedureDetail).toContain("Epinephrine을 적신 patty로 양측 비강 점막을 수축시킴");
    expect(procedureDetail).toContain("Rhinocel로 packing");
    expect(procedureDetail).not.toContain("Nasocel");
  });

  it("ESS packing은 Nasocel Plus로 쓴다", () => {
    const { procedureDetail } = generateOpNote("ESS", { ...fessSteps("right", ["mma"]), f_nasocel: true }, "record");
    expect(procedureDetail).toContain("Nasocel Plus로 1차 packing");
  });

  it("편측 ESS의 silastic sheet는 그 측에만 넣는다", () => {
    const { procedureDetail } = generateOpNote("ESS", { ...fessSteps("right", ["mma"]), f_silastic_sheet: true }, "plan");
    expect(procedureDetail).toContain("우측 middle meatus에 silastic sheet");
    expect(procedureDetail).not.toContain("양측 middle meatus");
  });

  it("시행 단계에 붙지 않는 비용종(후비공 연장, MMA 없는 middle meatus)도 제거 문장이 빠지지 않는다", () => {
    const { procedureDetail } = generateOpNote(
      "ESS",
      { ...fessSteps("right", ["ant_eth"]), n_polyp_right_site_mm: true, n_polyp_right_site_choana: true },
      "plan",
    );
    expect(procedureDetail).toContain("[우측] Middle meatus, 후비공(choana)까지 연장된 부위의 비용종을 제거함");
  });

  it("MMA를 하면 middle meatus 비용종은 MMA 문장에만 붙고 따로 반복하지 않는다", () => {
    const { procedureDetail } = generateOpNote(
      "ESS",
      { ...fessSteps("right", ["mma"]), n_polyp_right_site_mm: true },
      "plan",
    );
    expect(count(procedureDetail, "비용종을 제거함")).toBe(1);
  });
});

describe("비강 소견 — 고르지 않은 값을 지어내지 않는다", () => {
  it("방향을 안 고른 위험 소견은 '방향 미선택'으로 남긴다", () => {
    const values = { n_ess_pe_done: true, n_lp_dehiscence_present: true, n_dehiscence_present: true };
    const text = nasalFindingsText(values);
    expect(text).toContain("Lamina papyracea 결손: 방향 미선택");
    expect(text).toContain("시신경/경동맥 골 결손: 방향 미선택");
    expect(nasalFindingsSummary(values)).toContain("방향 미선택 Lamina papyracea 결손");
  });

  it("비중격 편위 방향만 고르고 정도를 안 골라도 편위로 쓴다", () => {
    const values = { n_septo_pe_done: true, n_dev_side: "우측", n_deviation: "해당없음" };
    expect(nasalFindingsText(values)).toContain("비중격: 우측 편위");
    expect(nasalFindingsSummary(values)).toContain("비중격 우측 편위");
  });
});

describe("수술명 — turbinoplasty만 시행", () => {
  it("부비동을 열지 않았으면 ESS를 붙이지 않는다", () => {
    expect(buildProcedureName("ESS", { turb_inferior_right: true, turb_inferior_left: true })).toBe("Both Turbinoplasty");
  });

  it("아무것도 고르지 않았으면 기존처럼 ESS로 둔다", () => {
    expect(buildProcedureName("ESS", {})).toBe("ESS");
  });
});
