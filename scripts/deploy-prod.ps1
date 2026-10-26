# ESS-Septo 운영 배포(이 병원 PC에서) — origin/main을 임시 작업 폴더로 꺼내 vercel deploy --prod.
# 병원 PC 이름이 한글이라 Vercel CLI가 깨지므로 os.hostname을 바꿔 끼운다(메모리 hospital-pc-dev-limits).
# 집 PC 허브 재시작이 막혀 있어 이 방식을 쓴다. 먼저 git push가 끝나 있어야 한다(origin/main을 배포)
# 사용: powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\PNUYH\ESS-Septo\scripts\deploy-prod.ps1
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$tmp = Join-Path $env:TEMP "ess-deploy-$(Get-Random)"
$hostFix = Join-Path $env:TEMP 'ess-hostname.js'
Set-Content -Encoding ascii $hostFix 'require("os").hostname = () => "hospital-pc";'
Push-Location $repo
try {
  git fetch origin 2>&1 | Out-Null
  git worktree add --detach $tmp origin/main 2>&1 | Out-Null
  Copy-Item -Recurse (Join-Path $repo '.vercel') (Join-Path $tmp '.vercel')
  Push-Location $tmp
  try {
    "배포할 커밋: $(git log --oneline -1)"
    $env:NODE_OPTIONS = "--require $hostFix"
    $o = npx vercel deploy --prod --yes 2>&1 | Out-String
    $state = [regex]::Match($o, '"readyState":\s*"([^"]+)"').Groups[1].Value
    $url = [regex]::Match($o, '"url":\s*"([^"]+)"').Groups[1].Value
    "결과: $state $url"
    if ($state -ne 'READY') { $o.Substring([Math]::Max(0, $o.Length - 1500)); exit 1 }
  } finally { Pop-Location }
} finally {
  git worktree remove --force $tmp 2>&1 | Out-Null
  Pop-Location
}
