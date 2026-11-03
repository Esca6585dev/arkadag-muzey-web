package handlers

import (
	"encoding/json"
	"errors"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/middleware"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

func init() {
	Register(func(d *Deps) {
		r := d.Admin.Group("/media")

		r.Get("/", func(c *fiber.Ctx) error {
			p := utils.ParseList(c, "-created_at", []string{"id", "created_at", "file_name", "original_name", "size", "folder"})
			q := d.DB.Model(&models.Media{})
			q = utils.ApplySearch(q, p.Search, []string{"file_name", "original_name", "alt"})
			if f := c.Query("folder"); f != "" {
				q = q.Where("folder = ?", f)
			}
			var items []models.Media
			meta, err := utils.Paginate(q, p, &items)
			if err != nil {
				return utils.ServerError(c, err)
			}
			if items == nil {
				items = []models.Media{}
			}
			return utils.Paginated(c, items, meta)
		})

		r.Get("/folders", func(c *fiber.Ctx) error {
			out := []fiber.Map{}
			var rows []struct {
				Folder string
				Count  int64
			}
			if err := d.DB.Model(&models.Media{}).Select("folder, COUNT(*) AS count").Group("folder").Order("folder").Scan(&rows).Error; err != nil {
				return utils.ServerError(c, err)
			}
			for _, x := range rows {
				out = append(out, fiber.Map{"folder": x.Folder, "count": x.Count})
			}
			return utils.OK(c, out)
		})

		r.Post("/upload", func(c *fiber.Ctx) error {
			form, err := c.MultipartForm()
			if err != nil {
				return utils.BadRequest(c, "Expected multipart form")
			}
			files := append(form.File["files"], form.File["file"]...)
			files = append(files, form.File["files[]"]...)
			if len(files) == 0 {
				return utils.BadRequest(c, "No files uploaded")
			}
			folder := c.FormValue("folder")
			uid := middleware.CurrentUserID(c)
			saved := []models.Media{}
			errs := []fiber.Map{}
			for _, fh := range files {
				m, err := utils.SaveUpload(d.Cfg, fh, folder)
				if err != nil {
					errs = append(errs, fiber.Map{"file": fh.Filename, "error": err.Error()})
					continue
				}
				m.UploadedBy = uid
				if err := d.DB.Create(m).Error; err != nil {
					utils.DeleteUploaded(d.Cfg, m.Path)
					errs = append(errs, fiber.Map{"file": fh.Filename, "error": err.Error()})
					continue
				}
				saved = append(saved, *m)
				LogActivity(c, d.DB, "upload", "media", m.ID, nil)
			}
			if len(saved) == 0 {
				return utils.Error(c, fiber.StatusBadRequest, "upload_failed", errs[0]["error"].(string))
			}
			resp := fiber.Map{"data": saved}
			if len(errs) > 0 {
				resp["errors"] = errs
			}
			return c.Status(fiber.StatusCreated).JSON(resp)
		})

		r.Post("/bulk-delete", func(c *fiber.Ctx) error {
			ids, err := utils.ParseIDs(c)
			if err != nil || len(ids) == 0 {
				return utils.BadRequest(c, "No ids provided")
			}
			var items []models.Media
			if err := d.DB.Find(&items, ids).Error; err != nil {
				return utils.ServerError(c, err)
			}
			n := 0
			for _, m := range items {
				if d.DB.Delete(&models.Media{}, m.ID).Error == nil {
					utils.DeleteUploaded(d.Cfg, m.Path)
					LogActivity(c, d.DB, "delete", "media", m.ID, nil)
					n++
				}
			}
			return utils.OK(c, fiber.Map{"deleted": n})
		})

		update := func(c *fiber.Ctx) error {
			id, err := c.ParamsInt("id")
			if err != nil || id <= 0 {
				return utils.BadRequest(c, "Invalid id")
			}
			var m models.Media
			if err := d.DB.First(&m, id).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return utils.NotFound(c, "")
				}
				return utils.ServerError(c, err)
			}
			var body struct {
				Alt    json.RawMessage `json:"alt"`
				Folder *string         `json:"folder"`
			}
			if err := c.BodyParser(&body); err != nil {
				return utils.BadRequest(c, "Invalid JSON body")
			}
			if len(body.Alt) > 0 && string(body.Alt) != "null" {
				var t models.Translatable
				if json.Unmarshal(body.Alt, &t) != nil {
					var s string
					if json.Unmarshal(body.Alt, &s) != nil {
						return utils.BadRequest(c, "Invalid alt")
					}
					t = models.Translatable{DefaultLocale(d.DB): s}
				}
				m.Alt = t
			}
			if body.Folder != nil && *body.Folder != "" {
				m.Folder = *body.Folder
			}
			if err := d.DB.Save(&m).Error; err != nil {
				return utils.ServerError(c, err)
			}
			LogActivity(c, d.DB, "update", "media", m.ID, nil)
			return utils.OK(c, m)
		}
		r.Put("/:id", update)
		r.Patch("/:id", update)

		r.Delete("/:id", func(c *fiber.Ctx) error {
			id, err := c.ParamsInt("id")
			if err != nil || id <= 0 {
				return utils.BadRequest(c, "Invalid id")
			}
			var m models.Media
			if err := d.DB.First(&m, id).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return utils.NotFound(c, "")
				}
				return utils.ServerError(c, err)
			}
			if err := d.DB.Delete(&m).Error; err != nil {
				return utils.ServerError(c, err)
			}
			utils.DeleteUploaded(d.Cfg, m.Path)
			LogActivity(c, d.DB, "delete", "media", m.ID, nil)
			return utils.Message(c, "Deleted")
		})
	})
}
