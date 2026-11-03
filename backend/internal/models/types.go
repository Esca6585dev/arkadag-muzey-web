package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

// Translatable holds a value per language code, e.g. {"tk":"...","ru":"...","en":"..."}.
type Translatable map[string]string

func (t Translatable) Value() (driver.Value, error) {
	if t == nil {
		return "{}", nil
	}
	b, err := json.Marshal(t)
	return string(b), err
}

func (t *Translatable) Scan(v any) error {
	return scanJSON(v, t)
}

func (Translatable) GormDataType() string { return "json" }

// Get returns the value for locale, falling back to fallback locale, then any non-empty value.
func (t Translatable) Get(locale, fallback string) string {
	if t == nil {
		return ""
	}
	if v := t[locale]; v != "" {
		return v
	}
	if v := t[fallback]; v != "" {
		return v
	}
	for _, v := range t {
		if v != "" {
			return v
		}
	}
	return ""
}

func (t Translatable) Has(locale string) bool { return t != nil && t[locale] != "" }

// StringList is a JSON array of strings.
type StringList []string

func (s StringList) Value() (driver.Value, error) {
	if s == nil {
		return "[]", nil
	}
	b, err := json.Marshal(s)
	return string(b), err
}

func (s *StringList) Scan(v any) error { return scanJSON(v, s) }

func (StringList) GormDataType() string { return "json" }

// JSON is a raw JSON document column.
type JSON json.RawMessage

func (j JSON) Value() (driver.Value, error) {
	if len(j) == 0 {
		return "null", nil
	}
	return string(j), nil
}

func (j *JSON) Scan(v any) error {
	switch x := v.(type) {
	case nil:
		*j = JSON("null")
	case []byte:
		*j = JSON(append([]byte{}, x...))
	case string:
		*j = JSON(x)
	default:
		return fmt.Errorf("unsupported JSON scan type %T", v)
	}
	return nil
}

func (JSON) GormDataType() string { return "json" }

func (j JSON) MarshalJSON() ([]byte, error) {
	if len(j) == 0 {
		return []byte("null"), nil
	}
	return j, nil
}

func (j *JSON) UnmarshalJSON(data []byte) error {
	if j == nil {
		return errors.New("JSON: UnmarshalJSON on nil pointer")
	}
	*j = append((*j)[0:0], data...)
	return nil
}

func scanJSON(v any, dst any) error {
	switch x := v.(type) {
	case nil:
		return nil
	case []byte:
		if len(x) == 0 {
			return nil
		}
		return json.Unmarshal(x, dst)
	case string:
		if x == "" {
			return nil
		}
		return json.Unmarshal([]byte(x), dst)
	default:
		return fmt.Errorf("unsupported scan type %T", v)
	}
}

// Base holds common columns.
type Base struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Status values shared by content entities.
const (
	StatusDraft     = "draft"
	StatusPublished = "published"
	StatusArchived  = "archived"
)

// Roles.
const (
	RoleAdmin  = "admin"
	RoleEditor = "editor"
	RoleUser   = "user"
)
