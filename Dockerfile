# ─────────────────────────────────────────────────────────────────────────
# 貓利歐 中文化版 建置環境
#
# 用 Debian + MinGW-w64 交叉編譯到 32-bit Windows .exe
# 32-bit 是因為原作 MarioCat.exe 也是 32-bit、且 DxLib for GCC 對 32-bit
# 支援度最完整。
# ─────────────────────────────────────────────────────────────────────────
FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

# 交叉編譯工具（Debian 預設 mingw-w64 用 msvcrt 而非 ucrt）+ 解壓日文檔名 zip
# 對應的 DxLib SDK 子資料夾要選 msvcrt 命名風格（不含 _ucrt_）
RUN apt-get update && apt-get install -y --no-install-recommends \
        g++-mingw-w64-x86-64 \
        gcc-mingw-w64-x86-64 \
        binutils-mingw-w64-x86-64 \
        make \
        wget \
        p7zip-full \
        ca-certificates \
        file \
        findutils \
    && rm -rf /var/lib/apt/lists/*

# Debian mingw 預設 thread model 是 win32（如其名 -win32 變體），切到 posix 比較通用
RUN update-alternatives --set x86_64-w64-mingw32-gcc /usr/bin/x86_64-w64-mingw32-gcc-posix && \
    update-alternatives --set x86_64-w64-mingw32-g++ /usr/bin/x86_64-w64-mingw32-g++-posix

# 預設工作目錄；compose 會把 repo 掛進來
WORKDIR /work

# 預設指令：打開 bash，使用者進去手動跑 make
CMD ["bash"]
