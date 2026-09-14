package config

import (
	"context"
	"log"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var DB *mongo.Database

func ConnectDB() {
	uri := os.Getenv("MONGODB_URI")
	if uri == "" {
		log.Fatal("MONGODB_URI is not set in environment variables")
	}

	clientOptions := options.Client().ApplyURI(uri).
		// Atlas M0 free tier caps connections (~500) and shares CPU/RAM.
		// A single F1/B1 instance needs only a small pool; this also
		// keeps cold-start connection storms down.
		SetMaxPoolSize(10).
		SetMinPoolSize(1).
		SetMaxConnIdleTime(5 * time.Minute)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		log.Fatal(err)
	}

	err = client.Ping(ctx, nil)
	if err != nil {
		log.Fatal(err)
	}

	DB = client.Database("studybuddy")
	log.Println("Connected to MongoDB!")
}

func GetDB() *mongo.Database {
	return DB
}
