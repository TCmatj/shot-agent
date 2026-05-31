package main

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestReferenceUploadStoresFileInR2(t *testing.T) {
	var uploadedPath string
	var authHeader string
	r2 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodPut {
			t.Fatalf("expected PUT, got %s", request.Method)
		}
		uploadedPath = request.URL.EscapedPath()
		authHeader = request.Header.Get("Authorization")
		if request.Header.Get("Content-Type") != "image/png" {
			t.Fatalf("unexpected content type %q", request.Header.Get("Content-Type"))
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer r2.Close()

	server := newAppServer(serverConfig{
		Storage: objectStorageConfig{
			Endpoint:        r2.URL,
			Bucket:          "shot-agent",
			AccessKeyID:     "access-key",
			SecretAccessKey: "secret-key",
			PublicBaseURL:   "https://assets.example.com",
		},
		MaxUploadBytes: 1024 * 1024,
	})
	server.now = func() time.Time { return time.Unix(1700000000, 0).UTC() }

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	_ = writer.WriteField("canvasId", "canvas 1")
	_ = writer.WriteField("nodeId", "node/image")
	part, err := writer.CreateFormFile("file", "input.png")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = part.Write([]byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a})
	_ = writer.Close()

	request := httptest.NewRequest(http.MethodPost, "/api/assets/reference-upload", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	response := httptest.NewRecorder()

	server.handleReferenceUpload(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", response.Code, response.Body.String())
	}
	if !strings.HasPrefix(uploadedPath, "/shot-agent/canvases/canvas-1/seedance-references/node-image-") {
		t.Fatalf("unexpected upload path %s", uploadedPath)
	}
	if !strings.Contains(authHeader, "AWS4-HMAC-SHA256") {
		t.Fatalf("missing AWS authorization header")
	}

	var result uploadResponse
	if err := json.NewDecoder(response.Body).Decode(&result); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(result.URL, "https://assets.example.com/canvases/canvas-1/seedance-references/node-image-") {
		t.Fatalf("unexpected public url %s", result.URL)
	}
}

func TestReferenceUploadRejectsUnsupportedMedia(t *testing.T) {
	server := newAppServer(serverConfig{MaxUploadBytes: 1024 * 1024})

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "input.txt")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = part.Write([]byte("hello"))
	_ = writer.Close()

	request := httptest.NewRequest(http.MethodPost, "/api/assets/reference-upload", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	response := httptest.NewRecorder()

	server.handleReferenceUpload(response, request)

	if response.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("expected 415, got %d", response.Code)
	}
}
