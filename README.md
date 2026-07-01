# Solato

> **Work in Progress** – Solato is under active development. Features, APIs, and the overall structure may change frequently and without notice.

A local desktop timer app designed to help track and manage study sessions.

## Key features
- Simple stopwatch for tracking study time
- Pomodoro timer with customizable work and break intervals
- Project management to organize and track study time by project
- Analysis of study sessions with statistics and charts
- Settings to customize the app to your workflow

## Data & privacy
All data is currently stored **locally only** on your device. Nothing is sent anywhere. Your study sessions and statistics stay fully private.

## Prerequisites
- Node.js (recommended >= 18)
- npm or pnpm
- Rust toolchain (for Tauri native builds): rustup, cargo
- Tauri CLI (optional for dev/build): `cargo install tauri-cli` or use `npm run tauri` if installed locally

## Getting started
1. Install dependencies:
   ```
   npm i
   ```
   
2. Set up test database (SQLite) for development:<br><br>
   Add a .env file with the content of .env.example<br>
   Then run both within /src-tauri folder:

   ```
   sqlx database create
   sqlx migrate run
   ```

3. Start the Tauri development session (serves the frontend and launches the native window):
   ```
   npm run tauri dev
   ```

4. Build production assets and create native installers:
   ```
   npm run tauri build
   ```

Notes:
- Vite is configured to use port 1420 and strictPort when launched via Tauri. If you need to expose HMR on a LAN host, set the `TAURI_DEV_HOST` environment variable.

## Useful scripts
- `npm run tauri dev`  # Start the Tauri dev session (frontend + native window)
- `npm run build`      # Compile TypeScript and build frontend assets
- `npm run tauri build`# Build native Tauri bundles
- `npm run format`     # Format code with Prettier

## Contributing
Contributions are welcome. Please open issues or PRs with small, focused changes. Keep TypeScript types and formatting consistent.

## License
This repository includes a LICENSE file. Check it for license details.
