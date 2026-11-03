package handlers

import (
	"errors"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/middleware"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

func favTypeOK(t string) bool {
	return t == "article" || t == "exhibit" || t == "event" || t == "hall"
}

// favTargetExists checks the target row exists.
func favTargetExists(db *gorm.DB, t string, id uint) bool {
	var n int64
	switch t {
	case "article":
		db.Model(&models.Article{}).Where("id = ?", id).Count(&n)
	case "exhibit":
		db.Model(&models.Exhibit{}).Where("id = ?", id).Count(&n)
	case "event":
		db.Model(&models.Event{}).Where("id = ?", id).Count(&n)
	case "hall":
		db.Model(&models.Hall{}).Where("id = ?", id).Count(&n)
	}
	return n > 0
}

// loadFavTargets attaches Target to each favorite, one query per type.
func loadFavTargets(db *gorm.DB, favs []models.Favorite) {
	byType := map[string][]uint{}
	for _, f := range favs {
		byType[f.TargetType] = append(byType[f.TargetType], f.TargetID)
	}
	found := map[string]map[uint]any{}
	for t, ids := range byType {
		m := map[uint]any{}
		switch t {
		case "article":
			var rows []models.Article
			db.Omit("body").Find(&rows, ids)
			for i := range rows {
				m[rows[i].ID] = rows[i]
			}
		case "exhibit":
			var rows []models.Exhibit
			db.Preload("Hall").Find(&rows, ids)
			for i := range rows {
				m[rows[i].ID] = rows[i]
			}
		case "event":
			var rows []models.Event
			db.Find(&rows, ids)
			for i := range rows {
				m[rows[i].ID] = rows[i]
			}
		case "hall":
			var rows []models.Hall
			db.Find(&rows, ids)
			for i := range rows {
				m[rows[i].ID] = rows[i]
			}
		}
		found[t] = m
	}
	for i := range favs {
		if t, ok := found[favs[i].TargetType][favs[i].TargetID]; ok {
			favs[i].Target = t
		}
	}
}

func init() {
	Register(func(d *Deps) {
		r := d.User.Group("/favorites")

		r.Get("/", func(c *fiber.Ctx) error {
			u := middleware.CurrentUser(c)
			q := d.DB.Where("user_id = ?", u.ID)
			if t := c.Query("type"); t != "" {
				if !favTypeOK(t) {
					return utils.BadRequest(c, "Invalid type")
				}
				q = q.Where("target_type = ?", t)
			}
			var favs []models.Favorite
			if err := q.Order("created_at DESC, id DESC").Find(&favs).Error; err != nil {
				return utils.ServerError(c, err)
			}
			loadFavTargets(d.DB, favs)
			if favs == nil {
				favs = []models.Favorite{}
			}
			return utils.OK(c, favs)
		})

		r.Get("/check", func(c *fiber.Ctx) error {
			u := middleware.CurrentUser(c)
			t := c.Query("type")
			if !favTypeOK(t) {
				return utils.BadRequest(c, "Invalid type")
			}
			ids := []uint{}
			for _, s := range strings.Split(c.Query("ids"), ",") {
				if n, err := strconv.ParseUint(strings.TrimSpace(s), 10, 64); err == nil && n > 0 {
					ids = append(ids, uint(n))
				}
			}
			out := []uint{}
			if len(ids) > 0 {
				d.DB.Model(&models.Favorite{}).Where("user_id = ? AND target_type = ? AND target_id IN ?", u.ID, t, ids).Pluck("target_id", &out)
			}
			return utils.OK(c, fiber.Map{"ids": out})
		})

		r.Post("/", func(c *fiber.Ctx) error {
			u := middleware.CurrentUser(c)
			var in struct {
				TargetType string `json:"target_type"`
				TargetID   uint   `json:"target_id"`
			}
			if err := c.BodyParser(&in); err != nil {
				return utils.BadRequest(c, "Invalid JSON body")
			}
			if !favTypeOK(in.TargetType) || in.TargetID == 0 {
				return utils.ValidationError(c, map[string]string{"target_type": "Must be article, exhibit, event or hall", "target_id": "Required"})
			}
			var f models.Favorite
			err := d.DB.Where("user_id = ? AND target_type = ? AND target_id = ?", u.ID, in.TargetType, in.TargetID).First(&f).Error
			if err == nil {
				if err := d.DB.Delete(&f).Error; err != nil {
					return utils.ServerError(c, err)
				}
				return utils.OK(c, fiber.Map{"favorited": false})
			}
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return utils.ServerError(c, err)
			}
			if !favTargetExists(d.DB, in.TargetType, in.TargetID) {
				return utils.NotFound(c, "Target not found")
			}
			f = models.Favorite{UserID: u.ID, TargetType: in.TargetType, TargetID: in.TargetID}
			if err := d.DB.Create(&f).Error; err != nil {
				return utils.ServerError(c, err)
			}
			return utils.OK(c, fiber.Map{"favorited": true})
		})

		r.Delete("/:type/:id", func(c *fiber.Ctx) error {
			u := middleware.CurrentUser(c)
			id, err := c.ParamsInt("id")
			if err != nil || id <= 0 || !favTypeOK(c.Params("type")) {
				return utils.BadRequest(c, "Invalid type or id")
			}
			if err := d.DB.Where("user_id = ? AND target_type = ? AND target_id = ?", u.ID, c.Params("type"), id).Delete(&models.Favorite{}).Error; err != nil {
				return utils.ServerError(c, err)
			}
			return utils.Message(c, "Removed")
		})

		d.User.Get("/dashboard", func(c *fiber.Ctx) error {
			u := middleware.CurrentUser(c)
			var favs, msgs int64
			d.DB.Model(&models.Favorite{}).Where("user_id = ?", u.ID).Count(&favs)
			d.DB.Model(&models.ContactMessage{}).Where("(user_id = ? OR email = ?)", u.ID, u.Email).Count(&msgs)
			return utils.OK(c, fiber.Map{"favorites": favs, "messages": msgs, "member_since": u.CreatedAt})
		})
	})
}
