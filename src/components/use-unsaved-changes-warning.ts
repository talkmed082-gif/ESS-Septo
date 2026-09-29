"use client";

import { useEffect } from "react";

// 저장하지 않은 입력이 있을 때 페이지를 떠나면 확인을 묻는다 — 새로고침·탭
// 닫기는 beforeunload로, 앱 안의 링크(Next Link 포함, 클라이언트 이동이라
// beforeunload가 안 뜸)는 document 캡처 단계에서 먼저 가로채서 막는다.
export function useUnsavedChangesWarning(
  enabled: boolean,
  message = "저장하지 않은 내용이 있습니다. 이 화면을 떠날까요?",
) {
  useEffect(() => {
    if (!enabled) return;

    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(a instanceof HTMLAnchorElement)) return;
      // 새 탭·다운로드·메일 링크, 같은 페이지 안의 #앵커는 화면을 떠나지 않는다.
      if (a.target === "_blank" || a.hasAttribute("download") || a.protocol === "mailto:") return;
      if (a.origin === location.origin && a.pathname === location.pathname && a.hash) return;
      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [enabled, message]);
}
