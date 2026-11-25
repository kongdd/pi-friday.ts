# pi-friday-windows

Windows x64 optional dependency of [pi-friday](https://www.npmjs.com/package/pi-friday), a voice playback extension for Pi. Install `pi-friday` rather than this package directly.

| Binary | Source | Purpose |
| --- | --- | --- |
| `audio-play.exe` | [audio-player in kongdd/system-media.rs](https://github.com/kongdd/system-media.rs/tree/main/crates/audio-player) (formerly [`auto-play.rs`](https://github.com/kongdd/auto-play.rs)) | Plays synthesized audio. |
| `edge-tts-rust.exe` | [kongdd/edge-tts-rust](https://github.com/kongdd/edge-tts-rust), forked from [Initsnow/edge-tts-rust](https://github.com/Initsnow/edge-tts-rust) | Synthesizes speech via Microsoft's online service. |

## Build

Follow the [audio tools build instructions](https://github.com/kongdd/pi-friday.ts#构建-rust-工具) in the main repository. To rebuild the bundled `audio-play.exe`, use the legacy `auto-play.rs` checkout alongside `pi-friday.ts`, then run `./scripts/build-audio-tools.sh /path/to/edge-tts-rust` from `pi-friday.ts`. The script uses Rust and MinGW-w64 to build the Windows binaries for `x86_64-pc-windows-gnu`.

## License

`edge-tts-rust.exe` is distributed under the [MIT license](LICENSE-edge-tts-rust). Neither the current `audio-player` crate nor the legacy `auto-play.rs` repository declares a license.
