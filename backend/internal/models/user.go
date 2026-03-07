package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type User struct {
	ID               primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Email            string             `bson:"email" json:"email"`
	Password         string             `bson:"password" json:"-"`
	Name             string             `bson:"name" json:"name"`
	Username         string             `bson:"username" json:"username"`
	Role             string             `bson:"role" json:"role"`
	EmailVerified    bool               `bson:"emailVerified" json:"emailVerified"`
	VerificationOtp  string             `bson:"verificationOtp,omitempty" json:"-"`
	OtpExpiry        time.Time          `bson:"otpExpiry,omitempty" json:"-"`
	ResetToken       string             `bson:"resetToken,omitempty" json:"-"`
	ResetTokenExpiry time.Time          `bson:"resetTokenExpiry,omitempty" json:"-"`
	OnboardingDone   bool               `bson:"onboardingDone" json:"onboardingDone"`
	TotalPoints      int                `bson:"totalPoints" json:"totalPoints"`
	TotalStudyMins   int                `bson:"totalStudyMinutes" json:"totalStudyMinutes"`
	Streak           int                `bson:"streak" json:"streak"`
	ExamGoal         string             `bson:"examGoal,omitempty" json:"examGoal,omitempty"`
	StudentClass     string             `bson:"studentClass,omitempty" json:"studentClass,omitempty"`
	Batch            string             `bson:"batch,omitempty" json:"batch,omitempty"`
	Syllabus         string             `bson:"syllabus,omitempty" json:"syllabus,omitempty"`
	Subjects         []string           `bson:"subjects,omitempty" json:"subjects,omitempty"`
	CreatedAt        time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt        time.Time          `bson:"updatedAt" json:"updatedAt"`
	LastActive       time.Time          `bson:"lastActive" json:"lastActive"`
	ShowProfile      bool               `bson:"showProfile" json:"showProfile"`
}
