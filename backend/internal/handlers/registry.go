package handlers

import (
	"encoding/json"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/config"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/middleware"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

// Deps is passed to every route registrar.
//
//	Public    -> /api/v1/public   (no auth; optional user via middleware.Auth(required=false))
//	Auth      -> /api/v1/auth     (login/register/refresh/me)
//	User      -> /api/v1/user     (any authenticated user)
//	Admin     -> /api/v1/admin    (roles: admin, editor)
//	AdminOnly -> /api/v1/admin    (role: admin only) – same prefix, stricter guard
type Deps struct {
	DB        *gorm.DB
	Cfg       *config.Config
	App       *fiber.App
	Public    fiber.Router
	Auth      fiber.Router
	User      fiber.Router
	Admin     fiber.Router
	AdminOnly fiber.Router
}

type Registrar func(d *Deps)

var registrars []Registrar

// Register adds a route registrar; each handler file calls this from init().
func Register(r Registrar) { registrars = append(registrars, r) }

// MountAll invokes every registered registrar.
func MountAll(d *Deps) {
	for _, r := range registrars {
		r(d)
	}
}

// LogActivity writes an admin audit record (errors ignored).
func LogActivity(c *fiber.Ctx, db *gorm.DB, action, entity string, entityID uint, details any) {
	var det models.JSON
	if details != nil {
		if b, err := json.Marshal(details); err == nil {
			det = models.JSON(b)
		}
	}
	_ = db.Create(&models.ActivityLog{
		UserID:   middleware.CurrentUserID(c),
		Action:   action,
		Entity:   entity,
		EntityID: entityID,
		Details:  det,
		IP:       utils.ClientIP(c),
	}).Error
}

// DefaultLocale returns the default language code from DB (cached per call, cheap).
func DefaultLocale(db *gorm.DB) string {
	var code string
	db.Model(&models.Language{}).Where("is_default = ?", true).Limit(1).Pluck("code", &code)
	if code == "" {
		return "tk"
	}
	return code
}
