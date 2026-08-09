package handlers

import (
	"bytes"
	"errors"
	"image"
	"image/color"
	"image/png"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func pngData(t *testing.T, width, height int) []byte {
	t.Helper()
	img := image.NewNRGBA(image.Rect(0, 0, width, height))
	img.Set(0, 0, color.NRGBA{R: 255, A: 255})
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("encode PNG: %v", err)
	}
	return buf.Bytes()
}

func TestOptimizedDimensions(t *testing.T) {
	tests := []struct {
		name          string
		width, height int
		wantWidth     int
		wantHeight    int
	}{
		{name: "unchanged", width: 1200, height: 800, wantWidth: 1200, wantHeight: 800},
		{name: "landscape", width: 3840, height: 2160, wantWidth: 1920, wantHeight: 1080},
		{name: "portrait", width: 2000, height: 4000, wantWidth: 960, wantHeight: 1920},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			width, height := optimizedDimensions(tt.width, tt.height)
			if width != tt.wantWidth || height != tt.wantHeight {
				t.Fatalf("optimizedDimensions(%d, %d) = (%d, %d), want (%d, %d)",
					tt.width, tt.height, width, height, tt.wantWidth, tt.wantHeight)
			}
		})
	}
}

func TestStoreMediaUploadOptimizesPNG(t *testing.T) {
	uploadDir := t.TempDir()
	var gotWidth, gotHeight int
	var gotResize bool
	optimizer := func(_ []byte, dstPath string, width, height int, resize bool) error {
		gotWidth, gotHeight = width, height
		gotResize = resize
		return os.WriteFile(dstPath, []byte("optimized"), 0644)
	}

	stored, err := storeMediaUpload(bytes.NewReader(pngData(t, 2400, 1200)), "photo.png", uploadDir, optimizer)
	if err != nil {
		t.Fatalf("storeMediaUpload: %v", err)
	}
	if gotWidth != 1920 || gotHeight != 960 {
		t.Fatalf("optimizer dimensions = (%d, %d), want (1920, 960)", gotWidth, gotHeight)
	}
	if !gotResize {
		t.Fatal("optimizer was not instructed to resize an oversized image")
	}
	if stored.MimeType != "image/webp" || filepath.Ext(stored.Filename) != ".webp" {
		t.Fatalf("stored media = %#v, want WebP", stored)
	}
	if stored.Size != int64(len("optimized")) {
		t.Fatalf("stored size = %d, want %d", stored.Size, len("optimized"))
	}
}

func TestStoreMediaUploadPreservesNonImage(t *testing.T) {
	uploadDir := t.TempDir()
	optimizerCalled := false
	optimizer := func(_ []byte, _ string, _, _ int, _ bool) error {
		optimizerCalled = true
		return nil
	}

	stored, err := storeMediaUpload(bytes.NewBufferString("plain text"), "notes.txt", uploadDir, optimizer)
	if err != nil {
		t.Fatalf("storeMediaUpload: %v", err)
	}
	if optimizerCalled {
		t.Fatal("optimizer was called for a non-image upload")
	}
	if stored.MimeType != "text/plain; charset=utf-8" || filepath.Ext(stored.Filename) != ".txt" {
		t.Fatalf("stored media = %#v, want original text file", stored)
	}
}

func TestStoreMediaUploadFallsBackWithoutOptimizer(t *testing.T) {
	uploadDir := t.TempDir()
	optimizer := func(_ []byte, _ string, _, _ int, _ bool) error {
		return errOptimizerUnavailable
	}

	stored, err := storeMediaUpload(bytes.NewReader(pngData(t, 10, 10)), "photo.png", uploadDir, optimizer)
	if err != nil {
		t.Fatalf("storeMediaUpload: %v", err)
	}
	if stored.MimeType != "image/png" || filepath.Ext(stored.Filename) != ".png" {
		t.Fatalf("stored media = %#v, want original PNG", stored)
	}
}

func TestStoreMediaUploadRejectsOversizedInput(t *testing.T) {
	uploadDir := t.TempDir()
	input := bytes.NewReader(make([]byte, maxUploadSize+1))

	_, err := storeMediaUpload(input, "large.bin", uploadDir, nil)
	if !errors.Is(err, errUploadTooLarge) {
		t.Fatalf("storeMediaUpload error = %v, want %v", err, errUploadTooLarge)
	}
	entries, readErr := os.ReadDir(uploadDir)
	if readErr != nil {
		t.Fatalf("read upload directory: %v", readErr)
	}
	if len(entries) != 0 {
		t.Fatalf("upload directory contains %d files after rejection, want 0", len(entries))
	}
}

func TestStoreMediaUploadRemovesFailedOptimization(t *testing.T) {
	uploadDir := t.TempDir()
	optimizerErr := errors.New("optimizer failed")
	optimizer := func(_ []byte, dstPath string, _, _ int, _ bool) error {
		if err := os.WriteFile(dstPath, []byte("partial"), 0644); err != nil {
			t.Fatalf("write partial output: %v", err)
		}
		return optimizerErr
	}

	_, err := storeMediaUpload(bytes.NewReader(pngData(t, 10, 10)), "photo.png", uploadDir, optimizer)
	if !errors.Is(err, optimizerErr) {
		t.Fatalf("storeMediaUpload error = %v, want %v", err, optimizerErr)
	}
	entries, readErr := os.ReadDir(uploadDir)
	if readErr != nil {
		t.Fatalf("read upload directory: %v", readErr)
	}
	if len(entries) != 0 {
		t.Fatalf("upload directory contains %d files after failure, want 0", len(entries))
	}
}

func TestOptimizeImageWithCWebP(t *testing.T) {
	if _, err := exec.LookPath("cwebp"); err != nil {
		t.Skip("cwebp is not installed")
	}

	dstPath := filepath.Join(t.TempDir(), "optimized.webp")
	if err := optimizeImageWithCWebP(pngData(t, 10, 10), dstPath, 10, 10, false); err != nil {
		t.Fatalf("optimizeImageWithCWebP: %v", err)
	}
	data, err := os.ReadFile(dstPath)
	if err != nil {
		t.Fatalf("read optimized image: %v", err)
	}
	if len(data) < 12 || string(data[:4]) != "RIFF" || string(data[8:12]) != "WEBP" {
		t.Fatalf("optimized output is not a WebP file")
	}
	info, err := os.Stat(dstPath)
	if err != nil {
		t.Fatalf("stat optimized image: %v", err)
	}
	if info.Mode().Perm() != 0644 {
		t.Fatalf("optimized image permissions = %o, want 644", info.Mode().Perm())
	}
}
