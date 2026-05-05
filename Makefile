# ─────────────────────────────────────────────────────────────────────────
# 貓利歐 中文化版 Makefile（MinGW-w64 32-bit cross-compile）
#
# 假設你已執行過 scripts/setup-dxlib.sh，DxLib SDK 在 ./dxlib/ 下。
# 編譯目標：dist/MarioCat_zh.exe
# ─────────────────────────────────────────────────────────────────────────

CXX      := i686-w64-mingw32-g++
WINDRES  := i686-w64-mingw32-windres

DXLIB_INC := dxlib/include
DXLIB_LIB := dxlib/lib

# 來源檔（單檔架構：main.cpp 直接 include 字串標頭，loadg.cpp 是另一個 TU）
SRCS := main.cpp loadg.cpp
OBJS := $(SRCS:.cpp=.o)

OUT_DIR := dist
TARGET  := $(OUT_DIR)/MarioCat_zh.exe

# 編譯旗標：
#   -DDX_GCC_COMPILE  : DxLib 必須的 macro
#   -finput-charset=UTF-8 : 我們的源碼是 UTF-8 BOM
#   -fexec-charset=CP950   : 字串字面值在 runtime 為 Big5（DxLib ANSI 模式繁中正確顯示）
#   -static-libgcc/-static-libstdc++ : 把 runtime 包進 .exe，使用者不用裝 MinGW DLL
#   -mwindows : 走 Windows GUI subsystem，沒 console
CXXFLAGS := \
    -DDX_GCC_COMPILE \
    -finput-charset=UTF-8 \
    -fexec-charset=CP950 \
    -I$(DXLIB_INC) \
    -O2 -Wall -Wno-unused-variable -Wno-write-strings \
    -m32

LDFLAGS := \
    -L$(DXLIB_LIB) \
    -m32 \
    -static-libgcc -static-libstdc++ \
    -mwindows

# DxLib 連結順序不能亂（官方文件強調）
LDLIBS := \
    -lDxLib -lDxUseCLib -lDxDrawFunc \
    -ljpeg -lpng -lzlib -ltiff \
    -ltheora_static -lvorbis_static -lvorbisfile_static -logg_static \
    -lbulletdynamics -lbulletcollision -lbulletmath \
    -lopusfile -lopus -lsilk_common -lcelt \
    -lgdi32 -lwinmm -lddraw -ld3dx9 -ldxguid -ldinput8 \
    -lole32 -loleaut32 -limm32 -luuid -lpsapi -ladvapi32

.PHONY: all clean check-dxlib

all: $(TARGET)

check-dxlib:
	@if [ ! -f $(DXLIB_INC)/DxLib.h ]; then \
	    echo "✗ 找不到 $(DXLIB_INC)/DxLib.h，請先執行：bash scripts/setup-dxlib.sh"; \
	    exit 1; \
	fi

$(OUT_DIR):
	@mkdir -p $(OUT_DIR)

%.o: %.cpp main.h | check-dxlib
	$(CXX) $(CXXFLAGS) -c $< -o $@

$(TARGET): $(OBJS) | $(OUT_DIR)
	$(CXX) $(OBJS) $(LDFLAGS) $(LDLIBS) -o $(TARGET)
	@echo
	@echo "✓ 編譯完成：$(TARGET)"
	@echo "  → 把 dist/MarioCat_zh.exe 連同 res/、BGM/、SE/ 一起放到 Windows 上即可執行"

clean:
	@rm -f $(OBJS)
	@rm -rf $(OUT_DIR)
	@echo "已清除 .o 與 dist/"
