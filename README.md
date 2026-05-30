# Japa Meditation Online — WordPress Plugin

A focused Hare Krishna maha-mantra tracker with real-time voice recognition, guided chanting pace mode, session history, and multilingual support.

---

## Features

- **Voice detection** — Google Web Speech API listens in `hi-IN` (Hindi/Sanskrit) and counts each complete maha-mantra automatically.
- **Guided Chanting** — Highlights the 16 mantra words in sequence at Slow / Medium / Fast tempo. Chant along hands-free.
- **Manual counting** — Tap the button (or ↑ / Space on desktop) to count at your own pace.
- **Progress ring** — Animated SVG ring tracks progress toward 108 rounds (one full mala).
- **Session timer** — Elapsed time shown in MM:SS.
- **Session modal** — Review rounds and duration, add notes, then save or discard.
- **Session history** — Last 10 sessions stored in the browser. Expires after 24 hours. No database or login required.
- **Multilingual** — All UI labels and mantra words translate via the `lang` shortcode attribute. Hebrew included (RTL layout applied automatically).
- **Auto-end** — Session ends automatically after 1 minute of inactivity.

---

## Installation

1. Upload the `japa-meditation-online/` folder to `/wp-content/plugins/`.
2. Activate in **WordPress Admin → Plugins**.
3. Add `[mantra_meditation]` to any page or post.

---

## Shortcode

```
[mantra_meditation]
[mantra_meditation lang="he-IL"]
```

### Attribute

| Attribute | Default | Description |
|-----------|---------|-------------|
| `lang` | `en` | UI language code. Controls labels, mantra word display, and RTL layout. Voice recognition is always `hi-IN` regardless of this setting. |

**Target is hardcoded to 108** — one full mala. Not configurable via shortcode.

---

## Counting Logic

The full Hare Krishna maha-mantra has **16 words**:

> Hare Krishna Hare Krishna Krishna Krishna Hare Hare  
> Hare Rama Hare Rama Rama Rama Hare Hare

One **round** = 16 consecutive mantra words detected. The word position is carried across recognition results, so pausing mid-mantra does not lose progress. Unrecognised sounds (noise, breath) are ignored and do not reset the streak.

---

## Modes

| Mode | How it works |
|------|-------------|
| **Manual** | Tap "+ Count Mantra" or press ↑ / Space. First tap also starts the session. |
| **Auto Detection** | Toggle on Google Voice (hi-IN). Listens continuously; increments on every completed 16-word cycle. Starts the session automatically. |
| **Guided Chanting** | Pick Slow / Medium / Fast, press Play. Each word lights up in sequence at the chosen interval; count increments every 16 words. Starts the session automatically. |

---

## Session History

- Stored in **localStorage** — no server, no account required.
- Limited to the **last 10 sessions**.
- Each session expires after **24 hours**.
- Cleared on browser data reset.

---

## Multilingual

The default language is English. Use the `lang` attribute to switch:

```
[mantra_meditation lang="he-IL"]   → Hebrew, RTL layout
```

To add a new language, open `japa-meditation-online.php` and add an entry to the `$translations` array inside `mm_get_strings()`:

```php
'fr' => [
    'title'            => 'Méditation Japa',
    'mantras_label'    => 'mantras',
    'end_session'      => 'Terminer',
    'reset'            => 'Réinitialiser',
    'mode_manual'      => 'Manuel',
    'count_mantra'     => '+ Compter Mantra',
    'mode_auto'        => 'Détection automatique',
    'enable_voice'     => 'Activer la voix',
    'voice_off'        => 'Inactif',
    'mode_guided'      => 'Chant guidé',
    'slow'             => 'Lent',
    'medium'           => 'Moyen',
    'fast'             => 'Rapide',
    'play'             => '▶ Démarrer',
    'pause'            => '⏸ Pause',
    'history_title'    => 'Historique',
    'history_empty'    => 'Aucune session. Commencez votre pratique.',
    'modal_title'      => 'Session terminée',
    'modal_subtitle'   => 'Hare Krishna',
    'rounds'           => 'Tours',
    'duration'         => 'Durée',
    'notes_label'      => 'Notes',
    'notes_optional'   => '(optionnel)',
    'notes_placeholder'=> 'Comment était votre pratique ?…',
    'save'             => 'Enregistrer',
    'discard'          => 'Annuler',
    'voice_off_status' => 'Détection vocale désactivée',
    'listening'        => 'À l\'écoute…',
    'recognising'      => 'Reconnaissance…',
    'detected'         => '🙏 Mantra compté !',
    'no_support'       => '⚠ Reconnaissance vocale non supportée',
    'mic_denied'       => '⚠ Accès au microphone refusé',
    'session_label'    => 'Session',
    'stat_rounds'      => 'tours',
    'stat_duration'    => 'durée',
    'word_hare'        => 'Hare',
    'word_krishna'     => 'Krishna',
    'word_rama'        => 'Rama',
],
```

Then use `[mantra_meditation lang="fr-FR"]`.

---

## Browser Compatibility

| Feature | Chrome | Edge | Safari 15+ | Firefox |
|---------|--------|------|-----------|---------|
| Timer, counter, pace mode | ✅ | ✅ | ✅ | ✅ |
| Voice detection (Auto mode) | ✅ | ✅ | ✅ | ❌ |

Firefox users can use Manual or Guided Chanting mode instead.

---

## Voice Recognition Notes

- Recognition language is hardcoded to `hi-IN` — this gives the best accuracy for Sanskrit mantra words.
- The browser will request **microphone permission** on first use of Auto Detection.
- Recognition runs **continuously** in the background. The counter updates as full 16-word cycles are completed.
- Supported in Chrome, Edge, and Safari 15+.
