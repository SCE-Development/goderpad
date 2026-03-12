package models

import (
	"sync"
	"time"
)

type Hub struct {
	Rooms map[string]*Room
	mu    sync.Mutex
}

var (
	hubInstance *Hub
	once        sync.Once
)

func GetHub() *Hub {
	once.Do(func() {
		hubInstance = &Hub{
			Rooms: make(map[string]*Room),
		}
		go hubInstance.ExpireRooms()
	})
	return hubInstance
}

func (h *Hub) GetRoom(roomID string) (*Room, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	room, exists := h.Rooms[roomID]
	return room, exists
}

func (h *Hub) AddRoom(room *Room) error {
	if room == nil {
		return ErrRoomNil
	}
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, exists := h.Rooms[room.RoomID]; exists {
		return ErrRoomExists
	}

	h.Rooms[room.RoomID] = room
	return nil
}

func (h *Hub) RemoveRoom(roomID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.Rooms, roomID)
}

// ExpireRooms is a goroutine that runs every hour, removing any rooms older than 24 hours.
func (h *Hub) ExpireRooms() {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		h.mu.Lock()
		for roomID, room := range h.Rooms {
			if time.Since(room.CreatedAt) > time.Hour*24 {
				room.Close() // close the room's channels and stop its goroutines
				delete(h.Rooms, roomID)
			}
		}
		h.mu.Unlock()
	}
}
