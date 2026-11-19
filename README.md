# Friday

本包包含两个 Pi 扩展：Friday 语音朗读和 VS Code 编辑器上下文。

## 安装

```sh
pi install npm:@kongdd/pi-friday
```

重启 Pi 后，运行 `/friday on` 开启朗读，运行 `/friday test` 试听。如果已有手动安装的 Friday 或 `pi-vscode-context.ts`，请先停用旧副本，避免重复加载。

本地终端播放需要在 `PATH` 中提供 `edge-tts-rust` 和可用的播放器（如 macOS 自带的 `afplay`，或 `ffplay`）。使用 `edge-tts-rust` 合成时，待朗读文本会发送到在线语音服务。

## 常用命令

- `/friday on`、`/friday off`：切换当前会话的朗读；追加 `global` 或 `local`，分别保存到用户或项目配置。
- `/friday zh`、`/friday en`：切换中文或英文音色。
- `/friday config`：查看当前语音配置。

远程模式通过 HTTP POST 将音频发送给接收器（默认端口 `17322`）。播放模式默认根据 SSH 环境判断。可在 `~/.pi/Friday.json` 中将 `mode` 设为 `"local"` 或 `"remote"`，然后运行 `/reload`；删除该字段恢复自动判断。

## VS Code 编辑器上下文

在 VS Code 中安装 [VSCode Pi Agent Bridge](https://marketplace.visualstudio.com/items?itemName=zenyui.vscode-pi-bridge)（`zenyui.vscode-pi-bridge`）。由于本包已包含 Pi 端扩展，请在 VS Code 设置中关闭 `piContext.autoInstallCompanion`，并移走已自动生成的 `~/.pi/agent/extensions/pi-vscode-context.ts`（若存在），避免重复加载。

在 VS Code 集成终端运行 Pi，用 `/vscode` 查看编辑器上下文。连接后默认将活动文件与选区附加到发送给模型的消息，可用 `/vscode-auto off` 关闭。
