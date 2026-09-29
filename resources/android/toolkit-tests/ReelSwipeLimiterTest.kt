package `in`.satym.studybuddy.toolkit

import `in`.satym.studybuddy.shortsblock.ReelSwipeLimiter
import android.content.Context
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/**
 * Unit tests for ReelSwipeLimiter swipe counting and debouncing.
 *
 * These tests use Robolectric to provide a Context for SharedPreferences.
 * The debouncing and limit logic is pure Kotlin and doesn't touch Android UI.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class ReelSwipeLimiterTest {

    private lateinit var context: Context

    @Before
    fun setUp() {
        context = RuntimeEnvironment.getApplication()
        // Clear SharedPreferences before each test
        context.getSharedPreferences("studybuddy_shortsblock_swipes", Context.MODE_PRIVATE)
            .edit().clear().commit()
    }

    @Test
    fun `todayCount returns zero on first call`() {
        assertEquals(0, ReelSwipeLimiter.todayCount(context))
    }

    @Test
    fun `recordSwipe increments count on first swipe`() {
        val recorded = ReelSwipeLimiter.recordSwipe(context, 1000L)
        assertTrue(recorded)
        assertEquals(1, ReelSwipeLimiter.todayCount(context))
    }

    @Test
    fun `recordSwipe increments count on subsequent swipes after debounce`() {
        ReelSwipeLimiter.recordSwipe(context, 1000L)
        ReelSwipeLimiter.recordSwipe(context, 2000L)
        assertEquals(2, ReelSwipeLimiter.todayCount(context))
    }

    @Test
    fun `recordSwipe debounces within 600ms`() {
        val first = ReelSwipeLimiter.recordSwipe(context, 1000L)
        val second = ReelSwipeLimiter.recordSwipe(context, 1500L)  // 500ms later
        assertTrue(first)
        assertFalse(second)
        assertEquals(1, ReelSwipeLimiter.todayCount(context))
    }

    @Test
    fun `recordSwipe accepts swipe exactly 600ms after previous`() {
        val first = ReelSwipeLimiter.recordSwipe(context, 1000L)
        val second = ReelSwipeLimiter.recordSwipe(context, 1600L)  // exactly 600ms
        assertTrue(first)
        assertTrue(second)
        assertEquals(2, ReelSwipeLimiter.todayCount(context))
    }

    @Test
    fun `recordSwipe accepts swipe after 600ms debounce window`() {
        val first = ReelSwipeLimiter.recordSwipe(context, 1000L)
        val second = ReelSwipeLimiter.recordSwipe(context, 1601L)  // 601ms later
        assertTrue(first)
        assertTrue(second)
        assertEquals(2, ReelSwipeLimiter.todayCount(context))
    }

    @Test
    fun `multiple debounced swipes only count once`() {
        ReelSwipeLimiter.recordSwipe(context, 1000L)
        ReelSwipeLimiter.recordSwipe(context, 1100L)
        ReelSwipeLimiter.recordSwipe(context, 1200L)
        ReelSwipeLimiter.recordSwipe(context, 1300L)
        assertEquals(1, ReelSwipeLimiter.todayCount(context))
    }

    @Test
    fun `limitExceeded returns false when limit is zero`() {
        ReelSwipeLimiter.recordSwipe(context, 1000L)
        ReelSwipeLimiter.recordSwipe(context, 2000L)
        assertFalse(ReelSwipeLimiter.limitExceeded(context, 0))
    }

    @Test
    fun `limitExceeded returns false when below limit`() {
        ReelSwipeLimiter.recordSwipe(context, 1000L)
        ReelSwipeLimiter.recordSwipe(context, 2000L)
        assertFalse(ReelSwipeLimiter.limitExceeded(context, 5))
    }

    @Test
    fun `limitExceeded returns true when at limit`() {
        ReelSwipeLimiter.recordSwipe(context, 1000L)
        ReelSwipeLimiter.recordSwipe(context, 2000L)
        ReelSwipeLimiter.recordSwipe(context, 3000L)
        assertTrue(ReelSwipeLimiter.limitExceeded(context, 3))
    }

    @Test
    fun `limitExceeded returns true when above limit`() {
        ReelSwipeLimiter.recordSwipe(context, 1000L)
        ReelSwipeLimiter.recordSwipe(context, 2000L)
        ReelSwipeLimiter.recordSwipe(context, 3000L)
        ReelSwipeLimiter.recordSwipe(context, 4000L)
        assertTrue(ReelSwipeLimiter.limitExceeded(context, 3))
    }

    @Test
    fun `count resets on new calendar day`() {
        // Simulate recording swipes, then force a date change by directly manipulating prefs
        ReelSwipeLimiter.recordSwipe(context, 1000L)
        ReelSwipeLimiter.recordSwipe(context, 2000L)
        assertEquals(2, ReelSwipeLimiter.todayCount(context))

        // Manually change the stored date to yesterday
        val prefs = context.getSharedPreferences("studybuddy_shortsblock_swipes", Context.MODE_PRIVATE)
        prefs.edit().putString("date", "2026-09-28").commit()

        // Today count should now be zero
        assertEquals(0, ReelSwipeLimiter.todayCount(context))
    }

    @Test
    fun `recordSwipe resets count on new calendar day`() {
        ReelSwipeLimiter.recordSwipe(context, 1000L)
        assertEquals(1, ReelSwipeLimiter.todayCount(context))

        // Change stored date to yesterday
        val prefs = context.getSharedPreferences("studybuddy_shortsblock_swipes", Context.MODE_PRIVATE)
        prefs.edit().putString("date", "2026-09-28").commit()

        // Recording a new swipe today should reset to 1
        ReelSwipeLimiter.recordSwipe(context, 2000L)
        assertEquals(1, ReelSwipeLimiter.todayCount(context))
    }

    @Test
    fun `high swipe rate respects debounce window`() {
        // Simulate rapid swipes every 100ms
        val recorded = mutableListOf<Boolean>()
        for (i in 0..20) {
            recorded.add(ReelSwipeLimiter.recordSwipe(context, 1000L + i * 100L))
        }
        
        // Only swipes at 1000, 1600, 1200 (21 total attempts, debounce every 600ms)
        // Actually: 1000 (yes), 1100-1500 (no), 1600 (yes), 1700-2200 (no until 2200), etc.
        // Let's count: 1000, 1600, 2200 = 3 swipes
        assertEquals(4, ReelSwipeLimiter.todayCount(context))
    }

    @Test
    fun `limitExceeded with negative limit returns false`() {
        ReelSwipeLimiter.recordSwipe(context, 1000L)
        assertFalse(ReelSwipeLimiter.limitExceeded(context, -1))
    }

    @Test
    fun `todayCount persists across context instances`() {
        ReelSwipeLimiter.recordSwipe(context, 1000L)
        ReelSwipeLimiter.recordSwipe(context, 2000L)
        
        // Create a new context instance
        val newContext = RuntimeEnvironment.getApplication()
        assertEquals(2, ReelSwipeLimiter.todayCount(newContext))
    }

    @Test
    fun `debounce is per-session not per-day`() {
        // Record first swipe
        ReelSwipeLimiter.recordSwipe(context, 1000L)
        
        // Simulate clearing prefs (like a new day)
        context.getSharedPreferences("studybuddy_shortsblock_swipes", Context.MODE_PRIVATE)
            .edit().clear().commit()
        
        // First swipe of new day should not be debounced even if timestamp is close
        val recorded = ReelSwipeLimiter.recordSwipe(context, 1500L)
        assertTrue(recorded)
        assertEquals(1, ReelSwipeLimiter.todayCount(context))
    }

    @Test
    fun `large time gap between swipes does not break counting`() {
        ReelSwipeLimiter.recordSwipe(context, 1000L)
        ReelSwipeLimiter.recordSwipe(context, 1000000L)  // ~16 minutes later
        assertEquals(2, ReelSwipeLimiter.todayCount(context))
    }

    @Test
    fun `swipes recorded at exact same timestamp are debounced`() {
        val first = ReelSwipeLimiter.recordSwipe(context, 1000L)
        val second = ReelSwipeLimiter.recordSwipe(context, 1000L)
        assertTrue(first)
        assertFalse(second)
        assertEquals(1, ReelSwipeLimiter.todayCount(context))
    }

    @Test
    fun `boundary test - 599ms is debounced`() {
        ReelSwipeLimiter.recordSwipe(context, 1000L)
        val recorded = ReelSwipeLimiter.recordSwipe(context, 1599L)
        assertFalse(recorded)
        assertEquals(1, ReelSwipeLimiter.todayCount(context))
    }

    @Test
    fun `boundary test - 601ms is not debounced`() {
        ReelSwipeLimiter.recordSwipe(context, 1000L)
        val recorded = ReelSwipeLimiter.recordSwipe(context, 1601L)
        assertTrue(recorded)
        assertEquals(2, ReelSwipeLimiter.todayCount(context))
    }

    @Test
    fun `zero timestamp is valid and counts`() {
        val recorded = ReelSwipeLimiter.recordSwipe(context, 0L)
        assertTrue(recorded)
        assertEquals(1, ReelSwipeLimiter.todayCount(context))
    }

    @Test
    fun `negative timestamp is valid and counts`() {
        // SystemClock.elapsedRealtime() can theoretically be negative on some edge cases
        val recorded = ReelSwipeLimiter.recordSwipe(context, -1000L)
        assertTrue(recorded)
        assertEquals(1, ReelSwipeLimiter.todayCount(context))
    }
}
