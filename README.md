# 貓利歐：屎喔棒大冒險（Cat Mario / Syobon Action — 繁體中文版）

把日本經典整人遊戲「**しょぼんのアクション**」(Syobon Action / Cat Mario) 完整翻譯成台灣繁體中文，並加上幾項本地化搞怪。原作由「ちく」於 2007 年發表，是公認最難最欠揍的 2D 平台遊戲之一。

> 玩了之後可能會對人類產生不信任感。請小心服用。

---

## 怎麼玩

最快：下載 [`MarioCat_zh_Launcher.exe`](dist/MarioCat_zh_Launcher.exe) 雙擊即可，單一 6.4 MB 檔案，自動解壓 + 執行 + 清理。

或自行建置（見下方「自己編譯」）。

### 操作

| 鍵 | 動作 |
|---|---|
| ← / → | 移動 |
| ↑ 或 Z | 跳躍 |
| 空白（按住） | 兩倍速 |
| O | 自我了斷（卡關時用） |
| 1 ～ 8 | 標題畫面選關 |
| F1 | 回標題 |
| ESC | 結束遊戲 |

更完整的玩法見 [`說明.txt`](說明.txt)。

---

## 中文化的部分

- **5,551 行原始日文程式碼註解** 全部翻成繁中
- **92 條遊戲內台詞** 翻譯 + PTT/Dcard 風格在地化
  - 「貴様の死に場所はここだ!」→「你的葬身之地就在這!」
  - 「屑が!!」→「雜碎!!」
  - 「一昨日来やがれ!!」→「下輩子再來啦!!」
  - 「見事にオワタ」→「完美、寄了」
  - 「俺、最強!!」→「老子最頂!!」
- **新標題圖片**：用「貓貓貓 瑪利歐」中文 logo 取代原本日文
- **新增 5 條死亡哏**：我就爛、破防了、下輩子當人吧、這款不適合我、媽我在這
- **死亡計數器**：累積死到第 5 / 10 / 20 / 50 / 100 次時，視窗標題會冒出來酸你

---

## 自己編譯（WSL2 + Docker）

不用裝 Visual Studio。Docker 內以 MinGW-w64 交叉編譯出 64-bit Windows .exe。

```bash
# 1. 建 image（首次約 1～2 分鐘）
docker compose build

# 2. 下載 DxLib SDK（首次約 1～3 分鐘，~150 MB）
docker compose run --rm build bash scripts/setup-dxlib.sh

# 3. 編譯遊戲
docker compose run --rm build make

# 4. 打成單檔 portable launcher
docker compose run --rm build make package
```

完整建置說明見 [`BUILD.md`](BUILD.md)。

### 產出

| 檔案 | 大小 | 說明 |
|---|---|---|
| `dist/MarioCat_zh.exe` | 11.86 MB | 遊戲本體（須與 res/、BGM/、SE/ 同層） |
| `dist/MarioCat_zh_Launcher.exe` | 6.45 MB | 單檔 portable launcher（自動解壓+執行+清理） |

---

## 技術細節

- **語言**：C++ + DxLib（Igor Pavlov 風日本 DirectX 包裝庫）
- **編譯器**：MinGW-w64 GCC 12.2.0（msvcrt runtime）
- **目標**：x86-64 Windows，PE32+ GUI
- **編碼策略**：源碼 UTF-8 BOM、`-fexec-charset=CP950` 讓字串以 Big5 進 .exe，DxLib ANSI 模式在繁中 Windows 直接渲染
- **字型**：執行時 `ChangeFont("Microsoft JhengHei")`
- **單檔 launcher**：[`chrislake/7zsfxmm`](https://github.com/chrislake/7zsfxmm) 的 modified SFX module（支援解壓→自動執行→清理）

---

## 致謝

- **原作者「ちく」**：2007 年發表 Syobon Action / しょぼんのアクション 原始版本
- **DxLib**：[dxlib.xsrv.jp](https://dxlib.xsrv.jp/)
- **chrislake/7zsfxmm**：[github.com/chrislake/7zsfxmm](https://github.com/chrislake/7zsfxmm) — Modified 7z SFX module

---

## 授權

原作以「**散布給不特定多數人時須註明原作者ちく**」之條件釋出，本繁體中文版本完整保留原作者資訊。

修改內容（翻譯、icon、搞怪邏輯、建置腳本、launcher 包裝）以 MIT 授權釋出。
