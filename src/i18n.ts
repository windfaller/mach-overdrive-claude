// Lightweight i18n: en / zh-Hant / ja. Strings may contain {name} params and {k:action} key glyphs
// that resolve to the active input device (keyboard+mouse or gamepad).
export type Lang = 'en' | 'zh' | 'ja';
export const LANGS: { id: Lang; label: string }[] = [{ id: 'en', label: 'EN' }, { id: 'zh', label: '繁中' }, { id: 'ja', label: '日本語' }];

type Dict = Record<string, string>;
const en: Dict = {
  r_c0a: "Kestrel, you're off the catapult. Neo-Kai's defense grid went dark an hour ago. Something took it.", r_c0b: 'Copy, Halcyon. Lots of drones out here, and none of them are ours.',
  r_c0c: 'They cluster to cover each other. Hold your lock and paint the whole swarm.', r_c0d: 'Second wave rising off the towers. Keep moving. Standing still gets you killed.',
  r_c1a: "Sky Highway 7. Civilian traffic is clear. Anything else up there is hostile.", r_c1b: "Heavies inbound. Your rifle won't crack that plating. Charge the beam.",
  r_c1c: "Contact on the long-range board. It's fast. Too fast for a drone.", r_c1d: 'So they sent the interceptor. Show me it is more than a paint job.',
  r_c1e: 'Fine. No more holding back.', r_c1f: '...Not bad, Kestrel. HELIOS will finish what I started.',
  r_c2a: 'Orbital fleet line ahead. Their screen is thin. Punch through before they close ranks.', r_c2b: 'Battleship dead ahead. Its core sits under the forward armor. Break it open.',
  r_c2c: 'Battleship down. Halcyon, what is this fleet escorting?', r_c2d: 'The mass driver. If they launch what is waiting at the end of it, we lose the coast.',
  r_c3a: "You're in the barrel, Kestrel. Gates give you speed. Barriers take your head off.", r_c3b: 'Light at the end. HELIOS is waiting on the other side.',
  r_c4a: 'INTERCEPTOR DETECTED. CLASSIFICATION: IRRELEVANT.', r_c4b: 'Three systems on that hull, each on its own node. Take the deflector first.',
  r_c4c: 'REDUNDANT FORM DISCARDED. ENGAGING COMBAT CONFIGURATION.', r_c4d: 'The core is exposed in that form! Hit it with everything you have.',
  r_c4e: 'CORE INTEGRITY... FAILING—', r_c4f: 'Overdrive. Ending this.',
  ch0: 'NEO-KAI MEGACITY', ch0l: 'The city went dark. Find out who turned off the lights.', ch1: 'SKY HIGHWAY 7', ch1l: 'Something fast is hunting along the expressway.',
  ch2: 'ORBITAL FLEET LINE', ch2l: 'Break the screen. Sink the flagship.', ch3: 'MASS DRIVER', ch3l: 'Ride the barrel at the speed of a shell.', ch4: 'HELIOS', ch4l: 'The dreadnought that took the sky.',
  wr_missiles: 'MISSILE HATCH', wr_deflector: 'DEFLECTOR', wr_beam: 'BEAM EMITTER', wr_shielded: 'SHIELDED', m_sys_missiles: 'MISSILE HATCHES CRIPPLED', m_sys_deflector: 'DEFLECTOR DOWN — ARRAYS EXPOSED', m_sys_beam: 'SWEEP BEAM OFFLINE',
  b_ravenLimit: 'RAVEN — LIMITER RELEASE', w_ravenLimit: 'WARNING  //  ELITE OUTPUT RISING', p_weakSys: 'Each weak point runs a system — break the <b>DEFLECTOR</b> first to drop the shields',
  shield: 'E-SHIELD', m_shieldDown: 'SHIELD DOWN', w_mechLost: 'CRITICAL DAMAGE', 
  beam: 'HEAVY BEAM', charging: 'CHARGING', c_beam: 'Hold to charge the heavy beam, release to fire (pierces)', m_beamFull: 'FULL CHARGE', m_beamPierce: 'PIERCE x{n}',
  p_beam: 'HEAVY UNITS — hold {k:charge} to charge the <b>HEAVY BEAM</b>, release to pierce', rotate: 'ROTATE TO LANDSCAPE',
  t_fire: 'FIRE', t_blade: 'BLADE', t_lock: 'LOCK', t_beam: 'BEAM', t_dodge: 'DODGE', t_boost: 'BOOST',
  launch: 'LAUNCH', retry: 'RETRY CHECKPOINT', restart: 'RESTART MISSION', again: 'FLY AGAIN', resume: 'RESUME', quit: 'QUIT TO TITLE',
  mechLost: 'MECH LOST', gameOver: 'GAME OVER', missionComplete: 'MISSION COMPLETE', heliosDestroyed: 'HELIOS DESTROYED', paused: 'PAUSED',
  hint: 'Best with headphones · Chrome / Edge / Safari · Xbox-style gamepad · touch screens supported',
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
  m_fullSalvo: 'FULL SALVO', m_fullLock: 'FULL LOCK', m_chain: 'CHAIN x{n}',
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
  r_c0a: '紅隼，你已離開彈射器。新開市的防衛網一小時前全面斷線——有東西奪走了它。', r_c0b: '收到，翠鳥。外面一堆無人機，沒有一架是我們的。',
  r_c0c: '它們會聚成群互相掩護。按住鎖定，把整群一起標起來。', r_c0d: '第二波正從大樓間升起。保持移動，停下來就是死路。',
  r_c1a: '天空公路七號。民用交通已淨空，上面其他東西全是敵人。', r_c1b: '重裝單位接近。步槍打不穿那層裝甲——蓄能重砲。',
  r_c1c: '長程雷達有反應……速度很快，快得不像無人機。', r_c1d: '原來派來的是攔截機。讓我看看你不只是塗裝好看。',
  r_c1e: '好吧。不必再保留了。', r_c1f: '……還不賴，紅隼。我沒做完的事，HELIOS 會替我做完。',
  r_c2a: '前方是軌道艦隊防線。屏障很薄——趁它們合攏前突破。', r_c2b: '戰艦正前方。核心在艦首裝甲下面，把它撬開。',
  r_c2c: '戰艦擊沉。翠鳥，這支艦隊在護送什麼？', r_c2d: '質量投射器。要是讓它們把盡頭那東西射出去，整條海岸就完了。',
  r_c3a: '你進到砲管裡了，紅隼。穿過閘門加速，撞上隔板就沒命。', r_c3b: '盡頭有光了。HELIOS 就在另一邊等著。',
  r_c4a: '偵測到攔截機。分類：無關緊要。', r_c4b: '那艘船上有三套系統，各自由一個節點控制。先打偏折護盾。',
  r_c4c: '捨棄冗餘形態。啟動戰鬥構型。', r_c4d: '那個形態的核心露出來了！用你所有的火力打它！',
  r_c4e: '核心完整性……失效——', r_c4f: '超限驅動。到此為止。',
  ch0: '新開巨型都市', ch0l: '整座城市陷入黑暗。查出是誰關的燈。', ch1: '天空公路七號', ch1l: '有個很快的東西正沿著高架道路狩獵。',
  ch2: '軌道艦隊防線', ch2l: '擊破屏障，擊沉旗艦。', ch3: '質量投射器', ch3l: '以砲彈的速度穿越砲管。', ch4: 'HELIOS', ch4l: '奪走天空的無畏戰艦。',
  wr_missiles: '飛彈艙', wr_deflector: '偏折護盾', wr_beam: '掃射光束', wr_shielded: '護盾中', m_sys_missiles: '飛彈艙重創', m_sys_deflector: '偏折護盾瓦解——弱點暴露', m_sys_beam: '掃射光束停擺',
  b_ravenLimit: 'RAVEN——限制器解除', w_ravenLimit: '警告  //  精英機出力攀升', p_weakSys: '每個弱點各自控制一套系統——先擊破<b>偏折護盾</b>解除防護',
  shield: '能量護盾', m_shieldDown: '護盾崩潰', w_mechLost: '機體嚴重損毀', 
  beam: '重粒子砲', charging: '蓄能中', c_beam: '按住蓄能重粒子砲，放開發射（可貫穿）', m_beamFull: '蓄能完成', m_beamPierce: '貫穿 x{n}',
  p_beam: '重裝單位——按住 {k:charge} 蓄能<b>重粒子砲</b>，放開貫穿射擊', rotate: '請將裝置轉為橫向',
  t_fire: '射擊', t_blade: '光刃', t_lock: '鎖定', t_beam: '重砲', t_dodge: '閃避', t_boost: '推進',
  launch: '出擊', retry: '從檢查點重試', restart: '重新開始任務', again: '再次出擊', resume: '繼續', quit: '回到標題',
  mechLost: '機體損毀', gameOver: '任務失敗', missionComplete: '任務完成', heliosDestroyed: 'HELIOS 已擊破', paused: '暫停',
  hint: '建議配戴耳機 · Chrome / Edge / Safari · 支援 Xbox 規格手把與觸控螢幕',
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
  m_fullSalvo: '全彈齊射', m_fullLock: '全鎖定', m_chain: '連鎖 x{n}',
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
  r_c0a: 'ケストレル、カタパルト離脱を確認。ネオカイの防衛網が一時間前に沈黙した。何かに乗っ取られた。', r_c0b: '了解、ハルシオン。ドローンだらけだ。味方は一機もいない。',
  r_c0c: '奴らは群れで互いを守る。ロックを長押しして、群れごと捉えろ。', r_c0d: '第二波、ビル群から上昇中。動き続けろ。止まれば死ぬぞ。',
  r_c1a: 'スカイハイウェイ7。民間機は退避済み。それ以外は全部敵だ。', r_c1b: '重装ユニット接近。ライフルではあの装甲は抜けない。ビームをチャージしろ。',
  r_c1c: '長距離レーダーに反応……速い。ドローンにしては速すぎる。', r_c1d: 'インターセプターを寄越したか。塗装だけじゃないところを見せてみろ。',
  r_c1e: 'いいだろう。もう手加減はしない。', r_c1f: '……悪くない、ケストレル。俺がやり残したことは、HELIOS が終わらせる。',
  r_c2a: '前方、軌道艦隊の防衛線。護衛は薄い。陣形が閉じる前に突破しろ。', r_c2b: '正面に戦艦。コアは艦首装甲の下だ。こじ開けろ。',
  r_c2c: '戦艦撃沈。ハルシオン、この艦隊は何を護衛している？', r_c2d: 'マスドライバーだ。その先にあるものを撃ち出されたら、沿岸は終わりだ。',
  r_c3a: '砲身に入ったぞ、ケストレル。ゲートで加速、隔壁に当たれば即死だ。', r_c3b: '出口の光だ。HELIOS が向こうで待っている。',
  r_c4a: 'インターセプターを検知。分類：無関係。', r_c4b: 'あの船体には三つのシステムがあり、それぞれ別のノードだ。まずディフレクターを叩け。',
  r_c4c: '冗長形態を破棄。戦闘形態へ移行。', r_c4d: 'その形態ではコアが露出している！全火力を叩き込め！',
  r_c4e: 'コア健全性……低下——', r_c4f: 'オーバードライブ。これで終わりだ。',
  ch0: 'ネオカイ・メガシティ', ch0l: '街が闇に沈んだ。灯りを消したのは誰だ。', ch1: 'スカイハイウェイ7', ch1l: '高速道路を何か速いものが狩っている。',
  ch2: '軌道艦隊防衛線', ch2l: '護衛を破り、旗艦を沈めろ。', ch3: 'マスドライバー', ch3l: '砲弾の速度で砲身を駆け抜けろ。', ch4: 'HELIOS', ch4l: '空を奪った超弩級戦艦。',
  wr_missiles: 'ミサイルハッチ', wr_deflector: 'ディフレクター', wr_beam: '掃射ビーム', wr_shielded: 'シールド中', m_sys_missiles: 'ミサイルハッチ大破', m_sys_deflector: 'ディフレクター停止——弱点露出', m_sys_beam: '掃射ビーム停止',
  b_ravenLimit: 'RAVEN——リミッター解除', w_ravenLimit: '警告  //  エリート出力上昇', p_weakSys: '弱点はそれぞれシステムを担う——まず<b>ディフレクター</b>を破壊せよ',
  shield: 'Eシールド', m_shieldDown: 'シールドダウン', w_mechLost: '機体損傷甚大', 
  beam: 'ヘビービーム', charging: 'チャージ中', c_beam: '長押しでヘビービームをチャージ、離して発射（貫通）', m_beamFull: 'フルチャージ', m_beamPierce: '貫通 x{n}',
  p_beam: '重装ユニット——{k:charge} 長押しで<b>ヘビービーム</b>をチャージ、離して貫通', rotate: '端末を横向きにしてください',
  t_fire: '射撃', t_blade: 'ブレード', t_lock: 'ロック', t_beam: 'ビーム', t_dodge: '回避', t_boost: 'ブースト',
  launch: '出撃', retry: 'チェックポイントから再開', restart: 'ミッションを最初から', again: 'もう一度出撃', resume: '再開', quit: 'タイトルへ戻る',
  mechLost: '機体大破', gameOver: 'ゲームオーバー', missionComplete: 'ミッション完了', heliosDestroyed: 'HELIOS 撃破', paused: 'ポーズ',
  hint: 'ヘッドホン推奨 · Chrome / Edge / Safari · Xbox系ゲームパッド・タッチ対応',
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
  m_fullSalvo: 'フルサルボ', m_fullLock: 'フルロック', m_chain: 'チェイン x{n}',
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

const KEYS: Record<string, Record<Device, string>> = {
  move: { kb: 'WASD', pad: 'L-STICK', touch: 'L-PAD' }, aim: { kb: 'MOUSE', pad: 'R-STICK', touch: 'DRAG' }, fire: { kb: 'LMB', pad: 'RT', touch: 'FIRE' },
  lock: { kb: 'RMB / E', pad: 'LT', touch: 'LOCK' }, charge: { kb: 'Q', pad: 'Y', touch: 'BEAM' },
  melee: { kb: 'F', pad: 'X', touch: 'BLADE' }, boost: { kb: 'SHIFT', pad: 'LB', touch: 'BOOST' }, dodge: { kb: 'SPACE', pad: 'A', touch: 'DODGE' },
  pause: { kb: 'ESC / P', pad: 'START', touch: 'II' }, confirm: { kb: 'ENTER', pad: 'A', touch: 'TAP' }, alt: { kb: 'R', pad: 'Y', touch: 'R' },
};

function detect(): Lang {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'en' || q === 'zh' || q === 'ja') return q;
  try { const s = localStorage.getItem('mo_lang'); if (s === 'en' || s === 'zh' || s === 'ja') return s; } catch (e) { /* storage blocked */ }
  const n = (navigator.language || 'en').toLowerCase();
  return n.startsWith('zh') ? 'zh' : n.startsWith('ja') ? 'ja' : 'en';
}
export let lang: Lang = detect();
export type Device = 'kb' | 'pad' | 'touch';
export let device: Device = 'kb';
const listeners: (() => void)[] = [];
export function onI18n(f: () => void) { listeners.push(f); }
export function setLang(l: Lang) { lang = l; try { localStorage.setItem('mo_lang', l); } catch (e) { /* ignore */ } listeners.forEach(f => f()); }
export function setDevice(d: Device) { if (d === device) return; device = d; listeners.forEach(f => f()); }
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
