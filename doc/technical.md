# Technical

## 1. 技术栈

Prism Rush 是一个独立的 Vite 工程，使用原生 JavaScript、Three.js 0.180.0 和 CSS 实现。3D 渲染使用 `THREE.WebGLRenderer`、`EffectComposer`、`RenderPass`、`UnrealBloomPass` 和 `OutputPass`，主场景为全屏 WebGL 画布；样式使用普通 CSS，构建配置 `base: './'`，确保部署到任意子路径都能加载资源。

音效使用 Web Audio API 动态合成，不依赖音频文件。语言使用项目内轻量 i18n，支持 `zh` 和 `en`，通过 `localStorage.game_locale` 或浏览器语言检测。最高分使用 `localStorage` 的 `prism_rush_best` 键保存。游戏 UUID 通过 `index.html` 的 `<meta name="game-uuid">` 注入，来源为 `/Users/yin/code/games/games/games.json`。

## 2. 目录结构

- `index.html`：页面结构、三态屏幕、HUD、Aigram 水印和游戏 UUID meta。
- `src/main.js`：Three.js 场景初始化、对象生成、主循环、碰撞、输入、计分、结算和 UI 状态同步。
- `src/styles.css`：全屏布局、HUD、开始/结算面板、按钮、连击徽章、浮动分数、台词气泡和响应式尺寸。
- `src/i18n.js`：`zh` / `en` 文案字典、语言检测、`t()` 和随机台词函数。
- `src/sounds.js`：Web Audio API 音效封装，包括开始、换道、收集、撞击、胜利和点击音。
- `public/img/aigram.svg`：平台水印资源。
- `public/poster.svg`：游戏封面图。
- `doc/requirements.md`：玩法和视觉蓝图。
- `doc/technical.md`：最终实现说明。
- `meta.json`：平台展示标题和封面路径。
- `vite.config.js`：Vite 构建配置，固定 `base: './'`。

## 3. 核心模块

状态管理集中在 `src/main.js` 的 `state` 对象，包含 `phase`、分数、历史最高、combo、当前轨道、目标轨道、倒计时、速度、生成计时器和结算原因。屏幕状态通过 `setPhase()` 在开始页、游戏中、结算页之间互斥切换。

主循环使用 `requestAnimationFrame` 驱动，`render()` 计算 `dt` 后调用 `updateScene()`，再用 `EffectComposer` 渲染。`updateScene()` 负责赛道框架循环、星点循环、粒子生命周期、玩家浮动和镜头追随；游戏中额外调用 `updatePlaying()`，按 0.72 秒节奏生成棱晶或危险门。

碰撞和更新逻辑使用固定 3 轨道坐标 `[-2.4, 0, 2.4]`。对象从 `z=-64` 向玩家移动，`z>6` 后移除；当对象与玩家横向距离小于 0.82 且 z 距离小于 1.05 时触发收集或撞击。开始后的 1.5 秒缓冲期只跳过危险门死亡判定，不跳过棱晶收集。

反馈系统包括 `popScore()` 浮动分数、`showBubble()` 台词气泡、`spawnParticles()` 收集/撞击粒子、`updateComboUI()` 连击徽章和 `sounds.js` 合成音效。最高分在 `endGame()` 中写入 `localStorage`，再来一次调用 `startGame()` 重置对象队列、倒计时、分数、combo 和轨道。

响应式布局由全屏 WebGL 画布承载，`resize()` 根据 `stage.clientWidth` 和 `stage.clientHeight` 同步 renderer、composer 和 camera aspect。UI 使用绝对定位和固定尺寸，按钮使用 `pointerdown`，游戏区点击左/右半屏换道；桌面端支持 ArrowLeft / ArrowRight / A / D / Space。

## 4. 扩展点

- 调玩法数值：修改 `src/main.js` 顶部的 `GAME_MS`、`GRACE_MS`、`LANES`、`SPAWN_Z`、`FRAME_COUNT`、生成概率、生成间隔、速度公式和碰撞阈值。
- 换视觉风格：修改 `src/main.js` 的材质颜色、灯光强度、Bloom 参数、几何体尺寸，以及 `src/styles.css` 的 HUD 和面板样式。
- 改文案和多语言：修改 `src/i18n.js` 的 `dictionaries`，所有用户可见文字都应继续通过 `t()` 或 `randomLine()` 输出。
- 调音效：修改 `src/sounds.js` 中各事件函数的频率、波形、时长、延迟和音量。
- 换封面/水印：替换 `public/poster.svg` 或 `public/img/aigram.svg`，并同步 `meta.json` 的 `cover_url`。
- 加平台后端、排行榜或存档：在保持当前 UUID 不变的前提下接入 `@shared/runtime` 或对应平台 API，并在新增持久化逻辑时避免直接用 `savedData` 做二次发布的读改写来源。
