package models

type CreateRoomRequest struct {
	UserID   string `json:"userId"`
	Name     string `json:"name"`
	RoomName string `json:"roomName"`
}

type JoinRoomRequest struct {
	UserID string `json:"userId"`
	Name   string `json:"name"`
	RoomID string `json:"roomId"`
}
