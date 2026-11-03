package routes

import (
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/config"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/handlers"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/middleware"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
)

// Setup builds the router groups and mounts every registered handler.
func Setup(app *fiber.App, db *gorm.DB, cfg *config.Config) {
	api := app.Group("/api/v1")

	api.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "env": cfg.Env})
	})

	deps := &handlers.Deps{
		DB:        db,
		Cfg:       cfg,
		App:       app,
		Public:    api.Group("/public", middleware.Auth(cfg, db, false)),
		Auth:      api.Group("/auth"),
		User:      api.Group("/user", middleware.Auth(cfg, db, true)),
		Admin:     api.Group("/admin", middleware.Auth(cfg, db, true), middleware.RequireRole(models.RoleAdmin, models.RoleEditor)),
		AdminOnly: api.Group("/admin", middleware.Auth(cfg, db, true), middleware.RequireRole(models.RoleAdmin)),
	}
	handlers.MountAll(deps)
}
