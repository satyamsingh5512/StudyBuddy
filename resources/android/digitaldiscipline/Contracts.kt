package `in`.satym.studybuddy.digitaldiscipline

/** Stable domain vocabulary exposed by the native bridge; never expose Android framework objects. */
enum class FocusState {
    IDLE, CONFIGURING, READY, ACTIVE, PAUSED, COMPLETING, COMPLETED, INTERRUPTED, SYSTEM_INTERRUPTION
}

enum class FocusMode { NORMAL, STRICT, HARDCORE, SHARED_ROOM, POMODORO, DEEP_WORK, CUSTOM }
enum class AppPolicy { ALLOW, WARN, INTERVENE, BLOCK }
enum class ControlLevel { STANDARD, CONSUMER, MANAGED }
enum class SyncState { PENDING, SYNCING, SYNCED, FAILED }

object FocusTransitions {
    private val allowed = mapOf(
        FocusState.IDLE to setOf(FocusState.CONFIGURING),
        FocusState.CONFIGURING to setOf(FocusState.READY, FocusState.IDLE),
        FocusState.READY to setOf(FocusState.ACTIVE, FocusState.INTERRUPTED, FocusState.IDLE),
        FocusState.ACTIVE to setOf(FocusState.PAUSED, FocusState.COMPLETING, FocusState.INTERRUPTED, FocusState.SYSTEM_INTERRUPTION),
        FocusState.PAUSED to setOf(FocusState.ACTIVE, FocusState.COMPLETING, FocusState.INTERRUPTED, FocusState.IDLE),
        FocusState.COMPLETING to setOf(FocusState.COMPLETED, FocusState.INTERRUPTED),
        FocusState.COMPLETED to emptySet(),
        FocusState.INTERRUPTED to emptySet(),
        FocusState.SYSTEM_INTERRUPTION to setOf(FocusState.ACTIVE, FocusState.INTERRUPTED)
    )

    fun permits(from: FocusState, to: FocusState): Boolean = allowed[from]?.contains(to) == true
}

data class DoomscrollEvaluation(
    val score: Int,
    val threshold: Int,
    val triggered: Boolean,
    val reasons: List<String>,
    val requestedPolicy: AppPolicy,
    val effectiveAction: String
)

/**
 * Deliberately deterministic and explainable. Signals are counts supplied by a
 * narrow foreground/surface detector; this does not attempt to infer intent.
 */
object DoomscrollScorer {
    val defaultWeights = linkedMapOf(
        "surface_entry" to 10,
        "repeated_navigation" to 5,
        "rapid_transition" to 5,
        "duration_threshold" to 10,
        "repeat_after_intervention" to 10,
        "blocked_attempt" to 5
    )

    fun evaluate(
        signals: Map<String, Int>,
        weights: Map<String, Int> = defaultWeights,
        threshold: Int = 10,
        policy: AppPolicy
    ): DoomscrollEvaluation {
        val reasons = mutableListOf<String>()
        var score = 0
        for ((name, count) in signals) {
            val safeCount = count.coerceIn(0, 100)
            val weight = weights[name] ?: continue
            if (safeCount > 0) {
                score += safeCount * weight.coerceIn(0, 100)
                reasons += "$name × $safeCount"
            }
        }
        val safeThreshold = threshold.coerceIn(1, 10_000)
        val triggered = policy != AppPolicy.ALLOW && score >= safeThreshold
        val action = when {
            !triggered || policy == AppPolicy.ALLOW -> "allow"
            policy == AppPolicy.WARN -> "warn"
            policy == AppPolicy.INTERVENE -> "intervene"
            // Consumer Android cannot suspend/force-stop. Managed mode may later
            // strengthen this decision through DevicePolicyManager capability checks.
            else -> "intervene_or_managed_block"
        }
        return DoomscrollEvaluation(score, safeThreshold, triggered, reasons, policy, action)
    }
}
