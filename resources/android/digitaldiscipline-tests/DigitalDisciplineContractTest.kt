package `in`.satym.studybuddy.digitaldiscipline

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DigitalDisciplineContractTest {
    @Test
    fun focusStateMachineAllowsOnlyDocumentedTransitions() {
        assertTrue(FocusTransitions.permits(FocusState.IDLE, FocusState.CONFIGURING))
        assertTrue(FocusTransitions.permits(FocusState.ACTIVE, FocusState.PAUSED))
        assertTrue(FocusTransitions.permits(FocusState.PAUSED, FocusState.ACTIVE))
        assertTrue(FocusTransitions.permits(FocusState.COMPLETING, FocusState.COMPLETED))
        assertFalse(FocusTransitions.permits(FocusState.COMPLETED, FocusState.ACTIVE))
        assertFalse(FocusTransitions.permits(FocusState.IDLE, FocusState.COMPLETED))
    }

    @Test
    fun doomscrollScoreIsDeterministicAndDoesNotTreatAllowAsEnforcement() {
        val intervening = DoomscrollScorer.evaluate(
            signals = mapOf("surface_entry" to 1, "repeated_navigation" to 2),
            threshold = 15,
            policy = AppPolicy.INTERVENE
        )
        assertEquals(20, intervening.score)
        assertTrue(intervening.triggered)
        assertEquals("intervene", intervening.effectiveAction)

        val allowed = DoomscrollScorer.evaluate(
            signals = mapOf("surface_entry" to 3),
            threshold = 1,
            policy = AppPolicy.ALLOW
        )
        assertFalse(allowed.triggered)
        assertEquals("allow", allowed.effectiveAction)
    }

    @Test
    fun blockPolicyIsHonestInConsumerEvaluation() {
        val result = DoomscrollScorer.evaluate(
            signals = mapOf("surface_entry" to 1),
            policy = AppPolicy.BLOCK
        )
        assertTrue(result.triggered)
        assertEquals("intervene_or_managed_block", result.effectiveAction)
    }
}
