package auth

import "github.com/gin-gonic/gin"

const identityContextKey = "goderpad.identity"

// Identity represents who is making a request. A nil Clark pointer means
// the caller is an unauthenticated guest; callers should fall back to
// client-supplied identification (e.g. localStorage-backed userID).
type Identity struct {
	Clark *ClarkClaims
}

func (i Identity) IsGuest() bool {
	return i.Clark == nil
}

func IdentityFromContext(c *gin.Context) Identity {
	if v, ok := c.Get(identityContextKey); ok {
		if id, ok := v.(Identity); ok {
			return id
		}
	}
	return Identity{}
}

func setIdentity(c *gin.Context, id Identity) {
	c.Set(identityContextKey, id)
}
