import { pcJson } from "@/lib/pc-api";
import { endDeviceSession } from "@/lib/device-auth";

// 진료실 PC 프로그램을 끌 때 세션을 끊는 입구
export async function POST(request: Request) {
  return pcJson({ ended: await endDeviceSession(request) });
}
