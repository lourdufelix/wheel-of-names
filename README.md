# Wheel of Names

A lightweight desktop app for spinning a wheel and picking a random winner from a list of names. Built with [Tauri](https://tauri.app/) + Vanilla HTML/CSS/JS.

---

## Features

- Add up to 40 names to the wheel
- Animated spin with a smooth ease-out effect
- Winner shown in a speech bubble after each spin
- **Remove winner after spin** toggle — automatically removes the winner from the wheel so the same person isn't picked twice
- **Restore All** button — brings all removed names back to the wheel
- **Clear All** with inline confirmation (no accidental deletions)
- Names and settings persist across sessions via localStorage
- Works on macOS and Windows as a standalone app — no install required

---

## Download

Go to the [Releases](../../releases) page and download the file for your platform:

| Platform | File |
|----------|------|
| Mac      | `wheel-of-names-macos.zip` |
| Windows  | `wheel-of-names-x64.msi` |

---

## macOS — First Launch

macOS will block the app from opening because it is not code-signed. You have two options:

### Option 1 — Terminal (recommended)
After unzipping, run this command once in your terminal:

```bash
xattr -cr ~/Downloads/wheel-of-names.app
```

Then double-click the app to open it normally.

### Option 2 — Right-click workaround
1. Right-click `wheel-of-names.app`
2. Select **Open**
3. Click **Open** on the warning dialog

You only need to do this once — after the first launch it opens normally.

---

## Windows — First Launch

Run the `.msi` installer. If Windows SmartScreen shows a warning, click **More info** → **Run anyway**.

---

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Rust](https://rustup.rs/)

### Run locally

```bash
npm install
npm run dev
```

### Build

```bash
npm run build
```

Output is in `src-tauri/target/release/bundle/`.

---

## Built by

Tiger & Athena teams 🐯
