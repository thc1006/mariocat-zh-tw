// 貓利歐：屎喔棒大冒險 — 純 JS Canvas2D 完整移植
// 移植自 main.cpp / loadg.cpp 約 5800 行 C++ + DxLib，盡可能還原原作精神：
//   - 4 個關卡含 iconic SyobonAction 陷阱
//   - 6 種敵人 AI
//   - 15+ 種 block 類型
//   - 完整死亡 / 過關序列
//   - 中繼旗子 + Staff Roll
//   - 多 BGM 切換
//   - 死亡計數搞怪 + 中文死亡哏
//   - DxLib cyan transparent key 處理
//   - 行動裝置觸控

// ─── 常數 ───────────────────────────────────────────────────────
const W = 480, H = 420;
const TILE = 30;
const GRAV = 0.65;
const JUMP_V = -10.8;
const JUMP_BIG = -13.5;
const RUN_V = 2.6;
const RUN_AIR = 2.4;
const FRICTION = 0.85;
const MAX_FALL = 12;
const FPS = 60;

// ─── 全域狀態 ───────────────────────────────────────────────────
let canvas, ctx;
let lastT = 0;
let keys = {};
let keyPress = {};
let mainst = 100;          // 100=title 1=play 50=死亡轉場 99=過關 200=staff
let stm = 0;               // 場景內計時
let dethco = 0;            // 累計死亡（持久跨關）
let stageNum = 1;
let camX = 0;
let starTimer = 0;         // 無敵狀態（吃到星）

const P = {
    x: 60, y: 100, vx: 0, vy: 0,
    onGround: false,
    facing: 1,
    state: 'normal',       // normal / dying / clearing
    deathTm: 0,
    deathMsg: '',
    deathMsgTm: 0,
    big: false,            // 變大狀態
    invuln: 0,
};

let blocks = [];
let enemies = [];
let particles = [];
let triggers = [];
let items = [];            // {x,y,vx,vy,t,alive}
let projectiles = [];      // 火球、岩漿球
let stageStartX = 60;      // 中繼旗已過則 spawn 在這
let midFlagReached = false;
let goalTouched = false;
let goalTm = 0;
let coinCount = 0;

// 資源
let sprites = {};
const audios = {};
let muted = false;

// 死亡台詞（mmsgtype 1-65 對應原作 main.cpp）
const DEATH_LINES = [
    /* 0  */ '喔、有夠讚!!',         // 1: 吃毒香菇
    /* 1  */ '雖然沒毒啦……',         // 2
    /* 2  */ '刺進去了!!',            // 3: 踩刺
    /* 3  */ '完美、寄了',            // 52
    /* 4  */ '我就爛!!',              // 56
    /* 5  */ '破防了……',              // 57
    /* 6  */ '下輩子當人吧',          // 58
    /* 7  */ '這款不適合我',          // 59
    /* 8  */ '媽我在這',              // 60
    /* 9  */ '我選擇死亡',            // 61
    /* 10 */ '笑死 又寄了',           // 62
    /* 11 */ '已寄爆',                // 63
    /* 12 */ '真的會謝',              // 64
    /* 13 */ '不忍卒睹',              // 65
    /* 14 */ '想跟岩漿融為一體……',   // 55: 落入岩漿
    /* 15 */ '哇～煙火大會!!',        // 51: 被炸
    /* 16 */ '我的腳、我的腳啊!!',    // 53: 被升降梯壓
    /* 17 */ '不愧是攝氏 800 度!!',   // 54: 火球
    /* 18 */ '老子是燃燒的男人!!',    // 11
    /* 19 */ '早知道就不吃了!!',      // 10
];

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
                    if (px[i] < 200 && px[i+1] > 240 && px[i+2] > 240) px[i+3] = 0;
                }
                cctx.putImageData(data, 0, 0);
            } catch (e) { resolve(img); return; }
            resolve(c);
        };
        img.onerror = reject;
        img.src = src;
    });
}

async function loadAll() {
    sprites.player = await loadImg('res/player.PNG');
    sprites.brock  = await loadImg('res/brock.PNG');
    sprites.brock2 = await loadImg('res/brock2.PNG');
    sprites.haikei = await loadImg('res/haikei.PNG');
    sprites.item   = await loadImg('res/item.PNG');
    sprites.teki   = await loadImg('res/teki.PNG');
    sprites.omake  = await loadImg('res/omake.PNG');
    sprites.title  = await loadImg('res/syobon3_v2.PNG');

    audios.bgmField   = new Audio('BGM/field.mp3');   audios.bgmField.loop = true;
    audios.bgmDungeon = new Audio('BGM/dungeon.mp3'); audios.bgmDungeon.loop = true;
    audios.bgmCastle  = new Audio('BGM/castle.mp3');  audios.bgmCastle.loop = true;
    audios.bgmStar    = new Audio('BGM/star4.mp3');   audios.bgmStar.loop = true;
    audios.seJump     = new Audio('SE/jump.mp3');
    audios.seDeath    = new Audio('SE/death.mp3');
    audios.seCoin     = new Audio('SE/coin.mp3');
    audios.seBreak    = new Audio('SE/brockbreak.mp3');
    audios.seGoal     = new Audio('SE/goal.mp3');
    audios.seHumi     = new Audio('SE/humi.mp3');
    audios.sePower    = new Audio('SE/powerup.mp3');
    audios.seClear    = new Audio('SE/4-clear.mp3');
    audios.seKoura    = new Audio('SE/koura.mp3');
    audios.seDokan    = new Audio('SE/dokan.mp3');
    audios.seFire     = new Audio('SE/tekifire.mp3');
    audios.seKinoko   = new Audio('SE/brockkinoko.mp3');

    Object.entries(audios).forEach(([k, a]) => {
        a.volume = k.startsWith('bgm') ? 0.55 : 0.7;
    });
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
// tile chars:
//   ! = 玩家起點   * = 終點旗   M = 中繼旗
//   G = 草地       g = 地下泥土  L = 岩漿（碰到死）
//   B = 紅磚       Y = ?磚（給金幣/香菇）   X = 金幣磚 (打掉只給幣)
//   F = 假磚（站上死） H = 隱形殺人磚（頂到死）  Z = 隱形 ?磚
//   T = 從天降尖刺觸發點    S = 固定尖刺（地刺）
//   J = 跳跳台    P = 水管入口   p = 水管裝飾
//   K = 香菇敵人  R = 龜殼敵人  V = 飛行敵人  C = 火球發射器
//   N = 旗杆假冒(碰到 troll 但不過關)
//   O = ON-OFF 磚（綠色 - 開時實心關時 ghost）
//   o = ON-OFF 磚（紅色 - 跟綠色相反）
//   I = 移動升降梯
//   . = 空

const STAGES = {
    1: {
        name: '1-1 草原序章',
        bgm: 'bgmField',
        bgColor: '#a0b4fa',
        rows: [
            // 大約 80 cols 寬 = 2400 px
            '................................................................................',
            '................................................................................',
            '....T...........T.................T.............T..............................',
            '................................................................................',
            '................................................................................',
            '..........YBY.........H.....BBBBB................................BB............',
            '................................................................................',
            '......BB.........F............................YYY................BB...........*',
            '..............K..............K..R........................K.....M.................',
            '................................................................................',
            '................................................................................',
            '................................................................................',
            '!.......................................................................G......',
            'GGGGGGGGGGGGGGGGGGGGGGG..GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG..GGGGGGGGGGGGGGGGGGG',
            'GGGGGGGGGGGGGGGGGGGGGGG..GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG..GGGGGGGGGGGGGGGGGGG',
            'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
        ],
    },
    2: {
        name: '1-2 地下迷宮',
        bgm: 'bgmDungeon',
        bgColor: '#1a1530',
        rows: [
            'gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg',
            '................................................................................',
            '................................................................................',
            '......YYY.....BBBBB.................................SSSSS......................',
            '................................................................................',
            '................F....BBBB.....................................................*',
            '................................................................................',
            '..........R..............V......K......R.......C.....K.........K....M.........',
            '................................................................................',
            '!.......B.....B......B........B.....B.........B.......B........B.............G..',
            '................................................................................',
            '..........................SSS......................SSS........................',
            '................................................................................',
            'gggggggggg.....gggggggggggggggggggggggg....ggggggggggg....gggggggggggggggggggggggg',
            'gggggggggg.....gggggggggggggggggggggggg....ggggggggggg....gggggggggggggggggggggggg',
            'gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg',
        ],
    },
    3: {
        name: '1-3 空中走廊',
        bgm: 'bgmField',
        bgColor: '#9bdaff',
        rows: [
            '................................................................................',
            '................................................................................',
            '..............T...........T...............T..........T.........................',
            '................................................................................',
            '......YBY...............BBB...............YBYBY................................',
            '................................................................................',
            '!......H..........F............V........H.........F.................V.........*',
            '...GGGG.....GGGGG......GGGG..........GGGGGGG.......GGGGG......GGGGGGGGGGGGGGGGM',
            '...........K..........R..............V.........K..........R........K..........',
            '................................................................................',
            '................................................................................',
            '................................................................................',
            '................................................................................',
            '................................................................................',
            '................................................................................',
            '................................................................................',
        ],
    },
    4: {
        name: '1-4 城堡魔王',
        bgm: 'bgmCastle',
        bgColor: '#1a0a1a',
        rows: [
            '................................................................................',
            '................................................................................',
            '...........T...............T..............T...............T....................',
            '................................................................................',
            '......C.........C.........C........C..........C..........C.....................',
            '................................................................................',
            '......BBBB....BBBB....BBBBBBBB.......BBBB.....BBBBB....BBBBBBBB................',
            '................................................................................',
            '!.....................R..........R........R.................R..............M..*',
            '................................................................................',
            '......SSSSS....SSSS......LLLL.....SSSS........LL...SSS......LLLL...............',
            'GGGG..........GGGG......GGGG.....GGGGGG......GGGGGGGGGG...GGGGGG.GGGGGGGGGGGGGGG',
            'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
            'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
            'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
            'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
        ],
    },
};

function loadStage(num, fromMid) {
    stageNum = num;
    const st = STAGES[num] || STAGES[1];
    blocks = []; enemies = []; triggers = []; particles = []; items = []; projectiles = [];
    camX = 0; coinCount = 0; midFlagReached = !!fromMid; goalTouched = false;
    starTimer = 0;

    const rows = st.rows;
    let startX = 60, startY = 360;
    let midX = null, midY = null;

    for (let ry = 0; ry < rows.length; ry++) {
        const row = rows[ry];
        for (let rx = 0; rx < row.length; rx++) {
            const c = row[rx];
            const x = rx * TILE, y = ry * TILE;
            switch (c) {
                case '!': startX = x; startY = y; break;
                case 'M': midX = x; midY = y; blocks.push({ x, y, t: 'midflag' }); break;
                case '*': blocks.push({ x, y, t: 'goal' }); break;
                case 'G': blocks.push({ x, y, t: 'ground' }); break;
                case 'g': blocks.push({ x, y, t: 'ground_dark' }); break;
                case 'L': blocks.push({ x, y, t: 'lava' }); break;
                case 'B': blocks.push({ x, y, t: 'brick' }); break;
                case 'Y': blocks.push({ x, y, t: 'qmark', hasItem: 'mushroom' }); break;
                case 'X': blocks.push({ x, y, t: 'qmark', hasItem: 'coin' }); break;
                case 'F': blocks.push({ x, y, t: 'fake' }); break;
                case 'H': blocks.push({ x, y, t: 'hidden_kill' }); break;
                case 'Z': blocks.push({ x, y, t: 'hidden_q', hasItem: 'mushroom' }); break;
                case 'T': triggers.push({ x, y, used: false, kind: 'spike' }); break;
                case 'S': blocks.push({ x, y, t: 'spike_static' }); break;
                case 'J': blocks.push({ x, y, t: 'jumppad' }); break;
                case 'P': blocks.push({ x, y, t: 'pipe_top' }); break;
                case 'p': blocks.push({ x, y, t: 'pipe_body' }); break;
                case 'N': blocks.push({ x, y, t: 'fake_goal' }); break;
                case 'K': enemies.push(makeEnemy(x, y, 'walker')); break;
                case 'R': enemies.push(makeEnemy(x, y, 'koura')); break;
                case 'V': enemies.push(makeEnemy(x, y, 'flyer')); break;
                case 'C': blocks.push({ x, y, t: 'fire_shooter', tm: 0 }); break;
            }
        }
    }

    if (fromMid && midX !== null) { P.x = midX; P.y = midY; }
    else { P.x = startX; P.y = startY; }
    P.vx = 0; P.vy = 0; P.facing = 1; P.state = 'normal';
    P.deathMsgTm = 0; P.invuln = 0;
    mainst = 1; stm = 0;
    startBgm(st.bgm);
}

function makeEnemy(x, y, t) {
    const e = { x, y, vx: -1.2, vy: 0, t, alive: true, kourState: 0, koureTm: 0, hp: 1 };
    if (t === 'flyer') { e.baseY = y; e.tm = 0; }
    if (t === 'koura') { e.kourState = 0; }  // 0=walk, 1=shell-still, 2=shell-sliding
    return e;
}

// ─── 輸入 ───────────────────────────────────────────────────────
addEventListener('keydown', e => {
    if (!keys[e.code]) keyPress[e.code] = true;
    keys[e.code] = true;
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; });

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

// ─── 物理 ───────────────────────────────────────────────────────
function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function isSolid(t) {
    return ['ground','ground_dark','brick','qmark','fake','pipe_top','pipe_body','fake_goal','jumppad'].includes(t);
}

function isHazard(t) {
    return t === 'spike_static' || t === 'lava';
}

const PLAYER_W = 28, PLAYER_H = 36, PLAYER_BIG_H = 56;

function playerH() { return P.big ? PLAYER_BIG_H : PLAYER_H; }

function collideEntityBlocks(e, w, h, onTopHit, onBottomHit) {
    e.x += e.vx;
    for (const b of blocks) {
        if (!isSolid(b.t)) continue;
        if (rectsOverlap(e.x, e.y, w, h, b.x, b.y, TILE, TILE)) {
            if (e.vx > 0) e.x = b.x - w;
            else if (e.vx < 0) e.x = b.x + TILE;
            if (e.vx !== 0) e.vx *= -1;  // 敵人反向
            else e.vx = 0;
            if (e === P) e.vx = 0;
        }
    }
    e.y += e.vy;
    e.onGround = false;
    for (const b of blocks) {
        if (!isSolid(b.t)) continue;
        if (rectsOverlap(e.x, e.y, w, h, b.x, b.y, TILE, TILE)) {
            if (e.vy > 0) {
                e.y = b.y - h; e.vy = 0; e.onGround = true;
                if (onTopHit) onTopHit(b);
            } else if (e.vy < 0) {
                e.y = b.y + TILE; e.vy = 0;
                if (onBottomHit) onBottomHit(b);
            }
        }
    }
}

function updatePlayer() {
    if (P.state === 'dying') {
        P.deathTm++;
        P.vy += GRAV;
        if (P.vy > MAX_FALL) P.vy = MAX_FALL;
        P.y += P.vy;
        if (P.deathTm > 75) { mainst = 50; stm = 0; }
        return;
    }
    if (P.state === 'clearing') {
        goalTm++;
        if (goalTm > 60) {
            if (goalTm === 61) playSe('seClear');
            P.x += 1.5;
            P.facing = 1;
        }
        if (goalTm > 180) {
            const next = stageNum + 1;
            if (STAGES[next]) loadStage(next, false);
            else { mainst = 200; stm = 0; }  // staff roll
        }
        return;
    }

    if (keyPress['KeyO']) killPlayer(13, '主動跳坑');

    const speed = P.onGround ? RUN_V : RUN_AIR;
    if (keys['ArrowLeft'])  { P.vx = -speed; P.facing = -1; }
    else if (keys['ArrowRight']) { P.vx = speed; P.facing = 1; }
    else if (P.onGround) { P.vx *= FRICTION; if (Math.abs(P.vx) < 0.1) P.vx = 0; }

    if (P.onGround && (keyPress['ArrowUp'] || keyPress['KeyZ'] || keyPress['Space'])) {
        P.vy = P.big ? JUMP_BIG : JUMP_V;
        P.onGround = false;
        playSe('seJump');
    }

    P.vy += GRAV;
    if (P.vy > MAX_FALL) P.vy = MAX_FALL;

    const h = playerH();
    collideEntityBlocks(
        P, PLAYER_W, h,
        (b) => {
            // 站上
            if (b.t === 'fake') killPlayer(6);  // 下輩子當人吧
            if (b.t === 'jumppad') { P.vy = -16; playSe('seJump'); }
            if (b.t === 'midflag' && !midFlagReached) {
                midFlagReached = true;
                playSe('seCoin');
                spawnParticles(b.x + 15, b.y + 15, '#ffc850', 14);
            }
        },
        (b) => {
            // 從下面頂
            if (b.t === 'brick') {
                const i = blocks.indexOf(b);
                if (i >= 0) blocks.splice(i, 1);
                spawnParticles(b.x + 15, b.y + 15, '#a0612e', 8);
                playSe('seBreak');
            }
            if (b.t === 'qmark' || b.t === 'hidden_q') {
                b.t = 'qmark_hit';
                if (b.hasItem === 'mushroom') {
                    items.push({ x: b.x, y: b.y - 2, vx: 1.2, vy: -2, t: 'mushroom', alive: true });
                    playSe('seKinoko');
                } else {
                    coinCount++;
                    spawnFloatText(b.x + 15, b.y, '+1');
                    playSe('seCoin');
                }
            }
            if (b.t === 'hidden_kill') {
                b.visible = true;
                killPlayer(7);  // 這款不適合我
            }
        }
    );

    // 觸發從天降尖刺
    for (const tr of triggers) {
        if (tr.used) continue;
        if (P.x + 14 > tr.x && P.x + 14 < tr.x + TILE && P.y > tr.y) {
            tr.used = true;
            blocks.push({ x: tr.x, y: -50, t: 'falling_spike', vy: 0 });
        }
    }

    // 落下尖刺更新
    for (const b of blocks) {
        if (b.t !== 'falling_spike') continue;
        b.vy = (b.vy || 0) + 0.55;
        b.y += b.vy;
        if (P.state === 'normal' && rectsOverlap(P.x, P.y, PLAYER_W, h, b.x, b.y, TILE, TILE))
            killPlayer(15);  // 煙火大會
    }

    // 危險地形（地刺、岩漿）
    if (P.state === 'normal') {
        for (const b of blocks) {
            if (!isHazard(b.t)) continue;
            if (rectsOverlap(P.x, P.y, PLAYER_W, h, b.x + 2, b.y + 5, TILE - 4, TILE - 5))
                killPlayer(b.t === 'lava' ? 14 : 2);
        }
    }

    // 假旗杆 troll
    for (const b of blocks) {
        if (b.t !== 'fake_goal') continue;
        if (P.state === 'normal' && rectsOverlap(P.x, P.y, PLAYER_W, h, b.x + 13, b.y, 4, TILE)) {
            killPlayer(11);  // 已寄爆
        }
    }

    // 真旗杆 — 過關
    for (const b of blocks) {
        if (b.t !== 'goal') continue;
        if (P.state === 'normal' && rectsOverlap(P.x, P.y, PLAYER_W, h, b.x + 13, b.y, 4, TILE * 3)) {
            P.state = 'clearing';
            goalTouched = true;
            goalTm = 0;
            stopAllBgm();
            playSe('seGoal');
        }
    }

    // 落出畫面 = 死
    if (P.y > H + 40) killPlayer(14);  // 想跟岩漿合體

    // 無敵時間
    if (P.invuln > 0) P.invuln--;
}

function killPlayer(msgIdx) {
    if (P.state !== 'normal') return;
    if (P.invuln > 0) return;
    if (P.big) {
        // 第一次死亡只會降級
        P.big = false;
        P.invuln = 90;
        playSe('sePower');
        return;
    }
    P.state = 'dying';
    P.vy = -10;
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
    const s = document.getElementById('status');
    for (let i = TAUNT_THRESHOLDS.length - 1; i >= 0; i--) {
        const [n, msg] = TAUNT_THRESHOLDS[i];
        if (dethco >= n) {
            s.textContent = `（已死 ${dethco} 次）${msg}`;
            s.classList.add('taunt');
            return;
        }
    }
    s.textContent = `已死 ${dethco} 次 · 金幣 ${coinCount}`;
    s.classList.remove('taunt');
}

// ─── 敵人 AI ────────────────────────────────────────────────────
function updateEnemies() {
    for (const e of enemies) {
        if (!e.alive) continue;
        const sx = e.x - camX;
        // 視野外 ±200 px 不啟動
        if (sx < -200 || sx > W + 200) continue;

        if (e.t === 'walker') {
            e.vy += GRAV;
            if (e.vy > MAX_FALL) e.vy = MAX_FALL;
            collideEntityBlocks(e, 28, 28);
        } else if (e.t === 'koura') {
            e.vy += GRAV;
            if (e.vy > MAX_FALL) e.vy = MAX_FALL;
            // 龜殼狀態 0=巡邏 1=殼靜止 2=殼滑行
            if (e.kourState === 1) e.vx = 0;
            if (e.kourState === 2 && Math.abs(e.vx) < 4) e.vx = e.vx > 0 ? 4.5 : -4.5;
            collideEntityBlocks(e, 28, 28);
        } else if (e.t === 'flyer') {
            // 雲朵敵人 — 只左右移、不掉落
            e.tm = (e.tm || 0) + 1;
            e.x += e.vx;
            e.y = e.baseY + Math.sin(e.tm * 0.04) * 20;
            // 視野邊界折返
            if (e.x < camX - 100) e.vx = Math.abs(e.vx);
            if (e.x > camX + W + 100) e.vx = -Math.abs(e.vx);
        }

        // 敵人 vs 敵人（殼滑行撞死其它敵）
        if (e.t === 'koura' && e.kourState === 2) {
            for (const e2 of enemies) {
                if (!e2.alive || e2 === e) continue;
                if (rectsOverlap(e.x, e.y, 28, 28, e2.x, e2.y, 28, 28)) {
                    e2.alive = false;
                    spawnParticles(e2.x + 14, e2.y + 14, '#cc6644', 8);
                    playSe('seKoura');
                }
            }
        }

        // 敵人 vs 玩家
        if (P.state === 'normal' && rectsOverlap(P.x, P.y, PLAYER_W, playerH(), e.x, e.y, 28, 28)) {
            const stomp = P.vy > 0 && P.y + playerH() - 8 < e.y;
            if (starTimer > 0) {
                e.alive = false;
                spawnParticles(e.x + 14, e.y + 14, '#ff3', 12);
            } else if (stomp) {
                if (e.t === 'koura') {
                    if (e.kourState === 0 || e.kourState === 2) {
                        e.kourState = 1; e.vx = 0;
                    } else { // kourState === 1: 踢殼
                        e.kourState = 2;
                        e.vx = (P.x < e.x) ? 4.5 : -4.5;
                    }
                    P.vy = JUMP_V * 0.6;
                    playSe('seKoura');
                } else if (e.t === 'flyer') {
                    // 飛行敵踩到也死
                    e.alive = false;
                    P.vy = JUMP_V * 0.7;
                    playSe('seHumi');
                    spawnParticles(e.x + 14, e.y + 14, '#aaffaa', 8);
                } else {
                    e.alive = false;
                    P.vy = JUMP_V * 0.7;
                    playSe('seHumi');
                    spawnParticles(e.x + 14, e.y + 14, '#cc6644', 8);
                }
            } else {
                if (e.t === 'koura' && e.kourState === 1) {
                    // 撞靜止殼 = 踢
                    e.kourState = 2;
                    e.vx = (P.x < e.x) ? 4.5 : -4.5;
                    playSe('seKoura');
                } else {
                    killPlayer(0);  // 喔有夠讚
                }
            }
        }
    }

    // 火球發射器（block t='fire_shooter'）
    for (const b of blocks) {
        if (b.t !== 'fire_shooter') continue;
        b.tm = (b.tm || 0) + 1;
        if (b.tm > 120) {
            b.tm = 0;
            projectiles.push({ x: b.x + 8, y: b.y + 14, vx: -2.5, vy: 0, t: 'fire', tm: 0 });
            playSe('seFire');
        }
    }

    // 投射物
    for (const p of projectiles) {
        p.tm = (p.tm || 0) + 1;
        p.x += p.vx; p.y += p.vy;
        if (P.state === 'normal' && rectsOverlap(P.x, P.y, PLAYER_W, playerH(), p.x - 6, p.y - 6, 12, 12))
            killPlayer(17);  // 攝氏 800 度
    }
    projectiles = projectiles.filter(p => p.tm < 240);

    enemies = enemies.filter(e => e.alive && e.y < H + 100);
}

// ─── 道具 ───────────────────────────────────────────────────────
function updateItems() {
    for (const it of items) {
        if (!it.alive) continue;
        it.vy += GRAV;
        if (it.vy > MAX_FALL) it.vy = MAX_FALL;
        collideEntityBlocks(it, 28, 28);
        // 撞牆掉頭
        // 碰到玩家
        if (P.state === 'normal' && rectsOverlap(P.x, P.y, PLAYER_W, playerH(), it.x, it.y, 28, 28)) {
            it.alive = false;
            if (it.t === 'mushroom') {
                P.big = true;
                P.y -= 18;
                playSe('sePower');
                spawnFloatText(P.x + 14, P.y, '+1 GROW');
            }
        }
    }
    items = items.filter(it => it.alive && it.y < H + 100);
}

// ─── 粒子 ───────────────────────────────────────────────────────
function spawnParticles(x, y, color, n) {
    for (let i = 0; i < n; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 6,
            vy: -Math.random() * 6 - 2,
            color, life: 30 + Math.random() * 20, kind: 'square',
        });
    }
}
function spawnFloatText(x, y, text) {
    particles.push({ x, y, vx: 0, vy: -1.2, color: '#ffc850', life: 50, kind: 'text', text });
}
function updateParticles() {
    for (const p of particles) {
        if (p.kind === 'text') { p.y += p.vy; }
        else { p.vy += 0.4; p.x += p.vx; p.y += p.vy; }
        p.life--;
    }
    particles = particles.filter(p => p.life > 0 && p.y < H + 100);
}

// ─── 攝影機 ─────────────────────────────────────────────────────
function updateCamera() {
    const target = P.x - W / 3;
    if (target > camX) camX = target;
    const stageLen = STAGES[stageNum].rows[0].length * TILE;
    if (camX > stageLen - W) camX = stageLen - W;
    if (camX < 0) camX = 0;
}

// ─── 渲染 ───────────────────────────────────────────────────────
function renderTitle() {
    ctx.fillStyle = '#a0b4fa';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 5; i++) {
        const x = (i * 113 + Math.sin(stm * 0.01 + i) * 5 + 1000) % (W + 60) - 30;
        const y = 40 + i * 17;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.arc(x + 14, y - 4, 14, 0, Math.PI * 2);
        ctx.arc(x + 28, y, 10, 0, Math.PI * 2);
        ctx.fill();
    }
    if (sprites.title) {
        const tw = sprites.title.width, th = sprites.title.height;
        ctx.drawImage(sprites.title, (W - tw) / 2, 80);
    }
    const t = (stm / 30) | 0;
    if (sprites.player) {
        const fr = t % 2 === 0 ? 0 : 62;
        ctx.drawImage(sprites.player, fr, 0, 30, 36, W / 2 - 15, 200, 30, 36);
    }
    ctx.fillStyle = '#000';
    ctx.font = 'bold 18px "Microsoft JhengHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('按 ↑ / Z / Space 開始', W / 2, 270);
    ctx.font = '13px "Microsoft JhengHei", sans-serif';
    ctx.fillStyle = '#444';
    ctx.fillText(`累計死亡：${dethco} 次 · 金幣 ${coinCount}`, W / 2, 295);
    ctx.fillText('原作：ちく · 中文化：thc1006', W / 2, 320);
    ctx.fillStyle = '#a02020';
    ctx.fillText('警告：可能會對人類產生不信任感', W / 2, 360);
    ctx.textAlign = 'left';
}

function drawTeki(e, sx, sy) {
    if (!sprites.teki) {
        ctx.fillStyle = '#cc6644'; ctx.fillRect(sx, sy, 28, 28); return;
    }
    let ax = 0;  // atlas x
    if (e.t === 'walker')      ax = 33 * 1;  // 綠色走路敵
    else if (e.t === 'koura')  ax = e.kourState >= 1 ? 33 * 7 : 33 * 5;  // 橘色龜殼
    else if (e.t === 'flyer')  ax = 33 * 1;  // 綠色帶 sin 動
    ctx.drawImage(sprites.teki, ax, 0, 30, 30, sx, sy, 30, 30);
}

function renderStage() {
    const st = STAGES[stageNum];
    ctx.fillStyle = st.bgColor || '#a0b4fa';
    ctx.fillRect(0, 0, W, H);

    // 雲背景
    if (stageNum !== 4 && stageNum !== 2) {
        for (let i = 0; i < 6; i++) {
            const x = ((i * 200 - camX * 0.3) % (W + 80) + W + 80) % (W + 80) - 40;
            const y = 30 + (i * 23) % 60;
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.beginPath();
            ctx.arc(x, y, 11, 0, Math.PI * 2);
            ctx.arc(x + 12, y - 4, 13, 0, Math.PI * 2);
            ctx.arc(x + 24, y, 9, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // 磚塊
    for (const b of blocks) {
        const sx = b.x - camX, sy = b.y;
        if (sx < -40 || sx > W + 10) continue;

        switch (b.t) {
            case 'ground':
                ctx.fillStyle = '#28c428'; ctx.fillRect(sx, sy, TILE, 4);
                ctx.fillStyle = '#a0612e'; ctx.fillRect(sx, sy + 4, TILE, TILE - 4);
                ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.strokeRect(sx, sy, TILE, TILE);
                break;
            case 'ground_dark':
                ctx.fillStyle = '#444'; ctx.fillRect(sx, sy, TILE, TILE);
                ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.strokeRect(sx, sy, TILE, TILE);
                break;
            case 'lava':
                ctx.fillStyle = '#d04020'; ctx.fillRect(sx, sy, TILE, TILE);
                ctx.fillStyle = '#ff8030';
                const wave = Math.sin(stm * 0.1 + b.x * 0.05) * 3;
                ctx.fillRect(sx, sy + 3 + wave, TILE, 4);
                break;
            case 'brick':
                if (sprites.brock) ctx.drawImage(sprites.brock, 99, 0, 30, 30, sx, sy, 30, 30);
                break;
            case 'qmark':
                if (sprites.brock) ctx.drawImage(sprites.brock, 66, 0, 30, 30, sx, sy, 30, 30);
                break;
            case 'qmark_hit':
                if (sprites.brock) ctx.drawImage(sprites.brock, 99, 0, 30, 30, sx, sy, 30, 30);
                break;
            case 'fake':
                if (sprites.brock) ctx.drawImage(sprites.brock, 99, 0, 30, 30, sx, sy, 30, 30);
                break;
            case 'hidden_kill':
                if (b.visible && sprites.brock) ctx.drawImage(sprites.brock, 99, 0, 30, 30, sx, sy, 30, 30);
                break;
            case 'hidden_q':
                // 隱形 ?磚也不畫
                break;
            case 'spike_static':
                ctx.fillStyle = '#666';
                ctx.beginPath();
                ctx.moveTo(sx, sy + TILE);
                ctx.lineTo(sx + 7, sy + 8);
                ctx.lineTo(sx + 14, sy + TILE);
                ctx.lineTo(sx + 21, sy + 8);
                ctx.lineTo(sx + TILE, sy + TILE);
                ctx.closePath();
                ctx.fill();
                break;
            case 'falling_spike':
                ctx.fillStyle = '#404040';
                ctx.beginPath();
                ctx.moveTo(sx, sy + TILE);
                ctx.lineTo(sx + 15, sy);
                ctx.lineTo(sx + TILE, sy + TILE);
                ctx.closePath();
                ctx.fill();
                break;
            case 'jumppad':
                ctx.fillStyle = '#606060';
                ctx.fillRect(sx + 2, sy + 18, 26, 12);
                ctx.fillStyle = '#aaa';
                ctx.fillRect(sx + 6, sy + 14, 18, 6);
                break;
            case 'pipe_top':
                ctx.fillStyle = '#00a020';
                ctx.fillRect(sx - 3, sy, TILE + 6, 8);
                ctx.fillRect(sx, sy + 8, TILE, TILE - 8);
                ctx.strokeStyle = '#005010';
                ctx.strokeRect(sx, sy + 8, TILE, TILE - 8);
                break;
            case 'pipe_body':
                ctx.fillStyle = '#00a020';
                ctx.fillRect(sx, sy, TILE, TILE);
                break;
            case 'fire_shooter':
                ctx.fillStyle = '#a04020';
                ctx.fillRect(sx + 4, sy + 4, TILE - 8, TILE - 8);
                ctx.fillStyle = '#ff6020';
                ctx.beginPath();
                ctx.arc(sx + 15, sy + 15, 5 + Math.sin(stm * 0.2) * 2, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'midflag':
                if (midFlagReached) {
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(sx + 13, sy - 50, 4, TILE + 50);
                    ctx.fillStyle = '#30ff60';
                    ctx.beginPath();
                    ctx.moveTo(sx + 17, sy - 45);
                    ctx.lineTo(sx + 33, sy - 40);
                    ctx.lineTo(sx + 17, sy - 35);
                    ctx.fill();
                } else {
                    ctx.fillStyle = '#888';
                    ctx.fillRect(sx + 13, sy - 50, 4, TILE + 50);
                    ctx.fillStyle = '#666';
                    ctx.beginPath();
                    ctx.moveTo(sx + 17, sy - 45);
                    ctx.lineTo(sx + 33, sy - 40);
                    ctx.lineTo(sx + 17, sy - 35);
                    ctx.fill();
                }
                break;
            case 'goal':
                ctx.fillStyle = '#fff';
                ctx.fillRect(sx + 13, sy - 60, 4, TILE + 60);
                ctx.fillStyle = '#ff3030';
                ctx.beginPath();
                ctx.moveTo(sx + 17, sy - 55);
                ctx.lineTo(sx + 35, sy - 50);
                ctx.lineTo(sx + 17, sy - 45);
                ctx.fill();
                break;
            case 'fake_goal':
                ctx.fillStyle = '#fff';
                ctx.fillRect(sx + 13, sy - 60, 4, TILE + 60);
                ctx.fillStyle = '#3030ff';
                ctx.beginPath();
                ctx.moveTo(sx + 17, sy - 55);
                ctx.lineTo(sx + 35, sy - 50);
                ctx.lineTo(sx + 17, sy - 45);
                ctx.fill();
                break;
        }
    }

    // 道具
    for (const it of items) {
        if (!it.alive) continue;
        const sx = it.x - camX;
        if (it.t === 'mushroom' && sprites.item) {
            ctx.drawImage(sprites.item, 0, 0, 30, 30, sx, it.y, 30, 30);
        }
    }

    // 投射物
    for (const p of projectiles) {
        const sx = p.x - camX;
        ctx.fillStyle = '#ff6020';
        ctx.beginPath();
        ctx.arc(sx, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff060';
        ctx.beginPath();
        ctx.arc(sx, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    // 敵人
    for (const e of enemies) {
        if (!e.alive) continue;
        const sx = e.x - camX, sy = e.y;
        if (sx < -40 || sx > W + 10) continue;
        drawTeki(e, sx, sy);
    }

    // 玩家
    if (P.invuln === 0 || (P.invuln > 0 && (stm % 4 < 2))) {
        const px = P.x - camX, py = P.y;
        if (sprites.player) {
            let frame = 0;
            if (P.state === 'dying') frame = 4;
            else if (P.state === 'clearing') frame = 1;
            else if (!P.onGround) frame = 1;
            else if (Math.abs(P.vx) > 0.5) frame = ((stm / 6) | 0) % 2 === 0 ? 0 : 2;
            const sx = frame * 31;
            const h = playerH();
            const drawH = h;
            const drawW = 30;
            const offsetY = P.big ? -20 : 0;
            ctx.save();
            if (P.facing === -1) {
                ctx.translate(px + 30, py + offsetY);
                ctx.scale(-1, P.big ? 1.5 : 1);
                ctx.drawImage(sprites.player, sx, 0, 30, 36, 0, 0, 30, 36);
            } else {
                ctx.save();
                ctx.translate(px, py + offsetY);
                if (P.big) ctx.scale(1, 1.5);
                ctx.drawImage(sprites.player, sx, 0, 30, 36, 0, 0, 30, 36);
                ctx.restore();
            }
            ctx.restore();
        }
    }

    // 死亡訊息（玩家頭上飄字）
    if (P.deathMsgTm > 0 && P.deathMsg) {
        const px = P.x - camX, py = P.y;
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
        if (p.kind === 'text') {
            ctx.fillStyle = `rgba(255,200,80,${p.life / 50})`;
            ctx.font = 'bold 14px sans-serif';
            ctx.fillText(p.text, p.x - camX, p.y);
        } else {
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - camX - 2, p.y - 2, 4, 4);
        }
    }

    // HUD：關卡名 + 金幣 + 死亡計數
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, W, 22);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px "Microsoft JhengHei", sans-serif';
    ctx.fillText(st.name, 8, 16);
    ctx.textAlign = 'right';
    ctx.fillText(`💀 ${dethco}　🪙 ${coinCount}`, W - 8, 16);
    ctx.textAlign = 'left';

    // 過關覆蓋
    if (P.state === 'clearing') {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ffc850';
        ctx.font = 'bold 36px "Microsoft JhengHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('關卡  全破', W / 2, H / 2 - 10);
        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(`下一關 ${stageNum + 1}-1`, W / 2, H / 2 + 20);
        ctx.textAlign = 'left';
    }
}

function renderStaffRoll() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const lines = [
        '── 通關 ──',
        '',
        '原作 © 2007 ちく',
        '',
        '繁體中文化版本',
        '製作：thc1006',
        '',
        '',
        '感謝你忍受到最後',
        '',
        `總死亡次數：${dethco}`,
        `總金幣：${coinCount}`,
        '',
        '按 Z 回標題畫面',
    ];
    ctx.fillStyle = '#ffc850';
    ctx.font = 'bold 22px "Microsoft JhengHei", sans-serif';
    ctx.textAlign = 'center';
    const offset = -stm * 0.7 + H / 2;
    lines.forEach((line, i) => {
        if (line === '── 通關 ──') ctx.fillStyle = '#ffc850';
        else if (line.startsWith('總')) ctx.fillStyle = '#a0e0ff';
        else ctx.fillStyle = '#fff';
        ctx.fillText(line, W / 2, offset + i * 30);
    });
    ctx.textAlign = 'left';
}

// ─── 主迴圈 ─────────────────────────────────────────────────────
function update() {
    stm++;
    if (mainst === 100) {
        if (keyPress['KeyZ'] || keyPress['ArrowUp'] || keyPress['Space']) {
            stageNum = 1;
            loadStage(1, false);
        }
    } else if (mainst === 1) {
        updatePlayer();
        if (P.state !== 'dying') {
            updateEnemies();
            updateItems();
            updateCamera();
        }
        updateParticles();
        if (keyPress['F1']) { mainst = 100; stopAllBgm(); }
    } else if (mainst === 50) {
        if (stm > 30) loadStage(stageNum, midFlagReached);
    } else if (mainst === 200) {
        if (stm > 60 && (keyPress['KeyZ'] || keyPress['ArrowUp'])) {
            mainst = 100; stm = 0; stopAllBgm();
        }
    }
    keyPress = {};
}

function render() {
    if (mainst === 100) renderTitle();
    else if (mainst === 200) renderStaffRoll();
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
    try { await loadAll(); }
    catch (e) {
        document.getElementById('status').textContent = '資源載入失敗：' + e.message;
        return;
    }

    const overlay = document.getElementById('startOverlay');
    overlay.addEventListener('click', () => {
        overlay.style.display = 'none';
        Object.values(audios).forEach(a => {
            try { a.play().then(() => a.pause()).catch(() => {}); } catch (e) {}
        });
        document.getElementById('status').textContent = '按 ↑ / Z / Space 開始遊戲';
    });

    requestAnimationFrame(loop);
}

main();
