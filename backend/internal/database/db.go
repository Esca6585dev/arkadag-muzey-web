package database

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/config"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
)

// Connect opens the MySQL connection, creating the database when missing.
func Connect(cfg *config.Config) (*gorm.DB, error) {
	if err := ensureDatabase(cfg); err != nil {
		return nil, err
	}
	lvl := logger.Warn
	if !cfg.IsProd() {
		lvl = logger.Warn
	}
	db, err := gorm.Open(mysql.Open(cfg.DSN()), &gorm.Config{
		Logger:                 logger.Default.LogMode(lvl),
		SkipDefaultTransaction: true,
		PrepareStmt:            true,
		NowFunc:                func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		return nil, err
	}
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetConnMaxLifetime(time.Hour)
	return db, nil
}

func ensureDatabase(cfg *config.Config) error {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/?charset=utf8mb4&parseTime=True", cfg.DBUser, cfg.DBPassword, cfg.DBHost, cfg.DBPort)
	raw, err := sql.Open("mysql", dsn)
	if err != nil {
		return err
	}
	defer raw.Close()
	_, err = raw.Exec("CREATE DATABASE IF NOT EXISTS `" + cfg.DBName + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
	return err
}

// Migrate runs AutoMigrate for all models.
func Migrate(db *gorm.DB) error {
	start := time.Now()
	if err := db.Set("gorm:table_options", "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci").
		AutoMigrate(models.AllModels()...); err != nil {
		return err
	}
	log.Printf("database migrated in %s", time.Since(start).Round(time.Millisecond))
	return nil
}
