package utils

import "github.com/gofiber/fiber/v2"

// Meta describes pagination of a list response.
type Meta struct {
	Page  int   `json:"page"`
	Limit int   `json:"limit"`
	Total int64 `json:"total"`
	Pages int   `json:"pages"`
}

func OK(c *fiber.Ctx, data any) error {
	return c.JSON(fiber.Map{"data": data})
}

func Created(c *fiber.Ctx, data any) error {
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": data})
}

func Paginated(c *fiber.Ctx, data any, meta Meta) error {
	return c.JSON(fiber.Map{"data": data, "meta": meta})
}

func Message(c *fiber.Ctx, msg string) error {
	return c.JSON(fiber.Map{"data": fiber.Map{"message": msg}})
}

func Error(c *fiber.Ctx, status int, code, msg string) error {
	return c.Status(status).JSON(fiber.Map{"error": fiber.Map{"code": code, "message": msg}})
}

func BadRequest(c *fiber.Ctx, msg string) error {
	return Error(c, fiber.StatusBadRequest, "bad_request", msg)
}

func NotFound(c *fiber.Ctx, msg string) error {
	if msg == "" {
		msg = "Resource not found"
	}
	return Error(c, fiber.StatusNotFound, "not_found", msg)
}

func Unauthorized(c *fiber.Ctx, msg string) error {
	if msg == "" {
		msg = "Authentication required"
	}
	return Error(c, fiber.StatusUnauthorized, "unauthorized", msg)
}

func Forbidden(c *fiber.Ctx, msg string) error {
	if msg == "" {
		msg = "You do not have permission to perform this action"
	}
	return Error(c, fiber.StatusForbidden, "forbidden", msg)
}

func ServerError(c *fiber.Ctx, err error) error {
	msg := "Internal server error"
	if err != nil {
		msg = err.Error()
	}
	return Error(c, fiber.StatusInternalServerError, "server_error", msg)
}

func ValidationError(c *fiber.Ctx, fields map[string]string) error {
	return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
		"error": fiber.Map{"code": "validation_error", "message": "Validation failed", "fields": fields},
	})
}
