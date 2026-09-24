package `in`.satym.studybuddy.digitaldiscipline

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase

@Entity(tableName = "user_local_profiles", indices = [Index(value = ["updatedAtMs"])])
data class UserLocalProfileEntity(
    @PrimaryKey val userId: String,
    val displayName: String,
    val updatedAtMs: Long
)

@Entity(tableName = "focus_sessions", indices = [Index(value = ["userId", "updatedAtMs"]), Index(value = ["state"]), Index(value = ["syncState"])])
data class FocusSessionEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val mode: String,
    val state: String,
    val configuredDurationMs: Long,
    val accumulatedElapsedMs: Long,
    val startedWallClockMs: Long,
    val startedElapsedRealtimeMs: Long?,
    val endedWallClockMs: Long?,
    val subject: String,
    val controlLevel: String,
    val interruptionReason: String?,
    val syncState: String,
    val createdAtMs: Long,
    val updatedAtMs: Long
)

@Entity(tableName = "focus_session_events", indices = [Index(value = ["sessionId", "atMs"]), Index(value = ["userId", "eventType"]), Index(value = ["eventType"])])
data class FocusSessionEventEntity(
    @PrimaryKey val id: String,
    val sessionId: String,
    val userId: String,
    val eventType: String,
    val detail: String,
    val atMs: Long
)

@Entity(tableName = "focus_configurations", indices = [Index(value = ["userId", "updatedAtMs"])])
data class FocusConfigurationEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val mode: String,
    val durationMs: Long,
    val protectedAppsEnabled: Boolean,
    val requireUnlockCredential: Boolean,
    val updatedAtMs: Long
)

@Entity(tableName = "protected_apps", primaryKeys = ["userId", "packageName"], indices = [Index(value = ["packageName"]), Index(value = ["userId", "policy"])])
data class ProtectedAppEntity(
    val userId: String,
    val packageName: String,
    val displayName: String,
    val category: String,
    val policy: String,
    val scheduleType: String,
    val customScheduleJson: String,
    val updatedAtMs: Long
)

@Entity(tableName = "doomscroll_rules", indices = [Index(value = ["userId", "packageName"]), Index(value = ["updatedAtMs"])])
data class DoomscrollRuleEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val packageName: String,
    val enabled: Boolean,
    val threshold: Int,
    val weightsJson: String,
    val scheduleType: String,
    val updatedAtMs: Long
)

@Entity(tableName = "doomscroll_events", indices = [Index(value = ["userId", "atMs"]), Index(value = ["packageName", "atMs"]), Index(value = ["eventType"])])
data class DoomscrollEventEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val packageName: String,
    val eventType: String,
    val score: Int,
    val reason: String,
    val atMs: Long
)

@Entity(tableName = "intervention_events", indices = [Index(value = ["userId", "atMs"]), Index(value = ["sessionId"]), Index(value = ["packageName"])])
data class InterventionEventEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val sessionId: String?,
    val packageName: String,
    val ruleId: String?,
    val action: String,
    val countdownSeconds: Int,
    val completed: Boolean,
    val atMs: Long
)

@Entity(tableName = "blocked_attempts", indices = [Index(value = ["userId", "atMs"]), Index(value = ["packageName", "atMs"]), Index(value = ["sessionId"])])
data class BlockedAttemptEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val sessionId: String?,
    val packageName: String,
    val enforcementLevel: String,
    val outcome: String,
    val atMs: Long
)

@Entity(tableName = "usage_applications", primaryKeys = ["userId", "packageName"], indices = [Index(value = ["packageName"]), Index(value = ["category"])])
data class UsageApplicationEntity(
    val userId: String,
    val packageName: String,
    val label: String,
    val category: String,
    val userOverridden: Boolean,
    val updatedAtMs: Long
)

@Entity(tableName = "usage_snapshots", indices = [Index(value = ["userId", "capturedAtMs"]), Index(value = ["packageName", "capturedAtMs"])])
data class UsageSnapshotEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val packageName: String,
    val startAtMs: Long,
    val endAtMs: Long,
    val foregroundMs: Long,
    val capturedAtMs: Long
)

@Entity(tableName = "daily_usage_summaries", primaryKeys = ["userId", "localDate"], indices = [Index(value = ["localDate"]), Index(value = ["userId", "updatedAtMs"])])
data class DailyUsageSummaryEntity(
    val userId: String,
    val localDate: String,
    val screenTimeMs: Long,
    val studyTimeMs: Long,
    val focusTimeMs: Long,
    val distractionTimeMs: Long,
    val doomscrollTimeMs: Long,
    val blockedAttempts: Int,
    val interventions: Int,
    val estimatedRecoveredMs: Long,
    val updatedAtMs: Long
)

@Entity(tableName = "weekly_usage_summaries", primaryKeys = ["userId", "weekStart"], indices = [Index(value = ["weekStart"]), Index(value = ["userId", "updatedAtMs"])])
data class WeeklyUsageSummaryEntity(
    val userId: String,
    val weekStart: String,
    val screenTimeMs: Long,
    val studyTimeMs: Long,
    val focusTimeMs: Long,
    val doomscrollTimeMs: Long,
    val updatedAtMs: Long
)

@Entity(tableName = "study_rooms", indices = [Index(value = ["userId", "updatedAtMs"]), Index(value = ["roomId"])])
data class StudyRoomEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val roomId: String,
    val name: String,
    val updatedAtMs: Long
)

@Entity(tableName = "study_room_presence", primaryKeys = ["roomId", "userId"], indices = [Index(value = ["updatedAtMs"]), Index(value = ["state"])])
data class StudyRoomPresenceEntity(
    val roomId: String,
    val userId: String,
    val state: String,
    val focusSessionId: String?,
    val updatedAtMs: Long
)

@Entity(tableName = "room_focus_sessions", indices = [Index(value = ["userId", "updatedAtMs"]), Index(value = ["roomId"]), Index(value = ["serverSessionId"])])
data class RoomFocusSessionEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val roomId: String,
    val serverSessionId: String,
    val nativeFocusSessionId: String?,
    val startsAtMs: Long,
    val durationMs: Long,
    val state: String,
    val updatedAtMs: Long
)

@Entity(tableName = "digital_discipline_settings", indices = [Index(value = ["updatedAtMs"])])
data class DigitalDisciplineSettingsEntity(
    @PrimaryKey val userId: String,
    val usageAnalyticsEnabled: Boolean,
    val antiDoomscrollEnabled: Boolean,
    val strictFocusEnabled: Boolean,
    val hardcoreFocusEnabled: Boolean,
    val roomFocusEnabled: Boolean,
    val managedDeviceModeEnabled: Boolean,
    val accessibilityIntegrationEnabled: Boolean,
    val updatedAtMs: Long
)

@Entity(tableName = "allowed_applications", primaryKeys = ["userId", "packageName"], indices = [Index(value = ["packageName"])])
data class AllowedApplicationEntity(
    val userId: String,
    val packageName: String,
    val reason: String,
    val updatedAtMs: Long
)

@Entity(tableName = "unlock_credential_metadata", indices = [Index(value = ["updatedAtMs"])])
data class UnlockCredentialMetadataEntity(
    @PrimaryKey val userId: String,
    val encryptedVerifier: String,
    val algorithm: String,
    val biometricAllowed: Boolean,
    val updatedAtMs: Long
)

@Entity(tableName = "achievements", indices = [Index(value = ["userId", "unlockedAtMs"]), Index(value = ["achievementType"])])
data class AchievementEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val achievementType: String,
    val unlockedAtMs: Long?,
    val progress: Int
)

@Entity(tableName = "productivity_metrics", indices = [Index(value = ["userId", "capturedAtMs"]), Index(value = ["metricType"])])
data class ProductivityMetricEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val metricType: String,
    val value: Double,
    val capturedAtMs: Long
)

@Entity(tableName = "sync_queue", indices = [Index(value = ["userId", "state", "createdAtMs"]), Index(value = ["state"]), Index(value = ["entityType"])])
data class SyncQueueItemEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val entityType: String,
    val aggregatePayloadJson: String,
    val state: String,
    val attempts: Int,
    val createdAtMs: Long,
    val updatedAtMs: Long,
    val lastError: String?
)

@Dao
interface DigitalDisciplineDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE) fun upsertProfile(profile: UserLocalProfileEntity)
    @Insert(onConflict = OnConflictStrategy.REPLACE) fun upsertFocus(session: FocusSessionEntity)
    @Insert(onConflict = OnConflictStrategy.REPLACE) fun insertFocusEvent(event: FocusSessionEventEntity)
    @Query("SELECT * FROM focus_sessions WHERE userId = :userId AND state IN ('CONFIGURING','READY','ACTIVE','PAUSED','COMPLETING','SYSTEM_INTERRUPTION') ORDER BY updatedAtMs DESC LIMIT 1") fun activeFocus(userId: String): FocusSessionEntity?
    @Query("SELECT * FROM focus_sessions WHERE id = :sessionId LIMIT 1") fun focus(sessionId: String): FocusSessionEntity?
    @Query("SELECT * FROM focus_sessions WHERE userId = :userId AND startedWallClockMs >= :fromMs") fun focusSince(userId: String, fromMs: Long): List<FocusSessionEntity>
    @Insert(onConflict = OnConflictStrategy.REPLACE) fun upsertProtectedApps(apps: List<ProtectedAppEntity>)
    @Query("SELECT * FROM protected_apps WHERE userId = :userId ORDER BY displayName COLLATE NOCASE") fun protectedApps(userId: String): List<ProtectedAppEntity>
    @Query("SELECT * FROM protected_apps WHERE userId = :userId AND packageName = :packageName LIMIT 1") fun protectedApp(userId: String, packageName: String): ProtectedAppEntity?
    @Insert(onConflict = OnConflictStrategy.REPLACE) fun upsertRules(rules: List<DoomscrollRuleEntity>)
    @Query("SELECT * FROM doomscroll_rules WHERE userId = :userId") fun doomscrollRules(userId: String): List<DoomscrollRuleEntity>
    @Insert(onConflict = OnConflictStrategy.REPLACE) fun insertDoomscrollEvent(event: DoomscrollEventEntity)
    @Insert(onConflict = OnConflictStrategy.REPLACE) fun insertIntervention(event: InterventionEventEntity)
    @Insert(onConflict = OnConflictStrategy.REPLACE) fun insertBlockedAttempt(attempt: BlockedAttemptEntity)
    @Query("SELECT COUNT(*) FROM blocked_attempts WHERE userId = :userId AND atMs >= :fromMs") fun blockedAttemptCount(userId: String, fromMs: Long): Int
    @Query("SELECT COUNT(*) FROM intervention_events WHERE userId = :userId AND atMs >= :fromMs") fun interventionCount(userId: String, fromMs: Long): Int
    @Insert(onConflict = OnConflictStrategy.REPLACE) fun upsertUsageApplications(apps: List<UsageApplicationEntity>)
    @Insert(onConflict = OnConflictStrategy.REPLACE) fun upsertUsageSnapshots(snapshots: List<UsageSnapshotEntity>)
    @Insert(onConflict = OnConflictStrategy.REPLACE) fun upsertDailySummary(summary: DailyUsageSummaryEntity)
    @Query("SELECT * FROM daily_usage_summaries WHERE userId = :userId AND localDate = :localDate LIMIT 1") fun dailySummary(userId: String, localDate: String): DailyUsageSummaryEntity?
    @Query("DELETE FROM usage_snapshots WHERE userId = :userId") fun deleteUsageSnapshots(userId: String)
    @Query("DELETE FROM usage_applications WHERE userId = :userId") fun deleteUsageApplications(userId: String)
    @Query("DELETE FROM daily_usage_summaries WHERE userId = :userId") fun deleteDailyUsage(userId: String)
    @Query("DELETE FROM weekly_usage_summaries WHERE userId = :userId") fun deleteWeeklyUsage(userId: String)
    @Query("DELETE FROM doomscroll_events WHERE userId = :userId") fun deleteDoomscrollEvents(userId: String)
    @Query("DELETE FROM intervention_events WHERE userId = :userId") fun deleteInterventionEvents(userId: String)
    @Query("DELETE FROM blocked_attempts WHERE userId = :userId") fun deleteBlockedAttempts(userId: String)
    @Query("DELETE FROM focus_session_events WHERE userId = :userId") fun deleteFocusEvents(userId: String)
    @Query("DELETE FROM focus_sessions WHERE userId = :userId") fun deleteFocusSessions(userId: String)
    @Insert(onConflict = OnConflictStrategy.REPLACE) fun upsertRoomFocus(session: RoomFocusSessionEntity)
    @Insert(onConflict = OnConflictStrategy.REPLACE) fun upsertUnlockCredential(metadata: UnlockCredentialMetadataEntity)
    @Query("SELECT * FROM unlock_credential_metadata WHERE userId = :userId LIMIT 1") fun unlockCredential(userId: String): UnlockCredentialMetadataEntity?
    @Insert(onConflict = OnConflictStrategy.REPLACE) fun upsertSettings(settings: DigitalDisciplineSettingsEntity)
    @Query("SELECT * FROM digital_discipline_settings WHERE userId = :userId LIMIT 1") fun settings(userId: String): DigitalDisciplineSettingsEntity?
    @Insert(onConflict = OnConflictStrategy.REPLACE) fun upsertSync(item: SyncQueueItemEntity)
    @Query("SELECT * FROM sync_queue WHERE userId = :userId ORDER BY createdAtMs ASC") fun syncQueue(userId: String): List<SyncQueueItemEntity>
    @Query("UPDATE sync_queue SET state = :state, attempts = :attempts, updatedAtMs = :updatedAtMs, lastError = :lastError WHERE id = :id") fun updateSyncState(id: String, state: String, attempts: Int, updatedAtMs: Long, lastError: String?)
}

@Database(
    entities = [
        UserLocalProfileEntity::class, FocusSessionEntity::class, FocusSessionEventEntity::class, FocusConfigurationEntity::class,
        ProtectedAppEntity::class, DoomscrollRuleEntity::class, DoomscrollEventEntity::class, InterventionEventEntity::class,
        BlockedAttemptEntity::class, UsageApplicationEntity::class, UsageSnapshotEntity::class, DailyUsageSummaryEntity::class,
        WeeklyUsageSummaryEntity::class, StudyRoomEntity::class, StudyRoomPresenceEntity::class, RoomFocusSessionEntity::class,
        DigitalDisciplineSettingsEntity::class, AllowedApplicationEntity::class, UnlockCredentialMetadataEntity::class,
        AchievementEntity::class, ProductivityMetricEntity::class, SyncQueueItemEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class DigitalDisciplineDatabase : RoomDatabase() {
    abstract fun dao(): DigitalDisciplineDao

    companion object {
        @Volatile private var instance: DigitalDisciplineDatabase? = null
        fun get(context: Context): DigitalDisciplineDatabase = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(
                context.applicationContext,
                DigitalDisciplineDatabase::class.java,
                "studybuddy-digital-discipline.db"
            ).build().also { instance = it }
        }
    }
}
