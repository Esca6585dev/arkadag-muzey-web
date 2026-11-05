package main

import (
	"encoding/json"
	"log"
	"path"
	"sort"
	"strings"
	"time"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

type legacyRow struct {
	ID        int
	Title     string
	Alias     string
	Introtext string
	Fulltext  string
	State     int
	Created   time.Time
	PublishUp *time.Time
	Modified  *time.Time
	Hits      int64
	Language  string
	Images    string
	Attribs   string
	Metadesc  string
}

// item is one prepared legacy article row (one language).
type item struct {
	row     legacyRow
	lang    string
	title   string
	body    string // HTML with rewritten image URLs
	meta    string
	imgRels []string // legacy image paths (cover + gallery), in display order
	bodyImg []string // already-copied URLs of images found inside the body
	date    time.Time
}

// group is one news story: the same story in up to three languages.
type group struct {
	items []*item
	langs map[string]bool
	imgs  map[string]bool
	date  time.Time
}

func (g *group) primary() *item {
	for _, it := range g.items {
		if it.lang == "tk" {
			return it
		}
	}
	return g.items[0]
}

func (im *importer) importContent(newsCat, eventsCat, authorID *uint) {
	var rows []legacyRow
	err := im.legacy.Raw("SELECT id, title, alias, introtext, `fulltext`, state, created, publish_up, modified, hits, language, images, attribs, metadesc FROM " +
		*prefix + "content WHERE state IN (0,1) ORDER BY COALESCE(publish_up, created), id").Scan(&rows).Error
	if err != nil {
		log.Fatalf("read legacy articles: %v", err)
	}
	log.Printf("legacy articles: %d", len(rows))

	groups := im.groupRows(rows)
	log.Printf("news stories after merging languages: %d", len(groups))

	type galleryRank struct {
		id   uint
		date time.Time
	}
	var ranks []galleryRank

	for _, g := range groups {
		art, ok := im.saveArticle(g, newsCat, eventsCat, authorID)
		if !ok {
			continue
		}
		if isEventStory(g) {
			im.saveEvent(g, art)
		}
		if id := im.saveGallery(g, art); id > 0 {
			ranks = append(ranks, galleryRank{id, g.date})
		}
	}

	// newest albums first, after the hand-made ones (sort_order 0)
	if !*dryRun {
		sort.Slice(ranks, func(i, j int) bool { return ranks[i].date.After(ranks[j].date) })
		for i, r := range ranks {
			im.target.Model(&models.Gallery{}).Where("id = ?", r.id).Update("sort_order", i+1)
		}
	}
}

// groupRows prepares every row and merges the language versions of the same story: rows
// in different languages that share at least one photo and were published within two weeks.
func (im *importer) groupRows(rows []legacyRow) []*group {
	var groups []*group
	byImage := map[string][]*group{}

	for _, r := range rows {
		it := im.prepare(r)
		if it == nil {
			im.st.skipped++
			continue
		}
		var target *group
		for _, rel := range it.imgRels {
			for _, g := range byImage[rel] {
				if !g.langs[it.lang] && absDays(g.date, it.date) <= 14 {
					target = g
					break
				}
			}
			if target != nil {
				break
			}
		}
		if target == nil {
			target = &group{langs: map[string]bool{}, imgs: map[string]bool{}, date: it.date}
			groups = append(groups, target)
		}
		target.items = append(target.items, it)
		target.langs[it.lang] = true
		for _, rel := range it.imgRels {
			if !target.imgs[rel] {
				target.imgs[rel] = true
				byImage[rel] = append(byImage[rel], target)
			}
		}
	}
	return groups
}

func isImagePath(rel string) bool {
	if !strings.HasPrefix(rel, "images/") {
		return false
	}
	switch strings.ToLower(path.Ext(rel)) {
	case ".jpg", ".jpeg", ".png", ".webp", ".gif":
		return true
	}
	return false
}

func absDays(a, b time.Time) float64 {
	d := a.Sub(b).Hours() / 24
	if d < 0 {
		return -d
	}
	return d
}

func (im *importer) prepare(r legacyRow) *item {
	title := cleanTitle(r.Title)
	if title == "" {
		return nil
	}
	body, bodyImg := im.rewriteImages(cleanBody(r.Introtext + "\n" + r.Fulltext))

	var rels []string
	seen := map[string]bool{}
	add := func(rel string) {
		rel = normaliseRel(rel)
		if !isImagePath(rel) {
			return // "undefined" placeholders, empty slots, documents
		}
		if !seen[rel] {
			seen[rel] = true
			rels = append(rels, rel)
		}
	}
	// Helix Ultimate template keeps the article photo + gallery in attribs.
	var attribs map[string]any
	if json.Unmarshal([]byte(r.Attribs), &attribs) == nil {
		if s, _ := attribs["helix_ultimate_image"].(string); s != "" {
			add(s)
		}
		if s, _ := attribs["helix_ultimate_gallery"].(string); s != "" {
			var g struct {
				Images []string `json:"helix_ultimate_gallery_images"`
			}
			if json.Unmarshal([]byte(s), &g) == nil {
				for _, p := range g.Images {
					add(p)
				}
			}
		}
	}
	if s := legacyImageField(r.Images); s != "" {
		add(s)
	}

	if plainText(body) == "" && len(rels) == 0 && len(bodyImg) == 0 {
		return nil
	}
	date := r.Created
	if r.PublishUp != nil && r.PublishUp.Year() > 1970 {
		date = *r.PublishUp
	}
	return &item{row: r, lang: mapLang(r.Language), title: title, body: body, meta: strings.TrimSpace(r.Metadesc), imgRels: rels, bodyImg: bodyImg, date: date}
}

// images copies the story's photos (all languages) and returns their public URLs, cover first.
func (im *importer) images(g *group) []string {
	var urls []string
	seen := map[string]bool{}
	push := func(u string) {
		if u != "" && !seen[u] {
			seen[u] = true
			urls = append(urls, u)
		}
	}
	order := append([]*item{g.primary()}, g.items...)
	for _, it := range order {
		for _, rel := range it.imgRels {
			push(im.copyImage(rel))
		}
	}
	for _, it := range order {
		for _, u := range it.bodyImg {
			push(u)
		}
	}
	return urls
}

// ---------- articles ----------

func (im *importer) saveArticle(g *group, newsCat, eventsCat, authorID *uint) (*models.Article, bool) {
	p := g.primary()
	ids := make([]int, 0, len(g.items))
	a := models.Article{Title: models.Translatable{}, Body: models.Translatable{}, Excerpt: models.Translatable{}, MetaDescription: models.Translatable{}}
	published := false
	var publishedAt *time.Time
	var views int64
	updated := p.row.Created
	for _, it := range g.items {
		ids = append(ids, it.row.ID)
		a.Title[it.lang] = it.title
		a.Body[it.lang] = it.body
		a.Excerpt[it.lang] = makeExcerpt(it.body, 220)
		if it.meta != "" {
			a.MetaDescription[it.lang] = it.meta
		}
		views += it.row.Hits
		if it.row.State == 1 {
			published = true
			if publishedAt == nil || it.date.Before(*publishedAt) {
				d := it.date
				publishedAt = &d
			}
		}
		if it.row.Modified != nil && it.row.Modified.After(updated) {
			updated = *it.row.Modified
		}
	}
	imgs := im.images(g)
	a.Images = models.StringList(imgs)
	if len(imgs) > 0 {
		a.CoverImage = imgs[0]
	}
	a.Status = models.StatusDraft
	if published {
		a.Status = models.StatusPublished
		a.PublishedAt = publishedAt
	}
	a.Views = views
	a.CategoryID = newsCat
	if isEventStory(g) && eventsCat != nil {
		a.CategoryID = eventsCat
	}
	a.LegacyID = &p.row.ID
	a.UpdatedAt = updated

	// Find what an earlier run created for any of these rows; merge duplicates into one.
	var existing []models.Article
	im.target.Where("legacy_id IN ?", ids).Order("id").Find(&existing)
	var keep *models.Article
	var drop []uint
	for i := range existing {
		if keep == nil && existing[i].LegacyID != nil && *existing[i].LegacyID == p.row.ID {
			keep = &existing[i]
		}
	}
	if keep == nil && len(existing) > 0 {
		keep = &existing[0]
	}
	for _, e := range existing {
		if keep != nil && e.ID != keep.ID {
			drop = append(drop, e.ID)
		}
	}

	if *dryRun {
		if keep != nil {
			im.st.articlesUpdated++
			a.Slug = keep.Slug
		} else {
			im.st.articlesNew++
			a.Slug = utils.Slugify(firstNonEmpty(a.Title["tk"], p.title))
		}
		im.st.articlesMerged += len(drop)
		return &a, true
	}

	if len(drop) > 0 {
		im.target.Exec("DELETE FROM article_tags WHERE article_id IN ?", drop)
		im.target.Where("target_type = ? AND target_id IN ?", "article", drop).Delete(&models.Favorite{})
		im.target.Where("id IN ?", drop).Delete(&models.Article{})
		im.st.articlesMerged += len(drop)
	}

	if keep != nil {
		a.ID = keep.ID
		a.Slug = keep.Slug
		err := im.target.Model(&models.Article{}).Where("id = ?", keep.ID).Select(
			"title", "body", "excerpt", "meta_description", "images", "cover_image", "status", "published_at", "views", "category_id", "legacy_id", "updated_at",
		).Updates(&a).Error
		if err != nil {
			log.Printf("update article (legacy %d): %v", p.row.ID, err)
			return nil, false
		}
		im.st.articlesUpdated++
		return &a, true
	}

	a.AuthorID = authorID
	a.Slug = utils.UniqueSlug(im.target, "articles", firstNonEmpty(a.Title["tk"], p.row.Alias, p.title), 0)
	a.CreatedAt = p.row.Created
	if err := im.target.Create(&a).Error; err != nil {
		log.Printf("insert article (legacy %d): %v", p.row.ID, err)
		return nil, false
	}
	im.st.articlesNew++
	return &a, true
}

// ---------- events ----------

// Words that mark a news story as an event (exhibition, excursion, meeting, concert, ...).
var eventWords = []string{
	// tk
	"sergi", "gezelenç", "ekskursiýa", "duşuşyk", "söhbetdeşlik", "tegelek stol", "maslahat", "konsert", "bäsleşik",
	"çäre", "dabara", "baýramçylyk", "festiwal", "aksiýa", "sapak", "leksiýa", "forum", "çykyş", "tanyşdyryş", "açylyş",
	"masterklass", "ussatlyk sapagy", "bilim äheňli", "wiktorina", "ertirlik", "agşamy",
	// ru
	"выставк", "экскурс", "встреч", "бесед", "круглый стол", "конференц", "концерт", "конкурс", "мероприят", "праздн",
	"фестивал", "акци", "урок", "лекци", "форум", "семинар", "презентац", "открыти", "мастер-класс", "выступлен", "викторин", "утренник",
	// en
	"exhibition", "excursion", "tour", "meeting", "round table", "conference", "concert", "competition", "contest",
	"event", "celebration", "festival", "lesson", "lecture", "forum", "seminar", "presentation", "opening",
	"master class", "masterclass", "performance", "quiz",
}

func isEventStory(g *group) bool {
	for _, it := range g.items {
		t := strings.ToLower(it.title)
		for _, w := range eventWords {
			if strings.Contains(t, w) {
				return true
			}
		}
	}
	return false
}

var museumLocation = models.Translatable{
	"tk": "Arkadag şäheriniň Taryhy we ülkäni öwreniş muzeýi",
	"ru": "Историко-краеведческий музей города Аркадаг",
	"en": "Arkadag City Museum of History and Local Lore",
}

func (im *importer) saveEvent(g *group, a *models.Article) {
	starts := g.primary().date
	if a.PublishedAt != nil {
		starts = *a.PublishedAt
	}
	status := models.StatusPublished
	if a.Status != models.StatusPublished {
		status = models.StatusDraft
	}
	ev := models.Event{
		Slug:        a.Slug,
		Title:       a.Title,
		Summary:     a.Excerpt,
		Description: a.Body,
		Image:       a.CoverImage,
		Location:    museumLocation,
		StartsAt:    starts,
		Status:      status,
	}
	if *dryRun {
		im.st.eventsNew++
		return
	}
	var existing models.Event
	if im.target.Where("slug = ?", a.Slug).Limit(1).Find(&existing).RowsAffected > 0 {
		err := im.target.Model(&existing).Select("title", "summary", "description", "image", "starts_at", "status").Updates(&ev).Error
		if err != nil {
			log.Printf("update event %s: %v", a.Slug, err)
			return
		}
		im.st.eventsUpdated++
		return
	}
	if err := im.target.Create(&ev).Error; err != nil {
		log.Printf("insert event %s: %v", a.Slug, err)
		return
	}
	im.st.eventsNew++
}

// ---------- galleries ----------

// saveGallery creates/updates one photo album per story with 2+ photos; returns the album id.
func (im *importer) saveGallery(g *group, a *models.Article) uint {
	if len(a.Images) < 2 {
		return 0
	}
	if *dryRun {
		im.st.galleriesNew++
		im.st.photos += len(a.Images)
		return 0
	}
	gal := models.Gallery{Slug: a.Slug, Title: a.Title, Description: a.Excerpt, CoverImage: a.CoverImage, IsActive: a.Status == models.StatusPublished}
	var existing models.Gallery
	if im.target.Where("slug = ?", a.Slug).Limit(1).Find(&existing).RowsAffected > 0 {
		gal.ID = existing.ID
		if err := im.target.Model(&existing).Select("title", "description", "cover_image", "is_active").Updates(&gal).Error; err != nil {
			log.Printf("update gallery %s: %v", a.Slug, err)
			return 0
		}
		im.target.Where("gallery_id = ?", existing.ID).Delete(&models.GalleryItem{})
		im.st.galleriesUpdated++
	} else {
		if err := im.target.Select("*").Omit("id", "Items").Create(&gal).Error; err != nil {
			log.Printf("insert gallery %s: %v", a.Slug, err)
			return 0
		}
		im.st.galleriesNew++
	}
	items := make([]models.GalleryItem, 0, len(a.Images))
	for i, u := range a.Images {
		items = append(items, models.GalleryItem{GalleryID: gal.ID, Image: u, SortOrder: i})
	}
	if err := im.target.Create(&items).Error; err != nil {
		log.Printf("gallery items %s: %v", a.Slug, err)
	}
	im.st.photos += len(items)
	return gal.ID
}
