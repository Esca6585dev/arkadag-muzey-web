package handlers

import (
	"encoding/json"
	"strings"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

type settingGroup struct {
	Group    string           `json:"group"`
	Settings []models.Setting `json:"settings"`
}

func groupedSettings(db *gorm.DB) []settingGroup {
	var all []models.Setting
	db.Order("`group` ASC, sort_order ASC, id ASC").Find(&all)
	var out []settingGroup
	idx := map[string]int{}
	for _, s := range all {
		i, ok := idx[s.Group]
		if !ok {
			idx[s.Group] = len(out)
			out = append(out, settingGroup{Group: s.Group})
			i = idx[s.Group]
		}
		out[i].Settings = append(out[i].Settings, s)
	}
	if out == nil {
		out = []settingGroup{}
	}
	return out
}

// SettingValue returns the raw JSON value of a setting.
func SettingValue(db *gorm.DB, key string) (json.RawMessage, bool) {
	var s models.Setting
	if err := db.Where("`key` = ?", key).First(&s).Error; err != nil {
		return nil, false
	}
	return json.RawMessage(s.Value), true
}

// SettingBool reads a boolean setting with a default.
func SettingBool(db *gorm.DB, key string, def bool) bool {
	raw, ok := SettingValue(db, key)
	if !ok {
		return def
	}
	switch strings.TrimSpace(string(raw)) {
	case "true", "\"true\"", "1":
		return true
	case "false", "\"false\"", "0":
		return false
	}
	return def
}

// PublicSettingsMap returns all public settings as key -> raw JSON value.
func PublicSettingsMap(db *gorm.DB) map[string]json.RawMessage {
	var all []models.Setting
	db.Where("is_public = ?", true).Find(&all)
	out := make(map[string]json.RawMessage, len(all))
	for _, s := range all {
		if len(s.Value) == 0 {
			out[s.Key] = json.RawMessage("null")
			continue
		}
		out[s.Key] = json.RawMessage(s.Value)
	}
	return out
}

func init() {
	Register(func(d *Deps) {
		d.Admin.Get("/settings", func(c *fiber.Ctx) error {
			return utils.OK(c, groupedSettings(d.DB))
		})

		d.AdminOnly.Put("/settings", func(c *fiber.Ctx) error {
			var body struct {
				Values map[string]json.RawMessage `json:"values"`
			}
			if err := c.BodyParser(&body); err != nil {
				return utils.BadRequest(c, "Invalid body")
			}
			if len(body.Values) == 0 {
				return utils.BadRequest(c, "No values provided")
			}
			err := d.DB.Transaction(func(tx *gorm.DB) error {
				for key, raw := range body.Values {
					if len(raw) == 0 {
						raw = json.RawMessage("null")
					}
					if err := tx.Model(&models.Setting{}).Where("`key` = ?", key).Update("value", models.JSON(raw)).Error; err != nil {
						return err
					}
				}
				return nil
			})
			if err != nil {
				return utils.ServerError(c, err)
			}
			keys := make([]string, 0, len(body.Values))
			for k := range body.Values {
				keys = append(keys, k)
			}
			LogActivity(c, d.DB, "update", "settings", 0, fiber.Map{"keys": keys})
			return utils.OK(c, groupedSettings(d.DB))
		})

		d.AdminOnly.Post("/settings", func(c *fiber.Ctx) error {
			var s models.Setting
			if err := c.BodyParser(&s); err != nil {
				return utils.BadRequest(c, "Invalid body")
			}
			s.ID = 0
			s.Key = strings.TrimSpace(s.Key)
			if s.Key == "" {
				return utils.ValidationError(c, map[string]string{"key": "This field is required"})
			}
			var n int64
			d.DB.Model(&models.Setting{}).Where("`key` = ?", s.Key).Count(&n)
			if n > 0 {
				return utils.ValidationError(c, map[string]string{"key": "Key already exists"})
			}
			if s.Group == "" {
				s.Group = "general"
			}
			if s.Type == "" {
				s.Type = "text"
			}
			if len(s.Value) == 0 {
				s.Value = models.JSON("null")
			}
			if err := d.DB.Create(&s).Error; err != nil {
				return utils.ServerError(c, err)
			}
			LogActivity(c, d.DB, "create", "setting", s.ID, nil)
			return utils.Created(c, s)
		})

		d.AdminOnly.Delete("/settings/:id", func(c *fiber.Ctx) error {
			id, _ := c.ParamsInt("id")
			res := d.DB.Delete(&models.Setting{}, id)
			if res.RowsAffected == 0 {
				return utils.NotFound(c, "")
			}
			LogActivity(c, d.DB, "delete", "setting", uint(id), nil)
			return utils.Message(c, "Deleted")
		})
	})
}
