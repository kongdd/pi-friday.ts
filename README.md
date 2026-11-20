# Friday

[![CI](https://github.com/kongdd/pi-friday.ts/actions/workflows/friday-ci.yml/badge.svg?branch=main)](https://github.com/kongdd/pi-friday.ts/actions/workflows/friday-ci.yml)
[![Codecov](https://codecov.io/gh/kongdd/pi-friday.ts/branch/main/graph/badge.svg)](https://codecov.io/gh/kongdd/pi-friday.ts)

Friday 是 Pi 的语音朗读扩展。

## 安装

```sh
pi install npm:@kongdd/pi-friday
```

重启 Pi 后，运行 `/friday on` 开启朗读，运行 `/friday test` 试听。如果已手动安装过 Friday，请先停用旧副本，避免重复加载。

npm 包内含 macOS ARM64 和 Windows x64 的 `edge-tts-rust` 与 `audio-play`，无需手动安装。找不到包内工具时，Friday 从 `PATH` 查找，播放器也可用 `afplay` 或 `ffplay`。合成时，待朗读文本会发送到在线语音服务。

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

两种工具的产物分别在 `dist/audio-tools/darwin-arm64/` 和 `dist/audio-tools/win32-x64/`。发布前先构建，再用 `npm pack --dry-run` 确认四个文件都在包里。
