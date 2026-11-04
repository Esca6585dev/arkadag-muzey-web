package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Env         string
	Host        string
	Port        string
	AppURL      string
	FrontendURL string
	CORSOrigins string

	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string

	JWTSecret        string
	AccessTTLMinutes int
	RefreshTTLDays   int
	CookieSecure     bool
	CookieDomain     string

	UploadDir   string
	UploadURL   string
	MaxUploadMB int

	AdminName     string
	AdminEmail    string
	AdminPassword string
}

func env(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

func envInt(key string, def int) int {
	if v, err := strconv.Atoi(env(key, "")); err == nil {
		return v
	}
	return def
}

func envBool(key string, def bool) bool {
	switch strings.ToLower(env(key, "")) {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	}
	return def
}

func Load() *Config {
	_ = godotenv.Load()
	return &Config{
		Env:              env("APP_ENV", "development"),
		Host:             env("APP_HOST", ""),
		Port:             env("APP_PORT", "8080"),
		AppURL:           env("APP_URL", "http://localhost:8080"),
		FrontendURL:      env("FRONTEND_URL", "http://localhost:3000"),
		CORSOrigins:      env("CORS_ORIGINS", "http://localhost:3000"),
		DBHost:           env("DB_HOST", "127.0.0.1"),
		DBPort:           env("DB_PORT", "3306"),
		DBUser:           env("DB_USER", "root"),
		DBPassword:       env("DB_PASSWORD", ""),
		DBName:           env("DB_NAME", "arkadag_museum"),
		JWTSecret:        env("JWT_SECRET", "dev-secret-change-me"),
		AccessTTLMinutes: envInt("JWT_ACCESS_TTL_MINUTES", 60),
		RefreshTTLDays:   envInt("JWT_REFRESH_TTL_DAYS", 30),
		CookieSecure:     envBool("COOKIE_SECURE", false),
		CookieDomain:     env("COOKIE_DOMAIN", ""),
		UploadDir:        env("UPLOAD_DIR", "./uploads"),
		UploadURL:        env("UPLOAD_URL", "/uploads"),
		MaxUploadMB:      envInt("MAX_UPLOAD_MB", 20),
		AdminName:        env("ADMIN_NAME", "Administrator"),
		AdminEmail:       env("ADMIN_EMAIL", "admin@example.com"),
		AdminPassword:    env("ADMIN_PASSWORD", "Admin12345!"),
	}
}

func (c *Config) DSN() string {
	return fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=UTC",
		c.DBUser, c.DBPassword, c.DBHost, c.DBPort, c.DBName)
}

func (c *Config) IsProd() bool { return c.Env == "production" }
