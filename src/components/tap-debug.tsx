"use client";

import { useEffect } from "react";

// 임시 진단 도구 — 주소에 ?tapdebug=1 이 붙어 있을 때만 화면 아래에 터치/클릭
// 이벤트 로그를 띄운다(폰에서 셀 연타가 씹히는 원인 확인용). 원인을 찾으면 제거한다.
const EVENTS = [
  "pointerdown",
  "pointerup",
  "pointercancel",
  "touchstart",
  "touchend",
  "touchcancel",
  "click",
  "scroll",
] as const;

const TABLE_MARK = "부비동염";

function describe(target: EventTarget | null): string {
  if (!(target instanceof Element)) return "?";
  const button = target.closest("button");
  const table = target.closest("table");
  if (button && table?.textContent?.includes(TABLE_MARK)) {
    const row = button.closest("tr")?.firstElementChild?.textContent?.trim() ?? "?";
    const col = (button.closest("td") as HTMLTableCellElement | null)?.cellIndex === 1 ? "R" : "L";
    return `${row.replace(" sinusitis", "")} ${col}${button.isConnected ? "" : " (DETACHED)"}`;
  }
  const cell = target.closest("td");
  if (cell && table?.textContent?.includes(TABLE_MARK)) {
    return `td:${cell.parentElement?.firstElementChild?.textContent?.trim().replace(" sinusitis", "") ?? "?"}`;
  }
  return target.tagName.toLowerCase();
}

function cellState(): string {
  const table = Array.from(document.querySelectorAll("table")).find((t) => t.textContent?.includes(TABLE_MARK));
  return Array.from(table?.querySelectorAll("button") ?? [])
    .map((b) => (b.className.includes("emerald") ? "1" : "0"))
    .join("");
}

export function TapDebug() {
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("tapdebug")) return;
    const box = document.createElement("pre");
    Object.assign(box.style, {
      position: "fixed",
      left: "0",
      right: "0",
      bottom: "0",
      maxHeight: "34vh",
      overflow: "hidden",
      margin: "0",
      padding: "4px 6px",
      background: "rgba(0,0,0,0.88)",
      color: "#7CFC00",
      font: "10px/1.3 monospace",
      zIndex: "99999",
      pointerEvents: "none",
      whiteSpace: "pre-wrap",
    });
    document.body.appendChild(box);
    const t0 = performance.now();
    const lines: string[] = [];
    const push = (line: string) => {
      lines.push(line);
      if (lines.length > 28) lines.shift();
      box.textContent = lines.join("\n");
    };
    const stamp = () => String(Math.round(performance.now() - t0)).padStart(6, " ");
    const handler = (e: Event) => {
      if (e.type === "scroll") {
        push(`${stamp()} scroll`);
        return;
      }
      const pe = e as PointerEvent;
      const te = e as TouchEvent;
      const extra = pe.pointerType ? ` ${pe.pointerType}` : te.touches ? ` t=${te.touches.length}` : "";
      push(`${stamp()} ${e.type}${extra} ${describe(e.target)}`);
      if (e.type === "click") setTimeout(() => push(`${stamp()}   state ${cellState()}`), 0);
    };
    for (const type of EVENTS) document.addEventListener(type, handler, { capture: true, passive: true });
    push("tapdebug on — 셀을 연타해 보세요");
    return () => {
      for (const type of EVENTS) document.removeEventListener(type, handler, { capture: true });
      box.remove();
    };
  }, []);
  return null;
}
