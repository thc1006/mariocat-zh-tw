#!/usr/bin/env bash
# 用 Emscripten 把遊戲編成 WebAssembly + HTML5 版本（docs/web/）
#
# 依賴：
#   - Docker（用 emscripten/emsdk:3.1.20 image，跟 nokotan/DxLibForHTML5 同期）
#   - DxLib HTML5 SDK：解壓在 web-build/dest/{include,lib}/
#     若不存在會自動下載（約 1.4 MB）
#   - coi-serviceworker：在 docs/web/coi-serviceworker.min.js
#     用來在 GitHub Pages 偽造 COOP/COEP header（pthread 必需）
#
# 用法：
#   bash scripts/build-web.sh
# 產出：docs/web/{index.html,index.js,index.wasm,index.data,index.worker.js}

set -euo pipefail

EMSDK_VER="${EMSDK_VER:-3.1.20}"
DXLIB_HTML5_VER="${DXLIB_HTML5_VER:-3.24b}"
DXLIB_HTML5_URL="https://github.com/nokotan/DxLibForHTML5/releases/download/${DXLIB_HTML5_VER}/DxLibForHTML5.tgz"

# DxLib HTML5 SDK
if [ ! -f web-build/dest/include/DxLib.h ]; then
    echo "[build-web] 下載 DxLib HTML5 SDK ${DXLIB_HTML5_VER}..."
    mkdir -p web-build && cd web-build
    curl -sL -o DxLibForHTML5.tgz "${DXLIB_HTML5_URL}"
    tar xzf DxLibForHTML5.tgz
    cd ..
fi

# COI service worker（cross-origin isolation 偽造 header）
if [ ! -f docs/web/coi-serviceworker.min.js ]; then
    echo "[build-web] 下載 coi-serviceworker..."
    mkdir -p docs/web
    curl -sL -o docs/web/coi-serviceworker.min.js \
        https://raw.githubusercontent.com/gzuidhof/coi-serviceworker/master/coi-serviceworker.min.js
fi

# Custom shell（首次 run 把 shell.html 留在 docs/web/，之後不重抓）
if [ ! -f docs/web/shell.html ]; then
    echo "[build-web] ✗ 缺少 docs/web/shell.html（自訂 HTML 模板）"
    exit 1
fi

echo "[build-web] em++ 編譯中..."
# Git Bash on Windows 會把 $(pwd) 轉成 C:/... 撞 docker mount 錯誤，
# 用 MSYS_NO_PATHCONV/MSYS2_ARG_CONV_EXCL 關掉路徑轉換 + 顯式 /c/... mount
WIN_PROJECT_PATH="$(pwd | sed -E 's|^([A-Za-z]):|/\L\1|; s|\\|/|g')"
MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' docker run --rm \
    -v "${WIN_PROJECT_PATH}:/src" -w /src \
    "emscripten/emsdk:${EMSDK_VER}" \
    em++ \
        -O2 \
        -DDX_GCC_COMPILE \
        -I web-build/dest/include \
        main.cpp loadg.cpp \
        -L web-build/dest/lib \
        -lDxLib -lDxUseCLib -lDxDrawFunc \
        --preload-file res \
        --preload-file BGM \
        --preload-file SE \
        --shell-file docs/web/shell.html \
        -s USE_FREETYPE=1 \
        -s USE_LIBPNG=1 \
        -s USE_LIBJPEG=1 \
        -s USE_ZLIB=1 \
        -s USE_OGG=1 \
        -s USE_VORBIS=1 \
        -s USE_BULLET=1 \
        -s USE_PTHREADS=1 \
        -s PROXY_TO_PTHREAD=1 \
        -s ALLOW_MEMORY_GROWTH=1 \
        -s INITIAL_MEMORY=128MB \
        -pthread \
        -o docs/web/index.html

echo "[build-web] ✓ 完成"
ls -lh docs/web/index.* docs/web/coi-serviceworker.min.js
