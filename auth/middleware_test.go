package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"goderpad/config"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func setupRouter(t *testing.T) *gin.Engine {
	t.Helper()
	config.AppConfig.Server.JWTSecret = testSecret
	r := gin.New()
	r.Use(RequireIdentity())
	return r
}

func TestRequireIdentity_NoCookie(t *testing.T) {
	r := setupRouter(t)
	r.GET("/x", func(c *gin.Context) {
		id := IdentityFromContext(c)
		if !id.IsGuest() {
			t.Errorf("expected guest, got Clark=%+v", id.Clark)
		}
		c.Status(http.StatusOK)
	})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("status = %d", w.Code)
	}
}

func TestRequireIdentity_ValidCookie(t *testing.T) {
	r := setupRouter(t)
	r.GET("/x", func(c *gin.Context) {
		id := IdentityFromContext(c)
		if id.Clark == nil {
			t.Fatal("expected Clark identity")
		}
		if id.Clark.UserID != "507f1f77bcf86cd799439011" {
			t.Errorf("UserID = %q", id.Clark.UserID)
		}
		c.Status(http.StatusOK)
	})
	tok := mintTestToken(t, testSecret, validClaims())
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.AddCookie(&http.Cookie{Name: CookieName, Value: tok})
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("status = %d", w.Code)
	}
}

func TestRequireIdentity_InvalidCookieFallsBackToGuest(t *testing.T) {
	r := setupRouter(t)
	r.GET("/x", func(c *gin.Context) {
		id := IdentityFromContext(c)
		if !id.IsGuest() {
			t.Errorf("invalid cookie should fall back to guest, got Clark=%+v", id.Clark)
		}
		c.Status(http.StatusOK)
	})
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.AddCookie(&http.Cookie{Name: CookieName, Value: "not-a-jwt"})
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("invalid cookie should not reject; status = %d", w.Code)
	}
}

func TestRequireMinAccessLevel_Guest401(t *testing.T) {
	r := setupRouter(t)
	r.GET("/x", RequireMinAccessLevel(2), func(c *gin.Context) {
		t.Fatal("handler should not run for guest")
	})
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", w.Code)
	}
}

func TestRequireMinAccessLevel_TooLow403(t *testing.T) {
	r := setupRouter(t)
	r.GET("/x", RequireMinAccessLevel(2), func(c *gin.Context) {
		t.Fatal("handler should not run for under-leveled user")
	})
	c := validClaims()
	c.AccessLevel = 1
	tok := mintTestToken(t, testSecret, c)
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.AddCookie(&http.Cookie{Name: CookieName, Value: tok})
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Errorf("status = %d, want 403", w.Code)
	}
}

func TestRequireMinAccessLevel_Officer200(t *testing.T) {
	r := setupRouter(t)
	r.GET("/x", RequireMinAccessLevel(2), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	tok := mintTestToken(t, testSecret, validClaims()) // accessLevel=2
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.AddCookie(&http.Cookie{Name: CookieName, Value: tok})
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", w.Code)
	}
}
