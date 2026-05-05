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

echo "[setup-dxlib] 解壓（zip 內檔名為 Shift_JIS）..."
RAW_DIR="/tmp/DxLib_raw"
rm -rf "${RAW_DIR}"
mkdir -p "${RAW_DIR}"
unzip -O CP932 -q "${DXLIB_ZIP}" -d "${RAW_DIR}"

echo "[setup-dxlib] 在 ${RAW_DIR} 內尋找符合 GCC ${GCC_VER_HINT}.x 的子資料夾..."
# 偵測：DxLib for GCC 的「プロジェクトに追加すべきファイル_GCC(MinGW)用」資料夾下，
# 會有多個 GCC 版本對應的子資料夾。我們找含「DxLib.h」、且路徑中含 "GCC ${GCC_VER_HINT}" 的最深目錄
CANDIDATE=$(find "${RAW_DIR}" -type f -name 'DxLib.h' 2>/dev/null | \
    awk -F'/DxLib.h' '{print $1}' | \
    grep -F "32" | \
    grep -F "GCC ${GCC_VER_HINT}" | head -n1 || true)

# 若沒找到對應版本就用第一個 32-bit 候選
if [[ -z "${CANDIDATE}" ]]; then
    echo "[setup-dxlib] 找不到 GCC ${GCC_VER_HINT}.x 對應目錄，回退到任一 32-bit 候選"
    CANDIDATE=$(find "${RAW_DIR}" -type f -name 'DxLib.h' 2>/dev/null | \
        awk -F'/DxLib.h' '{print $1}' | \
        grep -F "32" | head -n1 || true)
fi

if [[ -z "${CANDIDATE}" ]]; then
    echo "[setup-dxlib] ✗ 找不到任何含 DxLib.h 的 32-bit 目錄，無法繼續"
    exit 1
fi

echo "[setup-dxlib] 採用：${CANDIDATE}"

# 複製到 ASCII 路徑
mkdir -p "${DXLIB_OUT}/include" "${DXLIB_OUT}/lib"
# include 只需要 DxLib.h（DxLib 是 single-header 風格）
cp "${CANDIDATE}/DxLib.h" "${DXLIB_OUT}/include/"
# lib：複製所有 .a
find "${CANDIDATE}" -maxdepth 1 -name '*.a' -exec cp -v {} "${DXLIB_OUT}/lib/" \;

# 清理暫存
rm -rf "${RAW_DIR}" "${DXLIB_ZIP}"

echo
echo "[setup-dxlib] ✓ 完成"
echo "  include : ${DXLIB_OUT}/include/DxLib.h"
echo "  lib     : ${DXLIB_OUT}/lib/*.a ($(ls "${DXLIB_OUT}/lib" | wc -l) 個)"
echo
echo "  下一步：執行 make"
