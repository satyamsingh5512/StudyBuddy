package realtime

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	streamPrefix = "studybuddy:realtime:user:"
	// Capped low so the realtime feed shares a ~20MB free Redis
	// with the query cache without evicting it. Events are tiny
	// invalidation topics (~100 bytes); 200/user is plenty for
	// reconnecting clients to catch up.
	maxEventsPerUser = 200
	defaultReadBlock = 25 * time.Second
	operationTimeout = 2 * time.Second
)

type Event struct {
	ID    string `json:"id"`
	Topic string `json:"topic"`
	At    string `json:"at"`
}

type Changes struct {
	Enabled bool    `json:"enabled"`
	Events  []Event `json:"events"`
	Cursor  string  `json:"cursor"`
}

type Broker struct {
	client *redis.Client
}

var (
	brokerMu sync.RWMutex
	broker   *Broker
)

// Configure enables durable Redis Streams change events only when REDIS_URL
// is configured and reachable. A Redis outage never prevents the Mongo-backed
// API from serving requests.
func Configure(ctx context.Context, rawURL string) error {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		log.Println("Redis realtime disabled (REDIS_URL is not configured)")
		return nil
	}
	opts, err := redis.ParseURL(rawURL)
	if err != nil {
		return fmt.Errorf("parse REDIS_URL: %w", err)
	}
	// Redis Cloud free tier caps concurrent connections (30/DB).
	// Keep this pool tiny; the query cache (internal/cache) has its
	// own capped pool, so combined usage stays well under the limit.
	opts.PoolSize = 5
	opts.MinIdleConns = 1
	opts.DialTimeout = 3 * time.Second
	opts.ReadTimeout = operationTimeout
	opts.WriteTimeout = operationTimeout
	client := redis.NewClient(opts)
	pingCtx, cancel := context.WithTimeout(ctx, operationTimeout)
	defer cancel()
	if err := client.Ping(pingCtx).Err(); err != nil {
		_ = client.Close()
		return fmt.Errorf("ping Redis: %w", err)
	}

	brokerMu.Lock()
	previous := broker
	broker = &Broker{client: client}
	brokerMu.Unlock()
	if previous != nil && previous.client != nil {
		_ = previous.client.Close()
	}
	log.Println("Redis Streams realtime enabled")
	return nil
}

func Close() {
	brokerMu.Lock()
	current := broker
	broker = nil
	brokerMu.Unlock()
	if current != nil && current.client != nil {
		_ = current.client.Close()
	}
}

func currentBroker() *Broker {
	brokerMu.RLock()
	defer brokerMu.RUnlock()
	return broker
}

func Enabled() bool { return currentBroker() != nil }

// NotifyChange appends a tiny event (topic only, no private record payload)
// to the user's stream. It is asynchronous so a Redis outage cannot add
// request latency.
func NotifyChange(userID, topic string) {
	current := currentBroker()
	if current == nil || current.client == nil || userID == "" || topic == "" {
		return
	}
	client := current.client
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), operationTimeout)
		defer cancel()
		_ = client.XAdd(ctx, &redis.XAddArgs{
			Stream: streamPrefix + userID,
			MaxLen: maxEventsPerUser,
			Approx: true,
			Values: map[string]any{
				"topic": topic,
				"at":    time.Now().UTC().Format(time.RFC3339Nano),
			},
		}).Err()
	}()
}

func streamCursor(ctx context.Context, client *redis.Client, stream string) string {
	info, err := client.XInfoStream(ctx, stream).Result()
	if err != nil || info == nil || info.LastEntry.ID == "" {
		return "0-0"
	}
	return info.LastEntry.ID
}

func valueString(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case []byte:
		return string(typed)
	default:
		return fmt.Sprint(typed)
	}
}

// ReadChanges waits for a bounded period and returns every event after cursor.
// A fresh client starts at the current stream tail; reconnecting clients supply
// their previous Redis stream ID and receive missed events deterministically.
func ReadChanges(ctx context.Context, userID, cursor string, block time.Duration) (Changes, error) {
	current := currentBroker()
	if current == nil || current.client == nil {
		return Changes{Enabled: false, Events: []Event{}, Cursor: cursor}, nil
	}
	if block <= 0 || block > defaultReadBlock {
		block = defaultReadBlock
	}
	stream := streamPrefix + userID
	if cursor == "" {
		cursor = streamCursor(ctx, current.client, stream)
	}

	streams, err := current.client.XRead(ctx, &redis.XReadArgs{
		Streams: []string{stream, cursor},
		Count:   100,
		Block:   block,
	}).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) || errors.Is(err, context.DeadlineExceeded) {
			return Changes{Enabled: true, Events: []Event{}, Cursor: cursor}, nil
		}
		return Changes{}, err
	}

	events := make([]Event, 0)
	for _, result := range streams {
		for _, message := range result.Messages {
			event := Event{
				ID:    message.ID,
				Topic: valueString(message.Values["topic"]),
				At:    valueString(message.Values["at"]),
			}
			if event.Topic == "" {
				continue
			}
			events = append(events, event)
			cursor = event.ID
		}
	}
	return Changes{Enabled: true, Events: events, Cursor: cursor}, nil
}
