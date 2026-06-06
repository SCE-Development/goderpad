package handlers

import (
	"errors"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"

	"goderpad/auth"
	"goderpad/models"
	"goderpad/services"
)

// resolveIdentity picks the trusted userID and display name for a request.
// Clark identity wins when present so a guest can't impersonate an SCE
// member by stuffing fields into the DTO; for guests we fall through to
// the client-supplied values (same trust model as before this auth work).
func resolveIdentity(c *gin.Context, dtoUserID, dtoName string) (userID, name string, isClarkAuthed bool) {
	id := auth.IdentityFromContext(c)
	if id.Clark != nil {
		return id.Clark.UserID, id.Clark.Name(), true
	}
	return dtoUserID, dtoName, false
}

func CreateRoomHandler(c *gin.Context) {
	var req models.CreateRoomRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	creatorUserID, _, _ := resolveIdentity(c, req.UserID, req.Name)
	if creatorUserID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "userId is required"})
		return
	}

	roomID, err := services.CreateRoom(creatorUserID, req.RoomName, req.Language, req.InitialCode)
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

	userID, name, isClarkAuthed := resolveIdentity(c, req.UserID, req.Name)
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "userId is required"})
		return
	}

	response, err := services.JoinRoom(userID, name, req.RoomID, isClarkAuthed)
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
			"roomName":      response["roomName"],
			"creatorUserId": response["creatorUserId"],
			"document":      response["document"],
			"language":      response["language"],
			"users":         response["users"],
			"userId":        userID,
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

func EndInterviewHandler(c *gin.Context) {
	roomID := c.Param("roomID")
	if roomID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "Room ID is required"})
		return
	}

	// Resolve who is asking: Clark cookie wins over body. For guests the
	// body's userId is the only signal — same trust model as room creation.
	var req models.EndInterviewRequest
	_ = c.ShouldBindJSON(&req)
	requesterUserID, _, _ := resolveIdentity(c, req.UserID, "")
	if requesterUserID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"ok": false, "error": "userId required to end interview"})
		return
	}

	room, exists := models.GetHub().GetRoom(roomID)
	if !exists {
		// Already gone — treat as success so a duplicate click still
		// lets the user navigate home.
		c.JSON(http.StatusOK, gin.H{"ok": true})
		return
	}
	if room.CreatorUserID != requesterUserID {
		c.JSON(http.StatusForbidden, gin.H{"ok": false, "error": "only the room creator can end the interview"})
		return
	}

	if err := services.EndInterview(roomID); err != nil {
		if errors.Is(err, models.ErrRoomNotFound) {
			// Already gone — treat as success so a duplicate click still
			// lets the user navigate home.
			c.JSON(http.StatusOK, gin.H{"ok": true})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func ListPastInterviewsHandler(c *gin.Context) {
	dirPath := "past"
	entries, err := os.ReadDir(dirPath)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"ok": true, "data": []any{}})
		return
	}

	codeExtensions := map[string]bool{".py": true, ".js": true, ".jsx": true, ".java": true, ".cpp": true}

	type interviewEntry struct {
		RoomID   string   `json:"roomId"`
		RoomName string   `json:"roomName"`
		Files    []string `json:"files"`
	}
	var interviews []interviewEntry

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		roomID := entry.Name()
		subDir := filepath.Join(dirPath, roomID)
		files, err := os.ReadDir(subDir)
		if err != nil {
			continue
		}

		interview := interviewEntry{RoomID: roomID, RoomName: roomID}
		for _, f := range files {
			name := f.Name()
			ext := filepath.Ext(name)
			if codeExtensions[ext] {
				interview.Files = append(interview.Files, name)
			} else if !f.IsDir() {
				interview.RoomName = name
			}
		}
		if len(interview.Files) > 0 {
			interviews = append(interviews, interview)
		}
	}

	c.JSON(http.StatusOK, gin.H{"ok": true, "data": interviews})
}

func GetDocumentSaveHandler(c *gin.Context) {
	roomID := c.Param("roomID")
	if roomID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Room ID is required"})
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
