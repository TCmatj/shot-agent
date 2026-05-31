package main

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path"
	"strconv"
	"strings"
	"time"
)

const defaultListenAddr = ":8787"

type objectStorageConfig struct {
	Endpoint        string
	Bucket          string
	AccessKeyID     string
	SecretAccessKey string
	PublicBaseURL   string
}

type serverConfig struct {
	Storage        objectStorageConfig
	MaxUploadBytes int64
	AllowedOrigins []string
}

type appServer struct {
	config serverConfig
	client *http.Client
	now    func() time.Time
}

type uploadResponse struct {
	URL string `json:"url"`
	Key string `json:"key"`
}

type errorResponse struct {
	Error string `json:"error"`
}

func main() {
	config, err := loadServerConfig(os.Environ())
	if err != nil {
		log.Fatal(err)
	}

	server := newAppServer(config)
	mux := http.NewServeMux()
	server.routes(mux)

	addr := envString("LISTEN_ADDR", defaultListenAddr)
	log.Printf("shot-agent server listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}

func newAppServer(config serverConfig) *appServer {
	return &appServer{
		config: config,
		client: http.DefaultClient,
		now:    time.Now,
	}
}

func (server *appServer) routes(mux *http.ServeMux) {
	mux.HandleFunc("/health", server.handleHealth)
	mux.HandleFunc("/api/assets/reference-upload", server.handleReferenceUpload)
}

func loadServerConfig(environ []string) (serverConfig, error) {
	env := environMap(environ)
	accountID := strings.TrimSpace(env["R2_ACCOUNT_ID"])
	endpoint := strings.TrimSpace(env["R2_ENDPOINT"])
	if endpoint == "" && accountID != "" {
		endpoint = fmt.Sprintf("https://%s.r2.cloudflarestorage.com", accountID)
	}

	config := serverConfig{
		Storage: objectStorageConfig{
			Endpoint:        endpoint,
			Bucket:          strings.TrimSpace(env["R2_BUCKET_NAME"]),
			AccessKeyID:     strings.TrimSpace(env["R2_ACCESS_KEY_ID"]),
			SecretAccessKey: strings.TrimSpace(env["R2_SECRET_ACCESS_KEY"]),
			PublicBaseURL:   strings.TrimSpace(env["R2_PUBLIC_BASE_URL"]),
		},
		MaxUploadBytes: parseMegabytes(env["MAX_UPLOAD_MB"], 100),
		AllowedOrigins: parseCSV(env["ALLOWED_ORIGINS"]),
	}

	if !config.Storage.Configured() {
		return config, errors.New("R2 configuration is incomplete")
	}

	return config, nil
}

func (config objectStorageConfig) Configured() bool {
	return config.Endpoint != "" &&
		config.Bucket != "" &&
		config.AccessKeyID != "" &&
		config.SecretAccessKey != "" &&
		config.PublicBaseURL != ""
}

func (server *appServer) handleHealth(w http.ResponseWriter, request *http.Request) {
	server.writeCORSHeaders(w, request)
	if request.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if request.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse{Error: "method not allowed"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (server *appServer) handleReferenceUpload(w http.ResponseWriter, request *http.Request) {
	server.writeCORSHeaders(w, request)
	if request.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if request.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse{Error: "method not allowed"})
		return
	}

	request.Body = http.MaxBytesReader(w, request.Body, server.config.MaxUploadBytes)
	if err := request.ParseMultipartForm(server.config.MaxUploadBytes); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid multipart upload"})
		return
	}

	file, header, err := request.FormFile("file")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "missing file field"})
		return
	}
	defer file.Close()

	payload, err := io.ReadAll(file)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "failed to read upload"})
		return
	}
	if len(payload) == 0 {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "empty upload"})
		return
	}

	contentType := header.Header.Get("Content-Type")
	if contentType == "" || contentType == "application/octet-stream" {
		contentType = http.DetectContentType(payload)
		if contentType == "application/octet-stream" {
			if extensionType := mime.TypeByExtension(strings.ToLower(path.Ext(header.Filename))); extensionType != "" {
				contentType = extensionType
			}
		}
	}
	if !isAllowedMediaType(contentType) {
		writeJSON(w, http.StatusUnsupportedMediaType, errorResponse{Error: "unsupported media type"})
		return
	}

	objectKey := buildObjectKey(request, header.Filename, contentType, server.now())
	publicURL, err := server.uploadToR2(request.Context(), objectKey, payload, contentType)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, errorResponse{Error: err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, uploadResponse{URL: publicURL, Key: objectKey})
}

func (server *appServer) uploadToR2(ctx context.Context, objectKey string, payload []byte, contentType string) (string, error) {
	config := server.config.Storage
	endpoint := trimRightSlash(config.Endpoint)
	uploadURL := fmt.Sprintf("%s/%s/%s", endpoint, url.PathEscape(config.Bucket), encodeObjectKey(objectKey))
	parsedURL, err := url.Parse(uploadURL)
	if err != nil {
		return "", err
	}

	now := server.now().UTC()
	amzDate := now.Format("20060102T150405Z")
	shortDate := now.Format("20060102")
	payloadHash := sha256Hex(payload)
	canonicalHeaders := fmt.Sprintf(
		"content-type:%s\nhost:%s\nx-amz-content-sha256:%s\nx-amz-date:%s\n",
		contentType,
		parsedURL.Host,
		payloadHash,
		amzDate,
	)
	signedHeaders := "content-type;host;x-amz-content-sha256;x-amz-date"
	canonicalRequest := strings.Join([]string{
		http.MethodPut,
		parsedURL.EscapedPath(),
		"",
		canonicalHeaders,
		signedHeaders,
		payloadHash,
	}, "\n")
	credentialScope := fmt.Sprintf("%s/auto/s3/aws4_request", shortDate)
	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		amzDate,
		credentialScope,
		sha256Hex([]byte(canonicalRequest)),
	}, "\n")
	signature := hex.EncodeToString(hmacSHA256(deriveSigningKey(config.SecretAccessKey, shortDate), []byte(stringToSign)))
	authorization := fmt.Sprintf(
		"AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		config.AccessKeyID,
		credentialScope,
		signedHeaders,
		signature,
	)

	request, err := http.NewRequestWithContext(ctx, http.MethodPut, uploadURL, bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	request.Header.Set("Authorization", authorization)
	request.Header.Set("Content-Type", contentType)
	request.Header.Set("x-amz-content-sha256", payloadHash)
	request.Header.Set("x-amz-date", amzDate)

	response, err := server.client.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
		message := strings.TrimSpace(string(body))
		if message == "" {
			message = response.Status
		}
		return "", fmt.Errorf("upload to R2 failed: %s", message)
	}

	return fmt.Sprintf("%s/%s", trimRightSlash(config.PublicBaseURL), encodeObjectKey(objectKey)), nil
}

func buildObjectKey(request *http.Request, filename string, contentType string, now time.Time) string {
	canvasID := sanitizeKeySegment(request.FormValue("canvasId"))
	nodeID := sanitizeKeySegment(request.FormValue("nodeId"))
	if canvasID == "" {
		canvasID = "default"
	}
	if nodeID == "" {
		nodeID = "reference"
	}

	extension := strings.ToLower(path.Ext(filename))
	if extension == "" {
		extensions, _ := mime.ExtensionsByType(contentType)
		if len(extensions) > 0 {
			extension = extensions[0]
		}
	}
	if extension == "" {
		extension = ".bin"
	}

	return strings.Join([]string{
		"canvases",
		canvasID,
		"seedance-references",
		fmt.Sprintf("%s-%d%s", nodeID, now.UnixNano(), extension),
	}, "/")
}

func isAllowedMediaType(contentType string) bool {
	mediaType, _, err := mime.ParseMediaType(contentType)
	if err != nil {
		return false
	}

	return strings.HasPrefix(mediaType, "image/") ||
		strings.HasPrefix(mediaType, "video/") ||
		strings.HasPrefix(mediaType, "audio/")
}

func (server *appServer) writeCORSHeaders(w http.ResponseWriter, request *http.Request) {
	origin := request.Header.Get("Origin")
	if origin == "" || len(server.config.AllowedOrigins) == 0 {
		return
	}

	for _, allowed := range server.config.AllowedOrigins {
		if allowed == "*" || allowed == origin {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			return
		}
	}
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func environMap(environ []string) map[string]string {
	values := make(map[string]string, len(environ))
	for _, item := range environ {
		key, value, ok := strings.Cut(item, "=")
		if ok {
			values[key] = value
		}
	}
	return values
}

func parseMegabytes(value string, fallback int64) int64 {
	parsed, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
	if err != nil || parsed <= 0 {
		parsed = fallback
	}
	return parsed * 1024 * 1024
}

func parseCSV(value string) []string {
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func envString(key string, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func sanitizeKeySegment(value string) string {
	value = strings.TrimSpace(value)
	var builder strings.Builder
	for _, char := range value {
		if char >= 'a' && char <= 'z' ||
			char >= 'A' && char <= 'Z' ||
			char >= '0' && char <= '9' ||
			char == '.' || char == '_' || char == '-' {
			builder.WriteRune(char)
		} else {
			builder.WriteByte('-')
		}
	}
	return strings.Trim(builder.String(), "-")
}

func encodeObjectKey(value string) string {
	segments := strings.Split(strings.TrimLeft(strings.ReplaceAll(value, "\\", "/"), "/"), "/")
	for index, segment := range segments {
		segments[index] = url.PathEscape(segment)
	}
	return strings.Join(segments, "/")
}

func trimRightSlash(value string) string {
	return strings.TrimRight(strings.TrimSpace(value), "/")
}

func sha256Hex(payload []byte) string {
	sum := sha256.Sum256(payload)
	return hex.EncodeToString(sum[:])
}

func deriveSigningKey(secret string, shortDate string) []byte {
	dateKey := hmacSHA256([]byte("AWS4"+secret), []byte(shortDate))
	regionKey := hmacSHA256(dateKey, []byte("auto"))
	serviceKey := hmacSHA256(regionKey, []byte("s3"))
	return hmacSHA256(serviceKey, []byte("aws4_request"))
}

func hmacSHA256(key []byte, value []byte) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write(value)
	return mac.Sum(nil)
}
