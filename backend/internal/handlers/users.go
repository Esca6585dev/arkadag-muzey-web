package handlers

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/middleware"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

func userRoleOK(r string) bool { return r == "admin" || r == "editor" || r == "user" }
func userStatusOK(s string) bool {
	return s == "active" || s == "blocked" || s == "inactive" || s == "banned"
}

func init() {
	Register(func(d *Deps) {
		r := d.AdminOnly.Group("/users")

		// removeUserData deletes a user's dependent rows and the user.
		removeUser := func(id uint) error {
			return d.DB.Transaction(func(tx *gorm.DB) error {
				if err := tx.Where("user_id = ?", id).Delete(&models.RefreshToken{}).Error; err != nil {
					return err
				}
				if err := tx.Where("user_id = ?", id).Delete(&models.Favorite{}).Error; err != nil {
					return err
				}
				return tx.Delete(&models.User{}, id).Error
			})
		}

		r.Get("/", func(c *fiber.Ctx) error {
			p := utils.ParseList(c, "-created_at", []string{"id", "created_at", "name", "email", "role", "status", "last_login_at"})
			q := d.DB.Model(&models.User{})
			q = utils.ApplySearch(q, p.Search, []string{"name", "email"})
			if v := c.Query("role"); v != "" {
				q = q.Where("role = ?", v)
			}
			if v := c.Query("status"); v != "" {
				q = q.Where("status = ?", v)
			}
			var items []models.User
			meta, err := utils.Paginate(q, p, &items)
			if err != nil {
				return utils.ServerError(c, err)
			}
			if items == nil {
				items = []models.User{}
			}
			return utils.Paginated(c, items, meta)
		})

		r.Post("/bulk-delete", func(c *fiber.Ctx) error {
			ids, err := utils.ParseIDs(c)
			if err != nil || len(ids) == 0 {
				return utils.BadRequest(c, "No ids provided")
			}
			me := middleware.CurrentUserID(c)
			n := 0
			for _, id := range ids {
				if me != nil && *me == id {
					continue
				}
				if removeUser(id) == nil {
					LogActivity(c, d.DB, "delete", "user", id, nil)
					n++
				}
			}
			return utils.OK(c, fiber.Map{"deleted": n})
		})

		r.Get("/:id", func(c *fiber.Ctx) error {
			id, err := c.ParamsInt("id")
			if err != nil || id <= 0 {
				return utils.BadRequest(c, "Invalid id")
			}
			var u models.User
			if err := d.DB.First(&u, id).Error; err != nil {
				return utils.NotFound(c, "")
			}
			return utils.OK(c, u)
		})

		r.Post("/", func(c *fiber.Ctx) error {
			var in struct {
				Name     string `json:"name" validate:"required,min=2,max=120"`
				Email    string `json:"email" validate:"required,email"`
				Password string `json:"password" validate:"required,min=8"`
				Role     string `json:"role"`
				Status   string `json:"status"`
				Phone    string `json:"phone"`
			}
			if err := c.BodyParser(&in); err != nil {
				return utils.BadRequest(c, "Invalid JSON body")
			}
			if f := utils.Validate(&in); len(f) > 0 {
				return utils.ValidationError(c, f)
			}
			if in.Role == "" {
				in.Role = "user"
			}
			if in.Status == "" {
				in.Status = "active"
			}
			if !userRoleOK(in.Role) {
				return utils.ValidationError(c, map[string]string{"role": "Must be admin, editor or user"})
			}
			if !userStatusOK(in.Status) {
				return utils.ValidationError(c, map[string]string{"status": "Invalid status"})
			}
			in.Email = strings.ToLower(strings.TrimSpace(in.Email))
			var n int64
			d.DB.Model(&models.User{}).Where("email = ?", in.Email).Count(&n)
			if n > 0 {
				return utils.ValidationError(c, map[string]string{"email": "Email is already taken"})
			}
			hash, err := utils.HashPassword(in.Password)
			if err != nil {
				return utils.ServerError(c, err)
			}
			u := models.User{Name: in.Name, Email: in.Email, Password: hash, Role: in.Role, Status: in.Status, Phone: in.Phone, Locale: DefaultLocale(d.DB)}
			if err := d.DB.Create(&u).Error; err != nil {
				return utils.ServerError(c, err)
			}
			LogActivity(c, d.DB, "create", "user", u.ID, nil)
			return utils.Created(c, u)
		})

		update := func(c *fiber.Ctx) error {
			id, err := c.ParamsInt("id")
			if err != nil || id <= 0 {
				return utils.BadRequest(c, "Invalid id")
			}
			var u models.User
			if err := d.DB.First(&u, id).Error; err != nil {
				return utils.NotFound(c, "")
			}
			var in struct {
				Name     *string `json:"name"`
				Email    *string `json:"email"`
				Role     *string `json:"role"`
				Status   *string `json:"status"`
				Phone    *string `json:"phone"`
				Password string  `json:"password"`
			}
			if err := c.BodyParser(&in); err != nil {
				return utils.BadRequest(c, "Invalid JSON body")
			}
			me := middleware.CurrentUserID(c)
			self := me != nil && *me == u.ID
			fields := map[string]string{}
			if in.Name != nil {
				if l := len(strings.TrimSpace(*in.Name)); l < 2 || l > 120 {
					fields["name"] = "Must be between 2 and 120 characters"
				}
				u.Name = strings.TrimSpace(*in.Name)
			}
			if in.Email != nil {
				e := strings.ToLower(strings.TrimSpace(*in.Email))
				if f := utils.Validate(&struct {
					E string `validate:"required,email"`
				}{e}); len(f) > 0 {
					fields["email"] = "Must be a valid email address"
				} else if e != u.Email {
					var n int64
					d.DB.Model(&models.User{}).Where("email = ? AND id <> ?", e, u.ID).Count(&n)
					if n > 0 {
						fields["email"] = "Email is already taken"
					}
				}
				u.Email = e
			}
			if in.Role != nil && *in.Role != u.Role {
				if self {
					return utils.BadRequest(c, "You cannot change your own role")
				}
				if !userRoleOK(*in.Role) {
					fields["role"] = "Must be admin, editor or user"
				}
				u.Role = *in.Role
			}
			if in.Status != nil && *in.Status != u.Status {
				if self {
					return utils.BadRequest(c, "You cannot change your own status")
				}
				if !userStatusOK(*in.Status) {
					fields["status"] = "Invalid status"
				}
				u.Status = *in.Status
			}
			if in.Phone != nil {
				u.Phone = *in.Phone
			}
			if in.Password != "" {
				if len(in.Password) < 8 {
					fields["password"] = "Must be at least 8 characters"
				} else if h, err := utils.HashPassword(in.Password); err == nil {
					u.Password = h
				}
			}
			if len(fields) > 0 {
				return utils.ValidationError(c, fields)
			}
			if err := d.DB.Save(&u).Error; err != nil {
				return utils.ServerError(c, err)
			}
			if in.Password != "" || (in.Status != nil && u.Status != "active") {
				d.DB.Where("user_id = ?", u.ID).Delete(&models.RefreshToken{})
			}
			LogActivity(c, d.DB, "update", "user", u.ID, nil)
			return utils.OK(c, u)
		}
		r.Put("/:id", update)
		r.Patch("/:id", update)

		r.Delete("/:id", func(c *fiber.Ctx) error {
			id, err := c.ParamsInt("id")
			if err != nil || id <= 0 {
				return utils.BadRequest(c, "Invalid id")
			}
			if me := middleware.CurrentUserID(c); me != nil && *me == uint(id) {
				return utils.BadRequest(c, "You cannot delete yourself")
			}
			var n int64
			d.DB.Model(&models.User{}).Where("id = ?", id).Count(&n)
			if n == 0 {
				return utils.NotFound(c, "")
			}
			if err := removeUser(uint(id)); err != nil {
				return utils.ServerError(c, err)
			}
			LogActivity(c, d.DB, "delete", "user", uint(id), nil)
			return utils.Message(c, "Deleted")
		})
	})
}
