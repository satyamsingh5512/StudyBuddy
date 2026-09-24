package `in`.satym.studybuddy.digitaldiscipline

import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import java.security.MessageDigest
import java.security.SecureRandom
import java.security.spec.KeySpec
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec

private val Context.digitalDisciplineDataStore by preferencesDataStore(name = "studybuddy_digital_discipline")

class DigitalDisciplinePreferences(private val context: Context) {
    private val activeUserId = stringPreferencesKey("active_user_id")
    private val consumerMonitoring = booleanPreferencesKey("consumer_monitoring")
    private val usageAnalytics = booleanPreferencesKey("usage_analytics")
    private val antiDoomscroll = booleanPreferencesKey("anti_doomscroll")
    private val strictFocus = booleanPreferencesKey("strict_focus")
    private val hardcoreFocus = booleanPreferencesKey("hardcore_focus")
    private val studyRoomFocus = booleanPreferencesKey("study_room_focus")
    private val managedDeviceMode = booleanPreferencesKey("managed_device_mode")
    private val accessibilityIntegration = booleanPreferencesKey("accessibility_integration")

    fun userId(): String? = runBlocking { context.digitalDisciplineDataStore.data.first()[activeUserId] }
    fun consumerMonitoringEnabled(): Boolean = runBlocking { context.digitalDisciplineDataStore.data.first()[consumerMonitoring] ?: false }

    fun featureFlags(): Map<String, Boolean> = runBlocking {
        val data = context.digitalDisciplineDataStore.data.first()
        mapOf(
            "usageAnalytics" to (data[usageAnalytics] ?: false),
            "antiDoomscroll" to (data[antiDoomscroll] ?: false),
            "strictFocus" to (data[strictFocus] ?: false),
            "hardcoreFocus" to (data[hardcoreFocus] ?: false),
            "studyRoomFocus" to (data[studyRoomFocus] ?: false),
            "managedDeviceMode" to (data[managedDeviceMode] ?: false),
            // Accessibility is intentionally off by default and no service is registered.
            "accessibilityIntegration" to (data[accessibilityIntegration] ?: false)
        )
    }

    fun setUserId(userId: String) = runBlocking { context.digitalDisciplineDataStore.edit { it[activeUserId] = userId } }
    fun setConsumerMonitoring(enabled: Boolean) = runBlocking { context.digitalDisciplineDataStore.edit { it[consumerMonitoring] = enabled } }
    fun setFeatureFlags(values: Map<String, Boolean>) = runBlocking {
        context.digitalDisciplineDataStore.edit { prefs ->
            values["usageAnalytics"]?.let { prefs[usageAnalytics] = it }
            values["antiDoomscroll"]?.let { prefs[antiDoomscroll] = it }
            values["strictFocus"]?.let { prefs[strictFocus] = it }
            values["hardcoreFocus"]?.let { prefs[hardcoreFocus] = it }
            values["studyRoomFocus"]?.let { prefs[studyRoomFocus] = it }
            values["managedDeviceMode"]?.let { prefs[managedDeviceMode] = it }
            values["accessibilityIntegration"]?.let { prefs[accessibilityIntegration] = it }
        }
    }
}

/** AES-GCM payloads are stored as base64(iv).base64(ciphertext); plaintext never reaches Room. */
class KeystoreCipher {
    private val alias = "studybuddy.digitaldiscipline.local.v1"

    private fun key(): SecretKey {
        require(Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            "Secure unlock credentials require Android 6.0 (API 23) or later."
        }
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val existing = keyStore.getKey(alias, null) as? SecretKey
        if (existing != null) return existing
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        )
        return generator.generateKey()
    }

    fun encrypt(value: ByteArray): String {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        return Base64.encodeToString(cipher.iv, Base64.NO_WRAP) + "." +
            Base64.encodeToString(cipher.doFinal(value), Base64.NO_WRAP)
    }

    fun decrypt(payload: String): ByteArray {
        val parts = payload.split('.', limit = 2)
        require(parts.size == 2) { "Invalid encrypted credential metadata." }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(
            Cipher.DECRYPT_MODE,
            key(),
            GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP))
        )
        return cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP))
    }
}

class UnlockCredentialVerifier(private val dao: DigitalDisciplineDao) {
    private val random = SecureRandom()
    private val cipher = KeystoreCipher()

    private fun derive(secret: CharArray, salt: ByteArray): ByteArray {
        val spec: KeySpec = PBEKeySpec(secret, salt, 210_000, 256)
        return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
    }

    fun configure(userId: String, secret: String, biometricAllowed: Boolean) {
        require(secret.length in 4..256) { "Use a PIN or password between 4 and 256 characters." }
        val salt = ByteArray(16).also(random::nextBytes)
        val verifier = derive(secret.toCharArray(), salt)
        val encoded = Base64.encodeToString(salt, Base64.NO_WRAP) + ":" + Base64.encodeToString(verifier, Base64.NO_WRAP)
        // Avoid retaining the caller's raw secret in entity fields, logs, or preferences.
        dao.upsertUnlockCredential(
            UnlockCredentialMetadataEntity(
                userId = userId,
                encryptedVerifier = cipher.encrypt(encoded.toByteArray(StandardCharsets.UTF_8)),
                algorithm = "PBKDF2WithHmacSHA256/210000 + AndroidKeyStore AES-GCM",
                biometricAllowed = biometricAllowed,
                updatedAtMs = System.currentTimeMillis()
            )
        )
    }

    fun verify(userId: String, secret: String): Boolean {
        val metadata = dao.unlockCredential(userId) ?: return false
        return try {
            val values = String(cipher.decrypt(metadata.encryptedVerifier), StandardCharsets.UTF_8).split(':', limit = 2)
            if (values.size != 2) return false
            val salt = Base64.decode(values[0], Base64.NO_WRAP)
            val expected = Base64.decode(values[1], Base64.NO_WRAP)
            MessageDigest.isEqual(expected, derive(secret.toCharArray(), salt))
        } catch (_: Exception) {
            false
        }
    }

    fun configured(userId: String): Boolean = dao.unlockCredential(userId) != null
}

fun newLocalId(): String = UUID.randomUUID().toString()
