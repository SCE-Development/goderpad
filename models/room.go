package models

import (
	"os"
	"path/filepath"
	"sync"
	"time"

	"goderpad/metrics"
	"goderpad/utils"
)

type Room struct {
	RoomID    string                `json:"roomId"`
	RoomName  string                `json:"roomName"`
	CreatedAt time.Time             `json:"-"`
	Language  string                `json:"language"`
	Documents map[string]string     `json:"documents"`
	Users     map[string]*User      `json:"users"`
	Broadcast chan BroadcastMessage `json:"-"`
	done      chan struct{}         `json:"-"`
	mu        sync.Mutex            `json:"-"`

	// File management
	dirty        bool        `json:"-"`
	lastSave     time.Time   `json:"-"`
	saveDebounce *time.Timer `json:"-"`
}

func NewRoom(roomID, roomName, language, initialCode string) *Room {
	document := utils.DefaultCodeForLanguage(language)
	if initialCode != "" {
		document = initialCode
	}
	documents := make(map[string]string)
	documents[language] = document
	room := &Room{
		RoomID:    roomID,
		RoomName:  roomName,
		CreatedAt: time.Now(),
		Language:  language,
		Documents: documents,
		Users:     make(map[string]*User),
		done:      make(chan struct{}),
		Broadcast: make(chan BroadcastMessage),
	}
	go room.BroadcastToUsers()
	return room
}

func (r *Room) Close() {
	close(r.done)
	close(r.Broadcast)
}

func (r *Room) GetDocument() string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.Documents[r.Language]
}

func (r *Room) SwitchLanguage(language string) string {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Language = language
	if doc, exists := r.Documents[language]; exists {
		return doc
	}
	r.Documents[language] = utils.DefaultCodeForLanguage(language)
	return r.Documents[language]
}

func (r *Room) AddUser(user *User) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Users[user.UserID] = user
	metrics.RoomUsersTotal.Inc()
}

func (r *Room) RemoveUser(userID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.Users[userID]; exists {
		delete(r.Users, userID)	
		metrics.RoomUsersTotal.Dec()
	}
}

func (r *Room) CheckUserExists(userID string) (*User, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	user, exists := r.Users[userID]
	return user, exists
}

func (r *Room) GetCurrentUsers() []*User {
	r.mu.Lock()
	defer r.mu.Unlock()
	users := []*User{}
	for _, user := range r.Users {
		users = append(users, user)
	}
	return users
}

// BroadcastToUsers reads broadcast messages from the room's broadcast channel and funnels to the users
func (r *Room) BroadcastToUsers() {
	for {
		select {
		case <-r.done:
			return
		case msg := <-r.Broadcast:
			r.mu.Lock()
			if msg.Type == "code_update" {
				if code, ok := msg.Payload["code"].(string); ok {
					r.Documents[r.Language] = code
					r.dirty = true
					r.scheduleSave()
				}
			}
			for _, user := range r.Users {
				// don't send the message back to the sender
				if user.UserID != msg.UserID {
					user.Send <- msg
				}
			}
			r.mu.Unlock()
		}
	}
}

func (r *Room) scheduleSave() {
	if r.saveDebounce != nil {
		r.saveDebounce.Stop()
	}
	r.saveDebounce = time.AfterFunc(3*time.Second, func() {
		r.mu.Lock()
		defer r.mu.Unlock()
		if r.dirty {
			r.saveToFile()
		}
	})
}

func (r *Room) saveToFile() {
	if !r.dirty {
		return
	}

	dirPath := filepath.Join("past", r.RoomID)
	if err := os.MkdirAll(dirPath, 0755); err != nil {
		metrics.DocumentSavesErrorsTotal.Inc()
		return
	}

	// Save an empty file named after the room for identification
	roomNamePath := filepath.Join(dirPath, r.RoomName)
	if err := os.WriteFile(roomNamePath, []byte{}, 0644); err != nil {
		metrics.DocumentSavesErrorsTotal.Inc()
		return
	}

	// Save each language's document to its own file (main.py, main.js, etc.)
	for lang, doc := range r.Documents {
		fileName := utils.FileNameForLanguage(lang)
		filePath := filepath.Join(dirPath, fileName)
		if err := os.WriteFile(filePath, []byte(doc), 0644); err != nil {
			metrics.DocumentSavesErrorsTotal.Inc()
			return
		}
	}

	r.dirty = false
	r.lastSave = time.Now()
}

func ReadDocumentFromFile(filePath string) (string, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return "", ErrFileNotFound
		}
		return "", err
	}
	return string(data), nil
}
