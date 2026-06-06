package auth

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"

	"goderpad/config"
)

// MeHandler returns the current caller's identity. Always 200 — a missing
// or invalid cookie is reported as { isGuest: true }, not an error.
func MeHandler(c *gin.Context) {
	id := IdentityFromContext(c)
	if id.Clark == nil {
		c.JSON(http.StatusOK, gin.H{"isGuest": true})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"isGuest":     false,
		"userId":      id.Clark.UserID,
		"firstName":   id.Clark.FirstName,
		"lastName":    id.Clark.LastName,
		"name":        id.Clark.Name(),
		"email":       id.Clark.Email,
		"accessLevel": id.Clark.AccessLevel,
	})
}

type devLoginRequest struct {
	Name        string `json:"name"`
	AccessLevel int    `json:"accessLevel"`
	Email       string `json:"email"`
}

// DevLoginHandler mints a JWT signed with the dev secret and sets it as the
// jwtToken cookie, mirroring what Clark does in production. Only mounted
// when config.GetDevAuth() is true; main.go enforces that at route-register
// time, so this handler trusts that and does not re-check.
func DevLoginHandler(c *gin.Context) {
	var req devLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}
	first, last := splitName(req.Name)
	if req.Email == "" {
		req.Email = "dev@example.test"
	}
	claims := ClarkClaims{
		UserID:      "dev-" + strings.ReplaceAll(strings.ToLower(req.Name), " ", "-"),
		AccessLevel: req.AccessLevel,
		FirstName:   first,
		LastName:    last,
		Email:       req.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(2 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	secret := config.GetJWTSecret()
	if secret == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "jwt secret not configured"})
		return
	}
	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to sign token"})
		return
	}
	// Match Clark's cookie attributes from SCE-Development/Clark Auth.js so
	// dev exercises the same code path prod will.
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(CookieName, signed, int((2 * time.Hour).Seconds()), "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func splitName(full string) (first, last string) {
	parts := strings.SplitN(strings.TrimSpace(full), " ", 2)
	if len(parts) == 1 {
		return parts[0], ""
	}
	return parts[0], parts[1]
}
