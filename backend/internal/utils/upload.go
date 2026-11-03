package utils

import (
	"errors"
	"fmt"
	"image"
	"mime/multipart"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/disintegration/imaging"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/config"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
)

var allowedExt = map[string]string{
	".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif",
	".webp": "image/webp", ".svg": "image/svg+xml", ".pdf": "application/pdf",
	".mp4": "video/mp4", ".webm": "video/webm", ".mp3": "audio/mpeg",
	".doc": "application/msword", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	".xls": "application/vnd.ms-excel", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

const (
	maxImageSide = 2200
	thumbWidth   = 480
)

var safeFolder = strings.NewReplacer("..", "", "\\", "", " ", "-")

// SaveUpload stores a multipart file under UPLOAD_DIR/<folder>/<yyyy>/<mm>/ and returns a Media record (unsaved).
func SaveUpload(cfg *config.Config, fh *multipart.FileHeader, folder string) (*models.Media, error) {
	if fh.Size > int64(cfg.MaxUploadMB)*1024*1024 {
		return nil, fmt.Errorf("file exceeds %d MB", cfg.MaxUploadMB)
	}
	ext := strings.ToLower(filepath.Ext(fh.Filename))
	mime, ok := allowedExt[ext]
	if !ok {
		return nil, errors.New("file type not allowed")
	}
	folder = strings.Trim(safeFolder.Replace(strings.ToLower(folder)), "/")
	if folder == "" {
		folder = "general"
	}
	now := time.Now()
	rel := path.Join(folder, now.Format("2006"), now.Format("01"))
	absDir := filepath.Join(cfg.UploadDir, filepath.FromSlash(rel))
	if err := os.MkdirAll(absDir, 0o755); err != nil {
		return nil, err
	}
	name := fmt.Sprintf("%s-%s%s", now.Format("20060102-150405"), RandomToken(4), ext)
	absPath := filepath.Join(absDir, name)

	src, err := fh.Open()
	if err != nil {
		return nil, err
	}
	defer src.Close()

	m := &models.Media{
		FileName:     name,
		OriginalName: fh.Filename,
		Path:         path.Join(rel, name),
		Mime:         mime,
		Folder:       folder,
	}

	isRaster := ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".webp" || ext == ".gif"
	if isRaster {
		img, err := imaging.Decode(src, imaging.AutoOrientation(true))
		if err != nil {
			return nil, fmt.Errorf("invalid image: %w", err)
		}
		b := img.Bounds()
		if b.Dx() > maxImageSide || b.Dy() > maxImageSide {
			img = imaging.Fit(img, maxImageSide, maxImageSide, imaging.Lanczos)
		}
		if err := saveImage(img, absPath, ext); err != nil {
			return nil, err
		}
		b = img.Bounds()
		m.Width, m.Height = b.Dx(), b.Dy()
		thumbName := strings.TrimSuffix(name, ext) + "_thumb" + ext
		thumb := imaging.Resize(img, thumbWidth, 0, imaging.Lanczos)
		if err := saveImage(thumb, filepath.Join(absDir, thumbName), ext); err == nil {
			m.ThumbURL = PublicURL(cfg, path.Join(rel, thumbName))
		}
	} else {
		out, err := os.Create(absPath)
		if err != nil {
			return nil, err
		}
		defer out.Close()
		if _, err := out.ReadFrom(src); err != nil {
			return nil, err
		}
	}
	if st, err := os.Stat(absPath); err == nil {
		m.Size = st.Size()
	}
	m.URL = PublicURL(cfg, m.Path)
	return m, nil
}

func saveImage(img image.Image, absPath, ext string) error {
	switch ext {
	case ".jpg", ".jpeg":
		return imaging.Save(img, absPath, imaging.JPEGQuality(85))
	case ".png":
		return imaging.Save(img, absPath, imaging.PNGCompressionLevel(6))
	default:
		return imaging.Save(img, absPath)
	}
}

// PublicURL builds the URL path for a stored relative path.
func PublicURL(cfg *config.Config, rel string) string {
	return strings.TrimRight(cfg.UploadURL, "/") + "/" + strings.TrimLeft(filepath.ToSlash(rel), "/")
}

// DeleteUploaded removes the file and its thumbnail for a relative path.
func DeleteUploaded(cfg *config.Config, rel string) {
	if rel == "" || strings.Contains(rel, "..") {
		return
	}
	abs := filepath.Join(cfg.UploadDir, filepath.FromSlash(rel))
	_ = os.Remove(abs)
	ext := filepath.Ext(abs)
	_ = os.Remove(strings.TrimSuffix(abs, ext) + "_thumb" + ext)
}
