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

    wp_enqueue_style(  'mm-style', MM_PLUGIN_URL . 'assets/style.css', [], time() );
    wp_enqueue_script( 'mm-app',   MM_PLUGIN_URL . 'assets/app.js',   [], time(), true );
}

/* ──────────────────────────────────────────────
   3. SHORTCODE  [mantra_meditation]
   ────────────────────────────────────────────── */
add_shortcode( 'mantra_meditation', 'mm_shortcode' );
function mm_shortcode( $atts ) {
    $atts = shortcode_atts( [ 'target' => 108 ], $atts, 'mantra_meditation' );

    ob_start(); ?>
    <div id="mm-root" data-target="<?php echo esc_attr( $atts['target'] ); ?>">

        <div class="mm-header">
            <div class="mm-om">हरि कृष्ण</div>
            <h1 class="mm-title">Japa Meditation Online</h1>
        </div>

        <div class="mm-ring-wrap">
            <svg class="mm-ring" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg">
                <circle class="mm-ring-bg"       cx="110" cy="110" r="96"/>
                <circle class="mm-ring-progress" cx="110" cy="110" r="96" id="mm-progress-circle"/>
            </svg>
            <div class="mm-ring-inner">
                <div class="mm-count" id="mm-count">0</div>
                <div class="mm-count-label">mantras</div>
                <div class="mm-timer" id="mm-timer">00:00</div>
            </div>
        </div>

        <div class="mm-transcript" id="mm-transcript"></div>

        <div class="mm-controls">
            <button class="mm-btn mm-btn-secondary" id="mm-stop-btn" disabled>
                <span class="mm-btn-icon">■</span> End Session
            </button>
            <button class="mm-btn mm-btn-reset"     id="mm-reset-btn">↺ Reset</button>
        </div>
        <div class="mm-modes">

            <div class="mm-mode">
                <span class="mm-mode-label">Manual</span>
                <button class="mm-btn mm-btn-primary mm-manual-btn" id="mm-manual-btn">
                    + Count Mantra &nbsp;<span class="mm-kbd">↑</span><span class="mm-or"> or </span><span class="mm-kbd">Space</span>
                </button>
            </div>

            <div class="mm-mode">
                <span class="mm-mode-label">Auto Detection</span>
                <div class="mm-mode-row">
                    <label class="mm-toggle-wrap">
                        <input type="checkbox" id="mm-voice-toggle" />
                        <span class="mm-toggle-slider"></span>
                        <span class="mm-toggle-label">Enable Google Voice</span>
                    </label>
                    <div class="mm-voice-status" id="mm-voice-status">
                        <div class="mm-pulse" id="mm-pulse"></div>
                        <span id="mm-voice-text">Off</span>
                        <span id="mm-lang-badge" class="mm-lang-badge"></span>
                    </div>
                </div>
            </div>

            <div class="mm-mode">
                <span class="mm-mode-label">Guided Chanting</span>
                <div class="mm-pace-btns" id="mm-pace-btns">
                    <button class="mm-pace-btn" data-pace="slow">Slow</button>
                    <button class="mm-pace-btn mm-pace-selected" data-pace="medium">Medium</button>
                    <button class="mm-pace-btn" data-pace="fast">Fast</button>
                </div>
                <div class="mm-pace-controls">
                    <button class="mm-btn mm-btn-primary mm-pace-play" id="mm-pace-play">▶ Play</button>
                    <button class="mm-btn mm-btn-secondary mm-pace-pause" id="mm-pace-pause" disabled>⏸ Pause</button>
                </div>
            </div>

        </div>

       

        <div class="mm-history-wrap">
            <h3 class="mm-history-title">Session History</h3>
            <div class="mm-history" id="mm-history">
                <p class="mm-history-empty">No sessions yet. Begin your practice.</p>
            </div>
        </div>

        <div class="mm-modal-overlay" id="mm-modal" aria-hidden="true">
        <div class="mm-modal">
            <div class="mm-modal-header">
                <div class="mm-modal-om">ॐ</div>
                <h2 class="mm-modal-title">Session Complete</h2>
                <p class="mm-modal-subtitle">Hare Krishna</p>
            </div>
            <div class="mm-modal-stats">
                <div class="mm-modal-stat">
                    <span class="mm-modal-num" id="mm-modal-count">0</span>
                    <span class="mm-modal-lbl">Rounds</span>
                </div>
                <div class="mm-modal-stat-divider"></div>
                <div class="mm-modal-stat">
                    <span class="mm-modal-num" id="mm-modal-time">0:00</span>
                    <span class="mm-modal-lbl">Duration</span>
                </div>
            </div>
            <div class="mm-modal-notes-wrap">
                <label class="mm-modal-notes-label" for="mm-notes">Notes <span>(optional)</span></label>
                <textarea class="mm-notes" id="mm-notes" placeholder="How was your practice?…" rows="3"></textarea>
            </div>
            <div class="mm-modal-actions">
                <button class="mm-btn mm-btn-primary" id="mm-save-btn">Save Session</button>
                <button class="mm-btn mm-btn-ghost"   id="mm-discard-btn">Discard</button>
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
        <h1>🕉 Mantra Meditation</h1>
        <p>Use shortcode <code>[mantra_meditation]</code> on any page.</p>
        <p>Session history is stored in each visitor's browser (localStorage).</p>
    </div>
    <?php
}
