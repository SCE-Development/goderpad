package handlers

import (
	"errors"
	"net/http"
	"os"

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

	roomID, err := services.CreateRoom(req.UserID, req.Name, req.RoomName)
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
	files, err := os.ReadDir(dirPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read directory"})
		return
	}
	if len(files) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Document not found"})
		return
	}
	fileName := files[0].Name()
	data, err := models.ReadDocumentFromFile(dirPath + "/" + fileName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read document"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"ok": true,
		"data": map[string]any{
			"document": data,
			"roomName": fileName,
		},
	})
}
