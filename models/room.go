package models

import (
	"os"
	"path/filepath"
	"sync"
	"time"

	"goderpad/utils"
)

type Room struct {
	RoomID    string                `json:"roomId"`
	RoomName  string                `json:"roomName"`
	CreatedAt time.Time             `json:"-"`
	Document  string                `json:"document"`
	Users     map[string]*User      `json:"users"`
	Broadcast chan BroadcastMessage `json:"-"`
	done      chan struct{}         `json:"-"`
	mu        sync.Mutex            `json:"-"`

	// File management
	dirty        bool        `json:"-"`
	lastSave     time.Time   `json:"-"`
	saveDebounce *time.Timer `json:"-"`
}

func NewRoom(roomID, roomName string) *Room {
	room := &Room{
		RoomID:    roomID,
		RoomName:  roomName,
		CreatedAt: time.Now(),
		Document:  utils.DEFAULT_CODE,
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

func (r *Room) AddUser(user *User) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Users[user.UserID] = user
}

func (r *Room) RemoveUser(userID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.Users, userID)
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
					r.Document = code
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
		return
	}

	filePath := filepath.Join(dirPath, r.RoomName)
	if err := os.WriteFile(filePath, []byte(r.Document), 0644); err != nil {
		return
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
