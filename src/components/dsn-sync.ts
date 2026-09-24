import { useEffect, useEffectEvent, type RefObject } from "react";
import { DSN_DEGREE_KEY, DSN_SIDE_KEY } from "@/lib/op-note-defs";
import type { FieldValues } from "@/lib/field-types";

// DSN(비중격 만곡) 방향/정도는 Septo의 모식도·정도 select와 ESS 해부학적 이상
// 소견의 DSN 행이 같은 폼 값을 공유한다. 한쪽이 값을 바꾸면 폼에 "dsn-sync"
// 이벤트를 보내 다른 쪽이 폼 값을 다시 읽게 해서, 서로를 직접 알지 못해도
// (계획 화면/기록지 화면 어디서든) 항상 같은 값을 보여준다.
export const DSN_NO_SIDE = "특이 만곡 없음";
export const DSN_NO_DEGREE = "해당없음";
export const DSN_SIDES = [DSN_NO_SIDE, "우측", "양측(C자형)", "좌측"] as const;
export const DSN_DEGREES = [DSN_NO_DEGREE, "경도", "중등도", "고도"] as const;

const SYNC_EVENT = "dsn-sync";
const NAME = { side: `field_${DSN_SIDE_KEY}`, degree: `field_${DSN_DEGREE_KEY}` } as const;

export type DsnKind = keyof typeof NAME;

function elementsFor(form: HTMLFormElement | null, kind: DsnKind): (HTMLInputElement | HTMLSelectElement)[] {
  if (!form) return [];
  return Array.from(form.querySelectorAll(`[name="${NAME[kind]}"]`)).filter(
    (el): el is HTMLInputElement | HTMLSelectElement => el instanceof HTMLInputElement || el instanceof HTMLSelectElement,
  );
}

export function readDsn(form: HTMLFormElement | null): { side: string; degree: string } {
  return {
    side: elementsFor(form, "side")[0]?.value || DSN_NO_SIDE,
    degree: elementsFor(form, "degree")[0]?.value || DSN_NO_DEGREE,
  };
}

// 같은 이름의 입력이 화면에 여러 개(보이는 select + 숨은 입력) 있어도 전부 맞춘다.
export function writeDsn(form: HTMLFormElement | null, kind: DsnKind, value: string): void {
  for (const el of elementsFor(form, kind)) el.value = value;
  form?.dispatchEvent(new CustomEvent(SYNC_EVENT));
}

export function hasDsnValue(values: FieldValues | undefined): boolean {
  const side = values?.[DSN_SIDE_KEY];
  const degree = values?.[DSN_DEGREE_KEY];
  return (typeof side === "string" && side !== "" && side !== DSN_NO_SIDE) ||
    (typeof degree === "string" && degree !== "" && degree !== DSN_NO_DEGREE);
}

// 폼에서 DSN 값이 바뀌면(다른 컴포넌트가 보낸 sync 이벤트, 또는 정도 select를
// 직접 바꾼 change 이벤트) onSync를 부른다.
export function useDsnSync(rootRef: RefObject<HTMLElement | null>, onSync: () => void): void {
  const handle = useEffectEvent(onSync);
  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const onChange = (e: Event) => {
      const name = (e.target as HTMLInputElement | null)?.name;
      if (name === NAME.side || name === NAME.degree) handle();
    };
    form.addEventListener(SYNC_EVENT, handle);
    form.addEventListener("change", onChange);
    return () => {
      form.removeEventListener(SYNC_EVENT, handle);
      form.removeEventListener("change", onChange);
    };
  }, [rootRef]);
}
