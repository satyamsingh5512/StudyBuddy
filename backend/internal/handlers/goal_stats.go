package handlers

import (
	"context"
	"errors"
	"math"
	"sort"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type GoalWeekdayPattern struct {
	Weekday        string  `json:"weekday"`
	Completed      int     `json:"completed"`
	Partial        int     `json:"partial"`
	Eligible       int     `json:"eligible"`
	CompletionRate float64 `json:"completionRate"`
}

type GoalShowUpSummary struct {
	Complete int `json:"complete"`
	Partial  int `json:"partial"`
	Total    int `json:"total"`
}

type GoalStats struct {
	From           string               `json:"from"`
	To             string               `json:"to"`
	Momentum       float64              `json:"momentum"`
	CurrentStreak  int                  `json:"currentStreak"`
	BestStreak     int                  `json:"bestStreak"`
	WeekdayPattern []GoalWeekdayPattern `json:"weekdayPattern"`
	ShowUps        GoalShowUpSummary    `json:"showUps"`
	TargetMomentum *int                 `json:"targetMomentum,omitempty"`
	MomentumDelta  *float64             `json:"momentumDelta,omitempty"`
}

func roundGoalStat(value float64) float64 {
	return math.Round(value*10) / 10
}

func laterDate(left, right time.Time) time.Time {
	if right.After(left) {
		return right
	}
	return left
}

func earlierDate(left, right time.Time) time.Time {
	if right.Before(left) {
		return right
	}
	return left
}

func goalEligibilityBounds(goal models.Goal, from, to, now time.Time, location *time.Location) (time.Time, time.Time) {
	start, _ := parseDateOnlyInLocation(goal.StartDate, location)
	start = laterDate(start, from)
	end := earlierDate(to, localGoalDay(now, location))
	if goal.TargetDate != nil {
		target, _ := parseDateOnlyInLocation(*goal.TargetDate, location)
		end = earlierDate(end, target)
	}
	if goal.CompletedAt != nil {
		completed := localGoalDay(*goal.CompletedAt, location)
		end = earlierDate(end, completed)
	}
	if goal.ArchivedAt != nil {
		archived := localGoalDay(*goal.ArchivedAt, location)
		end = earlierDate(end, archived)
	}
	return start, end
}

func eligibleGoalPeriods(goal models.Goal, start, end time.Time) []time.Time {
	if end.Before(start) {
		return []time.Time{}
	}
	step := 1
	if goal.GridMode == models.GoalGridWeekly {
		step = 7
		for start.Weekday() != time.Monday {
			start = start.AddDate(0, 0, 1)
		}
	}
	periods := make([]time.Time, 0, int(end.Sub(start).Hours()/24)/step+1)
	for day := start; !day.After(end); day = day.AddDate(0, 0, step) {
		periods = append(periods, day)
	}
	return periods
}

func calculateGoalStats(goal models.Goal, showUps []models.ShowUp, checkIns []models.GoalCheckIn, from, to, now time.Time, location *time.Location) GoalStats {
	stats := GoalStats{
		From:           from.Format(goalDateLayout),
		To:             to.Format(goalDateLayout),
		WeekdayPattern: make([]GoalWeekdayPattern, 7),
	}
	for i := 0; i < 7; i++ {
		weekday := time.Weekday((i + int(time.Monday)) % 7)
		stats.WeekdayPattern[i].Weekday = weekday.String()
	}

	start, end := goalEligibilityBounds(goal, from, to, now, location)
	periods := eligibleGoalPeriods(goal, start, end)
	byDate := make(map[string]models.ShowUp, len(showUps))
	for _, entry := range showUps {
		if !showUpBelongsToCurrentDefinition(goal, entry) {
			continue
		}
		entryDate, err := parseDateOnlyInLocation(entry.Date, location)
		if err != nil || entryDate.Before(start) || entryDate.After(end) {
			continue
		}
		byDate[entry.Date] = entry
	}

	achieved := 0.0
	currentRun := 0
	for _, period := range periods {
		patternIndex := (int(period.Weekday()) - int(time.Monday) + 7) % 7
		stats.WeekdayPattern[patternIndex].Eligible++
		entry, exists := byDate[period.Format(goalDateLayout)]
		if !exists {
			currentRun = 0
			continue
		}
		switch entry.Status {
		case models.GoalActivityComplete:
			achieved++
			stats.ShowUps.Complete++
			stats.WeekdayPattern[patternIndex].Completed++
			currentRun++
		case models.GoalActivityPartial:
			achieved += 0.5
			stats.ShowUps.Partial++
			stats.WeekdayPattern[patternIndex].Partial++
			currentRun++
		default:
			currentRun = 0
			continue
		}
		stats.ShowUps.Total++
		if currentRun > stats.BestStreak {
			stats.BestStreak = currentRun
		}
	}
	// A still-open current day/week is not a missed period. If it has no
	// activity yet, measure the current streak from the preceding closed period.
	openPeriod := localGoalDay(now, location)
	if goal.GridMode == models.GoalGridWeekly {
		openPeriod = mondayOnOrBefore(openPeriod)
	}
	for i := len(periods) - 1; i >= 0; i-- {
		entry, exists := byDate[periods[i].Format(goalDateLayout)]
		hasActivity := exists && (entry.Status == models.GoalActivityComplete || entry.Status == models.GoalActivityPartial)
		if !hasActivity && periods[i].Equal(openPeriod) {
			continue
		}
		if !hasActivity {
			break
		}
		stats.CurrentStreak++
	}
	if len(periods) > 0 {
		stats.Momentum = roundGoalStat(achieved / float64(len(periods)) * 100)
	}
	for i := range stats.WeekdayPattern {
		pattern := &stats.WeekdayPattern[i]
		if pattern.Eligible > 0 {
			pattern.CompletionRate = roundGoalStat((float64(pattern.Completed) + 0.5*float64(pattern.Partial)) / float64(pattern.Eligible) * 100)
		}
	}

	sort.SliceStable(checkIns, func(i, j int) bool { return checkIns[i].WeekStart < checkIns[j].WeekStart })
	for _, checkIn := range checkIns {
		week, err := parseDateOnlyInLocation(checkIn.WeekStart, location)
		if err == nil && !week.AddDate(0, 0, 6).Before(from) && !week.After(to) {
			target := checkIn.TargetMomentum
			stats.TargetMomentum = &target
		}
	}
	if stats.TargetMomentum != nil {
		delta := roundGoalStat(stats.Momentum - float64(*stats.TargetMomentum))
		stats.MomentumDelta = &delta
	}
	return stats
}

func GetGoalStats(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	goalID, responseErr := goalIDParam(c)
	if responseErr != nil {
		return responseErr
	}
	location := goalRequestLocation(c, user)
	from, to, err := parseGoalRangeInLocation(c.Query("from"), c.Query("to"), location)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	goal, err := loadOwnedGoal(ctx, goalID, user.ID)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return sendGoalNotFound(c)
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch goal"})
	}
	activityFilter := bson.M{"userId": user.ID, "goalId": goalID, "date": bson.M{"$gte": c.Query("from"), "$lte": c.Query("to")}}
	for key, value := range currentShowUpPredicate(goal) {
		activityFilter[key] = value
	}
	showUpCursor, err := config.DB.Collection(showUpsCollection).Find(ctx, activityFilter, options.Find().SetSort(bson.D{{Key: "date", Value: 1}}))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to calculate goal stats"})
	}
	defer showUpCursor.Close(ctx)
	var showUps []models.ShowUp
	if err := showUpCursor.All(ctx, &showUps); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to calculate goal stats"})
	}
	checkInFrom := mondayOnOrBefore(from).Format(goalDateLayout)
	checkInFilter := bson.M{"userId": user.ID, "goalId": goalID, "weekStart": bson.M{"$gte": checkInFrom, "$lte": c.Query("to")}}
	checkInCursor, err := config.DB.Collection(goalCheckInsCollection).Find(ctx, checkInFilter, options.Find().SetSort(bson.D{{Key: "weekStart", Value: 1}}))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to calculate goal stats"})
	}
	defer checkInCursor.Close(ctx)
	var checkIns []models.GoalCheckIn
	if err := checkInCursor.All(ctx, &checkIns); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to calculate goal stats"})
	}
	if err := verifyLoadedGoalDefinition(ctx, goal); errors.Is(err, errGoalDefinitionStale) {
		return sendGoalDefinitionStale(c)
	} else if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to verify goal stats definition"})
	}
	return c.JSON(calculateGoalStats(goal, showUps, checkIns, from, to, goalNow(), location))
}
