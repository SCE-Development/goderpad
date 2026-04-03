package redisclient

import (
	"context"
	"fmt"
	"log"

	"github.com/redis/go-redis/v9"

	"goderpad/config"
)

var client *redis.Client

func Init() error {
	client = redis.NewClient(&redis.Options{
		Addr:     config.GetRedisAddr(),
		Password: config.GetRedisPassword(),
		DB:       config.GetRedisDB(),
	})

	if err := client.Ping(context.Background()).Err(); err != nil {
		return fmt.Errorf("failed to connect to redis: %w", err)
	}

	log.Printf("connected to redis at %s", config.GetRedisAddr())
	return nil
}

func GetClient() *redis.Client {
	return client
}

func Close() {
	if client != nil {
		client.Close()
	}
}
