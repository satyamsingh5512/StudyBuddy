package handlers

import (
	"context"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"

	"go.mongodb.org/mongo-driver/bson"
)

func dayStartInLocation(t time.Time, loc *time.Location) time.Time {
	local := t.In(loc)
	y, m, d := local.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, loc)
}

func reconcileUserStats(ctx context.Context, user *models.User, loc *time.Location, now time.Time) (bson.M, error) {
	updateSet := bson.M{}

	if user.StatsResetAt != nil && !user.StatsResetAt.IsZero() && !user.StatsResetAt.After(now) {
		alreadyApplied := user.StatsResetAppliedAt != nil && !user.StatsResetAppliedAt.IsZero() && !user.StatsResetAppliedAt.Before(*user.StatsResetAt)
		if !alreadyApplied {
			updateSet["totalPoints"] = 0
			updateSet["totalStudyMinutes"] = 0
			updateSet["streak"] = 0
			appliedAt := now.UTC()
			updateSet["statsResetAppliedAt"] = appliedAt
			user.TotalPoints = 0
			user.TotalStudyMins = 0
			user.Streak = 0
			user.StatsResetAppliedAt = &appliedAt
		}
	}

	if user.LastStudyAt != nil && !user.LastStudyAt.IsZero() && user.Streak > 0 {
		gapDays := int(dayStartInLocation(now, loc).Sub(dayStartInLocation(*user.LastStudyAt, loc)).Hours() / 24)
		if gapDays > 1 {
			updateSet["streak"] = 0
			user.Streak = 0
		}
	}

	if len(updateSet) == 0 {
		return nil, nil
	}

	updateSet["updatedAt"] = now
	_, err := config.DB.Collection("users").UpdateOne(ctx, bson.M{"_id": user.ID}, bson.M{"$set": updateSet})
	if err != nil {
		return nil, err
	}

	return updateSet, nil
}

