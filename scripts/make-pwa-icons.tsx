// PWA 아이콘 PNG를 public/ 에 만든다: npx tsx scripts/make-pwa-icons.tsx
// (이모지는 next/og가 렌더 시 Twemoji를 받아오므로 인터넷 연결이 필요하다.)
import { writeFileSync } from "node:fs";
import { ImageResponse } from "next/og";

const BACKGROUND = "#a7f3d0"; // emerald-200 — 앱의 강조색, 어두운 청진기와 대비가 잘 됨

async function render(size: number, emojiScale: number, file: string) {
  const res = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BACKGROUND,
          fontSize: Math.round(size * emojiScale),
        }}
      >
        🩺
      </div>
    ),
    { width: size, height: size },
  );
  writeFileSync(`public/${file}`, Buffer.from(await res.arrayBuffer()));
  console.log("wrote", file);
}

// maskable은 가장자리가 잘려도 되도록 그림을 안쪽 80% 안전 영역에 넣는다.
async function main() {
  await render(192, 0.62, "icon-192.png");
  await render(512, 0.62, "icon-512.png");
  await render(512, 0.48, "icon-maskable-512.png");
  await render(180, 0.62, "apple-touch-icon.png");
}

main();
