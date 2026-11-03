package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/compress"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/etag"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/config"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/database"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/routes"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/seed"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

func main() {
	cfg := config.Load()

	db, err := database.Connect(cfg)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	if err := database.Migrate(db); err != nil {
		log.Fatalf("migration failed: %v", err)
	}
	if err := seed.Run(db, cfg); err != nil {
		log.Fatalf("seed failed: %v", err)
	}

	app := fiber.New(fiber.Config{
		AppName:               "Arkadag Museum API",
		BodyLimit:             (cfg.MaxUploadMB + 2) * 1024 * 1024,
		ReadTimeout:           30 * time.Second,
		WriteTimeout:          60 * time.Second,
		DisableStartupMessage: cfg.IsProd(),
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return utils.Error(c, code, "error", err.Error())
		},
	})

	app.Use(recover.New())
	if !cfg.IsProd() {
		app.Use(logger.New(logger.Config{Format: "${time} ${status} ${latency} ${method} ${path}\n", TimeFormat: "15:04:05"}))
	}
	app.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.CORSOrigins,
		AllowCredentials: true,
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization, X-Locale, X-Requested-With",
		AllowMethods:     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
	}))
	app.Use(compress.New())
	app.Use(etag.New())

	if err := os.MkdirAll(cfg.UploadDir, 0o755); err != nil {
		log.Fatalf("cannot create upload dir: %v", err)
	}
	app.Static(cfg.UploadURL, cfg.UploadDir, fiber.Static{
		Compress:      true,
		MaxAge:        86400 * 30,
		CacheDuration: time.Hour,
	})

	routes.Setup(app, db, cfg)

	app.Use(func(c *fiber.Ctx) error {
		return utils.NotFound(c, "Route not found")
	})

	go func() {
		if err := app.Listen(":" + cfg.Port); err != nil {
			log.Fatalf("server error: %v", err)
		}
	}()
	log.Printf("API listening on %s (env=%s)", cfg.AppURL, cfg.Env)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit
	log.Println("shutting down...")
	_ = app.ShutdownWithTimeout(10 * time.Second)
}
