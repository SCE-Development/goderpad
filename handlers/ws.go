package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	"goderpad/config"
	"goderpad/metrics"
	"goderpad/models"
	"goderpad/services"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// This handler listens for incoming websocket connections from users
func WebSocketHandler(c *gin.Context) {
	log.Printf("WebSocket request received: %s", c.Request.URL.Path)
	roomID := c.Param("roomID")
	userID := c.Query("userId")

	hub := models.GetHub()
	room, exists := hub.GetRoom(roomID)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
		return
	}

	// The user has already "joined" the room via the HTTP endpoint
	// So we just need to set up their websocket connection
	user, userExists := room.CheckUserExists(userID)
	if !userExists {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found in room"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		metrics.WebSocketUpgradeErrorsTotal.Inc()
		return
	}

	user.Conn = conn

	// Send current cursor positions and selections of all other users to the newly connected user
	for _, otherUser := range room.GetCurrentUsers() {
		if otherUser.UserID != userID {
			pos := otherUser.GetCursorPosition()
			conn.WriteJSON(models.BroadcastMessage{
				UserID: otherUser.UserID,
				Type:   "cursor_update",
				Payload: map[string]any{
					"lineNumber": pos.Line,
					"column":     pos.Column,
				},
			})
			// Send selection if exists
			sel := otherUser.GetSelection()
			if sel != nil {
				conn.WriteJSON(models.BroadcastMessage{
					UserID: otherUser.UserID,
					Type:   "selection_update",
					Payload: map[string]any{
						"startLineNumber": sel.StartLineNumber,
						"startColumn":     sel.StartColumn,
						"endLineNumber":   sel.EndLineNumber,
						"endColumn":       sel.EndColumn,
					},
				})
			}
		}
	}

	// Start listening for messages from this user's websocket connection
	go readBroadcastsFromUser(user, room)
}

func readBroadcastsFromUser(user *models.User, room *models.Room) {
	defer closeUserConnection(user, room)

	for {
		var msg models.BroadcastMessage
		err := user.Conn.ReadJSON(&msg)
		if err != nil {
			break
		}
		if msg.Type == "cursor_update" {
			// JSON unmarshals numbers as float64, not int
			if line, ok := msg.Payload["lineNumber"].(float64); ok {
				if column, ok := msg.Payload["column"].(float64); ok {
					user.UpdateCursorPosition(int(line), int(column))
				} else {
					continue
				}
			} else {
				continue
			}
		}
		if msg.Type == "selection_update" {
			startLine, ok1 := msg.Payload["startLineNumber"].(float64)
			startCol, ok2 := msg.Payload["startColumn"].(float64)
			endLine, ok3 := msg.Payload["endLineNumber"].(float64)
			endCol, ok4 := msg.Payload["endColumn"].(float64)
			if ok1 && ok2 && ok3 && ok4 {
				user.UpdateSelection(int(startLine), int(startCol), int(endLine), int(endCol))
			} else {
				continue
			}
		}
		if msg.Type == string(models.ExecuteRequestMessageType) {
			if !config.GetEnableCodeExecution() {
				user.Send <- models.BroadcastMessage{
					UserID: user.UserID,
					Type:   string(models.ExecuteResultMessageType),
					Payload: map[string]any{
						"userId": user.UserID,
						"stdout": "",
						"stderr": "code execution is disabled! to enable, set enable_code_execution: true in config/config.yml and restart the server.",
						"code":   -1,
					},
				}
				continue
			}
			language, _ := msg.Payload["language"].(string)
			code, _ := msg.Payload["code"].(string)
			jobID := fmt.Sprintf("%s:%s:%d", room.RoomID, user.UserID, time.Now().UnixNano())
			job := models.ExecuteJob{
				JobID:    jobID,
				RoomID:   room.RoomID,
				UserID:   user.UserID,
				Language: language,
				Code:     code,
			}
			if err := services.PublishJob(context.Background(), job); err != nil {
				user.Send <- models.BroadcastMessage{
					UserID: user.UserID,
					Type:   string(models.ExecuteResultMessageType),
					Payload: map[string]any{
						"userId": user.UserID,
						"stdout": "",
						"stderr": "failed to queue execution: " + err.Error(),
						"code":   -1,
					},
				}
			}
			continue
		}
		room.Broadcast <- msg
	}
}

func closeUserConnection(user *models.User, room *models.Room) {
	userID := user.UserID // Save before closing

	// First remove user from room so they don't receive their own leave message
	room.RemoveUser(userID)

	// Broadcast user_left to remaining users
	room.Broadcast <- models.BroadcastMessage{
		UserID: userID,
		Type:   "user_left",
		Payload: map[string]any{
			"roomId": room.RoomID,
		},
	}

	// Now clean up the user's resources
	user.Conn.Close()
	user.Close()
}
