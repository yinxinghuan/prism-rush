# Technical

## 1. 技术栈

Prism Rush 是一个独立的 Vite 工程，使用原生 JavaScript、Three.js 0.180.0 和 CSS 实现。3D 渲染使用 `THREE.WebGLRenderer`、`GLTFLoader`、`EffectComposer`、`RenderPass`、`UnrealBloomPass` 和 `OutputPass`，主场景为全屏 WebGL 画布；样式使用普通 CSS，构建配置 `base: './'`，确保部署到任意子路径都能加载资源。

音效使用 Web Audio API 动态合成，不依赖音频文件。语言使用项目内轻量 i18n，支持 `zh` 和 `en`，通过 `localStorage.game_locale` 或浏览器语言检测。最高分使用 `localStorage.prism_rush_best` 保存；角色商店使用 `prism_rush_owned_characters`、`prism_rush_prisms` 和 `prism_rush_selected_character`。游戏 UUID 通过 `index.html` 的 `<meta name="game-uuid">` 注入，来源为 `/Users/yin/code/games/games/games.json`。

排行榜使用 `public/aigram-bridge.js` 暴露的 `window.Aigram`，通过 Aigram Rank API 的 `/rank/score/save` 和 `/rank/score/list/by/session_id` 接入。榜单按游戏 UUID 隔离；非 AlterU 环境不拉平台榜，完整榜单弹层显示 AlterU 下载入口。海报使用 `public/poster.png`，平台列表副本为 `/Users/yin/code/games/games/posters/prism-rush.png`。

## 2. 目录结构

- `index.html`：页面结构、三态屏幕、HUD、冠军入口、`touch_app` 幽灵手指引导、单词评语层、角色商店弹层、排行榜弹层、Aigram 水印和游戏 UUID meta。
- `src/main.js`：Three.js 场景初始化、低多边形角色加载、角色商店、随机上场规则、角色动作、对象生成、主循环、碰撞、输入、计分、结算和 UI 状态同步。
- `src/leaderboard.js`：冠军入口、完整排行榜弹层、Rank API 提交/拉取、非 AlterU 下载 CTA、用户头像/姓名渲染、profile tap 和 `score_beat` 通知；分享图引用 `poster.png`。
- `src/styles.css`：全屏布局、HUD、幽灵手指与点击波纹、单词评语、结算面板、角色商店、排行榜弹层、按钮、连击徽章、浮动分数和响应式尺寸。
- `src/i18n.js`：`zh` / `en` 文案字典、语言检测、`t()` 和随机台词函数。
- `src/sounds.js`：Web Audio API 音效封装，包括开始、换道、收集、撞击、胜利和点击音。
- `src/assets/gltf/`：从 `_lowpoly_lab` 复制的 6 个角色 GLB：Student、Teen、Punk、Cowboy、Nurse、Cat。
- `src/assets/sprites/`：对应的 6 个透明 PNG 角色预览，用于角色商店。
- `public/aigram-bridge.js`：vanilla Aigram runtime bridge，负责 API 调用和 profile 打开。
- `public/img/aigram.svg`：平台水印资源。
- `public/poster.png`：1024 × 1024 平台海报。
- `_poster_raw.png`：平台 gen-image 返回的原始海报底图，供 `gen_poster.py` 复合标题和裁切时复用。
- `gen_poster.py`：通过平台 `gen-image` 生成 voxel 场景底图，并本地叠加 `PRISM RUSH` 标题，同时写入游戏海报和平台列表海报。
- `doc/requirements.md`：玩法和视觉蓝图。
- `doc/technical.md`：最终实现说明。
- `meta.json`：平台展示标题和封面路径。
- `vite.config.js`：Vite 构建配置，固定 `base: './'`。

## 3. 核心模块

状态管理集中在 `src/main.js` 的 `state` 对象，包含 `phase`、分数、历史最高、combo、当前轨道、目标轨道、倒计时、速度、生成计时器、结算原因和当前角色。屏幕状态通过 `setPhase()` 在开始页、游戏中、结算页之间互斥切换；开始页不渲染开始按钮，只显示全屏 3D 场景和循环左右移动的幽灵手指，`startScreen` 的 `pointerdown` 直接调用 `startGame()`，`setPhase()` 同步淡出引导。

主循环使用 `requestAnimationFrame` 驱动，`render()` 计算 `dt` 后调用 `updateScene()`，再用 `EffectComposer` 渲染。`updateScene()` 负责赛道框架循环、星点循环、粒子生命周期、玩家浮动、棱镜板自转、镜头追随和角色动作；游戏中额外调用 `updatePlaying()`，按 0.72 秒节奏生成棱晶或危险门。角色动作通过 `characterModel`、`characterMeshes` 和每个 mesh 的原始旋转/位置计算，避免破坏 GLB 原始姿态。

角色系统由 `CHARACTER_OPTIONS` 定义，每个条目包含角色 id、i18n key、GLB URL、PNG 预览、目标高度、朝向、价格和主题色。`loadCharacterStore()` 从本地读取拥有列表、Prism 余额和选中角色；`resolveCharacterId()` 优先使用已拥有的选中角色，否则从已拥有角色随机，最后回退到 Student。`renderShop()` 构建 Random 卡和 6 个角色卡；`buyCharacter()` 扣除 Prism 并加入拥有列表；`pickCharacter()` 设置当前角色并重新加载 GLB。商店卡片使用 `click`，因为弹层网格可能滚动。

碰撞和更新逻辑使用固定 3 轨道坐标 `[-2.4, 0, 2.4]`。对象从 `z=-64` 向玩家移动，`z>6` 后移除；当对象与玩家横向距离小于 0.82 且 z 距离小于 1.05 时触发收集或撞击。开始后的 1.5 秒缓冲期只跳过危险门死亡判定，不跳过棱晶收集。

反馈系统包括 `popScore()` 浮动分数、`showRating()` 单词评语、`spawnParticles()` 收集/撞击粒子、`updateComboUI()` 连击徽章和 `sounds.js` 合成音效。`nextLine('ratingWords')` 按顺序轮换短评，combo ≥ 5 时改用 `ratingCombo` 高亮。最高分在 `endGame()` 中写入 `localStorage`，并调用 `earnPrisms(state.score)` 把本局分数加入商店余额。再来一次调用 `prepareRandomCharacter()` 和 `startGame()` 重置对象队列、倒计时、分数、combo 和轨道。

排行榜系统由 `src/leaderboard.js` 管理。`initLeaderboard()` 绑定冠军入口、结算页排行榜按钮、弹层关闭和 Escape；`refreshLeaderboard()` 只在 `window.Aigram.canRank` 时拉取平台榜；`openLeaderboard()` 在非 AlterU 环境渲染 `Get AlterU / 下载 AlterU` CTA；`snapshotPreRunBest()` 在开局前记录自己的旧在榜成绩；`submitFinalScore()` 在结算后提交分数，并在破自己旧纪录时调用 `score_beat` 通知算法，只通知刚被超过且分数最高的 1 个其他用户。完整榜单行展示排名、头像、名字、分数；其他用户行使用 `click` 打开 profile，本人行显示 `YOU / 你` 且不可点击。

海报生成由 `gen_poster.py` 管理。脚本调用平台 `https://chat.aiwaves.tech/aigram/api/gen-image` 生成无文字 voxel 夜街底图，要求无手机框、无 UI、无边框；随后使用 Pillow 裁切到 1024 × 1024、添加左上 `PRISM RUSH` 标题和霓虹下划线，输出到 `public/poster.png` 和中心列表仓库 `games/posters/prism-rush.png`。

响应式布局由全屏 WebGL 画布承载，`resize()` 根据 `stage.clientWidth` 和 `stage.clientHeight` 同步 renderer、composer 和 camera aspect。UI 使用绝对定位和固定尺寸，按钮使用 `pointerdown`，游戏区点击左/右半屏换道；桌面端支持 ArrowLeft / ArrowRight / A / D / Space。

## 4. 扩展点

- 调玩法数值：修改 `src/main.js` 顶部的 `GAME_MS`、`GRACE_MS`、`LANES`、`SPAWN_Z`、`FRAME_COUNT`、生成概率、生成间隔、速度公式和碰撞阈值。
- 换视觉风格：修改 `src/main.js` 的材质颜色、灯光强度、Bloom 参数、几何体尺寸，以及 `src/styles.css` 的 HUD、开屏引导和商店样式。
- 调整角色库：修改 `src/main.js` 的 `CHARACTER_OPTIONS`，并把对应 GLB 放进 `src/assets/gltf/`、PNG 预览放进 `src/assets/sprites/`；如果新增价格，记得同步 `doc/requirements.md`。
- 调角色商店规则：修改 `STORE_OWNED_KEY`、`STORE_BALANCE_KEY`、`STORE_PICKED_KEY` 相关的 `loadCharacterStore()`、`buyCharacter()`、`earnPrisms()` 和 `resolveCharacterId()`。
- 改文案和多语言：修改 `src/i18n.js` 的 `dictionaries`，所有用户可见文字都应继续通过 `t()` 或 `nextLine()` 输出。
- 调音效：修改 `src/sounds.js` 中各事件函数的频率、波形、时长、延迟和音量。
- 调排行榜：修改 `src/leaderboard.js` 的榜单渲染、通知文案、海报 ref_url、CTA 文案或 score 提交流程；profile tap 必须继续使用 `click`，不要改成 `pointerdown`。
- 换海报：修改 `gen_poster.py` 的 `PROMPT`、裁切环境变量默认值或标题样式，重新运行脚本；完成后同步 `public/poster.png` 和 `/Users/yin/code/games/games/posters/prism-rush.png`，并确认 `meta.json.cover_url` 仍为 `/poster.png`。
- 加平台存档或其他后端能力：在保持当前 UUID 不变的前提下接入 `@shared/runtime` 或对应平台 API，并在新增持久化逻辑时避免直接用 `savedData` 做二次发布的读改写来源。
