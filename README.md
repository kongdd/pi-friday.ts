# Friday

[![CI](https://github.com/kongdd/pi-friday.ts/actions/workflows/friday-ci.yml/badge.svg?branch=main)](https://github.com/kongdd/pi-friday.ts/actions/workflows/friday-ci.yml)
[![Codecov](https://codecov.io/gh/kongdd/pi-friday.ts/branch/main/graph/badge.svg)](https://codecov.io/gh/kongdd/pi-friday.ts)

Friday 是 Pi 的语音朗读扩展。

## 安装

```sh
pi install npm:pi-friday
```

重启 Pi 后，运行 `/friday on` 开启朗读，运行 `/friday test` 试听。如果已手动安装过 Friday，请先停用旧副本，避免重复加载。

macOS ARM64 和 Windows x64 会自动安装对应的 `edge-tts-rust` 与 `audio-play`。Friday 优先查找本地 `pkgs/pi-friday-<平台>/`，其次查找 npm 平台包，最后查找 `PATH`。播放器也可用 `afplay`、`ffplay` 或 `mplayer`。合成时，待朗读文本会发送到在线语音服务。

## 常用命令

- `/friday on`、`/friday off`：切换当前会话的朗读；追加 `global` 或 `local`，分别保存到用户或项目配置。
- `/friday zh`、`/friday en`：切换中文或英文音色。
- `/friday config`：查看当前语音配置。

远程模式通过 HTTP POST 将音频发送给接收器（默认端口 `17322`）。播放模式默认根据 SSH 环境判断。可在 `~/.pi/Friday.json` 中将 `mode` 设为 `"local"` 或 `"remote"`，然后运行 `/reload`；删除该字段恢复自动判断。

## 构建 Rust 工具

在 Apple Silicon Mac 上，安装 Rust（rustup）、Xcode 命令行工具和 MinGW-w64，并准备 `edge-tts-rust` 源码及同级的 `../auto-play.rs`。运行：

```sh
brew install mingw-w64
rustup target add aarch64-apple-darwin x86_64-pc-windows-gnu
./scripts/build-audio-tools.sh /path/to/edge-tts-rust
```

构建产物位于 `pkgs/pi-friday-mac/` 和 `pkgs/pi-friday-windows/`，分别对应同名 npm 包，只发布本平台的两种工具。发布前用 `npm pack --dry-run ./pkgs/pi-friday-<平台>` 检查产物，并确认主包 `optionalDependencies` 指向已发布的平台包版本。

平台包有更新时，先手动发布对应的子包，再更新主包的依赖版本：

```sh
npm publish ./pkgs/pi-friday-mac
npm publish ./pkgs/pi-friday-windows
```

## 发布主包

首次使用前，在 npm 的 `pi-friday` 设置中添加 [Trusted Publisher](https://docs.npmjs.com/trusted-publishers/)，选择 GitHub Actions，填写所有者 `kongdd`、仓库 `pi-friday.ts`、工作流 `release.yml`，环境留空，并允许 `npm publish`。无需配置 npm token。

推送版本更新后，在 GitHub 发布正式 Release，标签须与主包版本一致（如 `v0.1.2`）。工作流会运行测试并将主包发布到 npm；草稿、预发布和仅推送标签不会触发 npm 发布。
