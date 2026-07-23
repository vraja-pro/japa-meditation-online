<?php
/**
 * Plugin Name: Japa Meditation Online
 * Plugin URI:  https://example.com/japa-meditation-online
 * Description: Japa meditation tracker with voice detection. Accurately recognises Hare Krishna mantra in real time.
 * Version:     2.0.0
 * Author:      Vraja Das
 * License:     GPL-2.0+
 * Text Domain: japa-online
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'MM_VERSION',    '2.0.1' );
define( 'MM_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'MM_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

/* ──────────────────────────────────────────────
   1. ACTIVATION – create DB table
   ────────────────────────────────────────────── */
register_activation_hook( __FILE__, 'mm_activate' );
function mm_activate() {
    global $wpdb;
    $table   = $wpdb->prefix . 'mantra_sessions';
    $charset = $wpdb->get_charset_collate();
    $sql = "CREATE TABLE IF NOT EXISTS {$table} (
        id            BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id       BIGINT(20) UNSIGNED NOT NULL DEFAULT 0,
        session_date  DATETIME            NOT NULL,
        duration_sec  INT(11)             NOT NULL DEFAULT 0,
        mantra_count  INT(11)             NOT NULL DEFAULT 0,
        notes         TEXT,
        PRIMARY KEY (id),
        KEY user_id (user_id)
    ) {$charset};";
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta( $sql );
}

/* ──────────────────────────────────────────────
   2. ENQUEUE ASSETS
   ────────────────────────────────────────────── */
add_action( 'wp_enqueue_scripts', 'mm_enqueue' );
function mm_enqueue() {
    global $post;
    if ( ! is_a( $post, 'WP_Post' ) || ! has_shortcode( $post->post_content, 'mantra_meditation' ) ) return;

    wp_enqueue_style(  'jmo-style', MM_PLUGIN_URL . 'assets/style.css', [], time() );
    wp_enqueue_script( 'jmo-app',   MM_PLUGIN_URL . 'assets/app.js',   [], time(), true );
}

/* ──────────────────────────────────────────────
   3. SHORTCODE  [mantra_meditation]
   ────────────────────────────────────────────── */
function mm_get_strings( $lang_base ) {
    $en = [
        'title'            => 'Japa Meditation Online',
        'mantras_label'    => 'mantras',
        'end_session'      => 'End Session',
        'reset'            => 'Reset',
        'mode_manual'      => 'Manual',
        'count_mantra'     => '+ Count Mantra',
        'lock_tap'         => 'Lock Tap',
        'unlock_tap'       => 'Unlock Tap',
        'mode_auto'        => 'Auto Detection',
        'enable_voice'     => 'Enable Google Voice',
        'voice_off'        => 'Off',
        'mode_guided'      => 'Guided Chanting',
        'slow'             => 'Slow',
        'medium'           => 'Medium',
        'fast'             => 'Fast',
        'play'             => '▶ Play',
        'pause'            => '⏸ Pause',
        'history_title'    => 'Session History',
        'history_empty'    => 'No sessions yet. Begin your practice.',
        'modal_title'      => 'Session Complete',
        'modal_subtitle'   => 'Hare Krishna',
        'rounds'           => 'Rounds',
        'duration'         => 'Duration',
        'notes_label'      => 'Notes',
        'notes_optional'   => '(optional)',
        'notes_placeholder'=> 'How was your practice?…',
        'save'             => 'Save Session',
        'dismiss'          => 'Dismiss',
        'discard'          => 'Discard',
        'voice_off_status' => 'Voice detection off',
        'listening'        => 'Listening…',
        'recognising'      => 'Recognising…',
        'detected'         => 'Mantra counted!',
        'no_support'       => '⚠ Voice recognition not supported in this browser',
        'mic_denied'       => '⚠ Microphone access denied',
        'session_label'    => 'Session',
        'stat_rounds'      => 'rounds',
        'stat_duration'    => 'duration',
        'word_hare'        => 'Hare',
        'word_krishna'     => 'Krishna',
        'word_rama'        => 'Rama',
        'total'            => 'Total',
        'auto_saved_inactivity' => 'Auto-saved after inactivity',
    ];

    $translations = [
        'he' => [
            'title'            => 'מדיטציית ג׳פּה אונליין',
            'mantras_label'    => 'מנטרות',
            'end_session'      => 'סיום תרגול',
            'reset'            => 'איפוס',
            'mode_manual'      => 'ידני',
            'count_mantra'     => '+ ספור מנטרה',
            'lock_tap'         => 'נעל הקשה',
            'unlock_tap'       => 'בטל נעילה',
            'mode_auto'        => 'זיהוי קולי',
            'enable_voice'     => 'הפעל זיהוי קול',
            'voice_off'        => 'כבוי',
            'mode_guided'      => 'שינון מודרך',
            'slow'             => 'איטי',
            'medium'           => 'בינוני',
            'fast'             => 'מהיר',
            'play'             => '▶ התחל',
            'pause'            => '⏸ השהה',
            'history_title'    => 'היסטוריה',
            'history_empty'    => 'אין תרגולים עדיין. התחל את התרגול.',
            'modal_title'      => 'התרגול הסתיים',
            'modal_subtitle'   => 'הרא קרישנה',
            'rounds'           => 'סיבובים',
            'duration'         => 'משך',
            'notes_label'      => 'הערות',
            'notes_optional'   => '(אופציונלי)',
            'notes_placeholder'=> 'איך היה התרגול?…',
            'save'             => 'שמור תרגול',
            'dismiss'          => 'סגור',
            'discard'          => 'בטל',
            'voice_off_status' => 'זיהוי קול כבוי',
            'listening'        => 'מאזין…',
            'recognising'      => 'מזהה…',
            'detected'         => 'מנטרה נספרה!',
            'no_support'       => '⚠ זיהוי קול אינו נתמך בדפדפן זה',
            'mic_denied'       => '⚠ גישה למיקרופון נדחתה',
            'session_label'    => 'תרגול',
            'stat_rounds'      => 'סיבובים',
            'stat_duration'    => 'משך',
            'word_hare'        => 'הַרֵא',
            'word_krishna'     => 'קְרִישְנָה',
            'word_rama'        => 'רָאמַה',
            'total'            => 'סה"כ',
            'auto_saved_inactivity' => 'נשמר אוטומטית לאחר חוסר פעילות',
        ],
    ];

    return array_merge( $en, $translations[ $lang_base ] ?? [] );
}

add_shortcode( 'mantra_meditation', 'mm_shortcode' );
function mm_shortcode( $atts ) {
    $atts = shortcode_atts( [ 'lang' => 'en' ], $atts, 'mantra_meditation' );

    $lang      = esc_attr( $atts['lang'] );
    $lang_base = strtolower( explode( '-', $lang )[0] );
    $dir       = in_array( $lang_base, [ 'he', 'ar', 'fa', 'ur' ] ) ? 'rtl' : 'ltr';
    $s         = mm_get_strings( $lang_base );

    ob_start(); ?>
    <script>window.JMO_I18N = <?php echo wp_json_encode( $s ); ?>;</script>
    <div id="jmo-root" data-lang="<?php echo $lang; ?>" dir="<?php echo $dir; ?>">

        <div class="jmo-header">
            <h1 class="jmo-title"><?php echo esc_html( $s['title'] ); ?></h1>
        </div>

        <div class="jmo-layout">
        <div class="jmo-main">

        <div class="jmo-ring-wrap">
            <svg class="jmo-ring" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg">
                <circle class="jmo-ring-bg"       cx="110" cy="110" r="96"/>
                <circle class="jmo-ring-progress" cx="110" cy="110" r="96" id="jmo-progress-circle"/>
            </svg>
            <div class="jmo-ring-inner">
                <div class="jmo-count" id="jmo-count">0</div>
                <div class="jmo-count-label"><?php echo esc_html( $s['mantras_label'] ); ?></div>
                <div class="jmo-rounds-display">
                    <span id="jmo-rounds">0</span>
                    <span class="jmo-rounds-label"><?php echo esc_html( $s['stat_rounds'] ); ?></span>
                </div>
                <div class="jmo-timer" id="jmo-timer">00:00</div>
            </div>
        </div>

        <div class="jmo-transcript" id="jmo-transcript"></div>

        <div class="jmo-controls">
            <button class="jmo-btn jmo-btn-secondary" id="jmo-stop-btn" disabled>
                <span class="jmo-btn-icon">■</span> <?php echo esc_html( $s['end_session'] ); ?>
            </button>
            <button class="jmo-btn jmo-btn-reset" id="jmo-reset-btn">↺ <?php echo esc_html( $s['reset'] ); ?></button>
        </div>

        </div><!-- .jmo-main -->
        <div class="jmo-sidebar">

        <div class="jmo-modes">

            <div class="jmo-mode">
                <span class="jmo-mode-label"><?php echo esc_html( $s['mode_manual'] ); ?></span>
                <div class="jmo-manual-row">
                    <button class="jmo-btn jmo-btn-primary jmo-manual-btn" id="jmo-manual-btn">
                        <?php echo esc_html( $s['count_mantra'] ); ?> &nbsp;<span class="jmo-kbd">↑</span><span class="jmo-or"> / </span><span class="jmo-kbd">Space</span>
                    </button>
                    <button class="jmo-btn jmo-btn-secondary jmo-lock-btn" id="jmo-lock-toggle" type="button" aria-pressed="false">
                        <?php echo esc_html( $s['lock_tap'] ); ?>
                    </button>
                </div>
            </div>

            <div class="jmo-mode">
                <span class="jmo-mode-label"><?php echo esc_html( $s['mode_auto'] ); ?></span>
                <div class="jmo-mode-row">
                    <label class="jmo-toggle-wrap">
                        <input type="checkbox" id="jmo-voice-toggle" />
                        <span class="jmo-toggle-slider"></span>
                        <span class="jmo-toggle-label"><?php echo esc_html( $s['enable_voice'] ); ?></span>
                    </label>
                    <div class="jmo-voice-status" id="jmo-voice-status">
                        <div class="jmo-pulse" id="jmo-pulse"></div>
                        <span id="jmo-voice-text"><?php echo esc_html( $s['voice_off'] ); ?></span>
                        <span id="jmo-lang-badge" class="jmo-lang-badge"></span>
                    </div>
                </div>
            </div>

            <div class="jmo-mode">
                <span class="jmo-mode-label"><?php echo esc_html( $s['mode_guided'] ); ?></span>
                <div class="jmo-pace-btns" id="jmo-pace-btns">
                    <button class="jmo-pace-btn" data-pace="slow"><?php echo esc_html( $s['slow'] ); ?></button>
                    <button class="jmo-pace-btn jmo-pace-selected" data-pace="medium"><?php echo esc_html( $s['medium'] ); ?></button>
                    <button class="jmo-pace-btn" data-pace="fast"><?php echo esc_html( $s['fast'] ); ?></button>
                </div>
                <div class="jmo-pace-controls">
                    <button class="jmo-btn jmo-btn-primary jmo-pace-play" id="jmo-pace-play"><?php echo esc_html( $s['play'] ); ?></button>
                    <button class="jmo-btn jmo-btn-secondary jmo-pace-pause" id="jmo-pace-pause" disabled><?php echo esc_html( $s['pause'] ); ?></button>
                </div>
            </div>

        </div>

        <div class="jmo-history-wrap">
            <h3 class="jmo-history-title"><?php echo esc_html( $s['history_title'] ); ?></h3>
            <div class="jmo-history" id="jmo-history">
                <p class="jmo-history-empty"><?php echo esc_html( $s['history_empty'] ); ?></p>
            </div>
        </div>

        </div><!-- .jmo-sidebar -->
        </div><!-- .jmo-layout -->

        <div class="jmo-modal-overlay" id="jmo-modal" aria-hidden="true">
        <div class="jmo-modal">
            <div class="jmo-modal-header">
                <div class="jmo-modal-om">ॐ</div>
                <h2 class="jmo-modal-title"><?php echo esc_html( $s['modal_title'] ); ?></h2>
                <p class="jmo-modal-subtitle"><?php echo esc_html( $s['modal_subtitle'] ); ?></p>
            </div>
            <div class="jmo-modal-stats">
                <div class="jmo-modal-stat">
                    <span class="jmo-modal-num" id="jmo-modal-count">0</span>
                    <span class="jmo-modal-lbl"><?php echo esc_html( $s['mantras_label'] ); ?></span>
                </div>
                <div class="jmo-modal-stat-divider"></div>
                <div class="jmo-modal-stat">
                    <span class="jmo-modal-num" id="jmo-modal-rounds">0</span>
                    <span class="jmo-modal-lbl"><?php echo esc_html( $s['stat_rounds'] ); ?></span>
                </div>
                <div class="jmo-modal-stat-divider"></div>
                <div class="jmo-modal-stat">
                    <span class="jmo-modal-num" id="jmo-modal-time">0:00</span>
                    <span class="jmo-modal-lbl"><?php echo esc_html( $s['duration'] ); ?></span>
                </div>
            </div>
            <div class="jmo-modal-notes-wrap">
                <label class="jmo-modal-notes-label" for="jmo-notes"><?php echo esc_html( $s['notes_label'] ); ?> <span><?php echo esc_html( $s['notes_optional'] ); ?></span></label>
                <textarea class="jmo-notes" id="jmo-notes" placeholder="<?php echo esc_attr( $s['notes_placeholder'] ); ?>" rows="3"></textarea>
            </div>
            <div class="jmo-modal-actions">
                <button class="jmo-btn jmo-btn-primary" id="jmo-save-btn"><?php echo esc_html( $s['save'] ); ?></button>
                <button class="jmo-btn jmo-btn-secondary" id="jmo-dismiss-btn"><?php echo esc_html( $s['dismiss'] ); ?></button>
                <button class="jmo-btn jmo-btn-ghost"   id="jmo-discard-btn"><?php echo esc_html( $s['discard'] ); ?></button>
            </div>
        </div>

    </div>
    <?php
    return ob_get_clean();
}

/* ──────────────────────────────────────────────
   AUTH UI  (shown to logged-out visitors)
   ────────────────────────────────────────────── */
/* ──────────────────────────────────────────────
   4. ADMIN – Settings page
   ────────────────────────────────────────────── */
add_action( 'admin_menu', 'mm_admin_menu' );
function mm_admin_menu() {
    add_menu_page( 'Mantra Meditation', 'Mantra Meditation', 'manage_options', 'mantra-meditation', 'mm_admin_page', 'dashicons-heart', 30 );
}

function mm_admin_page() { ?>
    <div class="wrap">
        <h1>Mantra Meditation</h1>
        <p>Use shortcode <code>[mantra_meditation]</code> on any page.</p>
        <p>Session history is stored in each visitor's browser (localStorage).</p>
    </div>
    <?php
}
