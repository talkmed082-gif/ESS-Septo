// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import Link from "next/link";

vi.mock("@/app/actions/patient-plan", () => ({ createPatientWithPlan: vi.fn() }));
// 저장 안 한 채 떠날 때 창의 "저장 안 하고 이동"이 쓰는 라우터 — 테스트에는 앱 라우터가 없어서 대역을 둔다
const routerPush = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: routerPush }) }));

import { SurgeryPlanner } from "./surgery-planner";
import { comboFullFields, essFullFields, septoplastyFullFields, taFullFields } from "@/lib/op-note-defs";

const types = [{ id: "1", code: "ESS", name: "ESS", fields: essFullFields }];

function sinusitisState(container: HTMLElement): string {
  const table = Array.from(container.querySelectorAll("table")).find((t) => t.textContent?.includes("부비동염"));
  return Array.from(table?.querySelectorAll("button") ?? [])
    .map((b) => (b.className.includes("emerald") ? "1" : "0"))
    .join("");
}

function sinusitisButtons(container: HTMLElement): HTMLButtonElement[] {
  const table = Array.from(container.querySelectorAll("table")).find((t) => t.textContent?.includes("부비동염"));
  return Array.from(table?.querySelectorAll("button") ?? []) as HTMLButtonElement[];
}

afterEach(cleanup);

function byText(container: HTMLElement, text: string): HTMLButtonElement {
  return Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.trim() === text) as HTMLButtonElement;
}

function postCell(container: HTMLElement, rowLabel: string, side: "right" | "left"): HTMLButtonElement {
  const table = Array.from(container.querySelectorAll("table")).find((t) => t.querySelector("thead th")?.textContent?.trim() === "ESS 시행 부위") as HTMLTableElement;
  const row = Array.from(table.querySelectorAll("tbody tr")).find((tr) => tr.querySelector("td")?.textContent?.trim() === rowLabel)!;
  return row.querySelectorAll("button")[side === "right" ? 0 : 1] as HTMLButtonElement;
}

function fessTable(container: HTMLElement): HTMLTableElement {
  return Array.from(container.querySelectorAll("table")).find((t) => t.textContent?.includes("FESS 시행")) as HTMLTableElement;
}


// 버튼 순서: Frontal(0,1) Ant(2,3) Post(4,5) Max(6,7) Sphenoid(8,9) — 각 행 우측/좌측
describe("부비동염 셀 연속 클릭", () => {
  it("화면이 다시 그려지기 전에 연달아 눌러도 모든 클릭이 반영된다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn />);
    act(() => {
      sinusitisButtons(container)[4].click(); // Post. ethmoid 우측
      sinusitisButtons(container)[6].click(); // Maxillary 우측
    });
    expect(sinusitisState(container)).toBe("0000101000");
  });

  it("같은 셀을 연달아 두 번 누르면 원래대로 돌아온다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn />);
    act(() => {
      sinusitisButtons(container)[4].click();
      sinusitisButtons(container)[4].click();
    });
    expect(sinusitisState(container)).toBe("0000000000");
  });

  it("클릭이 하나씩 들어올 때도 그대로 동작한다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn />);
    fireEvent.click(sinusitisButtons(container)[4]);
    fireEvent.click(sinusitisButtons(container)[6]);
    expect(sinusitisState(container)).toBe("0000101000");
  });

  it("셀을 눌러도 표의 버튼이 새 요소로 교체되지 않는다 (교체되면 연타한 탭이 사라진다)", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn />);
    const before = sinusitisButtons(container);
    fireEvent.click(before[4]);
    fireEvent.click(before[6]);
    // 눌렀던 바로 그 버튼들이 아직 화면에 그대로 있어야 한다
    expect(before[4].isConnected).toBe(true);
    expect(before[6].isConnected).toBe(true);
    expect(sinusitisButtons(container)[4]).toBe(before[4]);
    expect(sinusitisState(container)).toBe("0000101000");
  });

  it("교체 없이 바뀐 값이 Op Plan 표와 저장될 폼 값에도 반영된다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn />);
    fireEvent.click(sinusitisButtons(container)[4]); // Post. ethmoid 우측
    const form = container.querySelector("form") as HTMLFormElement;
    const hidden = (name: string) => form.elements.namedItem(`field_${name}`) as HTMLInputElement;
    expect(hidden("n_sinusitis_post_ethmoid_right").checked).toBe(true);
    expect(hidden("f_right_post_eth").checked).toBe(true);
    const fessTable = Array.from(container.querySelectorAll("table")).find((t) => t.textContent?.includes("FESS 시행"));
    expect(fessTable?.textContent).toContain("Post. ethmoidectomy");
    expect(container.textContent).toContain("Post. ethmoid sinusitis: 우측");
    fireEvent.click(sinusitisButtons(container)[4]); // 다시 눌러 해제
    expect(hidden("n_sinusitis_post_ethmoid_right").checked).toBe(false);
    expect(hidden("f_right_post_eth").checked).toBe(false);
  });

  it("수술 후 화면의 모식도도 소견에서 켠 부위를 그대로 보여준다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn />);
    fireEvent.click(sinusitisButtons(container)[4]); // Post. ethmoid 우측
    fireEvent.click(byText(container, "수술 후 (수술 방법 · 기록지)")); // 모식도는 수술 후 화면에서만 그린다
    expect(postCell(container, "Post. ethmoid", "right").className).toContain("emerald");
    expect(postCell(container, "Post. ethmoid", "left").className).not.toContain("emerald");
  });

  it("Op Plan 표의 셀을 눌러도 교체 없이 소견 폼 값이 바뀐다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn />);
    const fessTable = () => Array.from(container.querySelectorAll("table")).find((t) => t.textContent?.includes("FESS 시행")) as HTMLTableElement;
    const cell = Array.from(fessTable().querySelectorAll("tbody tr"))[2].querySelectorAll("button")[0] as HTMLButtonElement; // Post. ethmoidectomy 우측
    fireEvent.click(cell);
    expect(cell.isConnected).toBe(true);
    const form = container.querySelector("form") as HTMLFormElement;
    expect((form.elements.namedItem("field_f_right_post_eth") as HTMLInputElement).checked).toBe(true);
  });

  it("화면에 보이지 않는 쪽(수술 후 모식도)은 수술 전 화면에서 그리지 않는다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn />);
    expect(Array.from(container.querySelectorAll("table")).some((t) => t.querySelector("thead th")?.textContent?.trim() === "ESS 시행 부위")).toBe(false);
  });

  it("수술 후 화면에서 고른 부위가 수술 전 화면으로 돌아와도 유지된다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn />);
    fireEvent.click(byText(container, "수술 후 (수술 방법 · 기록지)"));
    fireEvent.click(postCell(container, "Post. ethmoid", "right"));
    fireEvent.click(byText(container, "수술 전 (비강 소견 · Op Plan)"));
    const form = container.querySelector("form") as HTMLFormElement;
    expect((form.elements.namedItem("field_f_right_post_eth") as HTMLInputElement).checked).toBe(true);
    const row = Array.from(fessTable(container).querySelectorAll("tbody tr"))[2];
    expect(row.querySelectorAll("button")[0].className).toContain("emerald");
  });

  it("우→좌 동일 복사도 표를 다시 만들지 않고 값을 옮긴다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn />);
    const before = sinusitisButtons(container);
    const opCell = fessTable(container).querySelectorAll("tbody tr")[1].querySelectorAll("button")[0] as HTMLButtonElement; // Ant. ethmoidectomy 우측
    fireEvent.click(opCell);
    fireEvent.click(byText(container, "우→좌 동일"));
    const left = fessTable(container).querySelectorAll("tbody tr")[1].querySelectorAll("button")[1] as HTMLButtonElement;
    expect(left.className).toContain("emerald");
    expect(before[0].isConnected).toBe(true); // 소견 표의 버튼도 그대로
    const form = container.querySelector("form") as HTMLFormElement;
    expect((form.elements.namedItem("field_f_left_ant_eth") as HTMLInputElement).checked).toBe(true);
  });

  it("이전 수술력(Revision)을 켜도 표가 교체되지 않고 uncinectomy가 함께 켜진다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn />);
    const before = sinusitisButtons(container);
    const box = Array.from(container.querySelectorAll("label")).find((l) => l.textContent?.includes("이전 수술력"))!.querySelector("input") as HTMLInputElement;
    fireEvent.click(box);
    const rt = Array.from(container.querySelectorAll("label")).find((l) => l.textContent?.trim() === "Rt. ESS")!.querySelector("input") as HTMLInputElement;
    fireEvent.click(rt);
    expect(before[0].isConnected).toBe(true);
    const form = container.querySelector("form") as HTMLFormElement;
    expect((form.elements.namedItem("field_f_revision_ess_right") as HTMLInputElement).checked).toBe(true);
    expect((form.elements.namedItem("field_f_right_uncinectomy") as HTMLInputElement).checked).toBe(true);
    // 수술 후 화면의 ESS 시행 부위 표에도 Uncinectomy 행이 생기고, 우측은 이미 켜져 있다
    fireEvent.click(byText(container, "수술 후 (수술 방법 · 기록지)"));
    expect(postCell(container, "Uncinectomy", "right").className).toContain("emerald");
    expect(postCell(container, "Uncinectomy", "left").className).not.toContain("emerald");
  });

  it("부비동염 그룹을 접으면 그 안의 체크가 모두 꺼진다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn />);
    fireEvent.click(sinusitisButtons(container)[4]);
    const form = container.querySelector("form") as HTMLFormElement;
    expect((form.elements.namedItem("field_n_sinusitis_post_ethmoid_right") as HTMLInputElement).checked).toBe(true);
    const groupBox = Array.from(container.querySelectorAll("label")).find((l) => l.textContent?.includes("부비동염"))!.querySelector("input") as HTMLInputElement;
    fireEvent.click(groupBox); // 접기
    expect((form.elements.namedItem("field_n_sinusitis_post_ethmoid_right") as HTMLInputElement).checked).toBe(false);
  });
});

const allTypes = [
  { id: "1", code: "ESS", name: "ESS", fields: essFullFields },
  { id: "2", code: "SEPTOPLASTY", name: "Septo", fields: septoplastyFullFields },
  { id: "3", code: "COMBO", name: "Combo", fields: comboFullFields },
];

function dsn(container: HTMLElement, kind: "side" | "degree", value: string): HTMLButtonElement {
  return container.querySelector(`[data-dsn="${kind}:${value}"]`) as HTMLButtonElement;
}

function openAnatomic(container: HTMLElement) {
  const box = Array.from(container.querySelectorAll("label")).find((l) => l.textContent?.includes("Pre-op anatomy"))!.querySelector("input") as HTMLInputElement;
  if (!box.checked) fireEvent.click(box);
}

function fieldEls(container: HTMLElement, key: string): (HTMLInputElement | HTMLSelectElement)[] {
  return Array.from(container.querySelectorAll(`[name="field_${key}"]`));
}

describe("상단 수술 종류 체크박스 순서", () => {
  it("ESS가 왼쪽(먼저), Septo가 오른쪽(나중)에 있다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={allTypes} loggedIn />);
    const labels = Array.from(container.querySelectorAll("label")).map((l) => l.textContent?.trim());
    expect(labels.indexOf("ESS")).toBeGreaterThan(-1);
    expect(labels.indexOf("ESS")).toBeLessThan(labels.indexOf("Septo"));
  });
});

describe("비중격 기타 특이사항 중복 저장", () => {
  it("Septo P/E가 보이면 n_septum_note 체크박스는 옵션마다 한 벌뿐이다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={allTypes} loggedIn />);
    const septo = Array.from(container.querySelectorAll("label")).find((l) => l.textContent?.trim() === "Septo")!;
    fireEvent.click(septo.querySelector("input")!);
    const caudal = fieldEls(container, "n_septum_note").filter((el) => el.value === "Caudal deviation");
    expect(caudal).toHaveLength(1);
  });
});

describe("ESS 해부학적 이상 소견의 DSN", () => {
  it("ESS에서 방향과 정도를 고르면 폼 값과 요약에 반영된다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={allTypes} loggedIn />);
    openAnatomic(container);
    fireEvent.click(dsn(container, "side", "좌측"));
    fireEvent.click(dsn(container, "degree", "중등도"));
    expect(fieldEls(container, "n_dev_side")[0].value).toBe("좌측");
    expect(fieldEls(container, "n_deviation")[0].value).toBe("중등도");
    expect(container.textContent).toContain("DSN 좌측 중등도");
    expect(dsn(container, "side", "좌측").className).toContain("emerald");
  });

  it("고른 값을 다시 누르면 기본값(없음)으로 돌아간다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={allTypes} loggedIn />);
    openAnatomic(container);
    fireEvent.click(dsn(container, "side", "우측"));
    fireEvent.click(dsn(container, "side", "우측"));
    expect(fieldEls(container, "n_dev_side")[0].value).toBe("특이 만곡 없음");
  });

  it("ESS 소견 폼에 비중격 만곡 방향 select가 따로 노출되지 않는다(숨은 입력만)", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={allTypes} loggedIn />);
    const visible = fieldEls(container, "n_dev_side").filter((el) => !el.className.includes("hidden"));
    expect(visible).toHaveLength(0);
  });
});

describe("병행: Septo DSN과 ESS DSN 연동", () => {
  const renderCombo = () => {
    const utils = render(<SurgeryPlanner surgeryTypes={allTypes} loggedIn />);
    // 상단 체크박스로 Septo도 함께 선택 → 병행
    const septo = Array.from(utils.container.querySelectorAll("label")).find((l) => l.textContent?.trim() === "Septo")!.querySelector("input") as HTMLInputElement;
    fireEvent.click(septo);
    openAnatomic(utils.container);
    return utils;
  };

  it("ESS의 DSN 방향을 바꾸면 Septo 모식도가 따라 바뀐다", () => {
    const { container } = renderCombo();
    fireEvent.click(dsn(container, "side", "양측(S자형)"));
    const sShape = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.trim() === "양측(S자형)" && !b.hasAttribute("data-dsn")) as HTMLButtonElement;
    expect(sShape.className).toContain("emerald");
  });

  it("Septo 모식도에서 방향을 바꾸면 ESS의 DSN 행이 따라 바뀐다", () => {
    const { container } = renderCombo();
    const sShape = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.trim() === "양측(S자형)" && !b.hasAttribute("data-dsn")) as HTMLButtonElement;
    fireEvent.click(sShape);
    expect(dsn(container, "side", "양측(S자형)").className).toContain("emerald");
  });

  it("ESS에서 정도를 고르면 Septo의 정도 select도 바뀌고, 반대로도 따라간다", () => {
    const { container } = renderCombo();
    fireEvent.click(dsn(container, "degree", "경도"));
    for (const el of fieldEls(container, "n_deviation")) expect(el.value).toBe("경도");
    const visibleSelect = fieldEls(container, "n_deviation").find((el) => !el.className.includes("hidden")) as HTMLSelectElement;
    visibleSelect.value = "고도";
    fireEvent.change(visibleSelect);
    expect(dsn(container, "degree", "고도").className).toContain("emerald");
    expect(dsn(container, "degree", "경도").className).not.toContain("emerald");
  });
});

function tableByTitle(container: HTMLElement, title: string): HTMLTableElement | undefined {
  return Array.from(container.querySelectorAll("table")).find(
    (t) => t.querySelector("thead th")?.textContent?.trim() === title,
  ) as HTMLTableElement | undefined;
}

function rowLabels(table: HTMLTableElement | undefined): string[] {
  return Array.from(table?.querySelectorAll("tbody tr") ?? []).map((tr) => tr.querySelector("td")?.textContent?.trim() ?? "");
}

describe("부비동 표 순서·모양 통일", () => {
  const SURGICAL = ["Maxillary", "Ant. ethmoid", "Post. ethmoid", "Sphenoid", "Frontal"];

  it("부비동염 표, Op Plan 시행 부위 표, 수술 후 ESS 시행 부위 표가 같은 순서다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={allTypes} loggedIn />);
    const sinusitis = rowLabels(tableByTitle(container, "부비동염(Sinusitis) 소견")).map((l) => l.replace(" sinusitis", ""));
    expect(sinusitis).toEqual(SURGICAL);

    const plan = rowLabels(fessTable(container));
    expect(plan.map((l) => l.split(/[ (]/)[0])).toEqual(["MMA", "Ant.", "Post.", "Sphenoidotomy", "Frontal"]);

    fireEvent.click(byText(container, "수술 후 (수술 방법 · 기록지)"));
    expect(rowLabels(tableByTitle(container, "ESS 시행 부위"))).toEqual(SURGICAL);
  });

  it("비용종 표도 같은 흐름(Middle meatus·Maxillary → Ant. → Post. → Sphenoid → Frontal → choana)이다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={allTypes} loggedIn />);
    const polypBox = Array.from(container.querySelectorAll("label")).find((l) => l.textContent?.includes("비용종"))!.querySelector("input") as HTMLInputElement;
    fireEvent.click(polypBox);
    expect(rowLabels(tableByTitle(container, "비용종(Polyp) 위치"))).toEqual([
      "Middle meatus",
      "Maxillary ostium",
      "Ant. ethmoid",
      "Post. ethmoid",
      "Sphenoid",
      "Frontal sinus",
      "Extension to choana",
    ]);
  });

  it("수술 후 ESS 시행 부위도 다른 표와 같은 표 모양(우측/좌측 열, 체크 셀)이다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={allTypes} loggedIn />);
    fireEvent.click(byText(container, "수술 후 (수술 방법 · 기록지)"));
    const table = tableByTitle(container, "ESS 시행 부위")!;
    expect(Array.from(table.querySelectorAll("thead th")).map((th) => th.textContent?.trim())).toEqual(["ESS 시행 부위", "우측", "좌측"]);
    expect(table.querySelectorAll("tbody tr")).toHaveLength(5);
    expect(table.querySelectorAll("tbody button")).toHaveLength(10);
  });

  it("수술 후 표의 셀을 눌러도 폼 값이 바뀌고 수술 전 표에도 반영된다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={allTypes} loggedIn />);
    fireEvent.click(byText(container, "수술 후 (수술 방법 · 기록지)"));
    const row = Array.from(tableByTitle(container, "ESS 시행 부위")!.querySelectorAll("tbody tr"))[2]; // Post. ethmoid
    fireEvent.click(row.querySelectorAll("button")[0]); // 우측
    const form = container.querySelector("form") as HTMLFormElement;
    expect((form.elements.namedItem("field_f_right_post_eth") as HTMLInputElement).checked).toBe(true);
    fireEvent.click(byText(container, "수술 전 (비강 소견 · Op Plan)"));
    const planRow = Array.from(fessTable(container).querySelectorAll("tbody tr"))[2];
    expect(planRow.querySelectorAll("button")[0].className).toContain("emerald");
  });
});


describe("계획 화면 사용성", () => {
  const editPlan = { surgeryTypeId: "1", plannedDate: "2026-09-01", values: {}, planNote: "항응고제 복용 중" };

  it("저장된 계획을 다시 열면 계획 메모가 채워져 있다 (그대로 저장해도 지워지지 않는다)", () => {
    const { container } = render(
      <SurgeryPlanner surgeryTypes={types} loggedIn fixedPatient={{ id: "p", name: "홍길동" }} editPlan={editPlan} action={vi.fn()} />,
    );
    const note = container.querySelector('textarea[name="planNote"]') as HTMLTextAreaElement;
    expect(note.value).toBe("항응고제 복용 중");
  });

  it("환자 이름을 폼 안에서 한 번 더 보여주지 않는다 (페이지 제목에 이미 있음)", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn fixedPatient={{ id: "p", name: "홍길동" }} />);
    expect(container.textContent).not.toContain("홍길동");
  });

  it("새 환자 등록 화면의 상태 선택은 화면 탭(수술 전/후)과 다른 이름(예정/완료)이다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn />);
    const radios = Array.from(container.querySelectorAll('input[name="planStatus"]')) as HTMLInputElement[];
    expect(radios.map((r) => r.closest("label")?.textContent?.trim())).toEqual(["예정", "완료"]);
  });

  it("저장 버튼 줄이 화면 아래에 고정되고, 모바일용 요약 이동 버튼이 있다", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn fixedPatient={{ id: "p", name: "홍길동" }} />);
    const saveBtn = byText(container, "계획 저장");
    expect(saveBtn.parentElement?.className).toContain("sticky");
    // sticky는 부모 안에서만 따라다니므로, 폼 전체(긴 입력 영역)의 직속 자식이어야 한다.
    expect(saveBtn.parentElement?.parentElement?.tagName).toBe("FORM");
    const jump = byText(container, "요약 보기");
    expect(jump.className).toContain("lg:hidden");
    fireEvent.click(jump);
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("입력을 바꾼 뒤에만 페이지를 떠날 때 경고하고, 저장(제출)하면 경고하지 않는다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn fixedPatient={{ id: "p", name: "홍길동" }} />);
    const leave = () => {
      const ev = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(ev);
      return ev.defaultPrevented;
    };
    expect(leave()).toBe(false);
    fireEvent.change(container.querySelector('textarea[name="planNote"]')!, { target: { value: "메모" } });
    expect(leave()).toBe(true);
    fireEvent.submit(container.querySelector("form")!);
    expect(leave()).toBe(false);
  });

  // 사용자 2026-10-16: 확인/취소만 있는 브라우저 창 대신 저장하고 이동 / 저장 안 하고 이동 / 취소
  const renderDirty = () => {
    const utils = render(
      <>
        <Link href="/patients">환자 목록</Link>
        <SurgeryPlanner surgeryTypes={types} loggedIn fixedPatient={{ id: "p", name: "홍길동" }} />
      </>,
    );
    fireEvent.change(utils.container.querySelector('textarea[name="planNote"]')!, { target: { value: "메모" } });
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    act(() => {
      utils.container.querySelector('a[href="/patients"]')!.dispatchEvent(ev);
    });
    return { ...utils, ev };
  };

  it("입력을 바꾼 뒤 앱 안의 다른 링크를 누르면 이동을 막고 세 가지 선택 창을 띄운다, 취소하면 남는다", () => {
    routerPush.mockClear();
    const { container, ev } = renderDirty();
    expect(ev.defaultPrevented).toBe(true);
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    fireEvent.click(byText(container, "취소 (이 화면에 남기)"));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("저장 안 하고 이동은 누르려던 화면으로 간다", () => {
    routerPush.mockClear();
    const { container } = renderDirty();
    fireEvent.click(byText(container, "저장 안 하고 이동"));
    expect(routerPush).toHaveBeenCalledWith("/patients");
  });

  it("저장하고 이동은 갈 주소를 실어 저장 버튼으로 제출한다", () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, "requestSubmit").mockImplementation(() => {});
    const { container } = renderDirty();
    fireEvent.click(byText(container, "계획 저장 후 이동"));
    const form = container.querySelector("form")!;
    expect(submit).toHaveBeenCalledWith(form.querySelector('button[name="saveIntent"]'));
    expect((form.querySelector('input[name="nextHref"]') as HTMLInputElement).value).toBe("/patients");
    submit.mockRestore();
  });
});

describe("차트 Remark", () => {
  it("CC와 수술 후 특이사항을 수술명과 함께 remark로 묶고, 수술 전 화면에서도 저장 값이 남는다", () => {
    const { container } = render(
      <SurgeryPlanner
        surgeryTypes={types}
        loggedIn
        defaultView="post"
        editPlan={{ surgeryTypeId: "1", plannedDate: "2026-10-06", values: {}, chiefComplaint: "코막힘" }}
      />,
    );
    const remark = container.querySelector("textarea:not([name])") as HTMLTextAreaElement;
    fireEvent.change(remark, { target: { value: "출혈 많아 packing" } });
    const pre = Array.from(container.querySelectorAll("pre")).find((p) => p.textContent?.startsWith("코막힘 증상 있어"))!;
    expect(pre.textContent).toMatch(/^코막힘 증상 있어 10월 6일 .+ 시행함, 출혈 많아 packing\.$/);

    fireEvent.click(byText(container, "수술 전 (비강 소견 · Op Plan)"));
    const form = new FormData(container.querySelector("form")!);
    expect(form.get("chiefComplaint")).toBe("코막힘");
    expect(form.get("postOpRemark")).toBe("출혈 많아 packing");
  });
});

describe("수술 날짜", () => {
  it("수술 전 화면에서 저장해도 날짜가 같이 전송된다", () => {
    const { container } = render(
      <SurgeryPlanner
        surgeryTypes={types}
        loggedIn
        defaultView="pre"
        editPlan={{ surgeryTypeId: "1", plannedDate: "2026-10-06", values: {} }}
      />,
    );
    expect(new FormData(container.querySelector("form")!).get("plannedDate")).toBe("2026-10-06");
  });

  it("새 계획은 날짜를 오늘로 지어내지 않고 비워 둔다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn />);
    expect(new FormData(container.querySelector("form")!).get("plannedDate")).toBe("");
  });

  it("새 환자를 완료 상태로 등록하면 비어 있던 날짜를 오늘로 채우고 기록지 초안에도 반영한다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn />);
    fireEvent.click(container.querySelector('input[name="planStatus"][value="DONE"]')!);
    const date = new FormData(container.querySelector("form")!).get("plannedDate") as string;
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const draft = Array.from(container.querySelectorAll("pre")).find((p) => p.textContent?.startsWith("수술명"))!;
    expect(draft.textContent).toContain(date);
  });
});

describe("CC 빠른 입력", () => {
  it("증상을 누른 뒤 그 옆의 방향을 고르면 CC에 방향과 함께 들어가고, 다른 방향을 누르면 방향만 바뀐다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn />);
    const side = (label: string) => container.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
    fireEvent.click(byText(container, "코막힘"));
    fireEvent.click(side("코막힘 Rt."));
    fireEvent.click(byText(container, "후비루"));
    const cc = container.querySelector('input[name="chiefComplaint"]') as HTMLInputElement;
    expect(cc.value).toBe("코막힘 (Rt.), 후비루");
    fireEvent.click(side("코막힘 Both"));
    expect(cc.value).toBe("코막힘 (Both), 후비루");
  });
});

describe("소견 해제 시 시행 부위", () => {
  it("같은 부비동의 다른 소견(비용종)이 남아 있으면 부비동염을 꺼도 MMA는 그대로 둔다", () => {
    const { container } = render(
      <SurgeryPlanner
        surgeryTypes={types}
        loggedIn
        editPlan={{
          surgeryTypeId: "1",
          plannedDate: "",
          values: { n_sinusitis_maxillary_right: true, n_polyp_right_site_maxillary: true, f_right_mma: true },
        }}
      />,
    );
    // 버튼 순서: Maxillary 우측이 첫 칸
    fireEvent.click(sinusitisButtons(container)[0]);
    const form = new FormData(container.querySelector("form")!);
    expect(form.get("field_n_sinusitis_maxillary_right")).toBeNull();
    expect(form.get("field_f_right_mma")).toBe("on");
  });
});

describe("P/E 좌우 복사", () => {
  it("우측 → 좌측 복사를 누르면 부비동염 우측 체크가 좌측에도 들어가고, 좌측 → 우측은 반대로", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn />);
    fireEvent.click(sinusitisButtons(container)[0]); // Frontal 우측
    fireEvent.click(sinusitisButtons(container)[6]); // Maxillary 우측
    expect(sinusitisState(container)).toBe("1000001000");
    act(() => byText(container, "우측 → 좌측 복사").click());
    expect(sinusitisState(container)).toBe("1100001100");

    fireEvent.click(sinusitisButtons(container)[1]); // Frontal 좌측 해제
    act(() => byText(container, "좌측 → 우측 복사").click());
    expect(sinusitisState(container)).toBe("0000001100");
  });
});

describe("문구 템플릿", () => {
  const templates = [{ id: "t1", title: "수술 전 브리핑", body: "[수술 전 특이사항 및 브리핑]\n핵심 리스크: 출혈" }];

  it("계획 메모: 고르면 칸 끝에 붙고, 이미 쓴 내용은 지우지 않는다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn templates={templates} />);
    const note = container.querySelector("textarea[name='planNote']") as HTMLTextAreaElement;
    note.value = "Navigation 준비";
    const picker = container.querySelector("select[aria-label='템플릿 넣기']") as HTMLSelectElement;
    fireEvent.change(picker, { target: { value: "t1" } });
    expect(note.value).toBe("Navigation 준비\n\n[수술 전 특이사항 및 브리핑]\n핵심 리스크: 출혈");
    expect(picker.value).toBe("");
  });

  it("수술 후 특이사항: 고르면 칸에 들어가고 remark 문장에도 반영된다", () => {
    const { container } = render(
      <SurgeryPlanner
        surgeryTypes={types}
        loggedIn
        defaultView="post"
        templates={[{ id: "t2", title: "짧은", body: "특이 합병증 없음" }]}
        editPlan={{ surgeryTypeId: "1", plannedDate: "2026-10-16", values: {} }}
      />,
    );
    const pickers = container.querySelectorAll("select[aria-label='템플릿 넣기']");
    fireEvent.change(pickers[1], { target: { value: "t2" } }); // 계획 메모가 맨 위라 특이사항 칸은 두 번째
    const remark = container.querySelector("textarea:not([name])") as HTMLTextAreaElement;
    expect(remark.value).toBe("특이 합병증 없음");
    expect(Array.from(container.querySelectorAll("pre")).some((p) => p.textContent?.endsWith("특이 합병증 없음."))).toBe(true);
  });

  it("템플릿이 없으면 선택칸을 보이지 않는다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn />);
    expect(container.querySelector("select[aria-label='템플릿 넣기']")).toBeNull();
  });
});

// 사용자 요청 2026-10-16
describe("병행 수술 순서는 P/E(DSN)를 따른다", () => {
  const renderCombo = () => {
    const utils = render(<SurgeryPlanner surgeryTypes={allTypes} loggedIn />);
    const septo = Array.from(utils.container.querySelectorAll("label")).find((l) => l.textContent?.trim() === "Septo")!.querySelector("input") as HTMLInputElement;
    fireEvent.click(septo);
    openAnatomic(utils.container);
    return utils;
  };
  const order = (c: HTMLElement) => fieldEls(c, "c_order")[0].value;

  it("기본은 넓은 쪽 ESS → 비중격 → 좁은 쪽 ESS, DSN 방향을 바꾸면 순서가 따라 바뀐다", () => {
    const { container } = renderCombo();
    expect(order(container)).toBe("우 FESS → 비중격 → 좌 FESS");
    fireEvent.click(dsn(container, "side", "우측")); // 우측으로 휨 → 우측이 좁다 → 좌측(넓은 쪽)부터
    expect(order(container)).toBe("좌 FESS → 비중격 → 우 FESS");
    fireEvent.click(dsn(container, "side", "좌측"));
    expect(order(container)).toBe("우 FESS → 비중격 → 좌 FESS");
  });

  it("순서를 손으로 바꿔도 DSN은 그대로다", () => {
    const { container } = renderCombo();
    fireEvent.click(dsn(container, "side", "우측"));
    const select = fieldEls(container, "c_order").find((el) => el instanceof HTMLSelectElement) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "비중격 → 우 FESS → 좌 FESS" } });
    expect(order(container)).toBe("비중격 → 우 FESS → 좌 FESS");
    expect(fieldEls(container, "n_dev_side")[0].value).toBe("우측");
  });
});

describe("Septo 기본 세트", () => {
  it("ESS에서 Septo를 켜면 양측 inf. turbinoplasty와 septal silastic sheet가 체크되고, MM silastic sheet는 기본으로 안 켜진다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={allTypes} loggedIn />);
    const septo = Array.from(container.querySelectorAll("label")).find((l) => l.textContent?.trim() === "Septo")!.querySelector("input") as HTMLInputElement;
    fireEvent.click(septo);
    const form = new FormData(container.querySelector("form")!);
    expect(form.get("field_turb_inferior_right")).toBe("on");
    expect(form.get("field_turb_inferior_left")).toBe("on");
    expect(form.get("field_s_splint")).toBe("on");
    expect(form.get("field_f_silastic_sheet")).toBeNull();
  });

  it("Turbinoplasty 시행을 켜면 양측 inferior가 체크되고, Middle은 MT 버튼을 눌러야 보인다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn defaultView="post" />);
    const performed = Array.from(container.querySelectorAll("label")).find((l) => l.textContent?.includes("Turbinoplasty 시행"))!.querySelector("input") as HTMLInputElement;
    fireEvent.click(performed);
    const form = () => new FormData(container.querySelector("form")!);
    expect(form().get("field_turb_inferior_right")).toBe("on");
    expect(form().get("field_turb_inferior_left")).toBe("on");
    expect(container.textContent).not.toContain("Middle turbinoplasty");
    fireEvent.click(byText(container, "MT turbinoplasty"));
    expect(container.textContent).toContain("Middle turbinoplasty");
  });
});

describe("저장 버튼", () => {
  it("버튼은 하나이고, 수술 후 화면에서는 완료로 바꾸는 저장(record)이 된다", () => {
    const { container } = render(
      <SurgeryPlanner
        surgeryTypes={types}
        loggedIn
        defaultView="pre"
        editPlan={{ surgeryTypeId: "1", plannedDate: "2026-10-16", values: {} }}
      />,
    );
    const saves = () => Array.from(container.querySelectorAll("button[name='saveIntent']")) as HTMLButtonElement[];
    expect(saves()).toHaveLength(1);
    expect(saves()[0].value).toBe("save");
    fireEvent.click(byText(container, "수술 후 (수술 방법 · 기록지)"));
    expect(saves()[0].value).toBe("record");
    expect(saves()[0].textContent).toBe("저장 · 수술 완료로 변경");
  });

  it("CC는 수술 전 화면에서만 보이고, 수술 후 화면에서도 값은 전송된다", () => {
    const { container } = render(
      <SurgeryPlanner
        surgeryTypes={types}
        loggedIn
        defaultView="post"
        editPlan={{ surgeryTypeId: "1", plannedDate: "2026-10-16", values: {}, chiefComplaint: "코막힘" }}
      />,
    );
    expect(container.textContent).not.toContain("CC (주호소)");
    expect(new FormData(container.querySelector("form")!).get("chiefComplaint")).toBe("코막힘");
  });
});

describe("Silastic 제거 리마인더", () => {
  it("silastic을 넣었으면 수술 후 화면에 버튼이 보이고, 누르면 수술 날짜로 추가한다", async () => {
    const add = vi.fn().mockResolvedValue({ ok: true });
    const { container, findByText } = render(
      <SurgeryPlanner
        surgeryTypes={allTypes}
        loggedIn
        defaultView="post"
        editPlan={{ surgeryTypeId: "3", plannedDate: "2026-10-16", values: { f_silastic_sheet: true } }}
        silasticReminder={{ exists: false, add }}
      />,
    );
    fireEvent.click(byText(container, "Silastic 제거 리마인더 추가 (수술일 +7일)"));
    expect(add).toHaveBeenCalledWith("2026-10-16");
    expect(await findByText("✓ Silastic 제거 리마인더 있음 (환자 화면에서 확인)")).toBeTruthy();
  });

  it("silastic이 없으면 버튼을 보이지 않는다", () => {
    const { container } = render(
      <SurgeryPlanner
        surgeryTypes={types}
        loggedIn
        defaultView="post"
        editPlan={{ surgeryTypeId: "1", plannedDate: "2026-10-16", values: { f_silastic_sheet: false } }}
        silasticReminder={{ exists: false, add: vi.fn() }}
      />,
    );
    expect(container.textContent).not.toContain("Silastic 제거 리마인더");
  });
});

describe("Pre-op anatomy 시신경/경동맥 분리", () => {
  it("새 항목 두 개가 보이고, 예전 합친 항목은 체크된 적 없으면 안 보인다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn />);
    openAnatomic(container);
    expect(container.textContent).toContain("경동맥관 골 결손");
    expect(container.textContent).toContain("시신경관 골 결손 (접형동)");
    expect(container.textContent).not.toContain("시신경/경동맥 골 결손");
  });

  it("예전 합친 항목이 체크된 계획은 그대로 보인다", () => {
    const { container } = render(
      <SurgeryPlanner
        surgeryTypes={types}
        loggedIn
        editPlan={{ surgeryTypeId: "1", plannedDate: "", values: { n_dehiscence_present: true, n_dehiscence_side: "우측" } }}
      />,
    );
    openAnatomic(container);
    expect(container.textContent).toContain("시신경/경동맥 골 결손");
  });
});

describe("특이사항 (가끔 하는 것)", () => {
  it("MM silastic sheet·quilting 등은 접힌 칸에 있고, 접혀 있어도 값이 전송된다", () => {
    const { container } = render(
      <SurgeryPlanner
        surgeryTypes={allTypes}
        loggedIn
        defaultView="post"
        editPlan={{ surgeryTypeId: "3", plannedDate: "2026-10-16", values: {} }}
      />,
    );
    const details = Array.from(container.querySelectorAll("details")).find((d) =>
      d.querySelector("summary")?.textContent?.includes("특이사항 (가끔 하는 것)"),
    )!;
    expect(details.open).toBe(false);
    expect(details.textContent).toContain("MM silastic sheet");
    expect(details.textContent).toContain("Quilting suture");
    // 수술 후 마무리 칸에는 septal silastic sheet만
    expect(new FormData(container.querySelector("form")!).get("field_s_splint")).toBe("on");
  });

  it("하나라도 체크돼 있으면 펼쳐서 연다", () => {
    const { container } = render(
      <SurgeryPlanner
        surgeryTypes={allTypes}
        loggedIn
        defaultView="post"
        editPlan={{ surgeryTypeId: "3", plannedDate: "2026-10-16", values: { s_quilting: true } }}
      />,
    );
    expect(container.querySelector("details")?.open).toBe(true);
  });
});

describe("T&A 선택", () => {
  const withTa = [...allTypes, { id: "4", code: "TA", name: "편도·아데노이드 절제술 (T&A)", fields: taFullFields }];

  function taCheckbox(container: HTMLElement): HTMLInputElement {
    const label = Array.from(container.querySelectorAll("label")).find((l) => l.textContent?.trim() === "T&A")!;
    return label.querySelector("input")!;
  }

  it("T&A를 체크하면 ESS/Septo가 꺼지고 T&A 수술명·기록지가 만들어진다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={withTa} loggedIn />);
    fireEvent.click(taCheckbox(container));
    expect(taCheckbox(container).checked).toBe(true);
    expect(new FormData(container.querySelector("form")!).get("surgeryTypeId")).toBe("4");
    expect(container.textContent).toContain("Tonsillectomy and adenoidectomy");
    expect(container.textContent).toContain("편도 크기 (Brodsky grade)");

    fireEvent.click(byText(container, "수술 후 (수술 방법 · 기록지)"));
    expect(container.textContent).toContain("수술 범위");
    // 비강 수술용 Turbinoplasty 입력은 나오지 않는다
    expect(container.textContent).not.toContain("Inferior turbinoplasty");
    const scope = container.querySelector<HTMLSelectElement>('select[name="field_t_scope"]')!;
    fireEvent.change(scope, { target: { value: "Tonsillectomy only" } });
    expect(container.textContent).toContain("Crowe-Davis mouth gag");
    expect(container.textContent).not.toContain("Tonsillectomy and adenoidectomy");
  });
});
