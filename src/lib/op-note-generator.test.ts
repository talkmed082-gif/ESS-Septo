import { describe, expect, it } from "vitest";
import {
  buildPlanTable,
  buildProcedureName,
  generateOpNote,
  nasalFindingsSummary,
  nasalFindingsText,
  procedureNameFor,
  type NameStyle,
} from "./op-note-generator";
import type { FieldValues } from "./field-types";
import { comboOrderForDsn } from "./op-note-defs";

describe("비중격 교정 정도(o_septo_code)에 따른 기록지", () => {
  const both = { turb_inferior_right: true, turb_inferior_left: true };

  it("골(기본)은 기존 기록지 그대로", () => {
    const { procedureDetail } = generateOpNote("SEPTOPLASTY", { ...both }, "record");
    expect(procedureDetail).toContain("septal cartilage 및 골성 비중격 일부를 절제");
    expect(procedureDetail).not.toContain("내시경 하에");
    expect(buildProcedureName("SEPTOPLASTY", { ...both })).toBe("Septoturbinoplasty");
  });

  it("연골은 내시경적 비중격교정술", () => {
    const v = { ...both, o_septo_code: "연골 (O1005)" };
    const { procedureDetail } = generateOpNote("SEPTOPLASTY", v, "record");
    expect(procedureDetail).toContain("내시경 하에 확인된 편위 부위의 변형된 septal cartilage를 절제");
    expect(buildProcedureName("SEPTOPLASTY", v)).toBe("Endoscopic Septoturbinoplasty");
    expect(buildProcedureName("COMBO", { ...v, f_right_mma: true })).toContain("Endoscopic Septoturbinoplasty");
  });

  it("재건은 ANS·연골 분리 후 PDS 5-0 재고정 문장 하나만(ANS 체크와 합침)", () => {
    const v = { ...both, o_septo_code: "재건 (O1007)", s_ans_release: true };
    const { procedureDetail } = generateOpNote("SEPTOPLASTY", v, "record");
    expect(procedureDetail).toContain("양측 flap을 거상한 후 ANS(Anterior nasal spine)에서 septal cartilage를 분리하고, 교정 후 PDS 5-0로 ANS에 다시 고정함");
    expect(procedureDetail).not.toContain("septum을 분리한 후 절제하고");
    expect(procedureDetail.match(/PDS 5-0/g)).toHaveLength(1);
    const combo = generateOpNote("COMBO", { ...v, f_right_mma: true }, "record").procedureDetail;
    expect(combo).toContain("PDS 5-0로 ANS에 다시 고정함");
  });
});

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
    // 비중격 구획도 술식 이름으로(양측 inf. turbinoplasty가 없으면 Septoplasty)
    expect(headers).toEqual(["--- FESS - 좌측 ---", "--- Septoplasty ---", "--- FESS - 우측 ---", "--- 종료 ---"]);

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
    expect(buildProcedureName("ESS", fessSteps("both"), style)).toBe("[B] ESS(FEMS)");
  });

  it("병행에서 Inferior 양측이면 Septoturbinoplasty + ESS로 쓴다", () => {
    const values = { ...fessSteps("both", ["mma", "ant_eth"]), turb_inferior_right: true, turb_inferior_left: true };
    expect(buildProcedureName("COMBO", values)).toBe("Septoturbinoplasty + Both ESS(Ethmoid, Maxillary)");
  });

  it("병행에서 Inferior 한쪽만이면 Septoplasty를 유지한다", () => {
    const values = { ...fessSteps("both", ["mma", "ant_eth"]), turb_inferior_right: true };
    expect(buildProcedureName("COMBO", values)).toMatch(/^Septoplasty \+ /);
  });

  it("병행에서 Inferior 양측 + Middle 양측이면 Middle만 접미사로 남는다", () => {
    const values = {
      ...fessSteps("both", ["mma"]),
      turb_inferior_right: true,
      turb_inferior_left: true,
      turb_middle_right: true,
      turb_middle_left: true,
    };
    expect(buildProcedureName("COMBO", values)).toBe("Septoturbinoplasty + Both MMA + Both Mturbinoplasty");
  });

  it("단독 비중격은 Inferior 양측이면 Septoturbinoplasty", () => {
    expect(buildProcedureName("SEPTOPLASTY", { turb_inferior_right: true, turb_inferior_left: true })).toBe(
      "Septoturbinoplasty",
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
      "비용종: 우측(Middle meatus, Maxillary ostium, Ant. & post. ethmoid, Sphenoid, Frontal sinus, Extension to choana)",
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

  it("병행(COMBO)은 부비동을 아직 안 골랐어도 ESS를 지우지 않는다", () => {
    expect(buildProcedureName("COMBO", { turb_inferior_right: true })).toBe("Septoplasty + ESS + Rt. Turbinoplasty");
    expect(buildProcedureName("COMBO", { turb_inferior_right: true, turb_inferior_left: true })).toBe(
      "Septoturbinoplasty + ESS",
    );
    expect(
      buildProcedureName("COMBO", {
        turb_inferior_right: true,
        turb_inferior_left: true,
        turb_middle_right: true,
        turb_middle_left: true,
      }),
    ).toBe("Septoturbinoplasty + ESS + Both Mturbinoplasty");
  });
});

describe("procedureNameFor", () => {
  it("기본 수술 종류는 자동 생성하고, 사용자가 추가한 종류는 그 이름을 쓴다", () => {
    expect(procedureNameFor({ code: "ESS", name: "부비동내시경수술" }, fessSteps("right", ["mma"]))).toBe("Rt. MMA");
    expect(procedureNameFor({ code: "TONSIL", name: "편도절제술" }, {})).toBe("편도절제술");
  });
});

// Pre-op anatomy CLOSE(사용자 2026-10-16)
describe("CLOSE 해부학 소견", () => {
  it("새 항목도 기록지 소견과 요약에 CLOSE 순서로 들어간다", () => {
    const values = {
      n_ess_pe_done: true,
      n_onodi_present: true,
      n_onodi_side: "우측",
      n_keros_asym_present: true,
      n_keros_asym_side: "좌측",
      n_sphenoid_pneum_present: true,
      n_sphenoid_pneum_side: "Sellar",
    };
    const text = nasalFindingsText(values);
    expect(text).toContain("Asymmetric Keros (낮은 쪽): 좌측");
    expect(text).toContain("Sphenoid 함기화 형태: Sellar");
    expect(text.indexOf("Asymmetric Keros")).toBeLessThan(text.indexOf("Onodi's cell"));
    const summary = nasalFindingsSummary(values);
    expect(summary).toContain("우측 Onodi's cell");
    expect(summary).toContain("Sphenoid 함기화 형태 Sellar");
  });
});

describe("병행 수술 순서 기본값", () => {
  it("순서를 안 골랐으면 DSN으로 넓은 쪽 ESS부터", () => {
    expect(comboOrderForDsn("우측")).toBe("좌 FESS → 비중격 → 우 FESS");
    expect(comboOrderForDsn("좌측")).toBe("우 FESS → 비중격 → 좌 FESS");
    expect(comboOrderForDsn("특이 만곡 없음")).toBe("우 FESS → 비중격 → 좌 FESS");
  });
});

// 계획표 표기(사용자 2026-10-16)
describe("계획표 동반 술식·시행 순서·비용종 표기", () => {
  it("병행: 시행 순서의 비중격은 술식 이름으로, 계획표에 동반 술식 칸은 없다", () => {
    const table = buildPlanTable("COMBO", {
      turb_inferior_right: true,
      turb_inferior_left: true,
      c_order: "우 FESS → 비중격 → 좌 FESS",
    });
    const row = (label: string) => table.keyValueRows.find((r) => r.label === label)?.value;
    expect(row("시행 순서")).toBe("우 FESS → Septoturbinoplasty → 좌 FESS");
    expect(table.procedureName).toContain("Septoturbinoplasty");
    expect(row("동반 술식")).toBeUndefined();
    const septo = buildPlanTable("SEPTOPLASTY", { s_quilting: true });
    expect(septo.keyValueRows.some((r) => r.label === "동반 술식")).toBe(false);
  });

  it("ESS의 turbinoplasty도 수술명에만 쓰고 동반 술식 줄은 만들지 않는다", () => {
    const table = buildPlanTable("ESS", { turb_inferior_right: true, turb_middle_left: true, turb_middle_right: true });
    expect(table.procedureName).toContain("Turbinoplasty");
    expect(table.keyValueRows.find((r) => r.label === "동반 술식")).toBeUndefined();
  });

  it("비용종 Ant.·Post. ethmoid가 같이 있으면 하나로 묶는다", () => {
    expect(
      nasalFindingsText({ n_ess_pe_done: true, n_polyp_left_site_ant_ethmoid: true, n_polyp_left_site_post_ethmoid: true }),
    ).toContain("비용종: 좌측(Ant. & post. ethmoid)");
  });

  it("비용종 위치가 좌우 같으면 양측으로 한 번만", () => {
    const values = {
      n_ess_pe_done: true,
      n_polyp_right_site_mm: true,
      n_polyp_left_site_mm: true,
    };
    expect(nasalFindingsText(values)).toContain("비용종: 양측(");
  });
});

describe("silastic sheet 두 종류(사용자 2026-10-16)", () => {
  it("MM은 고른 방향으로, septal은 비중격 문장으로 쓴다", () => {
    const { procedureDetail } = generateOpNote(
      "COMBO",
      { ...fessSteps("both", ["mma"]), f_silastic_sheet: true, f_silastic_sheet_dir: "우측", s_splint: true },
      "record",
    );
    expect(procedureDetail).toContain("우측 middle meatus에 silastic sheet");
    expect(procedureDetail).toContain("septal silastic sheet를 삽입");

  });
});

describe("방향 표기 [B]", () => {
  it("괄호 표기는 [R]/[L]/[B]로 앞뒤를 감싼다", () => {
    const style: NameStyle = { sideNotation: "bracket", abbreviateRegions: true };
    expect(buildProcedureName("COMBO", { ...fessSteps("both"), turb_inferior_right: true, turb_inferior_left: true }, style)).toBe(
      "Septoturbinoplasty + [B] ESS(FEMS)",
    );
  });
});

describe("T&A (편도·아데노이드 절제술)", () => {
  it("수술 범위에 따라 수술명이 바뀐다(기본은 T&A)", () => {
    expect(buildProcedureName("TA", {})).toBe("Tonsillectomy and adenoidectomy");
    expect(buildProcedureName("TA", { t_scope: "T&A" })).toBe("Tonsillectomy and adenoidectomy");
    expect(buildProcedureName("TA", { t_scope: "Tonsillectomy only" })).toBe("Tonsillectomy");
    expect(buildProcedureName("TA", { t_scope: "Adenoidectomy only" })).toBe("Adenoidectomy");
    expect(procedureNameFor({ code: "TA", name: "편도·아데노이드 절제술 (T&A)" }, { t_scope: "Tonsillectomy only" })).toBe(
      "Tonsillectomy",
    );
  });

  it("T&A 기록지 — RAE tube, mouth gag, 피막하 박리, 아데노이드 제거, 지혈 확인, 발관", () => {
    const v: FieldValues = {
      n_ta_indication: "OSA (수면무호흡), Tonsillar hypertrophy (편도 비대)",
      n_tonsil_grade: "3",
      n_adenoid_grade: "III",
      t_scope: "T&A",
      t_tonsil_method: "Coblation",
      t_adenoid_method: "Microdebrider",
      t_hemostasis: "Bipolar cautery, Suture ligation",
      t_ebl: "20",
      t_note: "Kissing tonsil",
    };
    const { findings, procedureDetail } = generateOpNote("TA", v, "record");
    expect(findings).toBe(
      "Indication: OSA (수면무호흡), Tonsillar hypertrophy (편도 비대)\nTonsil: Brodsky grade 3\nAdenoid: grade III\n특이사항: Kissing tonsil",
    );
    expect(procedureDetail).toContain("1. 환자를 앙와위로 눕히고 전신마취 하에 oral RAE tube로 기관 삽관한 후 수술을 시작함");
    expect(procedureDetail).toContain("Crowe-Davis mouth gag");
    expect(procedureDetail).toContain("피막하 박리면(subcapsular plane)을 따라 Coblation wand로");
    expect(procedureDetail).toContain("bipolar cautery로 소작 및 봉합 결찰(suture ligation)하여 지혈함");
    expect(procedureDetail).toContain("Microdebrider로 아데노이드를 제거");
    expect(procedureDetail).toContain("양측 편도와 및 비인두에 활동성 출혈이 없음을 재확인");
    expect(procedureDetail).toContain("추정 출혈량(EBL) 20cc");
    expect(procedureDetail).toMatch(/발관한 후 수술을 종료함$/);
    // 비강 수술 문장(SPG block, packing)은 들어가지 않는다
    expect(procedureDetail).not.toContain("sphenopalatine");
    expect(procedureDetail).not.toContain("packing");
  });

  it("편도만 하면 아데노이드 단계가, 아데노이드만 하면 편도 단계가 빠진다", () => {
    const tonsilOnly = generateOpNote("TA", { t_scope: "Tonsillectomy only" }, "record").procedureDetail;
    expect(tonsilOnly).toContain("cold steel dissection으로");
    expect(tonsilOnly).not.toContain("아데노이드");
    expect(tonsilOnly).toContain("양측 편도와에 활동성 출혈이 없음");

    const adenoidOnly = generateOpNote("TA", { t_scope: "Adenoidectomy only" }, "record").procedureDetail;
    expect(adenoidOnly).toContain("Adenoid curette로 아데노이드를 제거");
    expect(adenoidOnly).not.toContain("편도");
    expect(adenoidOnly).toContain("비인두에 활동성 출혈이 없음");
  });

  it("계획(plan) 모드는 마취·발관 문장 없이 술식만, 계획표는 술전 소견 칸", () => {
    const plan = generateOpNote("TA", {}, "plan").procedureDetail;
    expect(plan).not.toContain("RAE tube");
    expect(plan).not.toContain("발관");
    const table = buildPlanTable("TA", { n_tonsil_grade: "4", t_scope: "Adenoidectomy only" });
    expect(table.procedureName).toBe("Adenoidectomy");
    expect(table.findingsLabel).toBe("술전 소견");
    expect(table.findings).toBe("Tonsil: Brodsky grade 4");
    expect(table.keyValueRows).toEqual([{ label: "아데노이드 절제", value: "Curettage" }]);
    expect(table.sideMatrix).toBeUndefined();
  });
});
