package handlers

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/config"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/middleware"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

func init() {
	Register(func(d *Deps) {
		h := &authHandler{db: d.DB, cfg: d.Cfg}
		d.Auth.Post("/register", h.Register)
		d.Auth.Post("/login", h.Login)
		d.Auth.Post("/refresh", h.Refresh)
		d.Auth.Post("/logout", h.Logout)
		// authenticated
		me := d.Auth.Group("", middleware.Auth(d.Cfg, d.DB, true))
		me.Get("/me", h.Me)
		me.Put("/me", h.UpdateMe)
		me.Put("/me/password", h.ChangePassword)
		me.Get("/sessions", h.Sessions)
		me.Delete("/sessions/:id", h.RevokeSession)
	})
}

type authHandler struct {
	db  *gorm.DB
	cfg *config.Config
}

type registerInput struct {
	Name     string `json:"name" validate:"required,min=2,max=120"`
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8,max=72"`
	Phone    string `json:"phone"`
	Locale   string `json:"locale"`
}

type loginInput struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
	Remember bool   `json:"remember"`
}

func (h *authHandler) registrationEnabled() bool {
	var s models.Setting
	if err := h.db.Where("`key` = ?", "features.registration").First(&s).Error; err != nil {
		return true
	}
	return strings.TrimSpace(string(s.Value)) != "false"
}

func (h *authHandler) Register(c *fiber.Ctx) error {
	if !h.registrationEnabled() {
		return utils.Forbidden(c, "Registration is disabled")
	}
	var in registerInput
	if err := c.BodyParser(&in); err != nil {
		return utils.BadRequest(c, "Invalid body")
	}
	if f := utils.Validate(in); len(f) > 0 {
		return utils.ValidationError(c, f)
	}
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	var n int64
	h.db.Model(&models.User{}).Where("email = ?", in.Email).Count(&n)
	if n > 0 {
		return utils.ValidationError(c, map[string]string{"email": "Email is already registered"})
	}
	hash, err := utils.HashPassword(in.Password)
	if err != nil {
		return utils.ServerError(c, err)
	}
	locale := in.Locale
	if locale == "" {
		locale = utils.Locale(c, DefaultLocale(h.db))
	}
	user := models.User{Name: strings.TrimSpace(in.Name), Email: in.Email, Password: hash, Role: models.RoleUser, Phone: in.Phone, Locale: locale, Status: "active"}
	if err := h.db.Create(&user).Error; err != nil {
		return utils.ServerError(c, err)
	}
	LogActivity(c, h.db, "register", "user", user.ID, nil)
	return h.issueTokens(c, &user, true, fiber.StatusCreated)
}

func (h *authHandler) Login(c *fiber.Ctx) error {
	var in loginInput
	if err := c.BodyParser(&in); err != nil {
		return utils.BadRequest(c, "Invalid body")
	}
	if f := utils.Validate(in); len(f) > 0 {
		return utils.ValidationError(c, f)
	}
	var user models.User
	if err := h.db.Where("email = ?", strings.ToLower(strings.TrimSpace(in.Email))).First(&user).Error; err != nil || !utils.CheckPassword(user.Password, in.Password) {
		return utils.Error(c, fiber.StatusUnauthorized, "invalid_credentials", "Invalid email or password")
	}
	if user.Status != "active" {
		return utils.Forbidden(c, "Account is blocked")
	}
	now := time.Now()
	h.db.Model(&user).Update("last_login_at", now)
	user.LastLoginAt = &now
	return h.issueTokens(c, &user, true, fiber.StatusOK)
}

func (h *authHandler) issueTokens(c *fiber.Ctx, user *models.User, newRefresh bool, status int) error {
	accessTTL := time.Duration(h.cfg.AccessTTLMinutes) * time.Minute
	access, err := utils.GenerateAccessToken(h.cfg.JWTSecret, user.ID, user.Role, accessTTL)
	if err != nil {
		return utils.ServerError(c, err)
	}
	refreshTTL := time.Duration(h.cfg.RefreshTTLDays) * 24 * time.Hour
	refresh := ""
	if newRefresh {
		refresh = utils.RandomToken(32)
		h.db.Create(&models.RefreshToken{
			UserID:    user.ID,
			TokenHash: utils.HashToken(refresh),
			UserAgent: c.Get("User-Agent"),
			IP:        utils.ClientIP(c),
			ExpiresAt: time.Now().Add(refreshTTL),
		})
		h.db.Where("expires_at < ?", time.Now()).Delete(&models.RefreshToken{})
	}
	h.setCookie(c, "access_token", access, accessTTL, "/")
	if refresh != "" {
		h.setCookie(c, "refresh_token", refresh, refreshTTL, "/")
	}
	return c.Status(status).JSON(fiber.Map{"data": fiber.Map{
		"user":          user,
		"access_token":  access,
		"refresh_token": refresh,
		"expires_in":    int(accessTTL.Seconds()),
	}})
}

func (h *authHandler) setCookie(c *fiber.Ctx, name, value string, ttl time.Duration, path string) {
	c.Cookie(&fiber.Cookie{
		Name:     name,
		Value:    value,
		Path:     path,
		Domain:   h.cfg.CookieDomain,
		MaxAge:   int(ttl.Seconds()),
		Expires:  time.Now().Add(ttl),
		HTTPOnly: true,
		Secure:   h.cfg.CookieSecure,
		SameSite: "Lax",
	})
}

func (h *authHandler) clearCookies(c *fiber.Ctx) {
	for _, n := range []string{"access_token", "refresh_token"} {
		c.Cookie(&fiber.Cookie{Name: n, Value: "", Path: "/", Domain: h.cfg.CookieDomain, MaxAge: -1, Expires: time.Now().Add(-time.Hour), HTTPOnly: true, Secure: h.cfg.CookieSecure, SameSite: "Lax"})
	}
}

func (h *authHandler) Refresh(c *fiber.Ctx) error {
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	_ = c.BodyParser(&body)
	token := body.RefreshToken
	if token == "" {
		token = c.Cookies("refresh_token")
	}
	if token == "" {
		return utils.Unauthorized(c, "Missing refresh token")
	}
	var rt models.RefreshToken
	if err := h.db.Where("token_hash = ?", utils.HashToken(token)).First(&rt).Error; err != nil || rt.ExpiresAt.Before(time.Now()) {
		h.clearCookies(c)
		return utils.Error(c, fiber.StatusUnauthorized, "invalid_refresh", "Refresh token is invalid or expired")
	}
	var user models.User
	if err := h.db.First(&user, rt.UserID).Error; err != nil || user.Status != "active" {
		h.clearCookies(c)
		return utils.Unauthorized(c, "Account not available")
	}
	h.db.Delete(&rt) // rotate
	return h.issueTokens(c, &user, true, fiber.StatusOK)
}

func (h *authHandler) Logout(c *fiber.Ctx) error {
	if token := c.Cookies("refresh_token"); token != "" {
		h.db.Where("token_hash = ?", utils.HashToken(token)).Delete(&models.RefreshToken{})
	}
	h.clearCookies(c)
	return utils.Message(c, "Logged out")
}

func (h *authHandler) Me(c *fiber.Ctx) error {
	return utils.OK(c, middleware.CurrentUser(c))
}

func (h *authHandler) UpdateMe(c *fiber.Ctx) error {
	u := middleware.CurrentUser(c)
	var in struct {
		Name   *string `json:"name"`
		Phone  *string `json:"phone"`
		Avatar *string `json:"avatar"`
		Locale *string `json:"locale"`
	}
	if err := c.BodyParser(&in); err != nil {
		return utils.BadRequest(c, "Invalid body")
	}
	updates := map[string]any{}
	if in.Name != nil && len(strings.TrimSpace(*in.Name)) >= 2 {
		updates["name"] = strings.TrimSpace(*in.Name)
	}
	if in.Phone != nil {
		updates["phone"] = *in.Phone
	}
	if in.Avatar != nil {
		updates["avatar"] = *in.Avatar
	}
	if in.Locale != nil && *in.Locale != "" {
		updates["locale"] = *in.Locale
	}
	if len(updates) > 0 {
		if err := h.db.Model(u).Updates(updates).Error; err != nil {
			return utils.ServerError(c, err)
		}
	}
	h.db.First(u, u.ID)
	return utils.OK(c, u)
}

func (h *authHandler) ChangePassword(c *fiber.Ctx) error {
	u := middleware.CurrentUser(c)
	var in struct {
		Current string `json:"current_password" validate:"required"`
		New     string `json:"new_password" validate:"required,min=8,max=72"`
	}
	if err := c.BodyParser(&in); err != nil {
		return utils.BadRequest(c, "Invalid body")
	}
	if f := utils.Validate(in); len(f) > 0 {
		return utils.ValidationError(c, f)
	}
	if !utils.CheckPassword(u.Password, in.Current) {
		return utils.ValidationError(c, map[string]string{"current_password": "Current password is incorrect"})
	}
	hash, err := utils.HashPassword(in.New)
	if err != nil {
		return utils.ServerError(c, err)
	}
	h.db.Model(u).Update("password", hash)
	h.db.Where("user_id = ?", u.ID).Delete(&models.RefreshToken{})
	LogActivity(c, h.db, "password_change", "user", u.ID, nil)
	return h.issueTokens(c, u, true, fiber.StatusOK)
}

func (h *authHandler) Sessions(c *fiber.Ctx) error {
	u := middleware.CurrentUser(c)
	var list []models.RefreshToken
	h.db.Where("user_id = ? AND expires_at > ?", u.ID, time.Now()).Order("created_at DESC").Find(&list)
	return utils.OK(c, list)
}

func (h *authHandler) RevokeSession(c *fiber.Ctx) error {
	u := middleware.CurrentUser(c)
	id, _ := c.ParamsInt("id")
	h.db.Where("user_id = ? AND id = ?", u.ID, id).Delete(&models.RefreshToken{})
	return utils.Message(c, "Session revoked")
}
