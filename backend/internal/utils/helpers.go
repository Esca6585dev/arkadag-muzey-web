package utils

import (
	"fmt"
	"strings"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"github.com/gosimple/slug"
	"gorm.io/gorm"
)

var validate = validator.New()

// Validate runs struct validation and returns field errors (empty when valid).
func Validate(v any) map[string]string {
	err := validate.Struct(v)
	if err == nil {
		return nil
	}
	out := map[string]string{}
	if ve, ok := err.(validator.ValidationErrors); ok {
		for _, fe := range ve {
			field := strings.ToLower(fe.Field()[:1]) + fe.Field()[1:]
			field = toSnake(fe.Field())
			switch fe.Tag() {
			case "required":
				out[field] = "This field is required"
			case "email":
				out[field] = "Must be a valid email address"
			case "min":
				out[field] = fmt.Sprintf("Must be at least %s characters", fe.Param())
			case "max":
				out[field] = fmt.Sprintf("Must be at most %s characters", fe.Param())
			default:
				out[field] = "Invalid value"
			}
		}
		return out
	}
	return map[string]string{"_": err.Error()}
}

func toSnake(s string) string {
	var b strings.Builder
	for i, r := range s {
		if r >= 'A' && r <= 'Z' {
			if i > 0 {
				b.WriteByte('_')
			}
			b.WriteRune(r + 32)
		} else {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// Slugify converts text (incl. Turkmen/Cyrillic) to a URL slug.
func Slugify(s string) string {
	s = strings.NewReplacer("ä", "a", "Ä", "A", "ň", "n", "Ň", "N", "ö", "o", "Ö", "O", "ü", "u", "Ü", "U",
		"ý", "y", "Ý", "Y", "ş", "s", "Ş", "S", "ž", "z", "Ž", "Z", "ç", "c", "Ç", "C").Replace(s)
	out := slug.Make(s)
	if len(out) > 150 {
		out = out[:150]
	}
	return out
}

// UniqueSlug ensures the slug is unique in table (excluding excludeID).
func UniqueSlug(db *gorm.DB, table, base string, excludeID uint) string {
	base = Slugify(base)
	if base == "" {
		base = "item"
	}
	candidate := base
	for i := 2; i < 1000; i++ {
		var n int64
		q := db.Table(table).Where("slug = ?", candidate)
		if excludeID > 0 {
			q = q.Where("id <> ?", excludeID)
		}
		q.Count(&n)
		if n == 0 {
			return candidate
		}
		candidate = fmt.Sprintf("%s-%d", base, i)
	}
	return fmt.Sprintf("%s-%s", base, RandomToken(3))
}

// Locale returns the requested locale (query ?locale=, header X-Locale, Accept-Language) or def.
func Locale(c *fiber.Ctx, def string) string {
	l := strings.ToLower(strings.TrimSpace(c.Query("locale")))
	if l == "" {
		l = strings.ToLower(strings.TrimSpace(c.Get("X-Locale")))
	}
	if l == "" {
		al := c.Get("Accept-Language")
		if len(al) >= 2 {
			l = strings.ToLower(al[:2])
		}
	}
	if len(l) > 5 {
		l = l[:5]
	}
	if l == "" {
		return def
	}
	return l
}

// ClientIP returns the best-effort client IP.
func ClientIP(c *fiber.Ctx) string {
	if ip := c.Get("X-Forwarded-For"); ip != "" {
		return strings.TrimSpace(strings.Split(ip, ",")[0])
	}
	if ip := c.Get("X-Real-IP"); ip != "" {
		return ip
	}
	return c.IP()
}

// ParseIDs parses a JSON body {"ids":[...]}.
func ParseIDs(c *fiber.Ctx) ([]uint, error) {
	var body struct {
		IDs []uint `json:"ids"`
	}
	if err := c.BodyParser(&body); err != nil {
		return nil, err
	}
	return body.IDs, nil
}
