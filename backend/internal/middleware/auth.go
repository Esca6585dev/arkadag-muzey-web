package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/config"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

const userKey = "current_user"

// Auth authenticates via Bearer header or access_token cookie. When required is false,
// unauthenticated requests pass through with no user.
func Auth(cfg *config.Config, db *gorm.DB, required bool) fiber.Handler {
	return func(c *fiber.Ctx) error {
		token := ""
		if h := c.Get("Authorization"); strings.HasPrefix(strings.ToLower(h), "bearer ") {
			token = strings.TrimSpace(h[7:])
		}
		if token == "" {
			token = c.Cookies("access_token")
		}
		if token == "" {
			if required {
				return utils.Unauthorized(c, "")
			}
			return c.Next()
		}
		claims, err := utils.ParseAccessToken(cfg.JWTSecret, token)
		if err != nil {
			if required {
				return utils.Error(c, fiber.StatusUnauthorized, "token_expired", "Session expired, please sign in again")
			}
			return c.Next()
		}
		var user models.User
		if err := db.First(&user, claims.UserID).Error; err != nil || user.Status != "active" {
			if required {
				return utils.Unauthorized(c, "Account not available")
			}
			return c.Next()
		}
		c.Locals(userKey, &user)
		return c.Next()
	}
}

// RequireRole allows only users with one of the given roles.
func RequireRole(roles ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		u := CurrentUser(c)
		if u == nil {
			return utils.Unauthorized(c, "")
		}
		for _, r := range roles {
			if u.Role == r {
				return c.Next()
			}
		}
		return utils.Forbidden(c, "")
	}
}

// CurrentUser returns the authenticated user or nil.
func CurrentUser(c *fiber.Ctx) *models.User {
	if u, ok := c.Locals(userKey).(*models.User); ok {
		return u
	}
	return nil
}

// CurrentUserID returns a pointer to the authenticated user's id or nil.
func CurrentUserID(c *fiber.Ctx) *uint {
	if u := CurrentUser(c); u != nil {
		id := u.ID
		return &id
	}
	return nil
}
