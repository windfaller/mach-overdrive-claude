// Lightweight i18n: en / zh-Hant / ja. Strings may contain {name} params and {k:action} key glyphs
// that resolve to the active input device (keyboard+mouse or gamepad).
export type Lang = 'en' | 'zh' | 'ja';
export const LANGS: { id: Lang; label: string }[] = [{ id: 'en', label: 'EN' }, { id: 'zh', label: '繁中' }, { id: 'ja', label: '日本語' }];

type Dict = Record<string, string>;
const en: Dict = {
  launch: 'LAUNCH', retry: 'RETRY CHECKPOINT', restart: 'RESTART MISSION', again: 'FLY AGAIN', resume: 'RESUME', quit: 'QUIT TO TITLE',
  mechLost: 'MECH LOST', gameOver: 'GAME OVER', missionComplete: 'MISSION COMPLETE', heliosDestroyed: 'HELIOS DESTROYED', paused: 'PAUSED',
  hint: 'Best with headphones · Chrome / Edge / Safari desktop · Xbox-style gamepad supported',
  c_fly: 'Fly', c_aim: 'Aim', c_fire: 'Pulse rifle (hold)', c_lock: 'Hold to multi-lock, release to fire missiles', c_blade: 'Energy blade lunge (tap again to combo)',
  c_boost: 'Boost', c_dodge: 'Dodge · at the last moment for PERFECT DODGE', c_pause: 'Pause',
  s_score: 'SCORE', s_kills: 'KILLS', s_chain: 'MAX CHAIN', s_perfect: 'PERFECT DODGES', s_near: 'NEAR MISSES', s_time: 'TIME',
  armor: 'ARMOR INTEGRITY', energy: 'BOOST ENERGY', spd: 'SPD', kmh: 'KM/H', armament: 'ARMAMENT', rifle: 'PULSE RIFLE', missile: 'MICRO MISSILE',
  multilock: 'MULTI-LOCK', blade: 'ENERGY BLADE', score: 'SCORE', chain: 'CHAIN', ready: 'READY', locking: 'LOCKING', reload: 'RELOAD',
  locked: 'LOCKED', lockedN: 'LOCKED x{n}', bossSub: 'STRATEGIC AERIAL DREADNOUGHT', odTag: '◆ OVERDRIVE · DMG x2', overheat: 'OVERHEAT', standby: 'Stand by',
  sec1: 'SECTOR 01 // NEO-KAI MEGACITY', sec2: 'SECTOR 02 // SKY HIGHWAY 7', sec3: 'SECTOR 03 // ORBITAL FLEET LINE', sec4: 'SECTOR 04 // MASS DRIVER', secF: 'FINAL // HELIOS INTERCEPT',
  o_break: 'Break through the Neo-Kai defense line', o_multilock: 'Multi-lock the swarm', o_skyline: 'Clear the skyline', o_highway: 'Clear the highway corridor',
  o_raven: 'Defeat the elite mech RAVEN', o_fleet: 'Punch through the fleet screen', o_shipcore: 'Destroy the battleship core', o_driver: 'Ride the mass driver — fly through the gates',
  o_weak: 'Destroy the 3 weak points', o_survive: 'Survive the transformation', o_core: 'Destroy HELIOS core — PERFECT DODGE its blade',
  b_start: 'MISSION START', b_swarm: 'DRONE SWARM', b_wave2: 'SECOND WAVE', b_highway: 'SKY HIGHWAY', b_fleet: 'BATTLE FLEET', b_escorts: 'FLEET ESCORTS', b_maxv: 'MAX VELOCITY',
  b_raven: 'ELITE  //  RAVEN', b_final: 'HELIOS — FINAL FORM', b_od: 'OVERDRIVE', b_multi: 'MULTI KILL x{n}', b_multiOD: '{n} KILL OVERDRIVE', b_ravenDown: 'RAVEN DOWN',
  b_shipDown: 'BATTLESHIP DESTROYED', b_perfect: 'PERFECT DODGE', b_weakDown: '{name} DESTROYED', b_salvo: 'SALVO x{n}', b_helios: 'HELIOS',
  w_elite: 'WARNING — ELITE UNIT APPROACHING', w_ship: 'BATTLESHIP DEAD AHEAD', w_driver: 'ENTERING MASS DRIVER TUNNEL', w_boss: 'WARNING  ·  WARNING  ·  WARNING',
  w_shift: 'WARNING  //  HELIOS FORM SHIFT', w_barrage: 'MISSILE BARRAGE', w_sweep: 'BEAM SWEEP — DODGE THROUGH IT', w_bladeIn: '!! BLADE INCOMING — DODGE AT THE LAST MOMENT !!',
  w_cannon: 'CORE CANNON CHARGING', w_critical: 'HELIOS CORE CRITICAL', w_eliteClose: 'ELITE CLOSING IN  ·  DODGE!', w_hatch: 'MISSILE HATCHES OPEN',
  m_boost: 'BOOST', m_overheat: 'OVERHEAT — RELEASE BOOST', m_mslReady: 'MISSILES READY', m_salvo: 'MISSILE SALVO x{n}', m_near: 'NEAR MISS +8', m_bladeKill: 'BLADE KILL',
  m_gate: 'GATE  +SPEED', m_light: 'LIGHT AHEAD', m_weakN: 'WEAK POINTS {n}/3', m_exposed: 'CORE EXPOSED — x2 DAMAGE', m_evade: 'ELITE EVADES', m_withdraw: 'ELITE WITHDRAWING',
  m_fullSalvo: 'FULL SALVO', m_fullLock: 'FULL LOCK', m_chain: 'CHAIN x{n}', m_bench: 'BENCHMARK {n}/{total} · {name}',
  p_fly: '{k:move} fly &nbsp; {k:aim} aim &nbsp; {k:fire} hold to fire', p_lock: 'Hold {k:lock} to MULTI-LOCK · release to fire missiles',
  p_dodge: '{k:boost} boost · {k:dodge} dodge — dodge just before a hit for <b>PERFECT DODGE</b>', p_blade: 'Press {k:melee} near a target for an ENERGY BLADE lunge · tap again to combo',
  p_raven: 'RAVEN dodges rifle fire — use <b>missiles</b> and <b>blade</b>, PERFECT DODGE its lunge', p_core: 'Lock the <b>CORE</b> — or {k:boost} + {k:melee} to blade-dive it',
  p_tunnel: 'Dodge the barriers · fly through the <b>gates</b>', p_weak: 'Lock and destroy the <b>3 glowing weak points</b>', p_finisher: 'PRESS {k:melee} — OVERDRIVE FINISHER',
  p_pause: '{k:pause} pause',
  k_drone: 'DRONE', k_fighter: 'FIGHTER', k_heavy: 'HEAVY UNIT', k_elite: 'ELITE RAVEN', k_shipcore: 'BATTLESHIP', k_target: 'TARGET', k_down: '{name} DOWN', k_bladeSfx: ' · BLADE', k_mslSfx: ' · MSL',
  k_perfect: 'PERFECT DODGE', k_weak: 'WEAK POINT', wp_port: 'PORT ARRAY', wp_star: 'STARBOARD ARRAY', wp_spire: 'COMMAND SPIRE',
  lang: 'LANGUAGE', showcase: 'SHOWCASE',
};
const zh: Dict = {
  launch: '出擊', retry: '從檢查點重試', restart: '重新開始任務', again: '再次出擊', resume: '繼續', quit: '回到標題',
  mechLost: '機體損毀', gameOver: '任務失敗', missionComplete: '任務完成', heliosDestroyed: 'HELIOS 已擊破', paused: '暫停',
  hint: '建議配戴耳機 · 桌面版 Chrome / Edge / Safari · 支援 Xbox 規格手把',
  c_fly: '飛行', c_aim: '瞄準', c_fire: '脈衝步槍（按住）', c_lock: '按住多重鎖定，放開發射飛彈', c_blade: '光劍突進（連按連擊）',
  c_boost: '推進加速', c_dodge: '閃避 · 最後一刻閃避觸發完美閃避', c_pause: '暫停',
  s_score: '分數', s_kills: '擊墜', s_chain: '最大連鎖', s_perfect: '完美閃避', s_near: '擦身而過', s_time: '時間',
  armor: '裝甲完整度', energy: '推進能量', spd: '速度', kmh: 'KM/H', armament: '武裝', rifle: '脈衝步槍', missile: '微型飛彈',
  multilock: '多重鎖定', blade: '能量光劍', score: '分數', chain: '連鎖', ready: '就緒', locking: '鎖定中', reload: '裝填中',
  locked: '已鎖定', lockedN: '鎖定 x{n}', bossSub: '戰略級空中無畏艦', odTag: '◆ 超限驅動 · 傷害 x2', overheat: '過熱', standby: '待命',
  sec1: '區域 01 // 新海都市', sec2: '區域 02 // 天空高速 7 號線', sec3: '區域 03 // 軌道艦隊防線', sec4: '區域 04 // 質量投射隧道', secF: '最終 // 攔截 HELIOS',
  o_break: '突破新海都市防線', o_multilock: '多重鎖定無人機群', o_skyline: '肅清天際線', o_highway: '清空高速走廊',
  o_raven: '擊敗精英機體 RAVEN', o_fleet: '突破艦隊屏障', o_shipcore: '摧毀戰艦核心', o_driver: '搭乘質量投射器 — 穿越光環',
  o_weak: '摧毀 3 個弱點', o_survive: '撐過變形', o_core: '摧毀 HELIOS 核心 — 完美閃避它的光刃',
  b_start: '任務開始', b_swarm: '無人機群', b_wave2: '第二波', b_highway: '天空高速', b_fleet: '戰鬥艦隊', b_escorts: '艦隊護衛', b_maxv: '極限速度',
  b_raven: '精英機 // RAVEN', b_final: 'HELIOS — 最終形態', b_od: '超限驅動', b_multi: '連續擊墜 x{n}', b_multiOD: '{n} 連殺 超限', b_ravenDown: 'RAVEN 擊墜',
  b_shipDown: '戰艦已摧毀', b_perfect: '完美閃避', b_weakDown: '{name} 已摧毀', b_salvo: '齊射 x{n}', b_helios: 'HELIOS',
  w_elite: '警告 — 精英機體接近中', w_ship: '正前方戰艦', w_driver: '進入質量投射隧道', w_boss: '警告  ·  警告  ·  警告',
  w_shift: '警告 // HELIOS 形態轉換', w_barrage: '飛彈彈幕', w_sweep: '光束掃射 — 閃避穿過', w_bladeIn: '!! 巨刃來襲 — 最後一刻閃避 !!',
  w_cannon: '核心砲充能中', w_critical: 'HELIOS 核心臨界', w_eliteClose: '精英機逼近 · 閃避！', w_hatch: '飛彈艙門開啟',
  m_boost: '推進', m_overheat: '過熱 — 放開推進', m_mslReady: '飛彈就緒', m_salvo: '飛彈齊射 x{n}', m_near: '擦身而過 +8', m_bladeKill: '光劍擊殺',
  m_gate: '光環  +加速', m_light: '前方出口', m_weakN: '弱點 {n}/3', m_exposed: '核心暴露 — 傷害 x2', m_evade: '精英機閃避', m_withdraw: '精英機撤退',
  m_fullSalvo: '全彈齊射', m_fullLock: '全鎖定', m_chain: '連鎖 x{n}', m_bench: '效能測試 {n}/{total} · {name}',
  p_fly: '{k:move} 飛行 &nbsp; {k:aim} 瞄準 &nbsp; {k:fire} 按住射擊', p_lock: '按住 {k:lock} 多重鎖定 · 放開發射飛彈',
  p_dodge: '{k:boost} 推進 · {k:dodge} 閃避 — 被擊中前一刻閃避觸發<b>完美閃避</b>', p_blade: '靠近目標按 {k:melee} 光劍突進 · 再按連擊',
  p_raven: 'RAVEN 會閃避步槍 — 用<b>飛彈</b>與<b>光劍</b>，完美閃避它的突進', p_core: '鎖定<b>核心</b> — 或 {k:boost} + {k:melee} 光劍突入',
  p_tunnel: '閃避障礙 · 穿越<b>光環</b>', p_weak: '鎖定並摧毀<b>3 個發光弱點</b>', p_finisher: '按 {k:melee} — 超限終結技',
  p_pause: '{k:pause} 暫停',
  k_drone: '無人機', k_fighter: '戰鬥機', k_heavy: '重裝機', k_elite: '精英機 RAVEN', k_shipcore: '戰艦', k_target: '目標', k_down: '{name} 擊墜', k_bladeSfx: ' · 光劍', k_mslSfx: ' · 飛彈',
  k_perfect: '完美閃避', k_weak: '弱點', wp_port: '左舷陣列', wp_star: '右舷陣列', wp_spire: '指揮尖塔',
  lang: '語言', showcase: '展示模式',
};
const ja: Dict = {
  launch: '出撃', retry: 'チェックポイントから再開', restart: 'ミッションを最初から', again: 'もう一度出撃', resume: '再開', quit: 'タイトルへ戻る',
  mechLost: '機体大破', gameOver: 'ゲームオーバー', missionComplete: 'ミッション完了', heliosDestroyed: 'HELIOS 撃破', paused: 'ポーズ',
  hint: 'ヘッドホン推奨 · PC版 Chrome / Edge / Safari · Xbox系ゲームパッド対応',
  c_fly: '移動', c_aim: '照準', c_fire: 'パルスライフル（長押し）', c_lock: '長押しでマルチロック、離してミサイル発射', c_blade: 'ブレード突進（連打でコンボ）',
  c_boost: 'ブースト', c_dodge: '回避 · ギリギリでパーフェクト回避', c_pause: 'ポーズ',
  s_score: 'スコア', s_kills: '撃墜数', s_chain: '最大チェイン', s_perfect: 'パーフェクト回避', s_near: 'ニアミス', s_time: 'タイム',
  armor: '装甲耐久', energy: 'ブーストエネルギー', spd: '速度', kmh: 'KM/H', armament: '兵装', rifle: 'パルスライフル', missile: 'マイクロミサイル',
  multilock: 'マルチロック', blade: 'エネルギーブレード', score: 'スコア', chain: 'チェイン', ready: '準備完了', locking: 'ロック中', reload: '装填中',
  locked: 'ロック', lockedN: 'ロック x{n}', bossSub: '戦略航空弩級艦', odTag: '◆ オーバードライブ · ダメージ x2', overheat: 'オーバーヒート', standby: '待機',
  sec1: 'セクター 01 // ネオカイ・メガシティ', sec2: 'セクター 02 // スカイハイウェイ 7', sec3: 'セクター 03 // 軌道艦隊ライン', sec4: 'セクター 04 // マスドライバー', secF: '最終 // HELIOS 迎撃',
  o_break: 'ネオカイ防衛線を突破せよ', o_multilock: 'ドローン群をマルチロックせよ', o_skyline: 'スカイラインを制圧せよ', o_highway: 'ハイウェイ回廊を制圧せよ',
  o_raven: 'エリート機 RAVEN を撃破せよ', o_fleet: '艦隊の防衛網を突破せよ', o_shipcore: '戦艦コアを破壊せよ', o_driver: 'マスドライバーを駆け抜けろ — ゲートを通過せよ',
  o_weak: '3つの弱点を破壊せよ', o_survive: '変形を耐え抜け', o_core: 'HELIOS コアを破壊せよ — ブレードをパーフェクト回避',
  b_start: 'ミッション開始', b_swarm: 'ドローン群', b_wave2: '第二波', b_highway: 'スカイハイウェイ', b_fleet: '戦闘艦隊', b_escorts: '艦隊護衛', b_maxv: '最高速度',
  b_raven: 'エリート // RAVEN', b_final: 'HELIOS — 最終形態', b_od: 'オーバードライブ', b_multi: 'マルチキル x{n}', b_multiOD: '{n} キル オーバードライブ', b_ravenDown: 'RAVEN 撃墜',
  b_shipDown: '戦艦撃沈', b_perfect: 'パーフェクト回避', b_weakDown: '{name} 破壊', b_salvo: '一斉射 x{n}', b_helios: 'HELIOS',
  w_elite: '警告 — エリート機接近', w_ship: '前方に戦艦', w_driver: 'マスドライバートンネル突入', w_boss: '警告  ·  警告  ·  警告',
  w_shift: '警告 // HELIOS 形態変化', w_barrage: 'ミサイル弾幕', w_sweep: 'ビーム掃射 — すり抜けろ', w_bladeIn: '!! 巨大ブレード接近 — ギリギリで回避 !!',
  w_cannon: 'コアキャノン充填中', w_critical: 'HELIOS コア臨界', w_eliteClose: 'エリート機接近 · 回避せよ！', w_hatch: 'ミサイルハッチ開放',
  m_boost: 'ブースト', m_overheat: 'オーバーヒート — ブースト解除', m_mslReady: 'ミサイル準備完了', m_salvo: 'ミサイル一斉射 x{n}', m_near: 'ニアミス +8', m_bladeKill: 'ブレードキル',
  m_gate: 'ゲート  +加速', m_light: '前方に出口', m_weakN: '弱点 {n}/3', m_exposed: 'コア露出 — ダメージ x2', m_evade: 'エリート機回避', m_withdraw: 'エリート機撤退',
  m_fullSalvo: 'フルサルボ', m_fullLock: 'フルロック', m_chain: 'チェイン x{n}', m_bench: 'ベンチマーク {n}/{total} · {name}',
  p_fly: '{k:move} 移動 &nbsp; {k:aim} 照準 &nbsp; {k:fire} 長押しで射撃', p_lock: '{k:lock} 長押しでマルチロック · 離してミサイル発射',
  p_dodge: '{k:boost} ブースト · {k:dodge} 回避 — 被弾直前の回避で<b>パーフェクト回避</b>', p_blade: '敵の近くで {k:melee} ブレード突進 · 連打でコンボ',
  p_raven: 'RAVEN はライフルを回避する — <b>ミサイル</b>と<b>ブレード</b>を使え、突進はパーフェクト回避', p_core: '<b>コア</b>をロック — または {k:boost} + {k:melee} でブレード突入',
  p_tunnel: '障害物を回避 · <b>ゲート</b>を通過せよ', p_weak: '<b>光る3つの弱点</b>をロックして破壊せよ', p_finisher: '{k:melee} を押せ — オーバードライブ・フィニッシュ',
  p_pause: '{k:pause} ポーズ',
  k_drone: 'ドローン', k_fighter: '戦闘機', k_heavy: '重装機', k_elite: 'エリート RAVEN', k_shipcore: '戦艦', k_target: 'ターゲット', k_down: '{name} 撃墜', k_bladeSfx: ' · ブレード', k_mslSfx: ' · ミサイル',
  k_perfect: 'パーフェクト回避', k_weak: '弱点', wp_port: '左舷アレイ', wp_star: '右舷アレイ', wp_spire: '司令塔',
  lang: '言語', showcase: 'ショーケース',
};
const dicts: Record<Lang, Dict> = { en, zh, ja };

const KEYS: Record<string, { kb: string; pad: string }> = {
  move: { kb: 'WASD', pad: 'L-STICK' }, aim: { kb: 'MOUSE', pad: 'R-STICK' }, fire: { kb: 'LMB', pad: 'RT' }, lock: { kb: 'RMB / E', pad: 'LT' },
  melee: { kb: 'F', pad: 'X' }, boost: { kb: 'SHIFT', pad: 'LB' }, dodge: { kb: 'SPACE', pad: 'A' }, pause: { kb: 'ESC / P', pad: 'START' },
  confirm: { kb: 'ENTER', pad: 'A' }, alt: { kb: 'R', pad: 'Y' },
};

function detect(): Lang {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'en' || q === 'zh' || q === 'ja') return q;
  try { const s = localStorage.getItem('mo_lang'); if (s === 'en' || s === 'zh' || s === 'ja') return s; } catch (e) { /* storage blocked */ }
  const n = (navigator.language || 'en').toLowerCase();
  return n.startsWith('zh') ? 'zh' : n.startsWith('ja') ? 'ja' : 'en';
}
export let lang: Lang = detect();
export let device: 'kb' | 'pad' = 'kb';
const listeners: (() => void)[] = [];
export function onI18n(f: () => void) { listeners.push(f); }
export function setLang(l: Lang) { lang = l; try { localStorage.setItem('mo_lang', l); } catch (e) { /* ignore */ } listeners.forEach(f => f()); }
export function setDevice(d: 'kb' | 'pad') { if (d === device) return; device = d; listeners.forEach(f => f()); }
export const keyLabel = (a: string) => (KEYS[a] ? KEYS[a][device] : a);

/** Translate a key with params. Unknown keys pass through, so plain strings still work. */
export function t(key: string, p: Record<string, string | number> = {}): string {
  let s = dicts[lang][key] ?? en[key] ?? key;
  s = s.replace(/\{k:(\w+)\}/g, (_, a) => `<b>${keyLabel(a)}</b>`);
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in p ? String(p[k]).startsWith('@') ? t(String(p[k]).slice(1)) : String(p[k]) : `{${k}}`));
}
/** Plain-text variant for textContent targets (strips key-glyph markup). */
export const tt = (key: string, p: Record<string, string | number> = {}) => t(key, p).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');

/** Apply translations to static DOM nodes carrying data-i18n / data-i18n-html. */
export function applyDom() {
  document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : lang;
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => { el.textContent = tt(el.dataset.i18n!); });
  document.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml!); });
  document.querySelectorAll<HTMLElement>('[data-key]').forEach(el => { el.textContent = keyLabel(el.dataset.key!); });
  document.querySelectorAll<HTMLElement>('.langBtn').forEach(el => el.classList.toggle('on', el.dataset.lang === lang));
}
