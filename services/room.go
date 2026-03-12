package services

import (
	"log"
	"os"
	"path/filepath"
	"time"

	"goderpad/models"
	"goderpad/utils"
)

// CreateRoom creates a new room with the given details.
// It does NOT add a user to the room, that is handled in the JoinRoom function.
func CreateRoom(userID, name, roomName string) (string, error) {
	roomID := utils.GenerateRoomCode()
	room := models.NewRoom(roomID, roomName)

	hub := models.GetHub()
	if err := hub.AddRoom(room); err != nil {
		return "", err
	}

	return roomID, nil
}

func JoinRoom(userID, name, roomID string) (map[string]any, error) {
	hub := models.GetHub()
	room, exists := hub.GetRoom(roomID)
	if !exists {
		return nil, models.ErrRoomNotFound
	}

	user := models.CreateUser(userID, name)
	room.AddUser(user)

	response := map[string]any{
		"roomName": room.RoomName,
		"document": room.Document,
		"users":    room.GetCurrentUsers(),
	}
	return response, nil
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
			files, err := os.ReadDir(subDirPath)
			if err != nil || len(files) == 0 {
				continue
			}
			if len(files) != 1 || files[0].IsDir() {
				log.Printf("Unexpected file structure in %s, skipping deletion", subDirPath)
				continue
			}
			filePath := filepath.Join(subDirPath, files[0].Name())
			info, err := os.Stat(filePath)
			if err != nil {
				continue
			}
			if time.Since(info.ModTime()) > 24*7*time.Hour {
				os.Remove(filePath)
				os.Remove(subDirPath)
				log.Printf("Deleted old document save: %s", filePath)
			}
		}
	}
}
