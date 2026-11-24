#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || ! -f "$1/Cargo.toml" ]]; then
  printf 'Usage: %s /path/to/edge-tts-rust\n' "$0" >&2
  exit 2
fi

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
edge_manifest="$1/Cargo.toml"
audio_manifest="$root/../auto-play.rs/Cargo.toml"
target_dir="${CARGO_TARGET_DIR:-$root/dist/cargo-target}"
output="$root/pkgs"

# Use the rustup compiler that owns the installed cross-compilation targets.
cargo="$(rustup which cargo)"
RUSTC="$(rustup which rustc)"
export RUSTC
export CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER=x86_64-w64-mingw32-gcc
export CC_x86_64_pc_windows_gnu=x86_64-w64-mingw32-gcc
export AR_x86_64_pc_windows_gnu=x86_64-w64-mingw32-ar

build() {
  local target="$1" platform="$2" suffix="${3:-}"
  local release="$target_dir/$target/release" destination="$output/pi-friday-$platform"
  "$cargo" build --locked --release --target "$target" --target-dir "$target_dir" \
    --manifest-path "$edge_manifest" --bin edge-tts-rust
  "$cargo" build --locked --release --target "$target" --target-dir "$target_dir" \
    --manifest-path "$audio_manifest" --bin audio-play
  mkdir -p "$destination"
  install -m 755 "$release/edge-tts-rust$suffix" "$release/audio-play$suffix" "$destination/"
}

build aarch64-apple-darwin darwin-arm64
build x86_64-pc-windows-gnu win32-x64 .exe
