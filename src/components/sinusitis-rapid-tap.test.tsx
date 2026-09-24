// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

vi.mock("@/app/actions/patient-plan", () => ({ createPatientWithPlan: vi.fn() }));

import { SurgeryPlanner } from "./surgery-planner";
import { comboFullFields, essFullFields } from "@/lib/op-note-defs";

afterEach(cleanup);

const CELLS = 10; // Frontal/Ant/Post/Max/Sphenoid × 우측/좌측
const TYPES = [
  { code: "ESS", fields: essFullFields },
  { code: "COMBO", fields: comboFullFields },
];

function setup(code: string, fields: typeof essFullFields) {
  const utils = render(<SurgeryPlanner surgeryTypes={[{ id: "1", code, name: code, fields }]} loggedIn />);
  const table = () => Array.from(utils.container.querySelectorAll("table")).find((t) => t.textContent?.includes("부비동염"))!;
  const buttons = () => Array.from(table().querySelectorAll("button")) as HTMLButtonElement[];
  const form = utils.container.querySelector("form") as HTMLFormElement;
  const state = () => buttons().map((b) => (b.className.includes("emerald") ? "1" : "0")).join("");
  // 화면의 체크 → FESS 시행 부위 숨은 체크박스 (행/열이 같은 부위)
  const fessKeys = ["frontal", "ant_eth", "post_eth", "mma", "sphenoid"];
  const fessHidden = () =>
    fessKeys.flatMap((k) => ["right", "left"].map((s) => ((form.elements.namedItem(`field_f_${s}_${k}`) as HTMLInputElement).checked ? "1" : "0"))).join("");
  const sinusHidden = () =>
    ["frontal", "ant_ethmoid", "post_ethmoid", "maxillary", "sphenoid"]
      .flatMap((k) => ["right", "left"].map((s) => ((form.elements.namedItem(`field_n_sinusitis_${k}_${s}`) as HTMLInputElement).checked ? "1" : "0")))
      .join("");
  return { ...utils, buttons, state, fessHidden, sinusHidden };
}

// 사용자가 화면에서 보고 있던 버튼(요소)을 먼저 잡아 두고 그 요소를 그대로 이어서
// 누른다 — 앞선 탭 때문에 버튼이 새 요소로 교체되면 뒤의 탭은 화면에서 사라진
// 요소에 전달되어 무시된다(폰에서 연타가 씹히던 현상).
describe.each(TYPES)("$code: 부비동염 셀 연타", ({ code, fields }) => {
  it("모든 셀 쌍을 연달아 눌러도 두 탭이 모두 반영된다", () => {
    const failures: string[] = [];
    for (let i = 0; i < CELLS; i++) {
      for (let j = 0; j < CELLS; j++) {
        if (i === j) continue;
        const t = setup(code, fields);
        const seen = t.buttons(); // 화면에 보이던 버튼들
        act(() => seen[i].click());
        act(() => seen[j].click());
        const expected = Array(CELLS).fill("0");
        expected[i] = "1";
        expected[j] = "1";
        const want = expected.join("");
        if (t.state() !== want) failures.push(`${i}→${j}: 표시 ${t.state()} (기대 ${want})`);
        if (t.sinusHidden() !== want) failures.push(`${i}→${j}: 폼값 ${t.sinusHidden()} (기대 ${want})`);
        if (t.fessHidden() !== want) failures.push(`${i}→${j}: FESS ${t.fessHidden()} (기대 ${want})`);
        t.unmount();
      }
    }
    expect(failures).toEqual([]);
  });

  it("무작위로 200번 연타해도 누른 횟수의 홀짝과 항상 일치한다", () => {
    let seed = 20260923;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const t = setup(code, fields);
    const seen = t.buttons();
    const expected = Array(CELLS).fill(0);
    for (let n = 0; n < 200; n++) {
      const i = Math.floor(rnd() * CELLS);
      act(() => seen[i].click());
      expected[i] ^= 1;
    }
    const want = expected.join("");
    expect({ 표시: t.state(), 폼값: t.sinusHidden(), FESS: t.fessHidden() }).toEqual({ 표시: want, 폼값: want, FESS: want });
  });
});

describe("터치 영역", () => {
  it("셀의 체크 버튼은 24px 버튼 밖 칸 전체를 눌러도 반응하도록 눌리는 영역이 넓혀져 있다", () => {
    const t = setup("ESS", essFullFields);
    for (const b of t.buttons()) {
      // 칸 안에서 조금 빗나가게 눌러도(폰) 탭이 무시되지 않게 하는 확장 영역
      expect(b.className).toContain("before:-inset-x-7");
      expect(b.className).toContain("before:-inset-y-2");
    }
  });
});
