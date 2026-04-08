package handlers

import (
	"errors"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"

	"goderpad/config"
	"goderpad/models"
	"goderpad/services"
)

func CreateRoomHandler(c *gin.Context) {
	var req models.CreateRoomRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	roomID, err := services.CreateRoom(req.UserID, req.Name, req.RoomName, req.Language, req.InitialCode)
	if err != nil {
		if errors.Is(err, models.ErrRoomExists) || errors.Is(err, models.ErrRoomNil) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "data": map[string]any{
		"roomId": roomID,
	}})
}

func JoinRoomHandler(c *gin.Context) {
	var req models.JoinRoomRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	response, err := services.JoinRoom(req.UserID, req.Name, req.RoomID)
	if err != nil {
		if errors.Is(err, models.ErrRoomNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok": true,
		"data": map[string]any{
			"roomName": response["roomName"],
			"document": response["document"],
			"language": response["language"],
			"users":    response["users"],
		},
	})
}

func GetRoomNameHandler(c *gin.Context) {
	roomID := c.Param("roomID")
	if roomID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Room ID is required"})
		return
	}

	roomName, err := services.GetRoomName(roomID)
	if err != nil {
		if errors.Is(err, models.ErrRoomNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok": true,
		"data": map[string]any{
			"roomName": roomName,
		},
	})
}

func SwitchLanguageHandler(c *gin.Context) {
	var req models.SwitchLanguageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	document, err := services.SwitchLanguage(req.RoomID, req.Language)
	if err != nil {
		if errors.Is(err, models.ErrRoomNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok": true,
		"data": map[string]any{
			"document": document,
			"language": req.Language,
		},
	})
}

func ValidateKeyHandler(c *gin.Context) {
	apiKey := c.GetHeader("x-api-key")
	if apiKey == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"ok": false, "error": "API key is required"})
		return
	}
	if apiKey != config.GetAPIKey() {
		c.JSON(http.StatusForbidden, gin.H{"ok": false, "error": "Invalid API key"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func GetDocumentSaveHandler(c *gin.Context) {
	roomID := c.Param("roomID")
	if roomID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Room ID is required"})
		return
	}

	apiKey := c.GetHeader("x-api-key")
	if apiKey == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "API key is required"})
		return
	}
	if apiKey != config.GetAPIKey() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Invalid API key"})
		return
	}

	dirPath := "past/" + roomID
	entries, err := os.ReadDir(dirPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read directory"})
		return
	}

	// Read room name from the non-code marker file, and collect code files
	roomName := roomID
	type fileEntry struct {
		Name    string `json:"name"`
		Content string `json:"content"`
	}
	var files []fileEntry
	codeExtensions := map[string]bool{".py": true, ".js": true, ".jsx": true, ".java": true, ".cpp": true}
	for _, entry := range entries {
		name := entry.Name()
		if entry.IsDir() {
			continue
		}
		ext := filepath.Ext(name)
		if !codeExtensions[ext] {
			// This is the room name marker file
			roomName = name
			continue
		}
		content, err := models.ReadDocumentFromFile(dirPath + "/" + name)
		if err != nil {
			continue
		}
		files = append(files, fileEntry{Name: name, Content: content})
	}

	if len(files) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Document not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok": true,
		"data": map[string]any{
			"files":    files,
			"roomName": roomName,
		},
	})
}
