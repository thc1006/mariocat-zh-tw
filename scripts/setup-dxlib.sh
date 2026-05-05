#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# DxLib for GCC SDK 下載與 ASCII 化
#
# DxLib 官方 zip 檔內路徑全是日文（例：プロジェクトに追加すべきファイル_GCC(MinGW)用），
# 在 Linux Makefile 中很難直接引用，這支腳本會把所需檔案複製到
# ./dxlib/{include,lib}/ 純英文路徑下，供 Makefile 使用。
#
# 這個腳本只需要在第一次建置 (或想換 DxLib 版本時) 跑一次。
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

DXLIB_VERSION="${DXLIB_VERSION:-3_24f}"
DXLIB_URL="https://dxlib.xsrv.jp/DxLib/DxLib_GCC${DXLIB_VERSION}.zip"
DXLIB_ZIP="/tmp/DxLib_GCC.zip"
DXLIB_OUT="dxlib"
GCC_VER_HINT="${GCC_VER_HINT:-12}"   # Debian bookworm 內 mingw-w64 的 gcc 版本

if [[ -d "${DXLIB_OUT}/include" && -d "${DXLIB_OUT}/lib" ]]; then
    echo "[setup-dxlib] ${DXLIB_OUT}/ 已存在且看起來完整，跳過下載"
    echo "  → 想重新跑請先 rm -rf ${DXLIB_OUT}"
    exit 0
fi

echo "[setup-dxlib] 下載 DxLib_GCC${DXLIB_VERSION}.zip（約 150 MB）..."
wget -q --show-progress -O "${DXLIB_ZIP}" "${DXLIB_URL}"

echo "[setup-dxlib] 解壓（zip 內檔名為 Shift_JIS，用 7z 處理）..."
RAW_DIR="/tmp/DxLib_raw"
rm -rf "${RAW_DIR}"
mkdir -p "${RAW_DIR}"
# 7z 預設會把 CP932 檔名轉成 UTF-8，比舊版 unzip 的 -O 旗標可靠
7z x -bb0 -bd "${DXLIB_ZIP}" -o"${RAW_DIR}" > /dev/null

echo "[setup-dxlib] 在 ${RAW_DIR} 內挑 64-bit 且非 ucrt（msvcrt）的子資料夾..."
# DxLib for GCC 子資料夾名稱是純 ASCII，類似
#   12_2_0_x86_64_release_win32_seh_ucrt_rt_v10_rev2  → ucrt（Debian mingw 不相容）
#   13_1_0_x86_64_w64                                  → msvcrt（與 Debian mingw 對齊）
#   8_1_0_x86_64_posix_sjis_rt_v6_rev0                 → msvcrt + posix
# 偵測順序：x86_64 + 不含 ucrt → 任一 x86_64 → 任一含 DxLib.h
ALL_DXLIB_H=$(find "${RAW_DIR}" -type f -name 'DxLib.h' 2>/dev/null)

pick() {
    echo "${ALL_DXLIB_H}" | awk -F'/DxLib.h' '{print $1}' | \
        awk -v p="$1" -v exclude="$2" '
            { base = $0; sub(".*/", "", base) }
            base ~ p && (exclude == "" || base !~ exclude) { print; exit }
        '
}

# 優先：x86_64 且不含 ucrt（與 Debian msvcrt mingw 相容）
CANDIDATE=$(pick "x86_64" "ucrt")
# 退一步：任一 x86_64（會撈到 ucrt 版，可能 link 失敗）
[[ -z "${CANDIDATE}" ]] && CANDIDATE=$(pick "x86_64" "")
# 再退一步：任一含 DxLib.h
[[ -z "${CANDIDATE}" ]] && CANDIDATE=$(echo "${ALL_DXLIB_H}" | head -n1 | awk -F'/DxLib.h' '{print $1}')

if [[ -z "${CANDIDATE}" ]]; then
    echo "[setup-dxlib] ✗ 找不到任何含 DxLib.h 的 32-bit 目錄，無法繼續"
    exit 1
fi

echo "[setup-dxlib] 採用：${CANDIDATE}"

# 複製到 ASCII 路徑
mkdir -p "${DXLIB_OUT}/include" "${DXLIB_OUT}/lib"
# include：DxLib.h 會 include 一票 DxCompileConfig.h、DxAudio.h 等附屬標頭，全部複製
find "${CANDIDATE}" -maxdepth 1 -name '*.h' -exec cp {} "${DXLIB_OUT}/include/" \;
# lib：複製所有 .a
find "${CANDIDATE}" -maxdepth 1 -name '*.a' -exec cp {} "${DXLIB_OUT}/lib/" \;
echo "  include 檔數：$(ls "${DXLIB_OUT}/include" | wc -l)"
echo "  lib 檔數    ：$(ls "${DXLIB_OUT}/lib" | wc -l)"

# 清理暫存
rm -rf "${RAW_DIR}" "${DXLIB_ZIP}"

echo
echo "[setup-dxlib] ✓ 完成"
echo "  include : ${DXLIB_OUT}/include/DxLib.h"
echo "  lib     : ${DXLIB_OUT}/lib/*.a ($(ls "${DXLIB_OUT}/lib" | wc -l) 個)"
echo
echo "  下一步：執行 make"
