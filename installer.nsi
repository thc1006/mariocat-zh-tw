;
; MarioCat_zh portable launcher (NSIS, Linux build)
;
; 行為：被點兩下 → 靜默解壓到 %TEMP% → 啟動遊戲 → 等遊戲結束 → 清理
;
; 編譯（在 Docker 內）：
;   makensis -DSRC=. installer.nsi
; 產出：dist/MarioCat_zh_Launcher.exe
;
; 註：Linux 上的 makensis 對中文 Caption 與反斜線 path 不穩，這份用
;     全 ASCII 與 forward-slash 寫，最安全。
;

!ifndef SRC
  !define SRC "."
!endif

Name           "MarioCat_zh"
OutFile        "dist/MarioCat_zh_Launcher.exe"
Caption        "MarioCat_zh Launcher"
BrandingText   " "

SilentInstall  silent
RequestExecutionLevel user
Icon           "${SRC}/icon.ico"

Section
    InitPluginsDir
    StrCpy $INSTDIR "$PLUGINSDIR\MarioCat_zh"
    CreateDirectory "$INSTDIR"
    SetOutPath "$INSTDIR"

    File "${SRC}/MarioCat_zh.exe"
    File /r "${SRC}/res"
    File /r "${SRC}/BGM"
    File /r "${SRC}/SE"

    ExecWait '"$INSTDIR\MarioCat_zh.exe"'
SectionEnd
