package main

import (
	"log"
	"strconv"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"goderpad/config"
	"goderpad/handlers"
	"goderpad/metrics"
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

	r.POST("/createRoom", handlers.CreateRoomHandler)
	r.POST("/joinRoom", handlers.JoinRoomHandler)
	r.GET("/getRoomName/:roomID", handlers.GetRoomNameHandler)
	r.GET("/past/:roomID", handlers.GetDocumentSaveHandler)

	r.GET("/ws/:roomID", handlers.WebSocketHandler)

	r.GET("/metrics", gin.WrapH(promhttp.Handler()))

	go services.DeleteRoomSaves()

	r.Run(":" + config.GetPort())
}

func prometheusMiddleware(c *gin.Context) {
	start := time.Now()
	method := c.Request.Method
	path := c.FullPath()

	c.Next()

	status := c.Writer.Status()
	statusCode := strconv.Itoa(status)
	duration := time.Since(start).Seconds()

	metrics.EndpointHits.WithLabelValues(path, method, statusCode).Inc()
	metrics.HTTPRequestDurationSeconds.WithLabelValues(path, method, statusCode).Observe(duration)
}
