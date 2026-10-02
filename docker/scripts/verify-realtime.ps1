<#
  verify-realtime.ps1 — D1 "real data" acceptance check for a RESTARTED container.

  WHY THIS EXISTS
  ---------------
  A container can answer HTTP while still serving STALE bytecode. "The port is
  green" is therefore NOT evidence that the current src/ is running. Only a
  restart proves it. This script is meant to be run AFTER the user restarts.

  USAGE (from repo root)
    pwsh -File docker\scripts\verify-realtime.ps1
    powershell -ExecutionPolicy Bypass -File docker\scripts\verify-realtime.ps1

  EXIT CODE
    0 = every check passed
    1 = at least one check failed

  NOTES
    - Console output is intentionally ASCII-only so it renders correctly on
      PowerShell 5.1 regardless of whether this file carries a UTF-8 BOM
      (see docs/STARTUP.md sec.9). Chinese explanation lives in the docs.
#>

[CmdletBinding()]
param(
    [string]$Backend  = 'http://127.0.0.1:1000',
    [string]$Frontend = 'http://127.0.0.1:5173',
    [string]$Password = '123456'
)

$ErrorActionPreference = 'Continue'
$script:Fail = 0
$script:Pass = 0

function Write-Head([string]$t) {
    Write-Host ''
    Write-Host ('=' * 68) -ForegroundColor Cyan
    Write-Host "  $t"
    Write-Host ('=' * 68) -ForegroundColor Cyan
}

function Check([string]$name, [bool]$ok, [string]$detail) {
    if ($ok) {
        $script:Pass++
        Write-Host ("  [ PASS ] " + $name.PadRight(34)) -ForegroundColor Green
    } else {
        $script:Fail++
        Write-Host ("  [ FAIL ] " + $name.PadRight(34)) -ForegroundColor Red
    }
    if ($detail) { Write-Host ("           " + $detail) -ForegroundColor DarkGray }
}

function Get-Code([string]$url) {
    try { return [int](& curl.exe -s -o NUL -w '%{http_code}' --max-time 10 $url) }
    catch { return 0 }
}

# Login returns @{ Ok; Token; Msg }
function Login([string]$user, [string]$type) {
    $tmp = [System.IO.Path]::GetTempFileName()
    $body = '{"username":"' + $user + '","password":"' + $Password + '","type":"' + $type + '"}'
    [System.IO.File]::WriteAllText($tmp, $body, (New-Object System.Text.UTF8Encoding($false)))
    $raw = (& curl.exe -s --max-time 20 -X POST "$Backend/common/login" `
        -H 'Content-Type: application/json' --data-binary "@$tmp" 2>&1 | Out-String)
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    try {
        $o = $raw | ConvertFrom-Json
        if ($o.code -eq 200 -and $o.data) { return @{ Ok = $true; Token = [string]$o.data; Msg = '' } }
        return @{ Ok = $false; Token = ''; Msg = "code=$($o.code) msg=$($o.msg)" }
    } catch { return @{ Ok = $false; Token = ''; Msg = 'unparseable response' } }
}

function Get-Api([string]$token, [string]$path) {
    $raw = (& curl.exe -s --max-time 20 "$Backend$path" -H "Authorization: Bearer $token" 2>&1 | Out-String)
    try { return $raw | ConvertFrom-Json } catch { return $null }
}

Write-Head 'NEXUS MARKET - realtime data acceptance (post-restart)'

# ── 1. Services up ────────────────────────────────────────────────────────────
Write-Host ''
Write-Host '[1] Service reachability'
$b = Get-Code "$Backend/"
Check 'backend :1000 responds' ($b -ne 0 -and $b -ne 000) "GET / -> HTTP $b  (401/403/404 all mean UP)"
$f = Get-Code "$Frontend/"
Check 'frontend :5173 responds' ($f -eq 200) "GET / -> HTTP $f"

if ($b -eq 0 -or $b -eq 000) {
    Write-Host ''
    Write-Host 'Backend is NOT up. Restart the container first, then re-run.' -ForegroundColor Red
    exit 1
}

# ── 2. Logins ─────────────────────────────────────────────────────────────────
Write-Host ''
Write-Host '[2] Demo account login'
$a = Login 'admin' 'ADMIN'
Check 'admin / ADMIN' $a.Ok $a.Msg
$s = Login 'shop1' 'SHOP'
Check 'shop1 / SHOP'  $s.Ok $s.Msg
$u = Login 'user1' 'USER'
Check 'user1 / USER'  $u.Ok $u.Msg

if (-not ($a.Ok -and $s.Ok -and $u.Ok)) {
    Write-Host ''
    Write-Host 'Login failed - cannot continue acceptance checks.' -ForegroundColor Red
    exit 1
}

# ── 3. Admin dashboard (was hardcoded "$0"/"0") ───────────────────────────────
Write-Host ''
Write-Host '[3] Admin dashboard - MUST be real aggregation'
$r = Get-Api $a.Token '/admin/dashboard/stats'
if ($null -eq $r -or $r.code -ne 200) {
    Check 'GET /admin/dashboard/stats' $false "bad response"
} else {
    $vals = @($r.data | ForEach-Object { $_.value })
    Check 'GET /admin/dashboard/stats' $true (($vals -join ' | '))
    # Stale fingerprint: every metric exactly "$0" / "0" AND no decimal formatting.
    $allZero = @($r.data | Where-Object { $_.value -eq '$0' -or $_.value -eq '0' }).Count -eq @($r.data).Count
    Check 'not the old hardcoded stub' (-not $allZero) 'old class returned ALL metrics as $0 / 0'
}

# ── 4. Revenue chart (was always []) ─────────────────────────────────────────
Write-Host ''
Write-Host '[4] Admin revenue chart - MUST be a real date series'
$r = Get-Api $a.Token '/admin/dashboard/revenue-chart?days=7'
$pts = @()
if ($null -ne $r -and $r.code -eq 200) { $pts = @($r.data) }
Check 'GET /admin/dashboard/revenue-chart' ($pts.Count -gt 0) "points=$($pts.Count) (old class returned [])"
Check 'points carry a date field' ($pts.Count -gt 0 -and $null -ne $pts[0].date) `
    $(if ($pts.Count -gt 0) { "first=$($pts[0].date)" } else { 'n/a' })

# ── 5. Merchant dashboard (was hardcoded "$0") ────────────────────────────────
Write-Host ''
Write-Host '[5] Merchant dashboard - MUST be real aggregation'
$r = Get-Api $s.Token '/merchant/dashboard/stats'
if ($null -eq $r -or $r.code -ne 200) {
    Check 'GET /merchant/dashboard/stats' $false 'bad response'
} else {
    $vals = @($r.data | ForEach-Object { $_.value })
    Check 'GET /merchant/dashboard/stats' $true (($vals -join ' | '))
    $prod = @($r.data | Where-Object { $_.label -eq 'Products' })
    # shop1 owns products in the seed data, so a hard "0" here is the stale fingerprint.
    if ($prod.Count -eq 1) {
        Check 'Products count is not stubbed 0' ($prod[0].value -ne '0') "Products=$($prod[0].value)"
    }
}

# ── 6. Category counts (old class returned All:0 with fixed keys) ────────────
Write-Host ''
Write-Host '[6] Category counts - All must be > 0'
$r = Get-Api $u.Token '/products/category-counts'
$all = $null
if ($null -ne $r -and $r.code -eq 200 -and $null -ne $r.data.All) { $all = [int]$r.data.All }
Check 'GET /products/category-counts' ($null -ne $all) `
    $(if ($null -ne $r -and $r.code -eq 200) { ($r.data | ConvertTo-Json -Compress) } else { 'bad response' })
Check 'All is greater than zero' ($null -ne $all -and $all -gt 0) `
    "All=$all  (old class returned All=0 with hardcoded keys)"

# ── 7. Contract change: missing shop must be 404, not 200 "Unknown Store" ─────
Write-Host ''
Write-Host '[7] Contract change - missing shop returns 404'
$tmp = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllText($tmp, '{}', (New-Object System.Text.UTF8Encoding($false)))
$code = & curl.exe -s -o NUL -w '%{http_code}' --max-time 15 `
    "$Backend/merchants/99999/profile" -H "Authorization: Bearer $($u.Token)" 2>&1
Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
Check 'GET /merchants/99999/profile -> 404' ("$code" -eq '404') "HTTP $code (old class returned 200 + 'Unknown Store')"

# ── 8. Authz isolation still enforced ────────────────────────────────────────
Write-Host ''
Write-Host '[8] Cross-role isolation'
$code = & curl.exe -s -o NUL -w '%{http_code}' --max-time 15 `
    "$Backend/merchant/dashboard/stats" -H "Authorization: Bearer $($a.Token)" 2>&1
Check 'ADMIN blocked from /merchant/**' ("$code" -eq '403') "HTTP $code"
$code = & curl.exe -s -o NUL -w '%{http_code}' --max-time 15 `
    "$Backend/admin/dashboard/stats" -H "Authorization: Bearer $($s.Token)" 2>&1
Check 'SHOP blocked from /admin/**' ("$code" -eq '403') "HTTP $code"

# ── Summary ──────────────────────────────────────────────────────────────────
Write-Host ''
Write-Host ('=' * 68) -ForegroundColor Cyan
Write-Host ("  RESULT: {0} passed, {1} failed" -f $script:Pass, $script:Fail)
Write-Host ('=' * 68) -ForegroundColor Cyan
if ($script:Fail -gt 0) {
    Write-Host ''
    Write-Host '  A FAILED check here means the container is STILL serving stale' -ForegroundColor Yellow
    Write-Host '  bytecode. Confirm the restart actually recompiled:' -ForegroundColor Yellow
    Write-Host '    docker exec nexus-dev bash -lc "tail -n 60 /var/log/backend.log"' -ForegroundColor Yellow
    Write-Host '  If the log shows a compile error, the container will not have' -ForegroundColor Yellow
    Write-Host '  picked up src/ at all.' -ForegroundColor Yellow
    exit 1
}
Write-Host ''
Write-Host '  All checks passed: the running container matches current src/.' -ForegroundColor Green
exit 0