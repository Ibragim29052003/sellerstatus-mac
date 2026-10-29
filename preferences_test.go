package main

import (
	"os"
	"path/filepath"
	"sync"
	"testing"
)

func TestThemePreferencesDefaultAndPersistence(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config", "preferences.json")
	preferences := loadThemePreferences(path)
	if got := preferences.get(); got != "system" {
		t.Fatalf("default = %s", got)
	}
	for _, theme := range []string{"dark", "light", "system"} {
		if err := preferences.set(theme); err != nil {
			t.Fatal(err)
		}
		if got := loadThemePreferences(path).get(); got != theme {
			t.Fatalf("saved = %s, want %s", got, theme)
		}
	}
}
func TestInvalidStoredThemeFallsBackToSystem(t *testing.T) {
	for _, data := range []string{`{"theme":"unsupported"}`, `not json`, `{}`} {
		path := filepath.Join(t.TempDir(), "preferences.json")
		if err := os.WriteFile(path, []byte(data), 0600); err != nil {
			t.Fatal(err)
		}
		if got := loadThemePreferences(path).get(); got != "system" {
			t.Fatalf("invalid data produced %s", got)
		}
	}
}
func TestFailedSavePreservesLastTheme(t *testing.T) {
	dir := t.TempDir()
	blocker := filepath.Join(dir, "file")
	if err := os.WriteFile(blocker, []byte("not a directory"), 0600); err != nil {
		t.Fatal(err)
	}
	preferences := loadThemePreferences(filepath.Join(blocker, "preferences.json"))
	if err := preferences.set("dark"); err == nil {
		t.Fatal("expected write error")
	}
	if got := preferences.get(); got != "system" {
		t.Fatalf("failed save changed preference: %s", got)
	}
}
func TestThemeBindingRejectsInvalidValue(t *testing.T) {
	service := &DesktopService{preferences: loadThemePreferences(filepath.Join(t.TempDir(), "preferences.json"))}
	if err := service.SetTheme("../evil"); err == nil {
		t.Fatal("invalid theme accepted")
	}
	if service.GetTheme() != "system" {
		t.Fatal("invalid input changed theme")
	}
}
func TestConcurrentPreferencesStayValid(t *testing.T) {
	path := filepath.Join(t.TempDir(), "preferences.json")
	preferences := loadThemePreferences(path)
	var group sync.WaitGroup
	for _, theme := range []string{"dark", "light", "system", "dark"} {
		group.Go(func() {
			if err := preferences.set(theme); err != nil {
				t.Error(err)
			}
			_ = preferences.get()
		})
	}
	group.Wait()
	if persisted := loadThemePreferences(path).get(); persisted != preferences.get() {
		t.Fatal("memory and disk diverged")
	}
}
