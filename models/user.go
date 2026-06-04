package models

import (
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// WebSocket keepalive timings.
//   - PingPeriod is small enough to keep NAT/proxy idle-timeouts (often 30-60s)
//     from severing the connection while a tab is backgrounded.
//   - PongWait is the deadline for receiving a pong reply; if it elapses the
//     read loop errors and the connection is torn down.
const (
	WriteWait  = 10 * time.Second
	PongWait   = 60 * time.Second
	PingPeriod = 30 * time.Second
)

type User struct {
	UserID         string                `json:"userId"`
	Name           string                `json:"userName"`
	CursorPosition CursorPosition        `json:"cursorPosition"`
	Selection      *SelectionRange       `json:"selection"`
	Conn           *websocket.Conn       `json:"-"`
	Send           chan BroadcastMessage `json:"-"`
	done           chan struct{}         `json:"-"`
	mu             sync.Mutex            `json:"-"`
}

type CursorPosition struct {
	Line   int `json:"lineNumber"`
	Column int `json:"column"`
}

type SelectionRange struct {
	StartLineNumber int `json:"startLineNumber"`
	StartColumn     int `json:"startColumn"`
	EndLineNumber   int `json:"endLineNumber"`
	EndColumn       int `json:"endColumn"`
}

func CreateUser(userID, name string) *User {
	user := &User{
		UserID:         userID,
		Name:           name,
		CursorPosition: CursorPosition{Line: 1, Column: 1},
		Conn:           nil,
		Send:           make(chan BroadcastMessage),
		done:           make(chan struct{}),
	}
	go user.HandleBroadcasts()
	return user
}

func (u *User) Close() {
	close(u.done)
	close(u.Send)
}

func (u *User) UpdateCursorPosition(line, column int) {
	u.mu.Lock()
	defer u.mu.Unlock()
	u.CursorPosition.Line = line
	u.CursorPosition.Column = column
}

func (u *User) GetCursorPosition() CursorPosition {
	u.mu.Lock()
	defer u.mu.Unlock()
	return u.CursorPosition
}

func (u *User) UpdateSelection(startLine, startColumn, endLine, endColumn int) {
	u.mu.Lock()
	defer u.mu.Unlock()
	// If selection is empty (start equals end), clear it
	if startLine == endLine && startColumn == endColumn {
		u.Selection = nil
	} else {
		u.Selection = &SelectionRange{
			StartLineNumber: startLine,
			StartColumn:     startColumn,
			EndLineNumber:   endLine,
			EndColumn:       endColumn,
		}
	}
}

func (u *User) GetSelection() *SelectionRange {
	u.mu.Lock()
	defer u.mu.Unlock()
	return u.Selection
}

// this function reads incoming messages from the Send channel and sends to the user's websocket connection
func (u *User) HandleBroadcasts() {
	pingTicker := time.NewTicker(PingPeriod)
	defer pingTicker.Stop()
	for {
		select {
		case <-u.done:
			return
		case msg := <-u.Send:
			if u.Conn != nil {
				u.Conn.SetWriteDeadline(time.Now().Add(WriteWait))
				err := u.Conn.WriteJSON(msg)
				if err != nil {
					log.Println("Error writing to websocket:", err)
				}
			}
		case <-pingTicker.C:
			if u.Conn != nil {
				u.Conn.SetWriteDeadline(time.Now().Add(WriteWait))
				if err := u.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
					log.Println("Error sending ping:", err)
				}
			}
		}
	}
}
