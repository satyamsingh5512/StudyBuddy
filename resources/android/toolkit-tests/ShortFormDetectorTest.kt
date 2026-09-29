package `in`.satym.studybuddy.toolkit

import `in`.satym.studybuddy.shortsblock.AccessibilityNodeView
import `in`.satym.studybuddy.shortsblock.ShortFormDetector
import `in`.satym.studybuddy.shortsblock.ShortsBlockConfig
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Detection rules for short-form video feeds.
 *
 * These run on the JVM with no emulator because ShortFormDetector was written
 * against [AccessibilityNodeView] rather than AccessibilityNodeInfo. What matters
 * here is not that the rules match any particular app build — view ids change — but
 * that the switches actually gate detection, that an unrelated screen in a watched
 * app is left alone, and that the traversal honours its own node and depth budgets.
 */
class ShortFormDetectorTest {

    /** Minimal in-memory node tree. */
    private class FakeNode(
        override val viewIdResourceName: String? = null,
        override val text: CharSequence? = null,
        override val contentDescription: CharSequence? = null,
        private val children: List<FakeNode> = emptyList()
    ) : AccessibilityNodeView {
        var recycled = 0
            private set

        override fun childCount(): Int = children.size
        override fun childAt(index: Int): AccessibilityNodeView? = children.getOrNull(index)
        override fun recycle() {
            recycled += 1
        }

        fun countVisitedIds(): Int = 1 + children.sumOf { it.countVisitedIds() }
    }

    private fun chain(depth: Int, leaf: FakeNode): FakeNode {
        var node = leaf
        repeat(depth) { node = FakeNode(viewIdResourceName = "com.example:id/filler", children = listOf(node)) }
        return node
    }

    private val allOn = ShortsBlockConfig(
        youtubeEnabled = true,
        instagramEnabled = true,
        facebookEnabled = true,
        snapchatEnabled = true
    )

    @Test
    fun `youtube shorts player is detected by view id`() {
        val tree = FakeNode(
            children = listOf(
                FakeNode(viewIdResourceName = "com.google.android.youtube:id/watch_container"),
                FakeNode(viewIdResourceName = "com.google.android.youtube:id/reel_recycler")
            )
        )
        assertTrue(ShortFormDetector.detect(tree, YOUTUBE, allOn))
    }

    @Test
    fun `youtube shorts tab label is detected by text`() {
        val tree = FakeNode(children = listOf(FakeNode(text = "Shorts")))
        assertTrue(ShortFormDetector.detect(tree, YOUTUBE, allOn))
    }

    @Test
    fun `an ordinary youtube screen is left alone`() {
        val tree = FakeNode(
            children = listOf(
                FakeNode(viewIdResourceName = "com.google.android.youtube:id/watch_player", text = "Subscribe"),
                FakeNode(viewIdResourceName = "com.google.android.youtube:id/comments_entry_point")
            )
        )
        assertFalse(ShortFormDetector.detect(tree, YOUTUBE, allOn))
    }

    @Test
    fun `instagram reels viewer is detected`() {
        val tree = FakeNode(children = listOf(FakeNode(viewIdResourceName = "com.instagram.android:id/clips_viewer")))
        assertTrue(ShortFormDetector.detect(tree, INSTAGRAM, allOn))
    }

    @Test
    fun `facebook reels is detected via content description`() {
        val tree = FakeNode(children = listOf(FakeNode(contentDescription = "Reels")))
        assertTrue(ShortFormDetector.detect(tree, FACEBOOK, allOn))
    }

    @Test
    fun `snapchat spotlight is detected`() {
        val tree = FakeNode(children = listOf(FakeNode(viewIdResourceName = "com.snapchat.android:id/spotlight_page")))
        assertTrue(ShortFormDetector.detect(tree, SNAPCHAT, allOn))
    }

    @Test
    fun `a disabled platform is never detected even when the pattern is present`() {
        val tree = FakeNode(children = listOf(FakeNode(viewIdResourceName = "com.instagram.android:id/clips_viewer")))
        val onlyYoutube = allOn.copy(instagramEnabled = false)
        assertFalse(ShortFormDetector.detect(tree, INSTAGRAM, onlyYoutube))
        // The same config still watches YouTube, so the switch is per platform.
        assertTrue(
            ShortFormDetector.detect(
                FakeNode(children = listOf(FakeNode(viewIdResourceName = "x:id/shorts_player"))),
                YOUTUBE,
                onlyYoutube
            )
        )
    }

    @Test
    fun `an unwatched package is ignored unless the user added a rule for it`() {
        val tree = FakeNode(children = listOf(FakeNode(viewIdResourceName = "com.example.feed:id/endless_reel")))
        assertFalse(ShortFormDetector.detect(tree, "com.example.feed", allOn))

        val withRule = allOn.copy(customIdRules = mapOf("com.example.feed" to listOf("endless_reel")))
        assertTrue(ShortFormDetector.detect(tree, "com.example.feed", withRule))
    }

    @Test
    fun `a custom rule with no patterns cannot match everything`() {
        val tree = FakeNode(children = listOf(FakeNode(viewIdResourceName = "com.example.feed:id/anything")))
        val emptyRule = allOn.copy(customIdRules = mapOf("com.example.feed" to emptyList()))
        assertFalse(ShortFormDetector.detect(tree, "com.example.feed", emptyRule))
    }

    @Test
    fun `matching is case insensitive`() {
        val tree = FakeNode(children = listOf(FakeNode(viewIdResourceName = "COM.GOOGLE.ANDROID.YOUTUBE:ID/REEL_PLAYER")))
        assertTrue(ShortFormDetector.detect(tree, YOUTUBE, allOn))
    }

    @Test
    fun `nodes below the depth cap are not inspected`() {
        val leaf = FakeNode(viewIdResourceName = "x:id/reel_player")
        val deep = chain(depth = 6, leaf = leaf)

        assertFalse("a match deeper than maxDepth must not be reached", ShortFormDetector.detect(deep, YOUTUBE, allOn, maxDepth = 3))
        assertTrue(ShortFormDetector.detect(deep, YOUTUBE, allOn, maxDepth = 25))
    }

    @Test
    fun `scanning stops at the node cap`() {
        val wide = FakeNode(
            children = List(50) { FakeNode(viewIdResourceName = "x:id/filler_$it") } +
                FakeNode(viewIdResourceName = "x:id/reel_player")
        )
        assertEquals(52, wide.countVisitedIds())

        assertFalse("a match past maxNodes must not be reached", ShortFormDetector.detect(wide, YOUTUBE, allOn, maxNodes = 5))
        assertTrue(ShortFormDetector.detect(wide, YOUTUBE, allOn, maxNodes = 400))
    }

    @Test
    fun `an empty tree is not a match`() {
        assertFalse(ShortFormDetector.detect(FakeNode(), YOUTUBE, allOn))
    }

    private companion object {
        const val YOUTUBE = "com.google.android.youtube"
        const val INSTAGRAM = "com.instagram.android"
        const val FACEBOOK = "com.facebook.katana"
        const val SNAPCHAT = "com.snapchat.android"
    }
}
