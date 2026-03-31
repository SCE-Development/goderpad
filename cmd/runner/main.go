package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"

	"goderpad/config"
	"goderpad/execution"
	"goderpad/models"
	"goderpad/redisclient"
	"goderpad/services"
)

const runnerGroup = "runners"

func runnerConsumerName() string {
	hostname, _ := os.Hostname()
	return "runner-" + hostname
}

func main() {
	if err := config.Load("config/config.yml"); err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	if err := redisclient.Init(); err != nil {
		log.Fatalf("failed to connect to redis: %v", err)
	}
	defer redisclient.Close()

	// Build sandbox Docker images before accepting jobs
	if config.GetEnableExecutionImages() {
		execution.BuildImages()
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	rdb := redisclient.GetClient()
	consumer := runnerConsumerName()

	// Create consumer group for the jobs stream
	err := rdb.XGroupCreateMkStream(ctx, services.JobsStream, runnerGroup, "0").Err()
	if err != nil && err.Error() != "BUSYGROUP Consumer Group name already exists" {
		log.Printf("warning: could not create jobs consumer group: %v", err)
	}

	log.Printf("code runner started (consumer=%s), waiting for jobs...", consumer)

	for {
		select {
		case <-ctx.Done():
			log.Println("runner shutting down")
			return
		default:
		}

		streams, err := rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group:    runnerGroup,
			Consumer: consumer,
			Streams:  []string{services.JobsStream, ">"},
			Count:    1,
			Block:    5 * time.Second,
		}).Result()

		if err != nil {
			if err == redis.Nil || ctx.Err() != nil {
				continue
			}
			log.Printf("error reading jobs stream: %v", err)
			time.Sleep(1 * time.Second)
			continue
		}

		for _, stream := range streams {
			for _, msg := range stream.Messages {
				processJob(ctx, rdb, msg)
			}
		}
	}
}

func processJob(ctx context.Context, rdb *redis.Client, msg redis.XMessage) {
	data, ok := msg.Values["data"].(string)
	if !ok {
		log.Printf("invalid job message: %s", msg.ID)
		rdb.XAck(ctx, services.JobsStream, runnerGroup, msg.ID)
		return
	}

	var job models.ExecuteJob
	if err := json.Unmarshal([]byte(data), &job); err != nil {
		log.Printf("failed to unmarshal job: %v", err)
		rdb.XAck(ctx, services.JobsStream, runnerGroup, msg.ID)
		return
	}

	log.Printf("executing job %s: %s for room %s", job.JobID, job.Language, job.RoomID)

	result := models.ExecuteResult{
		JobID:  job.JobID,
		RoomID: job.RoomID,
		UserID: job.UserID,
	}

	execResult, err := execution.RunCode(job.Language, job.Code)
	if err != nil {
		result.Stdout = ""
		result.Stderr = err.Error()
		result.Code = -1
	} else {
		result.Stdout = execResult.Stdout
		result.Stderr = execResult.Stderr
		result.Code = execResult.Code
	}

	// Publish result back to Redis
	resultData, err := json.Marshal(result)
	if err != nil {
		log.Printf("failed to marshal result for job %s: %v", job.JobID, err)
		rdb.XAck(ctx, services.JobsStream, runnerGroup, msg.ID)
		return
	}

	if err := rdb.XAdd(ctx, &redis.XAddArgs{
		Stream: services.ResultsStream,
		MaxLen: 1000,
		Approx: true,
		Values: map[string]interface{}{
			"data": string(resultData),
		},
	}).Err(); err != nil {
		log.Printf("failed to publish result for job %s: %v", job.JobID, err)
	}

	rdb.XAck(ctx, services.JobsStream, runnerGroup, msg.ID)
	log.Printf("completed job %s (exit code: %d)", job.JobID, result.Code)
}
