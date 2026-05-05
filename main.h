#include "DxLib.h"
#include <stdio.h>
#include <math.h>
#include <string>
using namespace std;

void loadg();

// 使用 std::string

// 程式狀態（mainst 變數的語意）
// mainst = 10  → 遊戲進行中
// mainst = 100 → 標題畫面
int mainst=100,maintm=0;

// 關卡資訊
int stagecolor=0;
int sta=1,stb=4,stc=0;

// 快速模式（fast=1 表示啟用兩倍速）
int fast=1;

// 陷阱顯示開關
int trap=1;

// 中繼點（中間旗子）狀態
int tyuukan=0;


// 工作人員名單（過關後跑的字幕）
int ending=0;


// 關卡讀取迴圈用變數（請勿亂改）
int stagerr,stagepoint;
// 強制讓計數溢位用
int over=0;

// 關卡切換旗標
int stageonoff=0;


// 主程式
void Mainprogram();
void rpaint();
int maint;


// 子函式群
// （等待／延遲類）
void wait(int interval);
void wait2(long stime, long etime,int FLAME_TIME);
int rand(int Rand);
void end();

// 繪圖相關
int color;
void setfont(int a);
void setcolor(int red, int green, int blue);
void setc0();
void setc1();
void drawpixel(int a,int b);
void drawline(int a,int b,int c,int d);
void drawrect(int a,int b,int c,int d);
void fillrect(int a,int b,int c,int d);
void drawarc(int a,int b,int c,int d);
void fillarc(int a,int b,int c,int d);
int grap[161][8],mgrap[51];
int loadimage(string b);
int loadimage(int a,int x,int y,int r,int z);
int mirror;
void drawimage(int mx,int a,int b);
void drawimage(int mx,int a,int b,int c,int d,int e,int f);
void setre();
void setre2();
void setno();
int oto[151];
void ot(int x);void bgmchange(int x);

// 文字繪製
void str(string c,int a,int b);


// （子函式群結束）

void stagecls();
void stage();
void stagep();





// mainst = 1   → 關卡內
// mainst = 10  → 進入關卡前的過場
//



// 迴圈用的暫存變數
int t,tt,t1,t2,t3,t4;


// 初始化旗標（zxon、zzxon 用於關卡進場）
int zxon,zzxon;

// 按鍵設定
int key,keytm;

// 三角函數常數（圓周率）
double pai=3.1415926535;


// 地面（牆壁、土管、機關地形）
#define smax 31
int sx,sco;
int sa[smax],sb[smax],sc[smax],sd[smax],stype[smax],sxtype[smax],sr[smax];
int sgtype[smax];



// 玩家狀態（位置、方向、跳躍計時等）
int mainmsgtype;
int ma,mb,mnobia,mnobib,mhp;
int mc,md,macttype,atkon,atktm,mactsok,msstar,nokori=2,mactp,mact;

int mtype,mxtype,mtm,mzz;
int mzimen,mrzimen,mkasok,mmuki,mmukitm,mjumptm,mkeytm,mcleartm;
int mmutekitm,mmutekion;
int mztm,mztype;
int actaon[7];
// 對話框／訊息提示
int mmsgtm,mmsgtype;

int mascrollmax=21000;//9000




// 磚塊（會被頂、會出道具、可踩）
void tyobi(int x,int y,int type);
void brockbreak(int t);
#define tmax 641
int tco;
int ta[tmax],tb[tmax],tc[tmax],td[tmax],thp[tmax],ttype[tmax];
int titem[tmax],txtype[tmax];

// 訊息磚塊（碰到會跳出文字框）
int tmsgtm,tmsgtype,tmsgx,tmsgy,tmsgnobix,tmsgnobiy,tmsg;
void ttmsg();void txmsg(string x,int a);
void setfont(int x,int y);

// 純裝飾用、不影響遊戲邏輯的圖元（金幣、磚塊碎片等）
void eyobi(int xa,int xb,int xc,int xd,int xe,int xf,int xnobia,int xnobib,int xgtype,int xtm);
#define emax 201
int eco;
int ea[emax],eb[emax],enobia[emax],enobib[emax],ec[emax],ed[emax];
int ee[emax],ef[emax],etm[emax];
int egtype[emax];



// 敵人角色
void ayobi(int xa,int xb,int xc,int xd,int xnotm,int xtype,int xxtype);
void tekizimen();
#define amax 24
int aco;
int aa[amax],ab[amax],anobia[amax],anobib[amax],ac[amax],ad[amax];
int ae[amax],af[amax],abrocktm[amax];
int aacta[amax],aactb[amax],azimentype[amax],axzimen[amax];
int atype[amax],axtype[amax],amuki[amax],ahp[amax];
int anotm[amax],anx[160],any[160];
int atm[amax],a2tm[amax];
int amsgtm[amax],amsgtype[amax];

// 敵人出現排程（從哪裡冒出來）
#define bmax 81
int bco;
int ba[bmax],bb[bmax],btm[bmax];
int btype[bmax],bxtype[bmax],bz[bmax];


// 背景物件（雲、樹、城堡等）
#define nmax 41
int nxxmax,nco;
int na[nmax],nb[nmax],nc[nmax],nd[nmax],ntype[nmax];
int ne[nmax],nf[nmax],ng[nmax],nx[nmax];


// 升降梯／移動平台
#define srmax 21
int srco;
int sra[srmax],srb[srmax],src[srmax],srd[srmax],sre[srmax],srf[srmax];
int srtype[srmax],srgtype[srmax],sracttype[srmax],srsp[srmax];
int srmuki[srmax],sron[srmax],sree[srmax];
int srsok[srmax],srmovep[srmax],srmove[srmax];





// 畫面捲動範圍
int fx=0,fy=0,fzx,fzy,scrollx,scrolly;
// 整體位移補正用座標
int _fma=0,_fmb=0;
// 強制捲動旗標（強制往右滾的關卡）
int kscroll=0;
// 畫面尺寸（紅白機解析度 × 2，256×224 → 480×420）
int fxmax=48000,fymax=42000;



// 關卡資訊
unsigned char stagedate[17][2001];

// 畫面整片黑用的計時器
int blacktm=1,blackx=0;



// 萬用暫存（迴圈內常用的 scratch 變數）
int xx[91];
double xd[11];
string xs[31];


// 計時器（用來測 frame 時間）
long stime;
