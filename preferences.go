package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
)

var errInvalidTheme = errors.New("unsupported theme")

type themePreferences struct {
	mu    sync.Mutex
	path  string
	theme string
}

type preferencesJSON struct {
	Theme string `json:"theme"`
}

func loadThemePreferences(path string) *themePreferences {
	preferences := &themePreferences{path: path, theme: "system"}
	data, err := os.ReadFile(path)
	if err == nil {
		var decoded preferencesJSON
		if json.Unmarshal(data, &decoded) == nil && allowed(decoded.Theme, "system", "light", "dark") {
			preferences.theme = decoded.Theme
		}
	}
	return preferences
}
func (p *themePreferences) get() string {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.theme
}
func (p *themePreferences) set(theme string) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if err := os.MkdirAll(filepath.Dir(p.path), 0700); err != nil {
		return err
	}
	data, err := json.Marshal(preferencesJSON{Theme: theme})
	if err != nil {
		return err
	}
	file, err := os.CreateTemp(filepath.Dir(p.path), ".preferences-*")
	if err != nil {
		return err
	}
	defer os.Remove(file.Name())
	if _, err := file.Write(data); err != nil {
		file.Close()
		return err
	}
	if err := file.Close(); err != nil {
		return err
	}
	if err := os.Rename(file.Name(), p.path); err != nil {
		return err
	}
	p.theme = theme
	return nil
}

func (s *DesktopService) GetTheme() string { return s.preferences.get() }
func (s *DesktopService) SetTheme(theme string) error {
	if !allowed(theme, "system", "light", "dark") {
		return errInvalidTheme
	}
	if err := s.preferences.set(theme); err != nil {
		return err
	}
	if s.app != nil {
		s.app.Event.Emit("sellerstatus:theme", theme)
		setPlannerTheme(theme)
	}
	return nil
}
