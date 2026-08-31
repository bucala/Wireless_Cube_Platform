@echo off
REM ===========================================================================
REM  push-to-github.cmd
REM
REM  Nahra cely projekt na https://github.com/bucala/Wireless_Cube_Platform.git
REM
REM  Pouzitie (z lubovolneho miesta):
REM     scripts\push-to-github.cmd
REM     scripts\push-to-github.cmd "feat: pridany DPC tuner"
REM     scripts\push-to-github.cmd --force
REM        (--force prepise historiu na GitHube, pouzi len ked vies, co robis)
REM ===========================================================================
setlocal EnableExtensions

REM  Koren projektu si zapamatame HNED, pred parsovanim argumentov:
REM  "shift" v batchi posuva aj %0, takze %~dp0 by potom uz neukazovalo na skript.
set "PROJECT_ROOT=%~dp0.."

chcp 65001 >nul 2>nul

set "REMOTE=https://github.com/bucala/Wireless_Cube_Platform.git"
set "BRANCH=main"
set "MSG="
set "FORCE="

REM --- argumenty -------------------------------------------------------------
:parse
if "%~1"=="" goto parsed
if /i "%~1"=="-f" goto setforce
if /i "%~1"=="--force" goto setforce
if not defined MSG set "MSG=%~1"
shift
goto parse
:setforce
set "FORCE=1"
shift
goto parse
:parsed
if not defined MSG set "MSG=feat: NFC Dice Debugger platform (ESP32-S3/PN5180 firmware + React dashboard)"

cd /d "%PROJECT_ROOT%"
if errorlevel 1 (
  echo [chyba] neviem prejst do korena projektu: %PROJECT_ROOT%
  exit /b 1
)

echo Projekt : %CD%
echo Remote  : %REMOTE%
echo Branch  : %BRANCH%
echo Sprava  : %MSG%
echo.

REM --- 1/7 git --------------------------------------------------------------
echo [1/7] kontrola gitu
set "GIT_DIR_FOUND="
where git >nul 2>nul
if not errorlevel 1 goto gitok

REM Git nie je v PATH - skusime zname miesta instalacie.
call :tryGit "%ProgramFiles%\Git\cmd"
if defined GIT_DIR_FOUND goto gitpatched
call :tryGit "%ProgramFiles(x86)%\Git\cmd"
if defined GIT_DIR_FOUND goto gitpatched
call :tryGit "%LOCALAPPDATA%\Programs\Git\cmd"
if defined GIT_DIR_FOUND goto gitpatched
REM Git zabaleny v GitHub Desktop (berieme najnovsiu verziu adresara app-*).
for /f "delims=" %%d in ('dir /b /ad /o-n "%LOCALAPPDATA%\GitHubDesktop\app-*" 2^>nul') do (
  if not defined GIT_DIR_FOUND call :tryGit "%LOCALAPPDATA%\GitHubDesktop\%%d\resources\app\git\cmd"
)
if defined GIT_DIR_FOUND goto gitpatched

echo [chyba] git sa nenasiel ani v PATH, ani v znamych umiestneniach.
echo         Nainstaluj Git for Windows: https://git-scm.com/download/win
exit /b 1

:gitpatched
set "PATH=%GIT_DIR_FOUND%;%PATH%"
echo       git nebol v PATH, pouzivam: %GIT_DIR_FOUND%
echo       ^(tento skript to riesi sam; ak chces git aj v beznom CMD, pridaj
echo        tento adresar do Path cez: Win+R - sysdm.cpl - Advanced -
echo        Environment Variables - Path^)

:gitok
for /f "tokens=*" %%v in ('git --version') do echo       %%v

REM --- 2/7 identita ---------------------------------------------------------
echo [2/7] kontrola git identity
git config user.name >nul 2>nul
if errorlevel 1 (
  echo [chyba] nie je nastavene user.name. Spusti:
  echo         git config --global user.name "Tvoje Meno"
  echo         git config --global user.email "ty@example.com"
  exit /b 1
)
git config user.email >nul 2>nul
if errorlevel 1 (
  echo [chyba] nie je nastavene user.email. Spusti:
  echo         git config --global user.email "ty@example.com"
  exit /b 1
)

REM --- 3/7 inicializacia repozitara ----------------------------------------
echo [3/7] repozitar
if exist ".git" (
  echo       .git uz existuje, preskakujem init
) else (
  git init -b %BRANCH% >nul 2>nul
  if errorlevel 1 (
    REM starsi git bez podpory "init -b"
    git init >nul
    if errorlevel 1 (
      echo [chyba] git init zlyhal
      exit /b 1
    )
    git symbolic-ref HEAD refs/heads/%BRANCH% >nul 2>nul
  )
  echo       inicializovane
)

REM --- 4/7 spravna vetva ----------------------------------------------------
echo [4/7] vetva
git rev-parse --verify HEAD >nul 2>nul
if errorlevel 1 (
  REM repozitar bez commitov: staci prepisat symbolicky odkaz HEAD
  git symbolic-ref HEAD refs/heads/%BRANCH% >nul 2>nul
) else (
  set "CURRENT="
  for /f "tokens=*" %%b in ('git rev-parse --abbrev-ref HEAD') do set "CURRENT=%%b"
  call :ensureBranch
)
echo       %BRANCH%

REM --- 5/7 add + commit -----------------------------------------------------
echo [5/7] add + commit
git add -A
if errorlevel 1 (
  echo [chyba] git add zlyhal
  exit /b 1
)
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "%MSG%"
  if errorlevel 1 (
    echo [chyba] git commit zlyhal
    exit /b 1
  )
) else (
  echo       nic nove na commit, pokracujem
)
for /f "tokens=*" %%c in ('git rev-list --count HEAD 2^>nul') do echo       commitov v historii: %%c

REM --- 6/7 remote -----------------------------------------------------------
echo [6/7] remote origin
git remote get-url origin >nul 2>nul
if errorlevel 1 (
  git remote add origin "%REMOTE%"
  if errorlevel 1 (
    echo [chyba] nepodarilo sa pridat remote
    exit /b 1
  )
  echo       pridane
) else (
  git remote set-url origin "%REMOTE%"
  if errorlevel 1 (
    echo [chyba] nepodarilo sa prepisat remote
    exit /b 1
  )
  echo       aktualizovane
)

REM --- 7/7 push -------------------------------------------------------------
echo [7/7] push
if defined FORCE (
  echo       rezim --force: historia na GitHube bude prepisana
  git push -u --force origin %BRANCH%
) else (
  git push -u origin %BRANCH%
)
if errorlevel 1 goto pushfail

echo.
echo ==========================================================================
echo  Hotovo. Repozitar: https://github.com/bucala/Wireless_Cube_Platform
echo ==========================================================================
endlocal
exit /b 0

REM --- pomocne rutiny -------------------------------------------------------
:tryGit
if exist "%~1\git.exe" set "GIT_DIR_FOUND=%~1"
goto :eof

:ensureBranch
if /i "%CURRENT%"=="%BRANCH%" goto :eof
git branch -M %BRANCH% >nul 2>nul
if errorlevel 1 git checkout -b %BRANCH% >nul 2>nul
goto :eof

:pushfail
echo.
echo [chyba] push zlyhal. Najcastejsie priciny:
echo.
echo   1^) Remote uz obsahuje commity ^(napr. README vytvoreny na GitHube^).
echo      Zluc historie:
echo          git pull --rebase origin %BRANCH%
echo          scripts\push-to-github.cmd
echo      alebo prepis remote ^(POZOR, zmaze obsah na GitHube^):
echo          scripts\push-to-github.cmd --force
echo.
echo   2^) Chybne prihlasenie. Ako heslo pouzi Personal Access Token
echo      ^(GitHub - Settings - Developer settings - Tokens^), alebo:
echo          git config --global credential.helper manager
echo.
echo   3^) Repozitar neexistuje, alebo nemas prava na zapis:
echo          %REMOTE%
echo.
endlocal
exit /b 1
