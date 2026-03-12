package models

type MessageType string

const (
	UserJoinedMessageType       MessageType = "user_joined"
	UserLeftMessageType         MessageType = "user_left"
	CursorUpdateMessageType     MessageType = "cursor_update"
	CodeUpdateMessageType       MessageType = "code_update"
	SelectionUpdateMessageType  MessageType = "selection_update"
	VisibilityChangeMessageType MessageType = "visibility_change"
)

type BroadcastMessage struct {
	UserID  string         `json:"userId"`
	Type    string         `json:"type"`
	Payload map[string]any `json:"payload"`
}
