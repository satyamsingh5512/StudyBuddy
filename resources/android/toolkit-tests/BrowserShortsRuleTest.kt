package `in`.satym.studybuddy.toolkit

import `in`.satym.studybuddy.shortsblock.AccessibilityNodeView
import `in`.satym.studybuddy.shortsblock.BrowserShortsRule
import org.junit.Assert.*
import org.junit.Test

/**
 * Unit tests for browser short-form URL detection.
 *
 * All tests use mock node trees and never touch Android APIs.
 */
class BrowserShortsRuleTest {

    @Test
    fun `isBrowser returns true for supported browsers`() {
        assertTrue(BrowserShortsRule.isBrowser("com.android.chrome"))
        assertTrue(BrowserShortsRule.isBrowser("com.sec.android.app.sbrowser"))
        assertTrue(BrowserShortsRule.isBrowser("org.mozilla.firefox"))
        assertTrue(BrowserShortsRule.isBrowser("com.microsoft.emmx"))
        assertTrue(BrowserShortsRule.isBrowser("com.brave.browser"))
        assertTrue(BrowserShortsRule.isBrowser("com.opera.browser"))
    }

    @Test
    fun `isBrowser returns false for non-browser packages`() {
        assertFalse(BrowserShortsRule.isBrowser("com.example.app"))
        assertFalse(BrowserShortsRule.isBrowser("com.google.android.youtube"))
        assertFalse(BrowserShortsRule.isBrowser("com.instagram.android"))
    }

    @Test
    fun `detectUrl finds YouTube Shorts URL in Chrome address bar`() {
        val root = mockNode(
            id = "toolbar",
            children = listOf(
                mockNode(
                    id = "url_bar",
                    text = "https://youtube.com/shorts/abcd1234"
                )
            )
        )
        val detected = BrowserShortsRule.detectUrl(root, "com.android.chrome")
        assertEquals("short-form", detected)
    }

    @Test
    fun `detectUrl finds mobile YouTube Shorts URL`() {
        val root = mockNode(
            id = "toolbar",
            children = listOf(
                mockNode(
                    id = "url_bar",
                    text = "https://m.youtube.com/shorts/xyz9876"
                )
            )
        )
        val detected = BrowserShortsRule.detectUrl(root, "com.android.chrome")
        assertEquals("short-form", detected)
    }

    @Test
    fun `detectUrl finds Instagram Reel URL`() {
        val root = mockNode(
            id = "toolbar",
            children = listOf(
                mockNode(
                    id = "url_bar",
                    text = "https://www.instagram.com/reel/BcD3fGhIjKl/"
                )
            )
        )
        val detected = BrowserShortsRule.detectUrl(root, "com.android.chrome")
        assertEquals("short-form", detected)
    }

    @Test
    fun `detectUrl finds Instagram Reels browse URL`() {
        val root = mockNode(
            id = "toolbar",
            children = listOf(
                mockNode(
                    id = "url_bar",
                    text = "https://www.instagram.com/reels/"
                )
            )
        )
        val detected = BrowserShortsRule.detectUrl(root, "com.android.chrome")
        assertEquals("short-form", detected)
    }

    @Test
    fun `detectUrl finds Facebook Reel URL`() {
        val root = mockNode(
            id = "toolbar",
            children = listOf(
                mockNode(
                    id = "url_bar",
                    text = "https://facebook.com/reel/1234567890"
                )
            )
        )
        val detected = BrowserShortsRule.detectUrl(root, "com.android.chrome")
        assertEquals("short-form", detected)
    }

    @Test
    fun `detectUrl finds mobile Facebook Reel URL`() {
        val root = mockNode(
            id = "toolbar",
            children = listOf(
                mockNode(
                    id = "url_bar",
                    text = "https://m.facebook.com/reel/9876543210"
                )
            )
        )
        val detected = BrowserShortsRule.detectUrl(root, "com.android.chrome")
        assertEquals("short-form", detected)
    }

    @Test
    fun `detectUrl finds TikTok URL`() {
        val root = mockNode(
            id = "toolbar",
            children = listOf(
                mockNode(
                    id = "url_bar",
                    text = "https://www.tiktok.com/@user/video/1234"
                )
            )
        )
        val detected = BrowserShortsRule.detectUrl(root, "com.android.chrome")
        assertEquals("short-form", detected)
    }

    @Test
    fun `detectUrl returns null for non-short-form YouTube URL`() {
        val root = mockNode(
            id = "toolbar",
            children = listOf(
                mockNode(
                    id = "url_bar",
                    text = "https://youtube.com/watch?v=abcd1234"
                )
            )
        )
        val detected = BrowserShortsRule.detectUrl(root, "com.android.chrome")
        assertNull(detected)
    }

    @Test
    fun `detectUrl returns null for regular Instagram profile`() {
        val root = mockNode(
            id = "toolbar",
            children = listOf(
                mockNode(
                    id = "url_bar",
                    text = "https://www.instagram.com/some_user/"
                )
            )
        )
        val detected = BrowserShortsRule.detectUrl(root, "com.android.chrome")
        assertNull(detected)
    }

    @Test
    fun `detectUrl returns null for unrelated website`() {
        val root = mockNode(
            id = "toolbar",
            children = listOf(
                mockNode(
                    id = "url_bar",
                    text = "https://www.example.com/page"
                )
            )
        )
        val detected = BrowserShortsRule.detectUrl(root, "com.android.chrome")
        assertNull(detected)
    }

    @Test
    fun `detectUrl works with Samsung Browser address bar ID`() {
        val root = mockNode(
            id = "browser_toolbar",
            children = listOf(
                mockNode(
                    id = "location_bar_edit_text",
                    text = "youtube.com/shorts/test"
                )
            )
        )
        val detected = BrowserShortsRule.detectUrl(root, "com.sec.android.app.sbrowser")
        assertEquals("short-form", detected)
    }

    @Test
    fun `detectUrl works with Firefox address bar ID`() {
        val root = mockNode(
            id = "toolbar",
            children = listOf(
                mockNode(
                    id = "mozac_browser_toolbar_url_view",
                    text = "instagram.com/reel/abc"
                )
            )
        )
        val detected = BrowserShortsRule.detectUrl(root, "org.mozilla.firefox")
        assertEquals("short-form", detected)
    }

    @Test
    fun `detectUrl works with Edge address bar ID`() {
        val root = mockNode(
            id = "toolbar",
            children = listOf(
                mockNode(
                    id = "url_bar",
                    text = "tiktok.com"
                )
            )
        )
        val detected = BrowserShortsRule.detectUrl(root, "com.microsoft.emmx")
        assertEquals("short-form", detected)
    }

    @Test
    fun `detectUrl works with Brave address bar ID`() {
        val root = mockNode(
            id = "toolbar",
            children = listOf(
                mockNode(
                    id = "url_bar",
                    text = "m.youtube.com/shorts/brave"
                )
            )
        )
        val detected = BrowserShortsRule.detectUrl(root, "com.brave.browser")
        assertEquals("short-form", detected)
    }

    @Test
    fun `detectUrl works with Opera address bar ID`() {
        val root = mockNode(
            id = "toolbar",
            children = listOf(
                mockNode(
                    id = "url_field",
                    text = "facebook.com/reel/opera"
                )
            )
        )
        val detected = BrowserShortsRule.detectUrl(root, "com.opera.browser")
        assertEquals("short-form", detected)
    }

    @Test
    fun `detectUrl reads contentDescription when text is null`() {
        val root = mockNode(
            id = "toolbar",
            children = listOf(
                mockNode(
                    id = "url_bar",
                    contentDescription = "youtube.com/shorts/desc"
                )
            )
        )
        val detected = BrowserShortsRule.detectUrl(root, "com.android.chrome")
        assertEquals("short-form", detected)
    }

    @Test
    fun `detectUrl is case-insensitive`() {
        val root = mockNode(
            id = "toolbar",
            children = listOf(
                mockNode(
                    id = "URL_BAR",
                    text = "HTTPS://YOUTUBE.COM/SHORTS/TEST"
                )
            )
        )
        val detected = BrowserShortsRule.detectUrl(root, "com.android.chrome")
        assertEquals("short-form", detected)
    }

    @Test
    fun `detectUrl respects maxNodes limit`() {
        // Create a tree with 150 nodes
        val children = (1..150).map { mockNode(id = "child_$it") }
        val root = mockNode(id = "root", children = children)
        
        // Should still scan up to maxNodes (default 100)
        val detected = BrowserShortsRule.detectUrl(root, "com.android.chrome", maxNodes = 100)
        assertNull(detected)
    }

    @Test
    fun `detectUrl strips http and https schemes`() {
        val root = mockNode(
            id = "toolbar",
            children = listOf(
                mockNode(
                    id = "url_bar",
                    text = "http://instagram.com/reels"
                )
            )
        )
        val detected = BrowserShortsRule.detectUrl(root, "com.android.chrome")
        assertEquals("short-form", detected)
    }

    @Test
    fun `detectUrl handles URL with query parameters`() {
        val root = mockNode(
            id = "toolbar",
            children = listOf(
                mockNode(
                    id = "url_bar",
                    text = "https://youtube.com/shorts/abc?feature=share"
                )
            )
        )
        val detected = BrowserShortsRule.detectUrl(root, "com.android.chrome")
        assertEquals("short-form", detected)
    }

    @Test
    fun `detectUrl returns null when address bar ID not found`() {
        val root = mockNode(
            id = "some_other_id",
            text = "youtube.com/shorts/test"
        )
        val detected = BrowserShortsRule.detectUrl(root, "com.android.chrome")
        assertNull(detected)
    }

    @Test
    fun `detectUrl returns null for unsupported browser package`() {
        val root = mockNode(
            id = "url_bar",
            text = "youtube.com/shorts/test"
        )
        val detected = BrowserShortsRule.detectUrl(root, "com.unknown.browser")
        assertNull(detected)
    }

    // -------------------------------------------------------------------------
    // Mock helpers
    // -------------------------------------------------------------------------

    private fun mockNode(
        id: String? = null,
        text: String? = null,
        contentDescription: String? = null,
        children: List<MockNode> = emptyList()
    ): MockNode = MockNode(id, text, contentDescription, children)

    private class MockNode(
        override val viewIdResourceName: String?,
        override val text: CharSequence?,
        override val contentDescription: CharSequence?,
        private val children: List<MockNode>
    ) : AccessibilityNodeView {
        override fun childCount(): Int = children.size
        override fun childAt(index: Int): AccessibilityNodeView? =
            children.getOrNull(index)
        override fun recycle() {}
    }
}
