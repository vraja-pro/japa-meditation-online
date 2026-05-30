<?php
/**
 * Plugin Name: Mantra Meditation Counter
 * Plugin URI:  https://example.com/mantra-meditation
 * Description: Mantra meditation tracker with OpenAI Whisper voice detection. Accurately recognises "Rama Rama Hare Hare" in real time.
 * Version:     2.0.0
 * Author:      Your Name
 * License:     GPL-2.0+
 * Text Domain: mantra-meditation
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'MM_VERSION',    '2.0.0' );
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

    wp_enqueue_style(  'mm-style', MM_PLUGIN_URL . 'assets/style.css', [], MM_VERSION );
    wp_enqueue_script( 'mm-app',   MM_PLUGIN_URL . 'assets/app.js',   [], MM_VERSION, true );

    $api_key = get_option( 'mm_openai_api_key', '' );

    wp_localize_script( 'mm-app', 'MM_DATA', [
        'ajax_url'    => admin_url( 'admin-ajax.php' ),
        'nonce'       => wp_create_nonce( 'mm_nonce' ),
        'user_id'     => get_current_user_id(),
        'has_api_key' => ! empty( $api_key ),
    ]);
}

/* ──────────────────────────────────────────────
   3. SHORTCODE  [mantra_meditation]
   ────────────────────────────────────────────── */
add_shortcode( 'mantra_meditation', 'mm_shortcode' );
function mm_shortcode( $atts ) {
    $atts = shortcode_atts( [ 'target' => 108 ], $atts, 'mantra_meditation' );
    $has_key = ! empty( get_option( 'mm_openai_api_key', '' ) );

    ob_start(); ?>
    <div id="mm-root" data-target="<?php echo esc_attr( $atts['target'] ); ?>">

        <div class="mm-header">
            <div class="mm-om">ॐ</div>
            <h1 class="mm-title">Mantra Meditation</h1>
            <p class="mm-subtitle">Rama Rama Hare Hare</p>
        </div>

        <?php if ( ! $has_key ) : ?>
        <div class="mm-no-key">
            ⚠ No OpenAI API key configured.<br>
            <a href="<?php echo esc_url( admin_url( 'admin.php?page=mantra-meditation' ) ); ?>">Add your key in settings →</a>
        </div>
        <?php endif; ?>

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

        <div class="mm-voice-status" id="mm-voice-status">
            <div class="mm-pulse" id="mm-pulse"></div>
            <span id="mm-voice-text">Voice detection off</span>
            <span id="mm-lang-badge" class="mm-lang-badge"></span>
        </div>

        <div class="mm-transcript" id="mm-transcript"></div>

        <div class="mm-controls">
            <button class="mm-btn mm-btn-primary"   id="mm-start-btn">
                <span class="mm-btn-icon">▶</span> Begin Session
            </button>
            <button class="mm-btn mm-btn-secondary" id="mm-stop-btn" disabled>
                <span class="mm-btn-icon">■</span> End Session
            </button>
            <button class="mm-btn mm-btn-reset"     id="mm-reset-btn">↺ Reset</button>
        </div>

        <label class="mm-toggle-wrap">
            <input type="checkbox" id="mm-voice-toggle" <?php echo $has_key ? '' : 'disabled'; ?> />
            <span class="mm-toggle-slider"></span>
            <span class="mm-toggle-label">🎙 Auto-detect mantras (Whisper AI)</span>
        </label>

        <button class="mm-manual-btn" id="mm-manual-btn" disabled>
            + Count Mantra &nbsp;<span class="mm-kbd">↑</span> or <span class="mm-kbd">Space</span>
        </button>

        <div class="mm-history-wrap">
            <h3 class="mm-history-title">Session History</h3>
            <div class="mm-history" id="mm-history">
                <p class="mm-history-empty">No sessions yet. Begin your practice.</p>
            </div>
        </div>

        <div class="mm-modal-overlay" id="mm-modal" aria-hidden="true">
            <div class="mm-modal">
                <div class="mm-modal-om">ॐ</div>
                <h2>Session Complete</h2>
                <div class="mm-modal-stats">
                    <div class="mm-modal-stat">
                        <span class="mm-modal-num" id="mm-modal-count">0</span>
                        <span class="mm-modal-lbl">Mantras</span>
                    </div>
                    <div class="mm-modal-stat">
                        <span class="mm-modal-num" id="mm-modal-time">0:00</span>
                        <span class="mm-modal-lbl">Duration</span>
                    </div>
                </div>
                <textarea class="mm-notes" id="mm-notes" placeholder="Session notes (optional)…" rows="3"></textarea>
                <div class="mm-modal-actions">
                    <button class="mm-btn mm-btn-primary"   id="mm-save-btn">Save Session</button>
                    <button class="mm-btn mm-btn-secondary" id="mm-discard-btn">Discard</button>
                </div>
            </div>
        </div>

    </div>
    <?php
    return ob_get_clean();
}

/* ──────────────────────────────────────────────
   4. AJAX – WHISPER PROXY
   The browser sends a raw audio blob here.
   We forward it to OpenAI Whisper and return the transcript.
   The API key never leaves the server.
   ────────────────────────────────────────────── */
add_action( 'wp_ajax_mm_transcribe',        'mm_transcribe' );
add_action( 'wp_ajax_nopriv_mm_transcribe', 'mm_transcribe' );
function mm_transcribe() {
    check_ajax_referer( 'mm_nonce', 'nonce' );

    $api_key = get_option( 'mm_openai_api_key', '' );
    if ( empty( $api_key ) ) {
        wp_send_json_error( [ 'message' => 'No API key configured.' ] );
    }

    if ( empty( $_FILES['audio'] ) || $_FILES['audio']['error'] !== UPLOAD_ERR_OK ) {
        wp_send_json_error( [ 'message' => 'No audio received.' ] );
    }

    $tmp  = $_FILES['audio']['tmp_name'];
    $name = 'audio.webm';

    // Build multipart POST to OpenAI Whisper
    $boundary = wp_generate_uuid4();
    $body  = "--{$boundary}\r\n";
    $body .= "Content-Disposition: form-data; name=\"model\"\r\n\r\nwhisper-1\r\n";
    $body .= "--{$boundary}\r\n";
    $body .= "Content-Disposition: form-data; name=\"language\"\r\nContent-Type: text/plain\r\n\r\nhi\r\n";
    $body .= "--{$boundary}\r\n";
    $body .= "Content-Disposition: form-data; name=\"file\"; filename=\"{$name}\"\r\n";
    $body .= "Content-Type: audio/webm\r\n\r\n";
    $body .= file_get_contents( $tmp );
    $body .= "\r\n--{$boundary}--\r\n";

    $response = wp_remote_post( 'https://api.openai.com/v1/audio/transcriptions', [
        'timeout' => 20,
        'headers' => [
            'Authorization' => 'Bearer ' . $api_key,
            'Content-Type'  => "multipart/form-data; boundary={$boundary}",
        ],
        'body' => $body,
    ]);

    if ( is_wp_error( $response ) ) {
        wp_send_json_error( [ 'message' => $response->get_error_message() ] );
    }

    $code = wp_remote_retrieve_response_code( $response );
    $json = json_decode( wp_remote_retrieve_body( $response ), true );

    if ( $code !== 200 || empty( $json['text'] ) ) {
        wp_send_json_error( [ 'message' => $json['error']['message'] ?? 'Whisper error.' ] );
    }

    wp_send_json_success( [ 'text' => $json['text'] ] );
}

/* ──────────────────────────────────────────────
   5. AJAX – SAVE SESSION
   ────────────────────────────────────────────── */
add_action( 'wp_ajax_mm_save_session',        'mm_save_session' );
add_action( 'wp_ajax_nopriv_mm_save_session', 'mm_save_session' );
function mm_save_session() {
    check_ajax_referer( 'mm_nonce', 'nonce' );
    global $wpdb;
    $wpdb->insert( $wpdb->prefix . 'mantra_sessions', [
        'user_id'      => absint( $_POST['user_id'] ?? 0 ),
        'session_date' => current_time( 'mysql' ),
        'duration_sec' => absint( $_POST['duration'] ?? 0 ),
        'mantra_count' => absint( $_POST['count']    ?? 0 ),
        'notes'        => sanitize_textarea_field( $_POST['notes'] ?? '' ),
    ], [ '%d', '%s', '%d', '%d', '%s' ] );
    wp_send_json_success( [ 'id' => $wpdb->insert_id ] );
}

/* ──────────────────────────────────────────────
   6. AJAX – LOAD HISTORY
   ────────────────────────────────────────────── */
add_action( 'wp_ajax_mm_get_history',        'mm_get_history' );
add_action( 'wp_ajax_nopriv_mm_get_history', 'mm_get_history' );
function mm_get_history() {
    check_ajax_referer( 'mm_nonce', 'nonce' );
    global $wpdb;
    $rows = $wpdb->get_results( $wpdb->prepare(
        "SELECT * FROM {$wpdb->prefix}mantra_sessions WHERE user_id = %d ORDER BY session_date DESC LIMIT 10",
        absint( $_POST['user_id'] ?? 0 )
    ), ARRAY_A );
    wp_send_json_success( $rows );
}

/* ──────────────────────────────────────────────
   7. ADMIN – Settings page
   ────────────────────────────────────────────── */
add_action( 'admin_menu', 'mm_admin_menu' );
function mm_admin_menu() {
    add_menu_page( 'Mantra Meditation', 'Mantra Meditation', 'manage_options', 'mantra-meditation', 'mm_admin_page', 'dashicons-heart', 30 );
}

add_action( 'admin_init', 'mm_register_settings' );
function mm_register_settings() {
    register_setting( 'mm_settings', 'mm_openai_api_key', [
        'sanitize_callback' => 'sanitize_text_field',
    ]);
}

function mm_admin_page() {
    global $wpdb;
    $saved = isset( $_GET['settings-updated'] );
    $rows  = $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}mantra_sessions ORDER BY session_date DESC LIMIT 50", ARRAY_A );
    $key   = get_option( 'mm_openai_api_key', '' );
    ?>
    <div class="wrap">
        <h1>🕉 Mantra Meditation</h1>

        <?php if ( $saved ) : ?><div class="notice notice-success"><p>Settings saved.</p></div><?php endif; ?>

        <h2>Settings</h2>
        <form method="post" action="options.php">
            <?php settings_fields( 'mm_settings' ); ?>
            <table class="form-table">
                <tr>
                    <th><label for="mm_openai_api_key">OpenAI API Key</label></th>
                    <td>
                        <input type="password" id="mm_openai_api_key" name="mm_openai_api_key"
                               value="<?php echo esc_attr( $key ); ?>"
                               class="regular-text" placeholder="sk-..." />
                        <p class="description">
                            Required for Whisper voice detection.
                            Get your key at <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com/api-keys</a>.
                            The key is stored server-side and never exposed to the browser.
                        </p>
                    </td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>

        <h2>Session History</h2>
        <p>Use shortcode <code>[mantra_meditation]</code> on any page.</p>
        <table class="wp-list-table widefat fixed striped">
            <thead><tr><th>ID</th><th>User</th><th>Date</th><th>Duration</th><th>Mantras</th><th>Notes</th></tr></thead>
            <tbody>
            <?php if ( empty( $rows ) ) : ?>
                <tr><td colspan="6">No sessions yet.</td></tr>
            <?php else : foreach ( $rows as $r ) :
                $user = $r['user_id'] ? get_userdata( $r['user_id'] ) : false;
                $m = floor( $r['duration_sec'] / 60 ); $s = $r['duration_sec'] % 60;
            ?>
                <tr>
                    <td><?php echo esc_html( $r['id'] ); ?></td>
                    <td><?php echo $user ? esc_html( $user->user_login ) : 'Guest'; ?></td>
                    <td><?php echo esc_html( $r['session_date'] ); ?></td>
                    <td><?php printf( '%d:%02d', $m, $s ); ?></td>
                    <td><?php echo esc_html( $r['mantra_count'] ); ?></td>
                    <td><?php echo esc_html( $r['notes'] ); ?></td>
                </tr>
            <?php endforeach; endif; ?>
            </tbody>
        </table>
    </div>
    <?php
}
