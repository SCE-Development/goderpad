package models

type ExecuteJob struct {
	JobID    string `json:"jobId"`
	RoomID   string `json:"roomId"`
	UserID   string `json:"userId"`
	Language string `json:"language"`
	Code     string `json:"code"`
}

type ExecuteResult struct {
	JobID  string `json:"jobId"`
	RoomID string `json:"roomId"`
	UserID string `json:"userId"`
	Stdout string `json:"stdout"`
	Stderr string `json:"stderr"`
	Code   int    `json:"code"`
}
