# Mantra Meditation Counter — WordPress Plugin

A beautiful, fully-featured mantra meditation tracker with **real-time voice detection**, session timing, count tracking, and session history.

---

## Features

- 🎙 **Real-time voice detection** — Uses the Web Speech API to listen *while you chant* and increments the counter the moment it recognises the mantra phrase, not at the end.
- 🔢 **Visual progress ring** — Animated SVG ring shows progress toward the target (default: 108 — a full mala).
- ⏱ **Session timer** — Tracks elapsed time in MM:SS.
- ✋ **Manual counting** — Tap a button to count without voice if preferred.
- 💾 **Session history** — Sessions are saved to the WordPress database and shown in the widget and in the admin panel.
- 🌙 **Sacred aesthetic** — Deep indigo starfield, gold typography, Cinzel serif font.

---

## Installation

1. Upload the `mantra-meditation/` folder to `/wp-content/plugins/`.
2. Activate the plugin in **WordPress Admin → Plugins**.
3. Add `[mantra_meditation]` to any page or post.

### Optional shortcode attributes

```
[mantra_meditation target="108"]
```

| Attribute | Default | Description |
|-----------|---------|-------------|
| `target`  | `108`   | Number of mantras for a complete mala (affects the progress ring). |

---

## How Voice Detection Works

The plugin uses the browser's **Web Speech API** (`SpeechRecognition`).

- Supported in **Chrome, Edge, and Safari 15+**. Firefox does not support it natively.
- When the toggle is on, the browser will ask for **microphone permission** on first use.
- Recognition runs **continuously** in `interimResults` mode, meaning it processes speech in real time — the counter increments as you finish each full mantra phrase, not at the end of the session.
- **Fuzzy matching** (Levenshtein distance ≤ 1) handles slight mispronunciations or accent variations.
- The detected phrase is **"Rama Rama Hare Hare"** (4-word sequence).

---

## Admin Panel

Navigate to **WordPress Admin → Mantra Meditation** to view all saved sessions across all users, including date, duration, count, and any notes.

---

## Browser Compatibility

| Feature | Chrome | Edge | Safari | Firefox |
|---------|--------|------|--------|---------|
| Timer & counter | ✅ | ✅ | ✅ | ✅ |
| Voice detection | ✅ | ✅ | ✅ 15+ | ❌ |

Users on unsupported browsers can still use manual counting.

---

## Database

The plugin creates a single table: `{prefix}mantra_sessions`

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT | Auto-increment primary key |
| `user_id` | BIGINT | WordPress user ID (0 = guest) |
| `session_date` | DATETIME | When session ended |
| `duration_sec` | INT | Total seconds |
| `mantra_count` | INT | Mantras counted |
| `notes` | TEXT | Optional user notes |

---

## Shortcode Usage Example

```
[mantra_meditation target="108"]
```

Place this on a dedicated "Meditation" page for a focused, distraction-free practice space.
