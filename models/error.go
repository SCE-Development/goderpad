package models

import "errors"

// Client/validation errors (4xx)
var (
	ErrRoomNil      = errors.New("room cannot be nil")
	ErrRoomExists   = errors.New("room already exists")
	ErrRoomNotFound = errors.New("room not found")
	ErrFileNotFound = errors.New("file not found")
)

// Server errors (5xx)
var (
	ErrHubUnavailable = errors.New("hub is unavailable")
	ErrStorageFailed  = errors.New("storage operation failed")
)
