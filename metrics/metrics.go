package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
)

var (
	EndpointHits = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "endpoint_hits",
			Help: "Total number of HTTP requests",
		},
		[]string{"endpoint", "method", "status"},
	)
)

func init() {
	prometheus.MustRegister(EndpointHits)
}
