# ─────────────────────────────────────────────────────────────────────────
# 貓利歐 中文化版 建置環境
#
# 用 Debian + MinGW-w64 交叉編譯到 32-bit Windows .exe
# 32-bit 是因為原作 MarioCat.exe 也是 32-bit、且 DxLib for GCC 對 32-bit
# 支援度最完整。
# ─────────────────────────────────────────────────────────────────────────
FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

# 交叉編譯工具 + 解壓日文檔名 zip 用的 unzip
RUN apt-get update && apt-get install -y --no-install-recommends \
        g++-mingw-w64-i686 \
        gcc-mingw-w64-i686 \
        binutils-mingw-w64-i686 \
        make \
        wget \
        unzip \
        ca-certificates \
        file \
        findutils \
    && rm -rf /var/lib/apt/lists/*

# 切到 POSIX threads 模型（DxLib 預期）
RUN update-alternatives --set i686-w64-mingw32-gcc /usr/bin/i686-w64-mingw32-gcc-posix && \
    update-alternatives --set i686-w64-mingw32-g++ /usr/bin/i686-w64-mingw32-g++-posix

# 預設工作目錄；compose 會把 repo 掛進來
WORKDIR /work

# 預設指令：打開 bash，使用者進去手動跑 make
CMD ["bash"]
