package `in`.satym.studybuddy.sounds

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

/**
 * Procedural audio synthesis for focus and ambient soundscapes.
 *
 * WHY: shipping audio files for focus soundscapes adds APK weight and licensing
 * questions. Synthesizing noise and ambience procedurally produces equivalent audio
 * quality for this material while keeping the feature self-contained.
 *
 * All generators are pure Kotlin (no Android imports) so they can be unit-tested.
 * Output is 16-bit PCM suitable for android.media.AudioTrack.
 */
enum class Soundscape(val id: String, val label: String) {
    WHITE_NOISE("white_noise", "White Noise"),
    PINK_NOISE("pink_noise", "Pink Noise"),
    BROWN_NOISE("brown_noise", "Brown Noise"),
    RAIN("rain", "Rain"),
    OCEAN("ocean", "Ocean Waves"),
    FIREPLACE("fireplace", "Fireplace"),
    FOCUS_HUM("focus_hum", "Focus Hum");

    companion object {
        fun fromId(id: String): Soundscape? = values().firstOrNull { it.id == id }
    }
}

/**
 * Fills a 16-bit PCM buffer with the specified soundscape audio.
 *
 * All output is clipped to prevent distortion. Fade envelopes (2-second linear ramps)
 * are applied at buffer start/end when requested to eliminate clicks.
 *
 * @param soundscape which soundscape to generate
 * @param buffer output buffer (16-bit PCM samples)
 * @param sampleRate samples per second (typically 44100 Hz)
 * @param channels 1 for mono, 2 for stereo
 * @param position frame index this buffer starts at (for continuity)
 * @param applyFadeIn true to apply 2s fade-in envelope
 * @param applyFadeOut true to apply 2s fade-out envelope
 */
class SoundscapeGenerator(
    private val soundscape: Soundscape,
    private val sampleRate: Int,
    private val channels: Int,
    private val random: Random = Random.Default
) {
    private var position: Long = 0L

    // Pink noise Voss-McCartney state (Paul Kellett variant)
    private val pinkRows = 16
    private val pinkValues = FloatArray(pinkRows) { 0f }
    private var pinkIndex = 0

    // Brown noise leaky integrator state
    private var brownState = 0f

    // Ocean wave phase
    private var oceanPhase = 0.0

    // Fireplace crackle accumulator
    private var fireplaceCracklePhase = 0.0

    // Focus hum phase
    private var focusHumPhase1 = 0.0
    private var focusHumPhase2 = 0.0
    private var focusTremoloPhase = 0.0

    /**
     * Fill the buffer with the next chunk of audio.
     * Call repeatedly to generate continuous audio.
     */
    fun fillBuffer(buffer: ShortArray, applyFadeIn: Boolean = false, applyFadeOut: Boolean = false) {
        val frames = buffer.size / channels
        val fadeInSamples = (sampleRate * 2.0).toInt() // 2 seconds
        val fadeOutSamples = fadeInSamples

        for (frame in 0 until frames) {
            val left: Float
            val right: Float

            when (soundscape) {
                Soundscape.WHITE_NOISE -> {
                    left = generateWhiteNoise()
                    right = if (channels == 2) generateWhiteNoise() else left
                }
                Soundscape.PINK_NOISE -> {
                    left = generatePinkNoise()
                    right = if (channels == 2) generatePinkNoise() else left
                }
                Soundscape.BROWN_NOISE -> {
                    left = generateBrownNoise()
                    right = left // Brown noise is naturally continuous
                }
                Soundscape.RAIN -> {
                    val (l, r) = generateRain()
                    left = l
                    right = if (channels == 2) r else l
                }
                Soundscape.OCEAN -> {
                    left = generateOcean()
                    right = left
                }
                Soundscape.FIREPLACE -> {
                    val (l, r) = generateFireplace()
                    left = l
                    right = if (channels == 2) r else l
                }
                Soundscape.FOCUS_HUM -> {
                    val (l, r) = generateFocusHum()
                    left = l
                    right = if (channels == 2) r else l
                }
            }

            // Apply fade envelopes
            var envelopeGain = 1.0f
            if (applyFadeIn && position < fadeInSamples) {
                envelopeGain = position.toFloat() / fadeInSamples.toFloat()
            }
            if (applyFadeOut && (position + frames - frame) <= fadeOutSamples) {
                val remaining = (frames - frame).toFloat()
                envelopeGain = envelopeGain.coerceAtMost(remaining / fadeOutSamples.toFloat())
            }

            // Convert to 16-bit PCM and clip
            buffer[frame * channels] = clip(left * envelopeGain)
            if (channels == 2) {
                buffer[frame * channels + 1] = clip(right * envelopeGain)
            }

            position++
        }
    }

    private fun generateWhiteNoise(): Float {
        // Uniform random [-1, 1] scaled to comfortable listening level
        return (random.nextFloat() * 2f - 1f) * 0.3f
    }

    private fun generatePinkNoise(): Float {
        // Voss-McCartney algorithm (Paul Kellett variant)
        // Update random values for rows that change this sample
        val maxKey = random.nextInt(pinkRows)
        var diff = 0f
        for (i in 0 until maxKey) {
            val prev = pinkValues[i]
            pinkValues[i] = random.nextFloat() * 2f - 1f
            diff += pinkValues[i] - prev
        }
        val sum = pinkValues.sum()
        return (sum / pinkRows.toFloat()) * 0.3f
    }

    private fun generateBrownNoise(): Float {
        // Leaky integrated white noise
        val white = random.nextFloat() * 2f - 1f
        brownState = (brownState + white * 0.02f) * 0.995f
        return brownState.coerceIn(-1f, 1f) * 0.4f
    }

    private fun generateRain(): Pair<Float, Float> {
        // Pink noise base + random droplet transients
        val base = generatePinkNoise()
        var left = base
        var right = base

        // Sparse droplets (roughly 20 per second at 44.1kHz)
        if (random.nextFloat() < 20.0 / sampleRate) {
            val droplet = (random.nextFloat() * 2f - 1f) * 0.5f
            val pan = random.nextFloat() // 0=left, 1=right
            left += droplet * (1f - pan)
            right += droplet * pan
        }

        return Pair(left * 0.6f, right * 0.6f)
    }

    private fun generateOcean(): Float {
        // Brown noise with slow amplitude swell (0.08-0.15 Hz wave period)
        val brown = generateBrownNoise()
        val waveFreq = 0.11 // Hz, ~9 second wave period
        oceanPhase += 2.0 * PI * waveFreq / sampleRate
        if (oceanPhase > 2.0 * PI) oceanPhase -= 2.0 * PI

        val swellEnvelope = 0.5f + 0.5f * cos(oceanPhase).toFloat()
        return brown * (0.3f + 0.7f * swellEnvelope)
    }

    private fun generateFireplace(): Pair<Float, Float> {
        // Brown noise + sparse crackle impulses
        val brown = generateBrownNoise()
        var left = brown
        var right = brown

        // Random crackles (roughly 3 per second)
        if (random.nextFloat() < 3.0 / sampleRate) {
            val crackle = (random.nextFloat() * 2f - 1f) * 0.7f
            val pan = random.nextFloat()
            left += crackle * (1f - pan)
            right += crackle * pan
        }

        return Pair(left * 0.5f, right * 0.5f)
    }

    private fun generateFocusHum(): Pair<Float, Float> {
        // Soft low sine pair (110 Hz + 165 Hz) with slow tremolo
        // Optional 10 Hz binaural offset when stereo
        val f1 = 110.0 // Hz (A2)
        val f2 = 165.0 // Hz (E3)
        val tremoloFreq = 0.5 // Hz (slow pulsing)
        val binauralOffset = 10.0 // Hz

        focusHumPhase1 += 2.0 * PI * f1 / sampleRate
        focusHumPhase2 += 2.0 * PI * f2 / sampleRate
        focusTremoloPhase += 2.0 * PI * tremoloFreq / sampleRate

        if (focusHumPhase1 > 2.0 * PI) focusHumPhase1 -= 2.0 * PI
        if (focusHumPhase2 > 2.0 * PI) focusHumPhase2 -= 2.0 * PI
        if (focusTremoloPhase > 2.0 * PI) focusTremoloPhase -= 2.0 * PI

        val tremolo = 0.7f + 0.3f * cos(focusTremoloPhase).toFloat()
        val base = (sin(focusHumPhase1) + sin(focusHumPhase2)).toFloat() * 0.15f * tremolo

        val left = base
        val right = if (channels == 2) {
            // Add binaural offset to right channel
            val offsetPhase1 = focusHumPhase1 + 2.0 * PI * binauralOffset * position / sampleRate
            val offsetPhase2 = focusHumPhase2 + 2.0 * PI * binauralOffset * position / sampleRate
            (sin(offsetPhase1) + sin(offsetPhase2)).toFloat() * 0.15f * tremolo
        } else {
            left
        }

        return Pair(left, right)
    }

    private fun clip(sample: Float): Short {
        val scaled = sample * 32767f
        return when {
            scaled > 32767f -> 32767
            scaled < -32768f -> -32768
            else -> scaled.toInt().toShort()
        }
    }

    /** Reset generator state (useful for seamless loops or testing). */
    fun reset() {
        position = 0L
        pinkValues.fill(0f)
        pinkIndex = 0
        brownState = 0f
        oceanPhase = 0.0
        fireplaceCracklePhase = 0.0
        focusHumPhase1 = 0.0
        focusHumPhase2 = 0.0
        focusTremoloPhase = 0.0
    }
}
