package models

import "time"

// ---------- Users & auth ----------

type User struct {
	Base
	Name        string     `gorm:"size:120;not null" json:"name" validate:"required,min=2,max=120"`
	Email       string     `gorm:"size:190;uniqueIndex;not null" json:"email" validate:"required,email"`
	Password    string     `gorm:"size:255;not null" json:"-"`
	Role        string     `gorm:"size:20;not null;default:user;index" json:"role"`
	Avatar      string     `gorm:"size:500" json:"avatar"`
	Phone       string     `gorm:"size:40" json:"phone"`
	Locale      string     `gorm:"size:5;default:tk" json:"locale"`
	Status      string     `gorm:"size:20;not null;default:active" json:"status"`
	LastLoginAt *time.Time `json:"last_login_at"`
}

type RefreshToken struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"index;not null" json:"user_id"`
	TokenHash string    `gorm:"size:64;uniqueIndex;not null" json:"-"`
	UserAgent string    `gorm:"size:255" json:"user_agent"`
	IP        string    `gorm:"size:64" json:"ip"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

// ---------- Site configuration ----------

type Language struct {
	Base
	Code       string `gorm:"size:5;uniqueIndex;not null" json:"code" validate:"required,min=2,max=5"`
	Name       string `gorm:"size:60;not null" json:"name" validate:"required"`
	NativeName string `gorm:"size:60" json:"native_name"`
	Flag       string `gorm:"size:10" json:"flag"`
	IsDefault  bool   `gorm:"default:false" json:"is_default"`
	IsEnabled  bool   `gorm:"default:true" json:"is_enabled"`
	SortOrder  int    `gorm:"default:0" json:"sort_order"`
}

// Setting is a dynamic key/value configuration entry edited from the admin panel.
// Type: text, textarea, richtext, translatable, translatable_textarea, image, bool, number, color, json, select
type Setting struct {
	Base
	Key       string `gorm:"size:120;uniqueIndex;not null" json:"key" validate:"required"`
	Value     JSON   `gorm:"type:json" json:"value"`
	Group     string `gorm:"size:60;index;default:general" json:"group"`
	Type      string `gorm:"size:30;default:text" json:"type"`
	Label     string `gorm:"size:190" json:"label"`
	Options   JSON   `gorm:"type:json" json:"options"`
	IsPublic  bool   `gorm:"default:true" json:"is_public"`
	SortOrder int    `gorm:"default:0" json:"sort_order"`
}

// Translation overrides UI strings from the admin panel.
type Translation struct {
	Base
	Key    string       `gorm:"size:190;uniqueIndex;not null" json:"key" validate:"required"`
	Values Translatable `gorm:"type:json" json:"values"`
	Group  string       `gorm:"size:60;index;default:common" json:"group"`
}

type Menu struct {
	Base
	Slug  string     `gorm:"size:60;uniqueIndex;not null" json:"slug" validate:"required"`
	Name  string     `gorm:"size:120;not null" json:"name" validate:"required"`
	Items []MenuItem `gorm:"foreignKey:MenuID;constraint:OnDelete:CASCADE" json:"items,omitempty"`
}

// MenuItem Type: link (internal path), external (absolute URL), page (page slug in URL)
type MenuItem struct {
	Base
	MenuID    uint         `gorm:"index;not null" json:"menu_id"`
	ParentID  *uint        `gorm:"index" json:"parent_id"`
	Title     Translatable `gorm:"type:json" json:"title"`
	Type      string       `gorm:"size:30;default:link" json:"type"`
	URL       string       `gorm:"size:500" json:"url"`
	Target    string       `gorm:"size:10;default:_self" json:"target"`
	Icon      string       `gorm:"size:60" json:"icon"`
	SortOrder int          `gorm:"default:0" json:"sort_order"`
	IsActive  bool         `gorm:"default:true" json:"is_active"`
	Children  []MenuItem   `gorm:"-" json:"children,omitempty"`
}

// ---------- Content ----------

// Page is a block-based dynamic page (home, about, contact, custom pages).
// Blocks: [{"id":"","type":"hero","settings":{...}}]
type Page struct {
	Base
	Slug            string       `gorm:"size:160;uniqueIndex;not null" json:"slug" validate:"required"`
	Title           Translatable `gorm:"type:json" json:"title"`
	Excerpt         Translatable `gorm:"type:json" json:"excerpt"`
	Blocks          JSON         `gorm:"type:json" json:"blocks"`
	CoverImage      string       `gorm:"size:500" json:"cover_image"`
	Template        string       `gorm:"size:40;default:default" json:"template"`
	Status          string       `gorm:"size:20;default:draft;index" json:"status"`
	IsSystem        bool         `gorm:"default:false" json:"is_system"`
	MetaTitle       Translatable `gorm:"type:json" json:"meta_title"`
	MetaDescription Translatable `gorm:"type:json" json:"meta_description"`
	CreatedBy       *uint        `json:"created_by"`
}

type Category struct {
	Base
	Slug         string       `gorm:"size:160;uniqueIndex;not null" json:"slug"`
	Name         Translatable `gorm:"type:json" json:"name"`
	Description  Translatable `gorm:"type:json" json:"description"`
	Image        string       `gorm:"size:500" json:"image"`
	ParentID     *uint        `gorm:"index" json:"parent_id"`
	SortOrder    int          `gorm:"default:0" json:"sort_order"`
	IsActive     bool         `gorm:"default:true" json:"is_active"`
	ArticleCount int64        `gorm:"-" json:"article_count,omitempty"`
}

type Tag struct {
	Base
	Slug string       `gorm:"size:160;uniqueIndex;not null" json:"slug"`
	Name Translatable `gorm:"type:json" json:"name"`
}

type Article struct {
	Base
	Slug            string       `gorm:"size:200;uniqueIndex;not null" json:"slug"`
	Title           Translatable `gorm:"type:json" json:"title"`
	Excerpt         Translatable `gorm:"type:json" json:"excerpt"`
	Body            Translatable `gorm:"type:json" json:"body"`
	CoverImage      string       `gorm:"size:500" json:"cover_image"`
	Images          StringList   `gorm:"type:json" json:"images"`
	CategoryID      *uint        `gorm:"index" json:"category_id"`
	Category        *Category    `json:"category,omitempty"`
	AuthorID        *uint        `gorm:"index" json:"author_id"`
	Author          *User        `json:"author,omitempty"`
	Tags            []Tag        `gorm:"many2many:article_tags;" json:"tags,omitempty"`
	Status          string       `gorm:"size:20;default:draft;index" json:"status"`
	IsFeatured      bool         `gorm:"default:false;index" json:"is_featured"`
	PublishedAt     *time.Time   `gorm:"index" json:"published_at"`
	Views           int64        `gorm:"default:0" json:"views"`
	MetaTitle       Translatable `gorm:"type:json" json:"meta_title"`
	MetaDescription Translatable `gorm:"type:json" json:"meta_description"`
	LegacyID        *int         `gorm:"index" json:"legacy_id,omitempty"`
}

// Hall is a museum section / exhibition hall.
type Hall struct {
	Base
	Slug         string       `gorm:"size:160;uniqueIndex;not null" json:"slug"`
	Name         Translatable `gorm:"type:json" json:"name"`
	Summary      Translatable `gorm:"type:json" json:"summary"`
	Description  Translatable `gorm:"type:json" json:"description"`
	CoverImage   string       `gorm:"size:500" json:"cover_image"`
	Images       StringList   `gorm:"type:json" json:"images"`
	Icon         string       `gorm:"size:60" json:"icon"`
	Floor        string       `gorm:"size:40" json:"floor"`
	SortOrder    int          `gorm:"default:0" json:"sort_order"`
	IsActive     bool         `gorm:"default:true" json:"is_active"`
	Exhibits     []Exhibit    `json:"exhibits,omitempty"`
	ExhibitCount int64        `gorm:"-" json:"exhibit_count,omitempty"`
}

type Exhibit struct {
	Base
	Slug        string       `gorm:"size:160;uniqueIndex;not null" json:"slug"`
	Title       Translatable `gorm:"type:json" json:"title"`
	Summary     Translatable `gorm:"type:json" json:"summary"`
	Description Translatable `gorm:"type:json" json:"description"`
	Image       string       `gorm:"size:500" json:"image"`
	Images      StringList   `gorm:"type:json" json:"images"`
	HallID      *uint        `gorm:"index" json:"hall_id"`
	Hall        *Hall        `json:"hall,omitempty"`
	Period      Translatable `gorm:"type:json" json:"period"`
	Material    Translatable `gorm:"type:json" json:"material"`
	Origin      Translatable `gorm:"type:json" json:"origin"`
	InventoryNo string       `gorm:"size:60" json:"inventory_no"`
	IsFeatured  bool         `gorm:"default:false;index" json:"is_featured"`
	SortOrder   int          `gorm:"default:0" json:"sort_order"`
	Status      string       `gorm:"size:20;default:published;index" json:"status"`
	Views       int64        `gorm:"default:0" json:"views"`
}

type Gallery struct {
	Base
	Slug        string        `gorm:"size:160;uniqueIndex;not null" json:"slug"`
	Title       Translatable  `gorm:"type:json" json:"title"`
	Description Translatable  `gorm:"type:json" json:"description"`
	CoverImage  string        `gorm:"size:500" json:"cover_image"`
	Items       []GalleryItem `gorm:"foreignKey:GalleryID;constraint:OnDelete:CASCADE" json:"items,omitempty"`
	SortOrder   int           `gorm:"default:0" json:"sort_order"`
	IsActive    bool          `gorm:"default:true" json:"is_active"`
	ItemCount   int64         `gorm:"-" json:"item_count,omitempty"`
}

type GalleryItem struct {
	Base
	GalleryID uint         `gorm:"index;not null" json:"gallery_id"`
	Image     string       `gorm:"size:500;not null" json:"image"`
	Caption   Translatable `gorm:"type:json" json:"caption"`
	SortOrder int          `gorm:"default:0" json:"sort_order"`
}

type Event struct {
	Base
	Slug        string       `gorm:"size:160;uniqueIndex;not null" json:"slug"`
	Title       Translatable `gorm:"type:json" json:"title"`
	Summary     Translatable `gorm:"type:json" json:"summary"`
	Description Translatable `gorm:"type:json" json:"description"`
	Image       string       `gorm:"size:500" json:"image"`
	Location    Translatable `gorm:"type:json" json:"location"`
	StartsAt    time.Time    `gorm:"index" json:"starts_at"`
	EndsAt      *time.Time   `json:"ends_at"`
	Status      string       `gorm:"size:20;default:published;index" json:"status"`
	IsFeatured  bool         `gorm:"default:false" json:"is_featured"`
	Price       Translatable `gorm:"type:json" json:"price"`
}

type Slide struct {
	Base
	Title       Translatable `gorm:"type:json" json:"title"`
	Subtitle    Translatable `gorm:"type:json" json:"subtitle"`
	Image       string       `gorm:"size:500;not null" json:"image"`
	MobileImage string       `gorm:"size:500" json:"mobile_image"`
	ButtonText  Translatable `gorm:"type:json" json:"button_text"`
	ButtonURL   string       `gorm:"size:500" json:"button_url"`
	Button2Text Translatable `gorm:"type:json" json:"button2_text"`
	Button2URL  string       `gorm:"size:500" json:"button2_url"`
	Position    string       `gorm:"size:40;default:home;index" json:"position"`
	SortOrder   int          `gorm:"default:0" json:"sort_order"`
	IsActive    bool         `gorm:"default:true" json:"is_active"`
}

type Media struct {
	Base
	FileName     string       `gorm:"size:255;not null" json:"file_name"`
	OriginalName string       `gorm:"size:255" json:"original_name"`
	Path         string       `gorm:"size:500;not null" json:"path"`
	URL          string       `gorm:"size:600;not null" json:"url"`
	ThumbURL     string       `gorm:"size:600" json:"thumb_url"`
	Mime         string       `gorm:"size:100" json:"mime"`
	Size         int64        `json:"size"`
	Width        int          `json:"width"`
	Height       int          `json:"height"`
	Folder       string       `gorm:"size:120;index;default:general" json:"folder"`
	Alt          Translatable `gorm:"type:json" json:"alt"`
	UploadedBy   *uint        `json:"uploaded_by"`
}

// ---------- Interaction ----------

// ContactMessage Status: new, read, replied, archived
type ContactMessage struct {
	Base
	Name    string `gorm:"size:120;not null" json:"name" validate:"required,min=2"`
	Email   string `gorm:"size:190;not null" json:"email" validate:"required,email"`
	Phone   string `gorm:"size:40" json:"phone"`
	Subject string `gorm:"size:190" json:"subject"`
	Message string `gorm:"type:text;not null" json:"message" validate:"required,min=5"`
	Status  string `gorm:"size:20;default:new;index" json:"status"`
	Reply   string `gorm:"type:text" json:"reply"`
	IP      string `gorm:"size:64" json:"ip"`
	UserID  *uint  `gorm:"index" json:"user_id"`
	Locale  string `gorm:"size:5" json:"locale"`
}

type Subscriber struct {
	Base
	Email          string     `gorm:"size:190;uniqueIndex;not null" json:"email" validate:"required,email"`
	Name           string     `gorm:"size:120" json:"name"`
	Locale         string     `gorm:"size:5;default:tk" json:"locale"`
	IsConfirmed    bool       `gorm:"default:false" json:"is_confirmed"`
	Token          string     `gorm:"size:64;index" json:"-"`
	UnsubscribedAt *time.Time `json:"unsubscribed_at"`
}

// Favorite TargetType: article, exhibit, event, hall
type Favorite struct {
	Base
	UserID     uint   `gorm:"index:idx_fav,unique;not null" json:"user_id"`
	TargetType string `gorm:"size:20;index:idx_fav,unique;not null" json:"target_type"`
	TargetID   uint   `gorm:"index:idx_fav,unique;not null" json:"target_id"`
	Target     any    `gorm:"-" json:"target,omitempty"`
}

type ActivityLog struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    *uint     `gorm:"index" json:"user_id"`
	User      *User     `json:"user,omitempty"`
	Action    string    `gorm:"size:30;index" json:"action"`
	Entity    string    `gorm:"size:60;index" json:"entity"`
	EntityID  uint      `gorm:"index" json:"entity_id"`
	Details   JSON      `gorm:"type:json" json:"details"`
	IP        string    `gorm:"size:64" json:"ip"`
	CreatedAt time.Time `json:"created_at"`
}

// AllModels lists every model for AutoMigrate.
func AllModels() []any {
	return []any{
		&User{}, &RefreshToken{}, &Language{}, &Setting{}, &Translation{},
		&Menu{}, &MenuItem{}, &Page{}, &Category{}, &Tag{}, &Article{},
		&Hall{}, &Exhibit{}, &Gallery{}, &GalleryItem{}, &Event{}, &Slide{},
		&Media{}, &ContactMessage{}, &Subscriber{}, &Favorite{}, &ActivityLog{},
	}
}
