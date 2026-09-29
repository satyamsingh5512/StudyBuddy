package `in`.satym.studybuddy.shortsblock

/**
 * Browser short-form URL detection.
 *
 * Why this exists:
 * Short-form video feeds are not limited to native apps. YouTube Shorts, Instagram
 * Reels, TikTok, and Facebook Reels are all accessible via mobile web browsers, and
 * blocking only the native apps leaves an obvious escape hatch. Checking browser
 * address bars lets StudyBuddy detect and block these feeds regardless of how the
 * user accesses them.
 *
 * Supported browsers:
 * - Chrome (com.android.chrome)
 * - Samsung Internet (com.sec.android.app.sbrowser)
 * - Firefox (org.mozilla.firefox)
 * - Microsoft Edge (com.microsoft.emmx)
 * - Brave (com.brave.browser)
 * - Opera (com.opera.browser)
 *
 * Privacy:
 * Only the address bar text is read, and only while the user is in a browser. The
 * URL is matched against a fixed list of patterns and immediately discarded. URLs
 * are never logged, persisted, or transmitted. Only a counter of "short-form URLs
 * blocked" is stored.
 */
object BrowserShortsRule {
    /**
     * Browser package name -> address bar view ID resource name substring.
     */
    private val BROWSER_ADDRESS_BAR_IDS = mapOf(
        "com.android.chrome" to "url_bar",
        "com.sec.android.app.sbrowser" to "location_bar_edit_text",
        "org.mozilla.firefox" to "mozac_browser_toolbar_url_view",
        "com.microsoft.emmx" to "url_bar",
        "com.brave.browser" to "url_bar",
        "com.opera.browser" to "url_field"
    )

    /**
     * Short-form URL patterns: host + path prefix.
     * Normalized to lowercase for case-insensitive matching.
     */
    private val SHORT_FORM_PATTERNS = listOf(
        "youtube.com/shorts",
        "m.youtube.com/shorts",
        "instagram.com/reel",
        "instagram.com/reels",
        "facebook.com/reel",
        "m.facebook.com/reel",
        "tiktok.com"
    )

    /**
     * Check if [packageName] is a supported browser.
     */
    fun isBrowser(packageName: String): Boolean =
        BROWSER_ADDRESS_BAR_IDS.containsKey(packageName)

    /**
     * Scan a node tree for the browser's address bar and check if it contains a
     * short-form URL.
     *
     * @param root The root accessibility node to start scanning from.
     * @param packageName The browser's package name.
     * @param maxNodes Hard cap on nodes scanned to prevent hanging.
     * @return The detected URL if it matches a short-form pattern, null otherwise.
     */
    fun detectUrl(
        root: AccessibilityNodeView,
        packageName: String,
        maxNodes: Int = 100
    ): String? {
        val addressBarId = BROWSER_ADDRESS_BAR_IDS[packageName] ?: return null

        var scanned = 0
        val queue = ArrayDeque<AccessibilityNodeView>()
        queue.add(root)

        while (queue.isNotEmpty() && scanned < maxNodes) {
            val node = queue.removeFirst()
            scanned += 1

            // Check if this node is the address bar
            val id = node.viewIdResourceName?.lowercase() ?: ""
            if (id.contains(addressBarId.lowercase())) {
                val url = (node.text?.toString() ?: node.contentDescription?.toString() ?: "")
                    .lowercase()
                    .trim()
                if (matchesShortForm(url)) {
                    // Return only a sanitized indicator, not the full URL
                    return "short-form"
                }
            }

            // Continue searching
            for (i in 0 until node.childCount()) {
                val child = node.childAt(i)
                if (child != null) queue.add(child)
            }
        }

        return null
    }

    /**
     * Check if a URL matches any short-form pattern.
     */
    private fun matchesShortForm(url: String): Boolean {
        // Strip scheme if present
        val normalized = url.removePrefix("https://").removePrefix("http://")
        return SHORT_FORM_PATTERNS.any { normalized.contains(it) }
    }
}
