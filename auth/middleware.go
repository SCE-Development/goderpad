package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"goderpad/config"
)

// CookieName matches the cookie Clark sets after login. See
// SCE-Development/Clark Auth.js — must stay in sync with Clark.
const CookieName = "jwtToken"

// RequireIdentity attaches an Identity to the Gin context based on the
// jwtToken cookie. A missing or invalid cookie is NOT a rejection: the
// Identity is left as a guest and downstream routes decide whether that's
// allowed. Use RequireMinAccessLevel after this to gate officer-only paths.
func RequireIdentity() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := Identity{}
		if cookie, err := c.Cookie(CookieName); err == nil && cookie != "" {
			if claims, err := DecodeAndVerify(cookie, config.GetJWTSecret()); err == nil {
				id.Clark = claims
			}
		}
		setIdentity(c, id)
		c.Next()
	}
}

// RequireMinAccessLevel rejects unauthenticated callers with 401 and
// authenticated callers below the access level with 403. Must be chained
// after RequireIdentity.
func RequireMinAccessLevel(n int) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := IdentityFromContext(c)
		if id.Clark == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}
		if id.Clark.AccessLevel < n {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "insufficient access level"})
			return
		}
		c.Next()
	}
}
