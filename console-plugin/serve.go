package main

import (
	"crypto/tls"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func main() {
	staticDir := flag.String("static-dir", "/opt/app-root/src", "directory containing the console plugin static assets")
	certFile := flag.String("cert", "/var/serving-cert/tls.crt", "TLS certificate file")
	keyFile := flag.String("key", "/var/serving-cert/tls.key", "TLS private key file")
	port := flag.Int("port", 9443, "HTTPS listen port")
	flag.Parse()

	if _, err := os.Stat(*staticDir); os.IsNotExist(err) {
		log.Fatalf("static directory %q does not exist", *staticDir)
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "OK")
	})

	fs := http.FileServer(http.Dir(*staticDir))

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		clean := filepath.Clean(r.URL.Path)
		full := filepath.Join(*staticDir, clean)

		if info, err := os.Stat(full); err == nil && !info.IsDir() {
			fs.ServeHTTP(w, r)
			return
		}

		// SPA fallback: serve plugin-manifest.json for unknown paths
		// (matches nginx try_files behaviour)
		if !strings.HasPrefix(clean, "/api") {
			http.ServeFile(w, r, filepath.Join(*staticDir, "plugin-manifest.json"))
			return
		}

		http.NotFound(w, r)
	})

	addr := fmt.Sprintf(":%d", *port)
	tlsCfg := &tls.Config{MinVersion: tls.VersionTLS12}

	srv := &http.Server{
		Addr:      addr,
		Handler:   mux,
		TLSConfig: tlsCfg,
	}

	log.Printf("console-plugin serving %s on https://0.0.0.0%s", *staticDir, addr)
	if err := srv.ListenAndServeTLS(*certFile, *keyFile); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
