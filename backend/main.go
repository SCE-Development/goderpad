package main

import (
	"log"
	"net/http"
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
		AllowOrigins:     []string{"http://localhost:7777", "http://frontend:7777", "http://localhost:5173", "http://frontend:5173"},
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
	endpoint := c.FullPath()

	c.Next()

	status := c.Writer.Status()
	statusText := http.StatusText(status)
	duration := time.Since(start).Seconds()

	metrics.EndpointHits.WithLabelValues(endpoint, method, statusText).Inc()
	metrics.HTTPRequestDurationSeconds.WithLabelValues(endpoint, method, statusText).Observe(duration)
}
