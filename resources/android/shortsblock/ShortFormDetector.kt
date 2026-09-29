package `in`.satym.studybuddy.shortsblock

/**
 * Interface for traversing accessibility node trees, decoupled from Android
 * so the detection rules can be tested without an emulator.
 */
interface AccessibilityNodeView {
    val viewIdResourceName: String?
    val text: CharSequence?
    val contentDescription: CharSequence?
    fun childCount(): Int
    fun childAt(index: Int): AccessibilityNodeView?
    fun recycle()
}

/**
 * Platform-specific short-form video detection rules.
 *
 * Each supported app has one or more heuristics based on view IDs, text labels,
 * or content descriptions that appear when short-form content is being displayed.
 * Generic rules let the user extend detection to apps not explicitly listed here.
 *
 * Why this exists:
 * Short-form video feeds (YouTube Shorts, Instagram Reels, TikTok FYP) share a
 * common pattern: they are designed for rapid, endless scrolling and often trap
 * the user into minutes or hours of viewing. Recognizing when one of these feeds
 * is active allows StudyBuddy to offer an intervention before the user has fully
 * context-switched out of study mode.
 *
 * Accuracy:
 * These rules are heuristic, not guaranteed. View IDs may change across app updates,
 * and apps may add or rename features. False positives (blocking non-shorts content)
 * are rare but possible; false negatives (missing new short-form patterns) are
 * more common. When in doubt, we err toward fewer false positives to avoid annoying
 * the user during legitimate use.
 */
object ShortFormDetector {
    // Package names for known platforms
    private const val PKG_YOUTUBE = "com.google.android.youtube"
    private const val PKG_INSTAGRAM = "com.instagram.android"
    private const val PKG_FACEBOOK = "com.facebook.katana"
    private const val PKG_SNAPCHAT = "com.snapchat.android"

    /**
     * Detection rules for YouTube Shorts.
     *
     * Rules:
     * - View IDs containing: reel_recycler, reel_player, shorts_player, reel_watch
     * - Tab text matching "Shorts" (case-insensitive)
     */
    private val youtubeRules = listOf(
        "reel_recycler", "reel_player", "shorts_player", "reel_watch"
    )

    /**
     * Detection rules for Instagram Reels/Clips.
     *
     * Rules:
     * - View IDs containing: clips_viewer, clips_tab, reel_viewer
     */
    private val instagramRules = listOf(
        "clips_viewer", "clips_tab", "reel_viewer"
    )

    /**
     * Detection rules for Facebook Reels.
     *
     * Rules:
     * - View IDs containing: reels
     * - Content descriptions matching "Reels" (case-insensitive)
     */
    private val facebookRules = listOf("reels")

    /**
     * Detection rules for Snapchat Spotlight.
     *
     * Rules:
     * - View IDs containing: spotlight
     */
    private val snapchatRules = listOf("spotlight")

    /**
     * Scan a node tree and detect if short-form content is being displayed.
     *
     * @param root The root accessibility node to start scanning from.
     * @param packageName The foreground app's package name.
     * @param config The current blocking configuration.
     * @param maxNodes Hard cap on nodes scanned to prevent hanging on complex trees.
     * @param maxDepth Hard cap on tree depth.
     * @return True if a short-form pattern is detected and blocking is enabled for that platform.
     */
    fun detect(
        root: AccessibilityNodeView,
        packageName: String,
        config: ShortsBlockConfig,
        maxNodes: Int = 400,
        maxDepth: Int = 25
    ): Boolean {
        val platformEnabled = when (packageName) {
            PKG_YOUTUBE -> config.youtubeEnabled
            PKG_INSTAGRAM -> config.instagramEnabled
            PKG_FACEBOOK -> config.facebookEnabled
            PKG_SNAPCHAT -> config.snapchatEnabled
            else -> config.customIdRules.containsKey(packageName)
        }
        if (!platformEnabled) return false

        val rules = when (packageName) {
            PKG_YOUTUBE -> youtubeRules
            PKG_INSTAGRAM -> instagramRules
            PKG_FACEBOOK -> facebookRules
            PKG_SNAPCHAT -> snapchatRules
            else -> config.customIdRules[packageName] ?: emptyList()
        }

        if (rules.isEmpty()) return false

        var scanned = 0
        val queue = ArrayDeque<Pair<AccessibilityNodeView, Int>>()
        queue.add(Pair(root, 0))

        while (queue.isNotEmpty() && scanned < maxNodes) {
            val (node, depth) = queue.removeFirst()
            scanned += 1

            val detected = checkNode(node, packageName, rules)
            if (detected) {
                return true
            }

            if (depth < maxDepth) {
                val children = node.childCount()
                for (i in 0 until children) {
                    val child = node.childAt(i)
                    if (child != null) {
                        queue.add(Pair(child, depth + 1))
                    }
                }
            }
        }

        return false
    }

    /**
     * Check a single node against platform-specific rules.
     */
    private fun checkNode(node: AccessibilityNodeView, packageName: String, rules: List<String>): Boolean {
        val id = node.viewIdResourceName?.lowercase() ?: ""
        val text = node.text?.toString()?.lowercase() ?: ""
        val desc = node.contentDescription?.toString()?.lowercase() ?: ""

        // YouTube-specific: check for "Shorts" tab text
        if (packageName == PKG_YOUTUBE && text.contains("shorts")) {
            return true
        }

        // Facebook-specific: check content descriptions for "Reels"
        if (packageName == PKG_FACEBOOK && desc.contains("reels")) {
            return true
        }

        // Generic ID-based rules for all platforms
        for (rule in rules) {
            if (id.contains(rule.lowercase())) {
                return true
            }
        }

        return false
    }
}
