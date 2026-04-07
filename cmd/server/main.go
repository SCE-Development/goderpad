package main

import (
	"context"
	"log"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"goderpad/config"
	"goderpad/execution"
	"goderpad/handlers"
	"goderpad/metrics"
	"goderpad/redisclient"
	"goderpad/services"
)

func main() {
	// Load configuration
	if err := config.Load("config/config.yml"); err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     config.GetAllowedOrigins(),
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "x-api-key"},
		AllowCredentials: true,
	}))

	r.Use(prometheusMiddleware)

	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "welcome to goderpad",
		})
	})

	r.POST("/execute", handlers.ExecuteHandler)
	r.POST("/createRoom", handlers.CreateRoomHandler)
	r.POST("/joinRoom", handlers.JoinRoomHandler)
	r.POST("/switchLanguage", handlers.SwitchLanguageHandler)
	r.GET("/getRoomName/:roomID", handlers.GetRoomNameHandler)
	r.GET("/past/:roomID", handlers.GetDocumentSaveHandler)
	r.GET("/validateKey", handlers.ValidateKeyHandler)

	r.GET("/ws/:roomID", handlers.WebSocketHandler)

	r.GET("/metrics", gin.WrapH(promhttp.Handler()))

	go services.DeleteRoomSaves()

	if config.GetEnableCodeExecution() {
		go execution.BuildImages()

		if err := redisclient.Init(); err != nil {
			log.Fatalf("Failed to connect to Redis: %v", err)
		}
		defer redisclient.Close()

		ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
		defer stop()
		go services.StartResultListener(ctx)
	}
	metrics.RoomExpiryLastRun.Set(float64(time.Now().Unix()))
	r.Run(":" + config.GetPort())
}

func prometheusMiddleware(c *gin.Context) {
	if c.FullPath() == "/metrics" {
		c.Next()
		return
	}

	method := c.Request.Method
	path := c.FullPath()

	c.Next()

	status := c.Writer.Status()
	statusCode := strconv.Itoa(status)

	metrics.EndpointHits.WithLabelValues(path, method, statusCode).Inc()
}
