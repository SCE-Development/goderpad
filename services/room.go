package services

import (
	"log"
	"os"
	"path/filepath"
	"time"

	"goderpad/metrics"
	"goderpad/models"
	"goderpad/utils"
)

// CreateRoom creates a new room with the given details.
// It does NOT add a user to the room, that is handled in the JoinRoom function.
func CreateRoom(userID, name, roomName, language, initialCode string) (string, error) {
	roomID := utils.GenerateRoomCode()
	room := models.NewRoom(roomID, roomName, language, initialCode)

	hub := models.GetHub()
	if err := hub.AddRoom(room); err != nil {
		metrics.RoomCreateErrorsTotal.Inc()
		return "", err
	}

	return roomID, nil
}

func JoinRoom(userID, name, roomID string) (map[string]any, error) {
	hub := models.GetHub()
	room, exists := hub.GetRoom(roomID)
	if !exists {
		metrics.RoomJoinErrorsTotal.Inc()
		return nil, models.ErrRoomNotFound
	}

	user := models.CreateUser(userID, name)
	room.AddUser(user)

	response := map[string]any{
		"roomName": room.RoomName,
		"document": room.GetDocument(),
		"language": room.Language,
		"users":    room.GetCurrentUsers(),
	}
	return response, nil
}

func SwitchLanguage(roomID, language string) (string, error) {
	hub := models.GetHub()
	room, exists := hub.GetRoom(roomID)
	if !exists {
		return "", models.ErrRoomNotFound
	}
	document := room.SwitchLanguage(language)
	return document, nil
}

func GetRoomName(roomID string) (string, error) {
	hub := models.GetHub()
	room, exists := hub.GetRoom(roomID)
	if !exists {
		return "", models.ErrRoomNotFound
	}
	return room.RoomName, nil
}

// Goroutine that runs every hour to delete document saves older than 7 days.
func DeleteRoomSaves() {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	baseDir := "past/"

	for range ticker.C {
		entries, err := os.ReadDir(baseDir)
		if err != nil {
			continue
		}

		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}
			subDirPath := filepath.Join(baseDir, entry.Name())
			info, err := entry.Info()
			if err != nil {
				continue
			}
			if time.Since(info.ModTime()) > 24*7*time.Hour {
				os.RemoveAll(subDirPath)
				log.Printf("Deleted old document save: %s", subDirPath)
			}
		}
	}
}
