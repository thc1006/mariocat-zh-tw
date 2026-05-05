#!/usr/bin/env bash
# 用 7z SFX 把遊戲打成單檔 portable launcher
# （NSIS 在 Debian bookworm 有 segfault bug，改用 7z 路線）
#
# 行為：
#   執行 launcher .exe → 7z SFX 解壓到 %TEMP%\7zSXxxx → 自動執行 MarioCat_zh.exe
#   遊戲關閉後 7z SFX 會清掉 %TEMP% 暫存
set -euo pipefail

SRC="${SRC:-.}"
OUT="${OUT:-dist/MarioCat_zh_Launcher.exe}"
# 用 chrislake/7zsfxmm 的 7zsd.sfx — 這是「modified SFX」，
# 支援解壓到暫存目錄、自動執行 RunProgram、結束後清理。
# 官方 7-zip 的 7z.sfx 只是純解壓工具不支援這些功能。
SFX="${SRC}/tools/7zsd.sfx"
WORK="$(mktemp -d)"

if [ ! -f "${SFX}" ]; then
    echo "[launcher] ✗ 找不到 ${SFX}"
    echo "  從 https://github.com/chrislake/7zsfxmm/releases 下載 7zsd_extra_*.7z 解壓"
    exit 1
fi

echo "[launcher] 暫存工作區：${WORK}"

# 把所需檔複製到暫存區（避免把整個 repo 都打進去）
cp "${SRC}/MarioCat_zh.exe" "${WORK}/"
cp -r "${SRC}/res"          "${WORK}/"
cp -r "${SRC}/BGM"          "${WORK}/"
cp -r "${SRC}/SE"           "${WORK}/"
cp "${SRC}/說明.txt"        "${WORK}/" 2>/dev/null || true

# 建 7z 檔（最大壓縮）
ARCHIVE="${WORK}/game.7z"
( cd "${WORK}" && 7z a -mx9 -bso0 -bsp0 \
    "$(basename "${ARCHIVE}")" \
    MarioCat_zh.exe res BGM SE 說明.txt 2>/dev/null )

# 寫 7zsd modified SFX 的 config（要 CRLF + UTF-8 BOM）：
#   GUIMode="2"             完全靜默
#   ExtractPathTitle=...    無
#   RunProgram="..."        解壓完自動執行（路徑相對於 7zsd 自動產生的暫存目錄）
CONFIG="${WORK}/config.txt"
printf '\xef\xbb\xbf;!@Install@!UTF-8!\r\nGUIMode="2"\r\nRunProgram="MarioCat_zh.exe"\r\n;!@InstallEnd@!\r\n' > "${CONFIG}"

# 拼起來：SFX module + config + 7z archive = launcher .exe
mkdir -p "$(dirname "${OUT}")"
cat "${SFX}" "${CONFIG}" "${ARCHIVE}" > "${OUT}"
chmod +x "${OUT}"

# 清理
rm -rf "${WORK}"

echo "[launcher] ✓ 完成：${OUT}"
ls -la "${OUT}"
