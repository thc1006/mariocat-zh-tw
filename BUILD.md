# 建置指南 — 貓利歐 中文化版

本專案用 **WSL2 + Docker** 把 Linux 容器當編譯機，
透過 MinGW-w64 交叉編譯出 32-bit Windows `.exe`，
你不用在 Windows 端裝 Visual Studio。

## 前置條件

- Windows 10/11，WSL2 + Docker Desktop（或 Linux 本機 Docker）
- 一次性下載 DxLib SDK（約 150 MB）

## 三步建置

```bash
# 1. 啟動容器（第一次會 build image，約 2~5 分鐘）
docker compose build

# 2. 第一次：在容器內下載 DxLib SDK 並 ASCII 化路徑（約 150 MB / 1~3 分鐘）
docker compose run --rm build bash scripts/setup-dxlib.sh

# 3. 編譯（之後每次只需要這步）
docker compose run --rm build make
```

跑完會在 `dist/MarioCat_zh.exe` 產出可執行檔。

## 在 Windows 端執行

把整個資料夾（或至少 `dist/MarioCat_zh.exe` + `res/` + `BGM/` + `SE/`）
複製到你的 Windows 桌面，雙擊 `.exe` 即可。

> ⚠ **資源檔路徑必須相對正確**：執行時會讀取 `res/*.PNG`、`BGM/*.mp3`、`SE/*.mp3`。
> 也就是說 `.exe` 的同層必須有 `res/`、`BGM/`、`SE/` 三個資料夾。

## 程式碼修改後重新建置

只動 `.cpp` / `.h`：

```bash
docker compose run --rm build make
```

需要從零來：

```bash
docker compose run --rm build make clean
docker compose run --rm build make
```

## 常見問題

### Q: setup-dxlib.sh 跑到一半說「找不到對應 GCC 版本」？
> Debian bookworm 內 MinGW-w64 是 GCC 12.2.0。如果未來 Debian 升版到 GCC 13，
> 改 `GCC_VER_HINT=13 bash scripts/setup-dxlib.sh` 重跑。
> DxLib SDK 通常包含 GCC 8 ~ 13 各版本的 .a 檔，腳本會自動找最接近的。

### Q: 編譯到一半噴 `undefined reference to ...`？
> DxLib 連結順序不能改，Makefile 內 `LDLIBS` 已照官方順序排好。
> 如果是新版 DxLib 多加了 lib，到 [DxLib 官方說明頁](https://dxlib.xsrv.jp/use/dxuse_gcc.html) 比對更新。

### Q: 中文字在標題畫面顯示成方塊？
> Windows 端必須要有「微軟正黑體」字型（內建）。
> 如果還是不行，把 `loadg.cpp` 內 `ChangeFont( "Microsoft JhengHei" , ... )`
> 改成 `"標楷體"` 或其他你電腦上有的中文字型。

### Q: 想直接在 Windows 用 Visual Studio 編？
> 也可以。下載 DxLib for VC2017+ 版（不是這個 GCC 版），
> 新增 console 專案匯入 `main.cpp` / `main.h` / `loadg.cpp`，
> 設定 character set 為 UTF-8、加入 DxLib include + lib，編譯流程跟原作一樣。

## 為什麼用 64-bit？

原作 `MarioCat.exe` 是 32-bit，但 DxLib_GCC 3.24f SDK 對 GCC 12.x
只附 64-bit (`x86_64_release_win32_seh_ucrt`) 預編 .a，
對齊容器內的 mingw-w64 GCC 12.2.0 最穩，因此產出 64-bit `.exe`。
原作的 32-bit `MarioCat.exe` 在 64-bit Windows 也照樣能跑，所以
這個切換對玩家完全沒影響。

## 編碼策略說明

- 原始檔：UTF-8 with BOM（檔案內可寫繁中）
- Runtime 字串：CP950 (Big5)，由 `g++ -fexec-charset=CP950` 在編譯時轉
- DxLib：使用 ANSI 模式（預設），在繁中 Windows 上會把 Big5 字串丟給 GDI 渲染
- 字型：`ChangeFont("Microsoft JhengHei", DEFAULT_CHARSET)` 在 `loadg.cpp` 結尾

這個組合讓 DxLib 不用走 UNICODE 模式（會大量改 API），同時繁中字能正確顯示。
