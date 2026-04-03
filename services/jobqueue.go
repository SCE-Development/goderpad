package services

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"time"

	"github.com/redis/go-redis/v9"

	"goderpad/models"
	"goderpad/redisclient"
)

const (
	JobsStream    = "goderpad:jobs"
	ResultsStream = "goderpad:results"
	ServerGroup   = "server"
)

func serverConsumerName() string {
	hostname, _ := os.Hostname()
	return "server-" + hostname
}

// PublishJob adds an execution job to the Redis jobs stream.
func PublishJob(ctx context.Context, job models.ExecuteJob) error {
	data, err := json.Marshal(job)
	if err != nil {
		return err
	}

	return redisclient.GetClient().XAdd(ctx, &redis.XAddArgs{
		Stream: JobsStream,
		MaxLen: 1000,
		Approx: true,
		Values: map[string]interface{}{
			"data": string(data),
		},
	}).Err()
}

// StartResultListener consumes execution results from Redis and routes them
// back to the appropriate room's WebSocket connections.
func StartResultListener(ctx context.Context) {
	rdb := redisclient.GetClient()
	consumer := serverConsumerName()

	// Create consumer group, ignore error if it already exists
	err := rdb.XGroupCreateMkStream(ctx, ResultsStream, ServerGroup, "0").Err()
	if err != nil && err.Error() != "BUSYGROUP Consumer Group name already exists" {
		log.Printf("warning: could not create results consumer group: %v", err)
	}

	log.Printf("result listener started (consumer=%s)", consumer)

	for {
		select {
		case <-ctx.Done():
			log.Println("result listener shutting down")
			return
		default:
		}

		streams, err := rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group:    ServerGroup,
			Consumer: consumer,
			Streams:  []string{ResultsStream, ">"},
			Count:    10,
			Block:    5 * time.Second,
		}).Result()

		if err != nil {
			if err == redis.Nil || ctx.Err() != nil {
				continue
			}
			log.Printf("error reading results stream: %v", err)
			time.Sleep(1 * time.Second)
			continue
		}

		for _, stream := range streams {
			for _, msg := range stream.Messages {
				handleResultMessage(ctx, rdb, msg)
			}
		}
	}
}

func handleResultMessage(ctx context.Context, rdb *redis.Client, msg redis.XMessage) {
	data, ok := msg.Values["data"].(string)
	if !ok {
		log.Printf("invalid result message: %s", msg.ID)
		rdb.XAck(ctx, ResultsStream, ServerGroup, msg.ID)
		return
	}

	var result models.ExecuteResult
	if err := json.Unmarshal([]byte(data), &result); err != nil {
		log.Printf("failed to unmarshal result: %v", err)
		rdb.XAck(ctx, ResultsStream, ServerGroup, msg.ID)
		return
	}

	hub := models.GetHub()
	room, exists := hub.GetRoom(result.RoomID)
	if !exists {
		log.Printf("result for unknown room %s, discarding", result.RoomID)
		rdb.XAck(ctx, ResultsStream, ServerGroup, msg.ID)
		return
	}

	// Send execute_result to ALL users in the room (including the one who triggered it).
	// Using empty UserID so BroadcastToUsers won't skip anyone.
	room.Broadcast <- models.BroadcastMessage{
		UserID: "",
		Type:   string(models.ExecuteResultMessageType),
		Payload: map[string]any{
			"userId": result.UserID,
			"stdout": result.Stdout,
			"stderr": result.Stderr,
			"code":   result.Code,
		},
	}

	rdb.XAck(ctx, ResultsStream, ServerGroup, msg.ID)
}
