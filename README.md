# 指尖花园 · Fingertip Bloom

一个可在本地 HTTP 服务中运行的手势粒子花园。Three.js 与 GLSL 绘制四层立体粒子花瓣；MediaPipe Hands 在浏览器内识别一只手的 21 个关键点。握拳收拢为花苞，张开手掌向外绽放，花朵随食指位置柔和移动。

## Windows 双击启动版

无需安装 Node.js 或输入命令。适用于 Windows 10 / 11 x64。

1. [下载免安装包](https://github.com/13911006515-bit/codex-c-test/raw/refs/heads/fingertip-bloom-delivery/downloads/fingertip-bloom-windows.zip)。私有仓库需先登录有权限的 GitHub 账号。
2. 将压缩包完整解压，打开“指尖花园”文件夹。
3. 双击 **启动花园.cmd**，默认浏览器会自动打开网页。
4. 保持终端窗口开启，在网页点击“开启手势魔法”并允许摄像头。停止时按 Ctrl+C 或关闭终端。

免安装包包含生产网页、本地手势模型、静态 HTTP 服务和按官方 SHA-256 验证的 Node.js Windows 运行时。包内包含使用说明和依赖许可；下载包的校验值位于 `downloads/SHA256SUMS`。网页服务和浏览器交互已验证，Windows 启动文件仍需在真实 Windows 设备执行。

## Mac 双击启动版

[下载 Mac 通用启动包（约 88 MiB）](https://github.com/13911006515-bit/codex-c-test/raw/refs/heads/fingertip-bloom-delivery/downloads/fingertip-bloom-mac.zip)。要求 **macOS 13.5 或更新版本**，同时包含苹果芯片与 Intel 运行时，由启动文件自动选择。

1. 在 Mac 的 Finder 中双击 ZIP，用系统自带的归档实用工具完整解压。
2. 打开“指尖花园 Mac”文件夹，双击 **启动花园.command**。
3. 浏览器自动打开后，点击“开启手势魔法”，允许摄像头。保持终端窗口开启；停止时按 Control+C。

首次打开若系统提示无法验证开发者，确认下载来自本仓库后，在“系统设置 → 隐私与安全性”中选择对应项目的“仍要打开”，并按系统提示确认。部分系统版本也支持右键启动文件、选择“打开”。此包没有 Apple 应用公证；启动程序不会关闭系统安全验证或删除隔离属性。

包内含网页、模型和官方 Node.js 运行时，不需要安装依赖。两个运行时均已按官方 SHA-256 验证，并检查了 Mach-O 架构、13.5 系统目标和签名数据存在。云端已验证打包网页与本地服务；Finder 启动、Apple 签名验证、Gatekeeper 和真实摄像头还需 Mac 实机验证。使用最新版 Chrome 或 Edge 可获得更一致的手势体验。

重新打包：先运行 `npm run build`，再在此 Linux 开发环境运行 `python3 scripts/package-mac.py`。脚本下载并验证固定版本的官方运行时，保留可执行权限，生成 ZIP 并更新 `downloads/SHA256SUMS`。

## 开发环境启动

需要 Node.js 20.19+ 或 22.12+（本环境使用 Node.js 24）。

```bash
cd /workspace/codex-c-test
npm ci --cache /tmp/codex-npm-cache
npm run dev -- --port 5173
```

在本机浏览器打开 `http://localhost:5173`。其他机器部署时使用 HTTPS，浏览器只允许安全来源使用摄像头；localhost 的本地 HTTP 服务属于安全来源。通过普通 HTTP 局域网 IP 访问时，鼠标模式仍可运行，摄像头可能不可用。

依赖安装会自动将 MediaPipe 的 JS、WASM、图模型和 TFLite 文件复制到 `public/mediapipe/`。它们不提交到 Git；每次启动和构建也会检查并复制。网页运行时无需第三方 CDN，不需要 API 密钥。摄像头只在点击按钮并授权后开启，视频和推理均在浏览器内处理，不上传图像。关闭摄像头、离开页面或切换到后台时释放视频轨道。

## 交互

- **摄像头**：点击“开启手势魔法”，让单只手进入预览画面，掌心朝向摄像头。张开四指使花朵盛开，握拳收拢；移动食指改变花朵位置。小预览显示关键点和识别状态。
- **鼠标 / 触摸**：在画布上移动来轻推花朵；按住收拢，松开恢复。没有手或识别丢失时，花朵回到中央和手动绽放程度。
- **控制面板**：四种花色，12,000 / 24,000 / 40,000 粒子，绽放程度滑杆，以及自动呼吸动画。摄像头开启时由手势控制绽放，滑杆与呼吸开关暂时禁用。
- **保存画面**：下载粒子画布的 PNG 图片（不含页面文字、控制面板和摄像头画面）。

支持桌面和手机布局。浏览器需要 WebGL 与硬件加速；遵循系统减少动态效果设置以减少持续旋转和波动。粒子生成时带有随机采样，因此每次刷新略有不同。

## 构建和验证

```bash
npm test
npm run build
npm run preview -- --port 4173
```

`npm test` 包含手势开合、缩放/旋转不变性、镜像指尖位置、无效输入和帧率无关平滑的单元测试。生产输出位于 `dist/`，将整个目录部署到静态服务器即可，包括 `mediapipe/` 的本地模型文件。

浏览器集成验证需要先启动开发或预览服务。当前云环境已安装 `/usr/bin/chromium`：

```bash
npm run test:browser
# 验证生产构建时：
BLOOM_TEST_URL=http://localhost:4173 npm run test:browser
```

其他环境可运行 `npx playwright install chromium`，或通过 `BLOOM_CHROMIUM` 指定 Chromium 可执行文件。浏览器测试验证可见渲染像素、鼠标开合、控件、PNG 下载、手机布局、本地 MediaPipe 的实际模型初始化和模拟视频推理、摄像头关闭、权限拒绝，以及通过模拟关键点联动的张手/握拳。截图默认保存到 `/tmp/fingertip-bloom-artifacts`，可通过 `BLOOM_ARTIFACTS` 修改路径。

**验证范围**：模拟视频与关键点用于可重复验证，不能替代真实摄像头下不同光线、肤色、遮挡和手势的人工体验。真实设备上建议光线充足，整只手在镜头内，避免手指重叠；识别信心不足时可重试或使用鼠标模式。

## 文件结构

| 文件 | 用途 |
| --- | --- |
| `src/main.js` | Three.js 场景、交互面板、摄像头生命周期、推理循环 |
| `src/flower.js` | 花瓣/花苞粒子几何与 GLSL 着色器 |
| `src/gesture.js` | 手势绽放程度与平滑函数 |
| `src/style.css` | 桌面和移动端布局 |
| `scripts/prepare-assets.mjs` | 从安装包准备本地 MediaPipe 资源 |
| `scripts/browser-smoke.mjs` | Chromium 集成验证 |
| `tests/gesture.test.js` | 手势算法测试 |

云任务已具有隔离的环境，直接使用此仓库即可，无需创建 Git worktree。每个新任务需要重新启动 Vite 服务；已安装的依赖和本地资源可以复用。
