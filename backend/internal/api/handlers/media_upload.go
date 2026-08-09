package handlers

import (
	"bytes"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/google/uuid"
)

const (
	maxUploadSize     = 20 << 20 // 20 MB
	maxImageDimension = 1920
	maxImagePixels    = 100_000_000
	webpQuality       = 82
	uploadSniffLength = 512
)

var (
	errUploadTooLarge       = errors.New("file exceeds 20 MB limit")
	errInvalidImage         = errors.New("invalid image")
	errImageTooLarge        = errors.New("image dimensions are too large")
	errOptimizerUnavailable = errors.New("image optimizer is unavailable")
)

type storedMedia struct {
	Filename string
	MimeType string
	Size     int64
	Path     string
}

type imageOptimizer func(data []byte, dstPath string, width, height int, resize bool) error

func optimizedDimensions(width, height int) (int, int) {
	if width <= 0 || height <= 0 {
		return width, height
	}
	if width <= maxImageDimension && height <= maxImageDimension {
		return width, height
	}
	if width >= height {
		return maxImageDimension, max(1, height*maxImageDimension/width)
	}
	return max(1, width*maxImageDimension/height), maxImageDimension
}

func detectContentType(data []byte) string {
	sniff := data
	if len(sniff) > uploadSniffLength {
		sniff = sniff[:uploadSniffLength]
	}
	return http.DetectContentType(sniff)
}

func originalExtension(originalName, contentType string) string {
	switch contentType {
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	default:
		return strings.ToLower(filepath.Ext(filepath.Base(originalName)))
	}
}

func saveOriginalUpload(data []byte, originalName, contentType, uploadDir string) (storedMedia, error) {
	filename := uuid.NewString() + originalExtension(originalName, contentType)
	dstPath := filepath.Join(uploadDir, filename)
	if err := os.WriteFile(dstPath, data, 0644); err != nil {
		return storedMedia{}, fmt.Errorf("save upload: %w", err)
	}
	return storedMedia{
		Filename: filename,
		MimeType: contentType,
		Size:     int64(len(data)),
		Path:     dstPath,
	}, nil
}

func storeMediaUpload(src io.Reader, originalName, uploadDir string, optimizer imageOptimizer) (storedMedia, error) {
	data, err := io.ReadAll(io.LimitReader(src, maxUploadSize+1))
	if err != nil {
		return storedMedia{}, fmt.Errorf("read upload: %w", err)
	}
	if len(data) > maxUploadSize {
		return storedMedia{}, errUploadTooLarge
	}

	contentType := detectContentType(data)
	if contentType != "image/jpeg" && contentType != "image/png" {
		return saveOriginalUpload(data, originalName, contentType, uploadDir)
	}

	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || cfg.Width <= 0 || cfg.Height <= 0 {
		return storedMedia{}, errInvalidImage
	}
	if int64(cfg.Width)*int64(cfg.Height) > maxImagePixels {
		return storedMedia{}, errImageTooLarge
	}

	width, height := optimizedDimensions(cfg.Width, cfg.Height)
	filename := uuid.NewString() + ".webp"
	dstPath := filepath.Join(uploadDir, filename)
	resize := width != cfg.Width || height != cfg.Height
	if err := optimizer(data, dstPath, width, height, resize); err != nil {
		if errors.Is(err, errOptimizerUnavailable) {
			log.Printf("[media] cwebp is unavailable; preserving %s without optimization", originalName)
			return saveOriginalUpload(data, originalName, contentType, uploadDir)
		}
		_ = os.Remove(dstPath)
		return storedMedia{}, err
	}

	info, err := os.Stat(dstPath)
	if err != nil {
		_ = os.Remove(dstPath)
		return storedMedia{}, fmt.Errorf("stat optimized upload: %w", err)
	}
	return storedMedia{
		Filename: filename,
		MimeType: "image/webp",
		Size:     info.Size(),
		Path:     dstPath,
	}, nil
}

func optimizeImageWithCWebP(data []byte, dstPath string, width, height int, resize bool) error {
	input, err := os.CreateTemp(filepath.Dir(dstPath), "folio-upload-*")
	if err != nil {
		return fmt.Errorf("create optimizer input: %w", err)
	}
	inputPath := input.Name()
	defer os.Remove(inputPath)

	if _, err := input.Write(data); err != nil {
		input.Close()
		return fmt.Errorf("write optimizer input: %w", err)
	}
	if err := input.Close(); err != nil {
		return fmt.Errorf("close optimizer input: %w", err)
	}

	output, err := os.CreateTemp(filepath.Dir(dstPath), "folio-optimized-*.webp")
	if err != nil {
		return fmt.Errorf("create optimizer output: %w", err)
	}
	outputPath := output.Name()
	defer os.Remove(outputPath)
	if err := output.Close(); err != nil {
		return fmt.Errorf("close optimizer output: %w", err)
	}

	args := []string{
		"-quiet",
		"-q", strconv.Itoa(webpQuality),
		"-metadata", "none",
	}
	if resize {
		args = append(args, "-resize", strconv.Itoa(width), strconv.Itoa(height))
	}
	args = append(args, inputPath, "-o", outputPath)
	out, err := exec.Command("cwebp", args...).CombinedOutput()
	if err != nil {
		if errors.Is(err, exec.ErrNotFound) {
			return errOptimizerUnavailable
		}
		return fmt.Errorf("optimize image: %w: %s", err, strings.TrimSpace(string(out)))
	}
	if err := os.Chmod(outputPath, 0644); err != nil {
		return fmt.Errorf("set optimized image permissions: %w", err)
	}
	if err := os.Rename(outputPath, dstPath); err != nil {
		return fmt.Errorf("store optimized image: %w", err)
	}
	return nil
}
