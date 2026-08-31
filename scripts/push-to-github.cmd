@echo off
REM ===========================================================================
REM  push-to-github.cmd  --  jediny skript, ktory dostane projekt na GitHub
REM
REM  Riesi automaticky:
REM    - git, ktory nie je v PATH (najde ho v beznych umiestneniach)
REM    - rozbehnuty rebase / merge / cherry-pick (zrusi ho)
REM    - repozitar bez .git (inicializuje, vetva main)
REM    - remote, ktory ma vlastnu historiu: zluci ju strategiou "ours",
REM      takze obsah zostava tvoj, nic sa neprepisuje a netreba --force
REM    - interaktivny editor (Vim sa neotvori, spravy idu cez -m)
REM
REM  DOLEZITE: skript sa najprv prekopiruje do %TEMP% a bezi odtial. Je totiz
REM  sam verzovany a git reset / rebase --abort by mu prepisal telo priamo pod
REM  rukami (cmd.exe cita batch subor postupne po riadkoch).
REM
REM  Pouzitie:
REM    scripts\push-to-github.cmd
REM    scripts\push-to-github.cmd "feat: pridany DPC tuner"
REM    scripts\push-to-github.cmd --force     (nudzovy prepis historie na GitHube)
REM
REM  Skript je idempotentny - spustaj ho pri kazdej dalsej zmene.
REM ===========================================================================
setlocal EnableExtensions

if /i "%~1"=="--root" goto runner

REM --- fáza 1: presun do TEMP a restart odtial -------------------------------
set "PROJECT_ROOT=%~dp0.."
set "SELF_COPY=%TEMP%\pgh-%RANDOM%%RANDOM%.cmd"
copy /y "%~f0" "%SELF_COPY%" >nul
if errorlevel 1 goto nocopy
call "%SELF_COPY%" --root "%PROJECT_ROOT%" %*
set "RC=%ERRORLEVEL%"
del "%SELF_COPY%" >nul 2>nul
endlocal & exit /b %RC%

:nocopy
echo [chyba] neviem sa prekopirovat do %TEMP%
endlocal & exit /b 1

REM --- fáza 2: samotna praca ------------------------------------------------
:runner
shift
set "PROJECT_ROOT=%~1"
shift

set "REMOTE=https://github.com/bucala/Wireless_Cube_Platform.git"
set "BRANCH=main"
set "MSG="
set "FORCE="

REM Ziadny interaktivny editor: vsetky spravy dodavame cez -m / --no-edit.
set "GIT_EDITOR=true"
set "GIT_MERGE_AUTOEDIT=no"

chcp 65001 >nul 2>nul

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

cd /d "%PROJECT_ROOT%"
if errorlevel 1 goto noroot

echo ==========================================================================
echo  Projekt : %CD%
echo  Remote  : %REMOTE%
echo  Branch  : %BRANCH%
echo ==========================================================================
echo.

REM --- 1/8 git --------------------------------------------------------------
echo [1/8] git
set "GIT_DIR_FOUND="
where git >nul 2>nul
if not errorlevel 1 goto gitok

call :tryGit "%ProgramFiles%\Git\cmd"
if defined GIT_DIR_FOUND goto gitpatched
call :tryGit "%ProgramFiles(x86)%\Git\cmd"
if defined GIT_DIR_FOUND goto gitpatched
call :tryGit "%LOCALAPPDATA%\Programs\Git\cmd"
if defined GIT_DIR_FOUND goto gitpatched
for /f "delims=" %%d in ('dir /b /ad /o-n "%LOCALAPPDATA%\GitHubDesktop\app-*" 2^>nul') do call :tryGitDesktop "%%d"
if defined GIT_DIR_FOUND goto gitpatched

echo       [chyba] git sa nenasiel. Nainstaluj: https://git-scm.com/download/win
goto fail

:gitpatched
set "PATH=%GIT_DIR_FOUND%;%PATH%"
echo       nebol v PATH, pouzivam %GIT_DIR_FOUND%

:gitok
for /f "tokens=*" %%v in ('git --version') do echo       %%v

REM --- 2/8 identita ---------------------------------------------------------
echo [2/8] identita
git config user.name >nul 2>nul
if errorlevel 1 goto noname
git config user.email >nul 2>nul
if errorlevel 1 goto nomail
for /f "tokens=*" %%n in ('git config user.name') do echo       %%n

REM --- 3/8 repozitar --------------------------------------------------------
echo [3/8] repozitar
if exist ".git" goto haverepo
git init -b %BRANCH% >nul 2>nul
if not errorlevel 1 goto inited
git init >nul
if errorlevel 1 goto noinit
git symbolic-ref HEAD refs/heads/%BRANCH% >nul 2>nul
:inited
echo       inicializovany, vetva %BRANCH%
goto step4
:haverepo
echo       .git existuje

REM --- 4/8 zrusenie rozbehnutych operacii -----------------------------------
:step4
echo [4/8] nedokoncene operacie
set "GITDIR=.git"
for /f "delims=" %%g in ('git rev-parse --git-dir 2^>nul') do set "GITDIR=%%g"
set "CLEANED="
if exist "%GITDIR%\rebase-merge" call :abortRebase
if exist "%GITDIR%\rebase-apply" call :abortRebase
if exist "%GITDIR%\MERGE_HEAD" call :abortMerge
if exist "%GITDIR%\CHERRY_PICK_HEAD" call :abortCherry
if not defined CLEANED echo       ziadne, cisty stav

REM --- 5/8 vetva a commit sprava --------------------------------------------
echo [5/8] vetva
set "HAS_HEAD="
git rev-parse --verify HEAD >nul 2>nul
if not errorlevel 1 set "HAS_HEAD=1"
if not defined HAS_HEAD git symbolic-ref HEAD refs/heads/%BRANCH% >nul 2>nul
if defined HAS_HEAD call :ensureBranch
echo       %BRANCH%

if defined MSG goto msgready
if defined HAS_HEAD set "MSG=chore: sync local changes"
if not defined MSG set "MSG=feat: NFC Dice Debugger platform (ESP32-S3/PN5180 firmware + React dashboard)"
:msgready

REM --- 6/8 add + commit -----------------------------------------------------
echo [6/8] add + commit
git add -A
if errorlevel 1 goto noadd
if exist ".gitattributes" git add --renormalize . >nul 2>nul
git diff --cached --quiet
if not errorlevel 1 goto nothingnew
echo       sprava: %MSG%
git commit -q -m "%MSG%"
if errorlevel 1 goto nocommit
echo       commitnute
goto step7
:nothingnew
echo       nic nove na commit
:step7

REM --- 7/8 remote a zlucenie historie ---------------------------------------
echo [7/8] remote a historia
git remote get-url origin >nul 2>nul
if errorlevel 1 goto addremote
git remote set-url origin "%REMOTE%"
if errorlevel 1 goto noremote
goto remoteok
:addremote
git remote add origin "%REMOTE%"
if errorlevel 1 goto noremote
:remoteok

git fetch origin --prune --quiet
if errorlevel 1 goto nofetch

set "REMOTE_REF="
git rev-parse --verify --quiet refs/remotes/origin/%BRANCH% >nul 2>nul
if not errorlevel 1 set "REMOTE_REF=origin/%BRANCH%"
if defined REMOTE_REF goto haveref
git rev-parse --verify --quiet refs/remotes/origin/master >nul 2>nul
if not errorlevel 1 set "REMOTE_REF=origin/master"
:haveref

if not defined REMOTE_REF echo       remote je prazdny, push bude prvy
if not defined REMOTE_REF goto dopush
if defined FORCE echo       rezim --force, zlucenie preskakujem
if defined FORCE goto dopush

git merge-base --is-ancestor %REMOTE_REF% HEAD
if not errorlevel 1 goto histok

echo       %REMOTE_REF% ma vlastne commity - zlucujem strategiou "ours"
echo       obsah zostava tvoj, ziadny konflikt, ziadny prepis
git merge -s ours --allow-unrelated-histories --no-edit -m "chore: adopt initial commit from GitHub" %REMOTE_REF%
if errorlevel 1 goto nomerge
echo       zlucene
goto dopush

:histok
echo       historia %REMOTE_REF% uz je zapocitana

REM --- 8/8 push -------------------------------------------------------------
:dopush
echo [8/8] push
if defined FORCE goto forcepush
git push -u origin %BRANCH%
if errorlevel 1 goto pushfail
goto done
:forcepush
echo       --force: historia na GitHube bude prepisana
git push -u --force origin %BRANCH%
if errorlevel 1 goto pushfail

:done
echo.
echo ==========================================================================
echo  HOTOVO: https://github.com/bucala/Wireless_Cube_Platform
echo ==========================================================================
git log --oneline -3
endlocal & exit /b 0

REM --- pomocne rutiny -------------------------------------------------------
:tryGit
if exist "%~1\git.exe" set "GIT_DIR_FOUND=%~1"
goto :eof

:tryGitDesktop
if defined GIT_DIR_FOUND goto :eof
call :tryGit "%LOCALAPPDATA%\GitHubDesktop\%~1\resources\app\git\cmd"
goto :eof

:abortRebase
echo       rusim rozbehnuty rebase
git rebase --abort >nul 2>nul
set "CLEANED=1"
goto :eof

:abortMerge
echo       rusim rozbehnuty merge
git merge --abort >nul 2>nul
set "CLEANED=1"
goto :eof

:abortCherry
echo       rusim rozbehnuty cherry-pick
git cherry-pick --abort >nul 2>nul
set "CLEANED=1"
goto :eof

:ensureBranch
set "CURRENT="
for /f "tokens=*" %%b in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "CURRENT=%%b"
if /i "%CURRENT%"=="%BRANCH%" goto :eof
git branch -M %BRANCH% >nul 2>nul
if errorlevel 1 git checkout -b %BRANCH% >nul 2>nul
goto :eof

REM --- chybove vystupy ------------------------------------------------------
:noroot
echo [chyba] neviem prejst do korena projektu: %PROJECT_ROOT%
goto fail

:noname
echo       [chyba] chyba user.name. Spusti:
echo               git config --global user.name "Tvoje Meno"
echo               git config --global user.email "ty@example.com"
goto fail

:nomail
echo       [chyba] chyba user.email. Spusti:
echo               git config --global user.email "ty@example.com"
goto fail

:noinit
echo       [chyba] git init zlyhal
goto fail

:noadd
echo       [chyba] git add zlyhal
goto fail

:nocommit
echo       [chyba] git commit zlyhal
goto fail

:noremote
echo       [chyba] nepodarilo sa nastavit remote origin
goto fail

:nofetch
echo       [chyba] git fetch zlyhal - skontroluj siet a prihlasenie:
echo               git config --global credential.helper manager
goto fail

:nomerge
echo       [chyba] zlucenie zlyhalo. Nudzove riesenie:
echo               scripts\push-to-github.cmd --force
goto fail

:pushfail
echo.
echo [chyba] push zlyhal.
echo   Prihlasenie: pouzi Personal Access Token ako heslo, alebo zapni
echo   Git Credential Manager:  git config --global credential.helper manager
echo   Konflikt historie: scripts\push-to-github.cmd --force
goto fail

:fail
endlocal & exit /b 1
