<#
    push-to-github.ps1

    Nahra cely projekt na GitHub. Riesi:
      - git, ktory nie je v PATH
      - rozbehnuty rebase / merge (zrusi ho)
      - remote s vlastnou historiou (zluci strategiou "ours" - obsah zostava tvoj)

    Pouzitie z korena projektu:
      Set-ExecutionPolicy Bypass -Scope Process -Force
      .\scripts\push-to-github.ps1
      .\scripts\push-to-github.ps1 -Message "fix: oprava DPC"
      .\scripts\push-to-github.ps1 -Force
#>
param(
    [string]$Message,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$Remote = 'https://github.com/bucala/Wireless_Cube_Platform.git'
$Branch = 'main'

# Ziadny interaktivny editor - vsetky spravy dodavame cez -m / --no-edit.
$env:GIT_EDITOR = 'true'
$env:GIT_MERGE_AUTOEDIT = 'no'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# --- najdenie git.exe -----------------------------------------------------
$gitExe = (Get-Command git -CommandType Application -ErrorAction SilentlyContinue |
    Select-Object -First 1).Source

if (-not $gitExe) {
    $gitExe = @(
        "$env:ProgramFiles\Git\cmd\git.exe"
        "${env:ProgramFiles(x86)}\Git\cmd\git.exe"
        "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1

    if (-not $gitExe) {
        throw 'git sa nenasiel. Nainstaluj: https://git-scm.com/download/win'
    }
    Write-Host "git nie je v PATH, pouzivam $gitExe" -ForegroundColor DarkGray
}

# git pise progres na stderr, preto vnutri volani vypname 'Stop' - inak by
# uplne normalny vystup z push/fetch skoncil ako terminating error.
function Invoke-Git {
    $old = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & $gitExe @args
    $code = $LASTEXITCODE
    $ErrorActionPreference = $old
    if ($code -ne 0) { throw "git $($args -join ' ') zlyhal (kod $code)" }
}

# Test: vrati $true/$false podla exit kodu, vystup zahodi.
function Test-Git {
    $old = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & $gitExe @args *> $null
    $code = $LASTEXITCODE
    $ErrorActionPreference = $old
    return ($code -eq 0)
}

# Test: vrati jeden riadok vystupu.
function Read-Git {
    $old = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $out = & $gitExe @args 2>$null
    $ErrorActionPreference = $old
    return ($out | Select-Object -First 1)
}

Write-Host "Projekt : $root"
Write-Host "Remote  : $Remote"
Write-Host "Branch  : $Branch`n"

# --- 1. repozitar ---------------------------------------------------------
if (Test-Path '.git') {
    Write-Host '[1] repozitar existuje'
} else {
    Invoke-Git init -b $Branch
    Write-Host '[1] repozitar inicializovany'
}

# --- 2. zrusenie nedokoncenych operacii -----------------------------------
$gitDir = Read-Git rev-parse --absolute-git-dir
if ((Test-Path (Join-Path $gitDir 'rebase-merge')) -or (Test-Path (Join-Path $gitDir 'rebase-apply'))) {
    Test-Git rebase --abort | Out-Null
    Write-Host '[2] rozbehnuty rebase zruseny'
} elseif (Test-Path (Join-Path $gitDir 'MERGE_HEAD')) {
    Test-Git merge --abort | Out-Null
    Write-Host '[2] rozbehnuty merge zruseny'
} elseif (Test-Path (Join-Path $gitDir 'CHERRY_PICK_HEAD')) {
    Test-Git cherry-pick --abort | Out-Null
    Write-Host '[2] rozbehnuty cherry-pick zruseny'
} else {
    Write-Host '[2] cisty stav'
}

# --- 3. vetva -------------------------------------------------------------
$hasHead = Test-Git rev-parse --verify HEAD
if ($hasHead) {
    $current = Read-Git rev-parse --abbrev-ref HEAD
    if ($current -ne $Branch) { Invoke-Git branch -M $Branch }
} else {
    Invoke-Git symbolic-ref HEAD "refs/heads/$Branch"
}
Write-Host "[3] vetva $Branch"

# --- 4. add + commit ------------------------------------------------------
Invoke-Git add -A
if (Test-Path '.gitattributes') { Test-Git add --renormalize . | Out-Null }

if (-not $Message) {
    $Message = if ($hasHead) {
        'chore: sync local changes'
    } else {
        'feat: NFC Dice Debugger platform (ESP32-S3/PN5180 firmware + React dashboard)'
    }
}

if (Test-Git diff --cached --quiet) {
    Write-Host '[4] nic nove na commit'
} else {
    Invoke-Git commit -q -m $Message
    Write-Host "[4] commitnute: $Message"
}

# --- 5. remote ------------------------------------------------------------
if (Test-Git remote get-url origin) {
    Invoke-Git remote set-url origin $Remote
} else {
    Invoke-Git remote add origin $Remote
}
Write-Host '[5] remote origin nastaveny'

# --- 6. zlucenie historie z GitHubu --------------------------------------
Invoke-Git fetch origin --prune --quiet
$remoteRef = @("origin/$Branch", 'origin/master') |
    Where-Object { Test-Git rev-parse --verify --quiet "refs/remotes/$_" } |
    Select-Object -First 1

if (-not $remoteRef) {
    Write-Host '[6] remote je prazdny, push bude prvy'
} elseif ($Force) {
    Write-Host '[6] rezim -Force, zlucenie preskakujem'
} elseif (Test-Git merge-base --is-ancestor $remoteRef HEAD) {
    Write-Host "[6] historia $remoteRef uz je zapocitana"
} else {
    # "-s ours" prevezme commit z GitHubu do historie, ale obsah nechá tvoj.
    # Preto nikdy nevznikne konflikt a push je potom obycajny fast-forward.
    Invoke-Git merge -s ours --allow-unrelated-histories --no-edit `
        -m 'chore: adopt initial commit from GitHub' $remoteRef
    Write-Host "[6] $remoteRef zlucene strategiou ours"
}

# --- 7. push --------------------------------------------------------------
if ($Force) {
    Write-Host '[7] push --force (historia na GitHube bude prepisana)'
    Invoke-Git push -u --force origin $Branch
} else {
    Write-Host '[7] push'
    Invoke-Git push -u origin $Branch
}

Write-Host "`nHOTOVO: https://github.com/bucala/Wireless_Cube_Platform" -ForegroundColor Green
& $gitExe log --oneline -3
