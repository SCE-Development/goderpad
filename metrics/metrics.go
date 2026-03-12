package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
)

var (
	// EndpointHits counts HTTP requests by endpoint, method, and status.
	EndpointHits = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "endpoint_hits",
			Help: "Total number of HTTP requests",
		},
		[]string{"endpoint", "method", "status"},
	)

	// HTTPRequestDurationSeconds is a summary of HTTP request latencies.
	HTTPRequestDurationSeconds = prometheus.NewSummaryVec(
		prometheus.SummaryOpts{
			Name:       "http_request_duration_seconds",
			Help:       "HTTP request latency in seconds",
			Objectives: map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001},
		},
		[]string{"endpoint", "method", "status"},
	)

	// RoomsActive is the current number of rooms in the hub.
	RoomsActive = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "rooms_active",
			Help: "Current number of active rooms",
		},
	)

	// RoomUsersTotal is the current total number of users across all rooms.
	RoomUsersTotal = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "room_users_total",
			Help: "Current total number of users in all rooms",
		},
	)

	// RoomJoinErrorsTotal counts failed room join attempts.
	RoomJoinErrorsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "room_join_errors_total",
			Help: "Total number of room join errors",
		},
		[]string{"reason"},
	)

	// RoomCreateErrorsTotal counts failed room creation attempts.
	RoomCreateErrorsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "room_create_errors_total",
			Help: "Total number of room create errors",
		},
		[]string{"reason"},
	)

	// WebSocketUpgradeErrorsTotal counts failed WebSocket upgrades.
	WebSocketUpgradeErrorsTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "websocket_upgrade_errors_total",
			Help: "Total number of WebSocket upgrade errors",
		},
	)

	// DocumentSavesErrorsTotal counts failed document save operations.
	DocumentSavesErrorsTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "document_saves_errors_total",
			Help: "Total number of document save errors",
		},
	)

	// RoomExpiryLastRun is the Unix timestamp when the room-expiry goroutine last ran.
	RoomExpiryLastRun = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "room_expiry_last_run",
			Help: "Unix timestamp of the last run of the room expiry goroutine",
		},
	)
)

func init() {
	prometheus.MustRegister(
		EndpointHits,
		HTTPRequestDurationSeconds,
		RoomsActive,
		RoomUsersTotal,
		RoomJoinErrorsTotal,
		RoomCreateErrorsTotal,
		WebSocketUpgradeErrorsTotal,
		DocumentSavesErrorsTotal,
		RoomExpiryLastRun,
	)
}
