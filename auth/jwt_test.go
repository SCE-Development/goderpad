package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const testSecret = "test-secret-shared-with-clark"

func mintTestToken(t *testing.T, secret string, claims ClarkClaims) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := tok.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("mint: %v", err)
	}
	return signed
}

func validClaims() ClarkClaims {
	return ClarkClaims{
		UserID:      "507f1f77bcf86cd799439011",
		AccessLevel: 2,
		FirstName:   "Ada",
		LastName:    "Lovelace",
		Email:       "ada@sce.sjsu.edu",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
}

func TestDecodeAndVerify_HappyPath(t *testing.T) {
	tok := mintTestToken(t, testSecret, validClaims())
	got, err := DecodeAndVerify(tok, testSecret)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.UserID != "507f1f77bcf86cd799439011" {
		t.Errorf("UserID = %q", got.UserID)
	}
	if got.AccessLevel != 2 {
		t.Errorf("AccessLevel = %d", got.AccessLevel)
	}
	if got.Name() != "Ada Lovelace" {
		t.Errorf("Name() = %q", got.Name())
	}
}

func TestDecodeAndVerify_WrongSecret(t *testing.T) {
	tok := mintTestToken(t, testSecret, validClaims())
	_, err := DecodeAndVerify(tok, "different-secret")
	if err != ErrInvalidToken {
		t.Fatalf("err = %v, want ErrInvalidToken", err)
	}
}

func TestDecodeAndVerify_Expired(t *testing.T) {
	c := validClaims()
	c.ExpiresAt = jwt.NewNumericDate(time.Now().Add(-time.Hour))
	tok := mintTestToken(t, testSecret, c)
	_, err := DecodeAndVerify(tok, testSecret)
	if err != ErrInvalidToken {
		t.Fatalf("err = %v, want ErrInvalidToken", err)
	}
}

func TestDecodeAndVerify_MissingUserID(t *testing.T) {
	c := validClaims()
	c.UserID = ""
	tok := mintTestToken(t, testSecret, c)
	_, err := DecodeAndVerify(tok, testSecret)
	if err != ErrInvalidToken {
		t.Fatalf("err = %v, want ErrInvalidToken (claims with no _id should be rejected)", err)
	}
}

func TestDecodeAndVerify_EmptySecret(t *testing.T) {
	tok := mintTestToken(t, testSecret, validClaims())
	_, err := DecodeAndVerify(tok, "")
	if err == nil {
		t.Fatal("expected error when secret is unset")
	}
}

func TestDecodeAndVerify_WrongAlgorithm(t *testing.T) {
	tok := jwt.NewWithClaims(jwt.SigningMethodNone, validClaims())
	signed, err := tok.SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatalf("mint: %v", err)
	}
	_, err = DecodeAndVerify(signed, testSecret)
	if err != ErrInvalidToken {
		t.Fatalf("err = %v, want ErrInvalidToken (alg=none must be rejected)", err)
	}
}

func TestClarkClaims_NameFallbacks(t *testing.T) {
	cases := []struct {
		first, last, email, want string
	}{
		{"Ada", "Lovelace", "a@b", "Ada Lovelace"},
		{"Ada", "", "a@b", "Ada"},
		{"", "Lovelace", "a@b", "Lovelace"},
		{"", "", "a@b", "a@b"},
	}
	for _, tc := range cases {
		c := ClarkClaims{FirstName: tc.first, LastName: tc.last, Email: tc.email}
		if got := c.Name(); got != tc.want {
			t.Errorf("Name(%q,%q,%q) = %q, want %q", tc.first, tc.last, tc.email, got, tc.want)
		}
	}
}
