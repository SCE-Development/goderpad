package models

type CreateRoomRequest struct {
	UserID      string `json:"userId"`
	Name        string `json:"name"`
	RoomName    string `json:"roomName"`
	Language    string `json:"language"`
	InitialCode string `json:"initialCode"`
}

type JoinRoomRequest struct {
	UserID string `json:"userId"`
	Name   string `json:"name"`
	RoomID string `json:"roomId"`
}
