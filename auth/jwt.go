package auth

import (
	"errors"
	"fmt"

	"github.com/golang-jwt/jwt/v5"
)

// ClarkClaims mirrors the payload Clark signs into its jwtToken cookie.
// Field tags match Clark's exact key names so we can decode without any
// transformation; see SCE-Development/Clark token-functions.js.
type ClarkClaims struct {
	UserID      string `json:"_id"`
	AccessLevel int    `json:"accessLevel"`
	FirstName   string `json:"firstName"`
	LastName    string `json:"lastName"`
	Email       string `json:"email"`
	jwt.RegisteredClaims
}

func (c *ClarkClaims) Name() string {
	switch {
	case c.FirstName != "" && c.LastName != "":
		return c.FirstName + " " + c.LastName
	case c.FirstName != "":
		return c.FirstName
	case c.LastName != "":
		return c.LastName
	default:
		return c.Email
	}
}

var ErrInvalidToken = errors.New("auth: invalid token")

// DecodeAndVerify parses an HS256-signed Clark JWT and returns its claims.
// Returns ErrInvalidToken for any failure (bad signature, expired, wrong
// algorithm, missing required fields) so callers don't leak parser details.
func DecodeAndVerify(tokenString, secret string) (*ClarkClaims, error) {
	if secret == "" {
		return nil, fmt.Errorf("auth: jwt secret not configured")
	}
	claims := &ClarkClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("auth: unexpected signing method %v", t.Method.Alg())
		}
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return nil, ErrInvalidToken
	}
	if claims.UserID == "" {
		return nil, ErrInvalidToken
	}
	return claims, nil
}
