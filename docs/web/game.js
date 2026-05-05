// 貓利歐：屎喔棒大冒險 — 純 JS Canvas2D 移植
// 從 main.cpp / loadg.cpp 約 5800 行 C++ + DxLib 抽出核心遊戲邏輯
//
// 編碼策略：
//   - 物件位置用整數 px（原作用 *100 fixed-point，這邊直接 px）
//   - 30×30 一格 tile（matches DxLib 30 px sprite + 30 px world tile）
//   - 480×420 viewport （matches DxLib SetGraphMode）

// ─── 常數 ───────────────────────────────────────────────────────
const W = 480, H = 420;
const TILE = 30;
const GRAV = 0.65;          // 重力（px per frame²）
const JUMP_V = -10.5;       // 跳躍初速度
const RUN_V = 2.6;          // 跑速
const RUN_AIR = 2.2;        // 空中橫移速
const FRICTION = 0.85;      // 地面摩擦
const MAX_FALL = 12;
const FPS = 60;

// ─── 狀態 ───────────────────────────────────────────────────────
let canvas, ctx;
let lastT = 0;
let keys = {};
let keyPress = {};         // 一次性按鍵
let mainst = 100;          // 100=title, 1=play, 50=死, 99=過關
let stm = 0;               // 場景內計時
let dethco = 0;            // 累計死亡（持久）
let stageNum = 1;
let camX = 0;

// 玩家
const P = {
    x: 60, y: 100, vx: 0, vy: 0,
    onGround: false,
    facing: 1,             // 1=right, -1=left
    state: 'normal',       // normal, dying, dead
    deathTm: 0,
    deathMsg: '',
    deathMsgTm: 0,
};

// 實體
let blocks = [];           // {x,y,t}  t: 1=ground 2=brick 3=qmark 4=trap 5=spike 6=goal 7=pipe 8=fake 9=hidden 10=falling
let enemies = [];          // {x,y,vx,vy,t,alive}
let particles = [];        // 死亡碎片、煙花
let triggers = [];         // 觸發區（玩家經過會啟動陷阱）

// 資源
let sprites = {};
const audios = {};
let muted = false;

// 死亡哏（搬自 main.cpp v1.1，slot 1~65）
const DEATH_LINES = [
    '喔、有夠讚!!', '雖然沒毒啦……', '刺進去了!!', '完美、寄了',
    '我就爛!!', '破防了……', '下輩子當人吧', '這款不適合我', '媽我在這',
    '我選擇死亡', '笑死 又寄了', '已寄爆', '真的會謝', '不忍卒睹',
    '想跟岩漿融為一體……', '哇～煙火大會!!', '我的腳、我的腳啊!!',
];

// 死亡計數階段嗆聲（搬自 v1.1 的 SetMainWindowText）
const TAUNT_THRESHOLDS = [
    [5,   '死 5 次了喔'],
    [10,  '10 次！要不要喝口水'],
    [20,  '20 次，去睡覺啦'],
    [30,  '30 次了 認真的嗎？'],
    [50,  '不是每個人都適合這款、沒關係'],
    [70,  '70 次… 我都看不下去了'],
    [100, '你贏了，我服了'],
    [150, '你的人生是不是哪邊卡住了'],
    [200, '建議你刪了這個遊戲'],
    [300, '真心欽佩'],
    [500, '你已經沒救了 但繼續加油'],
];

// ─── 載入 ───────────────────────────────────────────────────────
// DxLib 用 cyan (R=153, G=255, B=255) 當透明色 key（SetTransColor(9*16+9,255,255)），
// PNG 本身沒有 alpha channel。瀏覽器原生 drawImage 不認得這個 convention，
// 所以載入時把 cyan 像素的 alpha 設成 0，回傳 offscreen canvas（可被 drawImage 引用）
function loadImg(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const c = document.createElement('canvas');
            c.width = img.width; c.height = img.height;
            const cctx = c.getContext('2d');
            cctx.drawImage(img, 0, 0);
            try {
                const data = cctx.getImageData(0, 0, c.width, c.height);
                const px = data.data;
                for (let i = 0; i < px.length; i += 4) {
                    // 涵蓋 cyan 與其變體（壓縮後可能差幾個值）
                    if (px[i] < 200 && px[i+1] > 240 && px[i+2] > 240) {
                        px[i+3] = 0;
                    }
                }
                cctx.putImageData(data, 0, 0);
            } catch (e) {
                // CORS 阻擋的話用 fallback：直接回 img（cyan 邊會看到）
                resolve(img); return;
            }
            resolve(c);
        };
        img.onerror = reject;
        img.src = src;
    });
}

async function loadAll() {
    sprites.player  = await loadImg('res/player.PNG');
    sprites.brock   = await loadImg('res/brock.PNG');
    sprites.brock2  = await loadImg('res/brock2.PNG');
    sprites.haikei  = await loadImg('res/haikei.PNG');
    sprites.item    = await loadImg('res/item.PNG');
    sprites.teki    = await loadImg('res/teki.PNG');
    sprites.omake   = await loadImg('res/omake.PNG');
    sprites.title   = await loadImg('res/syobon3_v2.PNG');

    // 音效（lazy，要等 user gesture）
    audios.bgmField = new Audio('BGM/field.mp3');
    audios.bgmField.loop = true;
    audios.bgmField.volume = 0.55;

    audios.bgmCastle = new Audio('BGM/castle.mp3');
    audios.bgmCastle.loop = true;
    audios.bgmCastle.volume = 0.55;

    audios.seJump  = new Audio('SE/jump.mp3');
    audios.seDeath = new Audio('SE/death.mp3');
    audios.seCoin  = new Audio('SE/coin.mp3');
    audios.seBreak = new Audio('SE/brockbreak.mp3');
    audios.seGoal  = new Audio('SE/goal.mp3');
    audios.seHumi  = new Audio('SE/humi.mp3');     // 踩敵人
    audios.sePower = new Audio('SE/powerup.mp3');
    audios.seClear = new Audio('SE/4-clear.mp3');

    Object.values(audios).forEach(a => { a.volume = a.volume || 0.65; });
}

function playSe(name) {
    const a = audios[name];
    if (!a || muted) return;
    try { a.currentTime = 0; a.play().catch(() => {}); } catch (e) {}
}

function startBgm(name) {
    Object.entries(audios).forEach(([k, a]) => {
        if (k.startsWith('bgm') && k !== name) { try { a.pause(); } catch(e){} }
    });
    if (muted) return;
    const a = audios[name];
    if (!a) return;
    try { a.currentTime = 0; a.play().catch(() => {}); } catch (e) {}
}

function stopAllBgm() {
    Object.entries(audios).forEach(([k, a]) => {
        if (k.startsWith('bgm')) { try { a.pause(); } catch(e){} }
    });
}

// ─── 關卡資料 ───────────────────────────────────────────────────
// tile char → block type
//   . = 空    G = 一般地面    B = 磚塊    ? = ?磚（好東西）
//   X = ?磚（陷阱-砸下尖刺）  T = 從天而降的尖刺觸發點
//   F = 假磚（站上去就死）   H = 隱形殺人磚（跳起頂到就死）
//   P = 水管   K = 龜殼敵人位置   E = 一般敵人位置
//   * = 終點旗杆               C = 金幣
//   ! = 玩家起點

const STAGES = {
    1: {
        bgm: 'bgmField',
        bgColor: '#a0b4fa',
        rows: [
            // 16 列 x 60 欄（x 30 = 1800px wide stage）
            '............................................................',
            '............................................................',
            '............................................................',
            '..........T.....................T..........................',
            '............................................................',
            '............................................................',
            '...........?....................?B?B.......................',
            '............................................................',
            '..........BBB..........F.....BBB..............E............',
            '..............................................BB..........*',
            '............................................................',
            '............................................................',
            '!.........................H..............................**',
            'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG.....GGGGGGGGGGGGGGGGGG',
            'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG.....GGGGGGGGGGGGGGGGGG',
            'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
        ],
    },
    2: {
        bgm: 'bgmField',
        bgColor: '#a0b4fa',
        rows: [
            '............................................................',
            '............................................................',
            '..........T...........T...........T.........T..............',
            '............................................................',
            '............................................................',
            '............?B?....................F....BB?B..............',
            '............................................................',
            '......BBBB.....................BBBBBB.......BB.............',
            '............................................................',
            '..............E.....E........E..........E...............E.*',
            '............................................................',
            '............................................................',
            '!......H..............................F..................**',
            'GGGGGGGGG..GGGGGGGGGG..GGGGGGGGGGGGGGGGGG..GGGGGGGGGGGGGGGGG',
            'GGGGGGGGG..GGGGGGGGGG..GGGGGGGGGGGGGGGGGG..GGGGGGGGGGGGGGGGG',
            'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
        ],
    },
};

function loadStage(num) {
    stageNum = num;
    const st = STAGES[num] || STAGES[1];
    blocks = [];
    enemies = [];
    triggers = [];
    particles = [];
    camX = 0;

    const rows = st.rows;
    for (let ry = 0; ry < rows.length; ry++) {
        const row = rows[ry];
        for (let rx = 0; rx < row.length; rx++) {
            const c = row[rx];
            const x = rx * TILE, y = ry * TILE;
            if (c === '!') { P.x = x; P.y = y; }
            else if (c === 'G') blocks.push({ x, y, t: 1 });
            else if (c === 'B') blocks.push({ x, y, t: 2 });
            else if (c === '?') blocks.push({ x, y, t: 3 });
            else if (c === 'X') blocks.push({ x, y, t: 4 });
            else if (c === 'F') blocks.push({ x, y, t: 8 });   // fake block 站上死
            else if (c === 'H') blocks.push({ x, y, t: 9 });   // hidden 隱形殺人磚
            else if (c === 'P') blocks.push({ x, y, t: 7 });
            else if (c === 'C') blocks.push({ x, y, t: 11 });  // 金幣
            else if (c === '*') blocks.push({ x, y, t: 6 });   // 旗杆
            else if (c === 'T') triggers.push({ x, y, used: false });
            else if (c === 'E') enemies.push({ x, y, vx: -1, vy: 0, t: 1, alive: true });
            else if (c === 'K') enemies.push({ x, y, vx: -1, vy: 0, t: 2, alive: true });
        }
    }

    // 玩家狀態 reset
    P.vx = 0; P.vy = 0;
    P.state = 'normal';
    P.facing = 1;
    P.deathMsgTm = 0;
    mainst = 1;
    stm = 0;
    startBgm(st.bgm);
}

// ─── 輸入 ───────────────────────────────────────────────────────
addEventListener('keydown', e => {
    if (!keys[e.code]) keyPress[e.code] = true;
    keys[e.code] = true;
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; });

// 觸控按鈕
document.querySelectorAll('.touch button').forEach(b => {
    const k = b.dataset.key;
    const down = e => { e.preventDefault(); if (!keys[k]) keyPress[k] = true; keys[k] = true; };
    const up   = e => { e.preventDefault(); keys[k] = false; };
    b.addEventListener('touchstart', down, { passive: false });
    b.addEventListener('touchend',   up,   { passive: false });
    b.addEventListener('mousedown',  down);
    b.addEventListener('mouseup',    up);
    b.addEventListener('mouseleave', up);
});

// ─── 物理 / 碰撞 ────────────────────────────────────────────────
function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function isSolid(t) {
    // 哪些磚塊算碰撞固體（站上去頭頂）
    return t === 1 || t === 2 || t === 3 || t === 7 || t === 8 || t === 4;
}

function collidePlayerBlocks() {
    // X 軸先 resolve
    P.x += P.vx;
    for (const b of blocks) {
        if (!isSolid(b.t)) continue;
        if (rectsOverlap(P.x, P.y, 28, 36, b.x, b.y, TILE, TILE)) {
            if (P.vx > 0) P.x = b.x - 28;
            else if (P.vx < 0) P.x = b.x + TILE;
            P.vx = 0;
        }
    }
    // Y 軸 resolve
    P.y += P.vy;
    P.onGround = false;
    for (const b of blocks) {
        if (!isSolid(b.t)) continue;
        if (rectsOverlap(P.x, P.y, 28, 36, b.x, b.y, TILE, TILE)) {
            if (P.vy > 0) {
                P.y = b.y - 36;
                P.vy = 0;
                P.onGround = true;
                // 站上 fake block (t=8) → 死
                if (b.t === 8) killPlayer(7);  // "下輩子當人吧"
            } else if (P.vy < 0) {
                P.y = b.y + TILE;
                P.vy = 0;
                // 從下面頂磚塊
                if (b.t === 2) {
                    // 磚塊被頂破
                    const idx = blocks.indexOf(b);
                    if (idx >= 0) blocks.splice(idx, 1);
                    spawnParticles(b.x + 15, b.y + 15, '#a0612e', 8);
                    playSe('seBreak');
                }
                if (b.t === 3) {
                    // ?磚（這版暫時當 brick 處理，給音效）
                    playSe('seCoin');
                    b.t = 1;
                }
            }
        }
    }

    // hidden 殺人磚（碰到任何方向都死）
    for (const b of blocks) {
        if (b.t !== 9) continue;
        if (rectsOverlap(P.x, P.y, 28, 36, b.x, b.y, TILE, TILE)) {
            killPlayer(8);  // "這款不適合我"
        }
    }

    // 落出畫面下緣 → 死
    if (P.y > H + 80) killPlayer(15);  // "想跟岩漿融為一體……"
}

function updatePlayer() {
    if (P.state === 'dying') {
        P.deathTm++;
        P.vy += GRAV;
        if (P.vy > MAX_FALL) P.vy = MAX_FALL;
        P.y += P.vy;
        if (P.deathTm > 90) {
            // 重新開始本關
            mainst = 50;
            stm = 0;
        }
        return;
    }

    // 自殺鍵
    if (keyPress['KeyO']) killPlayer(2);

    // 左右移動
    const speed = P.onGround ? RUN_V : RUN_AIR;
    if (keys['ArrowLeft'])  { P.vx = -speed; P.facing = -1; }
    else if (keys['ArrowRight']) { P.vx = speed; P.facing = 1; }
    else if (P.onGround) { P.vx *= FRICTION; if (Math.abs(P.vx) < 0.1) P.vx = 0; }

    // 跳躍
    if (P.onGround && (keyPress['ArrowUp'] || keyPress['KeyZ'] || keyPress['Space'])) {
        P.vy = JUMP_V;
        P.onGround = false;
        playSe('seJump');
    }

    // 重力
    P.vy += GRAV;
    if (P.vy > MAX_FALL) P.vy = MAX_FALL;

    collidePlayerBlocks();

    // 觸發從天而降的尖刺：T 觸發點 — 玩家走進該欄位下方時，從上方掉下尖刺
    for (const tr of triggers) {
        if (tr.used) continue;
        if (P.x + 14 > tr.x && P.x + 14 < tr.x + TILE && P.y > tr.y) {
            tr.used = true;
            // spawn 一個快速下落的尖刺
            blocks.push({ x: tr.x, y: -50, t: 10, vy: 0, fromTrigger: true });
        }
    }

    // 落下中的尖刺（type 10）
    for (const b of blocks) {
        if (b.t !== 10) continue;
        b.vy = (b.vy || 0) + 0.6;
        b.y += b.vy;
        if (rectsOverlap(P.x, P.y, 28, 36, b.x, b.y, TILE, TILE)) {
            killPlayer(16);  // "哇～煙火大會!!"
        }
    }

    // 旗杆（type 6）：碰到 = 過關
    for (const b of blocks) {
        if (b.t !== 6) continue;
        if (rectsOverlap(P.x, P.y, 28, 36, b.x, b.y, TILE, TILE)) {
            mainst = 99;
            stm = 0;
            stopAllBgm();
            playSe('seGoal');
            return;
        }
    }
}

function killPlayer(msgIdx) {
    if (P.state !== 'normal') return;
    P.state = 'dying';
    P.vy = -10;     // 跳起死亡動畫
    P.deathTm = 0;
    P.deathMsg = DEATH_LINES[msgIdx % DEATH_LINES.length];
    P.deathMsgTm = 60;
    dethco++;
    spawnParticles(P.x + 14, P.y + 18, '#fff', 16);
    playSe('seDeath');
    stopAllBgm();
    updateTaunt();
}

function updateTaunt() {
    // 對應原作 SetMainWindowText 階段嗆聲，這版改用上方 status bar 顯示
    const s = document.getElementById('status');
    for (let i = TAUNT_THRESHOLDS.length - 1; i >= 0; i--) {
        const [n, msg] = TAUNT_THRESHOLDS[i];
        if (dethco >= n) {
            s.textContent = `（已死 ${dethco} 次）${msg}`;
            s.classList.add('taunt');
            return;
        }
    }
    s.textContent = `已死 ${dethco} 次`;
    s.classList.remove('taunt');
}

function updateEnemies() {
    for (const e of enemies) {
        if (!e.alive) continue;
        e.vy += GRAV;
        if (e.vy > MAX_FALL) e.vy = MAX_FALL;

        // X 軸
        e.x += e.vx;
        for (const b of blocks) {
            if (!isSolid(b.t)) continue;
            if (rectsOverlap(e.x, e.y, 28, 28, b.x, b.y, TILE, TILE)) {
                if (e.vx > 0) e.x = b.x - 28;
                else e.x = b.x + TILE;
                e.vx *= -1;
            }
        }
        // Y 軸
        e.y += e.vy;
        for (const b of blocks) {
            if (!isSolid(b.t)) continue;
            if (rectsOverlap(e.x, e.y, 28, 28, b.x, b.y, TILE, TILE)) {
                if (e.vy > 0) { e.y = b.y - 28; e.vy = 0; }
                else { e.y = b.y + TILE; e.vy = 0; }
            }
        }

        // 跟玩家碰撞
        if (P.state === 'normal' && rectsOverlap(P.x, P.y, 28, 36, e.x, e.y, 28, 28)) {
            if (P.vy > 0 && P.y + 36 < e.y + 14) {
                // 踩到敵人
                e.alive = false;
                P.vy = JUMP_V * 0.7;
                playSe('seHumi');
                spawnParticles(e.x + 14, e.y + 14, '#cc6644', 8);
            } else {
                killPlayer(0);  // "喔、有夠讚!!"
            }
        }
    }
    // 清死的
    enemies = enemies.filter(e => e.alive && e.y < H + 100);
}

function spawnParticles(x, y, color, n) {
    for (let i = 0; i < n; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 6,
            vy: -Math.random() * 6 - 2,
            color,
            life: 30 + Math.random() * 20,
        });
    }
}

function updateParticles() {
    for (const p of particles) {
        p.vy += 0.4;
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
    }
    particles = particles.filter(p => p.life > 0 && p.y < H + 100);
}

function updateCamera() {
    // 向右捲動，玩家保持在 left third
    const target = P.x - W / 3;
    if (target > camX) camX = target;
    // 防止超過 stage 邊界
    const stageLen = (STAGES[stageNum].rows[0].length) * TILE;
    if (camX > stageLen - W) camX = stageLen - W;
    if (camX < 0) camX = 0;
}

// ─── 渲染 ───────────────────────────────────────────────────────
function drawSprite(img, sx, sy, sw, sh, dx, dy) {
    ctx.drawImage(img, sx, sy, sw, sh, dx | 0, dy | 0, sw, sh);
}

function renderTitle() {
    ctx.fillStyle = '#a0b4fa';
    ctx.fillRect(0, 0, W, H);

    // 雲朵點綴
    for (let i = 0; i < 5; i++) {
        const x = (i * 113 + Math.sin(stm * 0.01 + i) * 5) % (W + 60) - 30;
        const y = 40 + i * 17;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.arc(x + 14, y - 4, 14, 0, Math.PI * 2);
        ctx.arc(x + 28, y, 10, 0, Math.PI * 2);
        ctx.fill();
    }

    // 標題圖
    if (sprites.title) {
        const tw = sprites.title.width, th = sprites.title.height;
        ctx.drawImage(sprites.title, (W - tw) / 2, 80);
    }

    // 玩家 sprite 走動 demo
    const t = (stm / 30) | 0;
    const fx = t % 2 === 0 ? 0 : 31;
    if (sprites.player) {
        ctx.drawImage(sprites.player, fx, 0, 30, 36, W / 2 - 15, 200, 30, 36);
    }

    ctx.fillStyle = '#000';
    ctx.font = 'bold 18px "Microsoft JhengHei", "PingFang TC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('按 ↑ / Z / Space 開始', W / 2, 270);
    ctx.font = '13px "Microsoft JhengHei", sans-serif';
    ctx.fillStyle = '#444';
    ctx.fillText(`累計死亡：${dethco} 次`, W / 2, 295);
    ctx.fillText('原作：ちく · 中文化：thc1006', W / 2, 320);
    ctx.fillText('警告：可能會對人類產生不信任感', W / 2, 360);
    ctx.textAlign = 'left';
}

function renderStage() {
    const st = STAGES[stageNum];
    ctx.fillStyle = st.bgColor || '#a0b4fa';
    ctx.fillRect(0, 0, W, H);

    // 背景雲
    for (let i = 0; i < 6; i++) {
        const x = ((i * 200 - camX * 0.3) % (W + 80) + W + 80) % (W + 80) - 40;
        const y = 30 + i * 23 % 60;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.arc(x, y, 11, 0, Math.PI * 2);
        ctx.arc(x + 12, y - 4, 13, 0, Math.PI * 2);
        ctx.arc(x + 24, y, 9, 0, Math.PI * 2);
        ctx.fill();
    }

    // 磚塊
    for (const b of blocks) {
        const sx = b.x - camX, sy = b.y;
        if (sx < -40 || sx > W + 10) continue;

        if (b.t === 1) {
            // 一般地面（綠草）— 自繪
            ctx.fillStyle = '#28c428';
            ctx.fillRect(sx, sy, TILE, 4);
            ctx.fillStyle = '#a0612e';
            ctx.fillRect(sx, sy + 4, TILE, TILE - 4);
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.strokeRect(sx, sy, TILE, TILE);
        } else if (b.t === 2 && sprites.brock) {
            // 磚塊 sprite — atlas (99,0)（pixel-sample 確認 col 3 是棕色磚塊紋理；
            // col 0/1 是黑色 placeholder 給 stealth 磚塊用，col 2 是 ?）
            ctx.drawImage(sprites.brock, 99, 0, 30, 30, sx, sy, 30, 30);
        } else if (b.t === 3 && sprites.brock) {
            // ? 磚 — atlas (66,0)
            ctx.drawImage(sprites.brock, 66, 0, 30, 30, sx, sy, 30, 30);
        } else if (b.t === 4) {
            // 陷阱 ?（黃底跟普通 ? 磚一樣，視覺上 indistinguishable，這就是整人哏）
            ctx.fillStyle = '#ffc850';
            ctx.fillRect(sx, sy, TILE, TILE);
            ctx.strokeStyle = '#000';
            ctx.strokeRect(sx, sy, TILE, TILE);
            ctx.fillStyle = '#000';
            ctx.font = 'bold 24px sans-serif';
            ctx.fillText('?', sx + 8, sy + 22);
        } else if (b.t === 6) {
            // 旗杆
            ctx.fillStyle = '#fff';
            ctx.fillRect(sx + 13, sy - 60, 4, TILE + 60);
            ctx.fillStyle = '#ff3030';
            ctx.beginPath();
            ctx.moveTo(sx + 17, sy - 55);
            ctx.lineTo(sx + 35, sy - 50);
            ctx.lineTo(sx + 17, sy - 45);
            ctx.fill();
        } else if (b.t === 7 && sprites.brock) {
            // 水管
            ctx.fillStyle = '#00a020';
            ctx.fillRect(sx, sy, TILE, TILE);
            ctx.strokeStyle = '#005010';
            ctx.strokeRect(sx, sy, TILE, TILE);
        } else if (b.t === 8 && sprites.brock) {
            // fake block — 看起來跟一般磚塊完全一樣（站上去才知道你寄了）
            ctx.drawImage(sprites.brock, 99, 0, 30, 30, sx, sy, 30, 30);
        } else if (b.t === 9) {
            // hidden block — 不畫（隱形）
        } else if (b.t === 10) {
            // 落下尖刺
            ctx.fillStyle = '#404040';
            ctx.beginPath();
            ctx.moveTo(sx, sy + TILE);
            ctx.lineTo(sx + 15, sy);
            ctx.lineTo(sx + TILE, sy + TILE);
            ctx.closePath();
            ctx.fill();
        } else if (b.t === 11 && sprites.item) {
            // 金幣
            ctx.drawImage(sprites.item, 0, 0, 30, 30, sx, sy, 30, 30);
        }
    }

    // 敵人
    for (const e of enemies) {
        if (!e.alive) continue;
        const sx = e.x - camX, sy = e.y;
        if (sx < -40 || sx > W + 10) continue;
        if (sprites.teki) {
            ctx.drawImage(sprites.teki, 0, 0, 30, 30, sx, sy, 30, 30);
        } else {
            ctx.fillStyle = '#cc6644';
            ctx.fillRect(sx, sy, 28, 28);
        }
    }

    // 玩家
    const px = P.x - camX, py = P.y;
    if (sprites.player) {
        let frame = 0;
        if (P.state === 'dying') frame = 4;     // 死亡 sprite
        else if (!P.onGround) frame = 1;        // 跳躍
        else if (Math.abs(P.vx) > 0.5) frame = ((stm / 6) | 0) % 2 === 0 ? 0 : 2;

        const sx = frame * 31;
        ctx.save();
        if (P.facing === -1) {
            ctx.translate(px + 30, py);
            ctx.scale(-1, 1);
            ctx.drawImage(sprites.player, sx, 0, 30, 36, 0, 0, 30, 36);
        } else {
            ctx.drawImage(sprites.player, sx, 0, 30, 36, px, py, 30, 36);
        }
        ctx.restore();
    }

    // 死亡訊息（玩家頭上飄字）
    if (P.deathMsgTm > 0 && P.deathMsg) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        const tw = P.deathMsg.length * 14 + 16;
        ctx.fillRect(px - tw / 2 + 14, py - 30, tw, 22);
        ctx.fillStyle = '#ffc850';
        ctx.font = 'bold 14px "Microsoft JhengHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(P.deathMsg, px + 14, py - 14);
        ctx.textAlign = 'left';
        P.deathMsgTm--;
    }

    // 粒子
    for (const p of particles) {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - camX - 2, p.y - 2, 4, 4);
    }

    // 過關覆蓋
    if (mainst === 99) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ffc850';
        ctx.font = 'bold 36px "Microsoft JhengHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('關卡  全破', W / 2, H / 2 - 10);
        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#fff';
        const next = stageNum + 1;
        if (STAGES[next]) ctx.fillText(`按 Z 進下一關（${next}-1）`, W / 2, H / 2 + 30);
        else ctx.fillText('全部通關！按 Z 回標題', W / 2, H / 2 + 30);
        ctx.textAlign = 'left';
    }
}

// ─── 主迴圈 ─────────────────────────────────────────────────────
function update() {
    stm++;
    if (mainst === 100) {
        if (keyPress['KeyZ'] || keyPress['ArrowUp'] || keyPress['Space']) {
            loadStage(1);
        }
    } else if (mainst === 1) {
        updatePlayer();
        if (P.state === 'normal') {
            updateEnemies();
            updateCamera();
        }
        updateParticles();
        // F1 回標題
        if (keyPress['F1']) { mainst = 100; stopAllBgm(); }
    } else if (mainst === 50) {
        // 死亡轉場
        if (stm > 30) loadStage(stageNum);  // 重來本關（dethco 不重置）
    } else if (mainst === 99) {
        // 過關轉場
        if (stm > 30 && (keyPress['KeyZ'] || keyPress['ArrowUp'] || keyPress['Space'])) {
            const next = stageNum + 1;
            if (STAGES[next]) loadStage(next);
            else { mainst = 100; stopAllBgm(); }
        }
    }
    keyPress = {};
}

function render() {
    if (mainst === 100) renderTitle();
    else renderStage();
}

function loop(t) {
    const dt = t - lastT;
    if (dt >= 1000 / FPS - 1) {
        lastT = t;
        update();
        render();
    }
    requestAnimationFrame(loop);
}

// ─── Bootstrap ──────────────────────────────────────────────────
async function main() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    document.getElementById('status').textContent = '載入中…';
    try {
        await loadAll();
    } catch (e) {
        document.getElementById('status').textContent = '資源載入失敗：' + e.message;
        return;
    }

    // start overlay：使用者點一下才會開始 + 啟用音訊
    const overlay = document.getElementById('startOverlay');
    overlay.addEventListener('click', () => {
        overlay.style.display = 'none';
        // 先 play() 一次每個 audio 來解鎖（瀏覽器 autoplay policy）
        Object.values(audios).forEach(a => {
            try { a.play().then(() => a.pause()).catch(() => {}); } catch (e) {}
        });
        document.getElementById('status').textContent = '按 ↑ / Z / Space 開始遊戲';
    });

    requestAnimationFrame(loop);
}

main();
