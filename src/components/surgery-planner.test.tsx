// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";

vi.mock("@/app/actions/patient-plan", () => ({ createPatientWithPlan: vi.fn() }));

import { SurgeryPlanner } from "./surgery-planner";
import { comboFullFields, essFullFields, septoplastyFullFields } from "@/lib/op-note-defs";

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

function fessTable(container: HTMLElement): HTMLTableElement {
  return Array.from(container.querySelectorAll("table")).find((t) => t.textContent?.includes("FESS 시행")) as HTMLTableElement;
}


// 버튼 순서: Frontal(0,1) Ant(2,3) Post(4,5) Max(6,7) Sphenoid(8,9) — 각 행 우측/좌측
describe("부비동염 셀 연속 클릭", () => {
  it("화면이 다시 그려지기 전에 연달아 눌러도 모든 클릭이 반영된다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn />);
    act(() => {
      sinusitisButtons(container)[4].click(); // Post. Ethmoid 우측
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
    fireEvent.click(sinusitisButtons(container)[4]); // Post. Ethmoid 우측
    const form = container.querySelector("form") as HTMLFormElement;
    const hidden = (name: string) => form.elements.namedItem(`field_${name}`) as HTMLInputElement;
    expect(hidden("n_sinusitis_post_ethmoid_right").checked).toBe(true);
    expect(hidden("f_right_post_eth").checked).toBe(true);
    const fessTable = Array.from(container.querySelectorAll("table")).find((t) => t.textContent?.includes("FESS 시행"));
    expect(fessTable?.textContent).toContain("Post. ethmoidectomy");
    expect(container.textContent).toContain("Post. Ethmoid sinusitis: 우측");
    fireEvent.click(sinusitisButtons(container)[4]); // 다시 눌러 해제
    expect(hidden("n_sinusitis_post_ethmoid_right").checked).toBe(false);
    expect(hidden("f_right_post_eth").checked).toBe(false);
  });

  it("수술 후 화면의 모식도도 소견에서 켠 부위를 그대로 보여준다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn />);
    fireEvent.click(sinusitisButtons(container)[4]); // Post. Ethmoid 우측
    fireEvent.click(byText(container, "수술 후 (수술 방법 · 기록지)")); // 모식도는 수술 후 화면에서만 그린다
    const diagramPost = Array.from(container.querySelectorAll("button")).filter((b) => b.textContent?.trim() === "Post. Ethmoid");
    // 모식도 버튼은 우측 열이 먼저
    expect(diagramPost[0].className).toContain("emerald");
    expect(diagramPost[1].className).not.toContain("emerald");
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
    expect(Array.from(container.querySelectorAll("button")).some((b) => b.textContent?.trim() === "Uncinectomy" || b.textContent?.trim() === "Post. Ethmoid")).toBe(false);
  });

  it("수술 후 화면에서 고른 부위가 수술 전 화면으로 돌아와도 유지된다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn />);
    fireEvent.click(byText(container, "수술 후 (수술 방법 · 기록지)"));
    const post = Array.from(container.querySelectorAll("button")).filter((b) => b.textContent?.trim() === "Post. Ethmoid");
    fireEvent.click(post[0]); // 우측 Post. Ethmoid
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
    // 수술 후 화면의 모식도에도 Uncinectomy 버튼이 생긴다
    fireEvent.click(byText(container, "수술 후 (수술 방법 · 기록지)"));
    expect(byText(container, "Uncinectomy")).toBeTruthy();
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
  const box = Array.from(container.querySelectorAll("label")).find((l) => l.textContent?.includes("해부학적 이상 소견"))!.querySelector("input") as HTMLInputElement;
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
    fireEvent.click(dsn(container, "side", "양측(C자형)"));
    const cShape = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.trim() === "양측(C자형)" && !b.hasAttribute("data-dsn")) as HTMLButtonElement;
    expect(cShape.className).toContain("emerald");
  });

  it("Septo 모식도에서 방향을 바꾸면 ESS의 DSN 행이 따라 바뀐다", () => {
    const { container } = renderCombo();
    const cShape = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.trim() === "양측(C자형)" && !b.hasAttribute("data-dsn")) as HTMLButtonElement;
    fireEvent.click(cShape);
    expect(dsn(container, "side", "양측(C자형)").className).toContain("emerald");
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

