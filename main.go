package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net/url"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

//go:embed all:frontend/dist
var frontend embed.FS

//go:embed assets/tray.png
var trayIcon []byte

type DesktopService struct {
	app         *application.App
	preferences *themePreferences
	details     *application.WebviewWindow
	tray        *application.SystemTray
	panel       *application.WebviewWindow
}

// OpenDetails only navigates the app's own bundled UI; callers cannot open
// arbitrary URLs or execute commands through this binding.
func (s *DesktopService) OpenDetails(page, period, scenario string) error {
	if !allowed(page, "overview", "stocks", "finance", "activity") ||
		!allowed(period, "today", "yesterday", "week") ||
		!allowed(scenario, "normal", "loss", "partial", "stale", "empty", "error") {
		return fmt.Errorf("unsupported view context")
	}
	query := url.Values{"page": {page}, "period": {period}, "scenario": {scenario}}
	s.details.SetURL("/?" + query.Encode())
	hidePanel(s.panel)
	s.details.Show()
	s.details.Focus()
	return nil
}

func (s *DesktopService) ClosePanel() { hidePanel(s.panel) }

func (s *DesktopService) OpenPanel() {
	s.details.Hide()
	showPanel(s.panel)
}

func allowed(value string, values ...string) bool {
	for _, candidate := range values {
		if value == candidate {
			return true
		}
	}
	return false
}

func main() {
	assets, err := fs.Sub(frontend, "frontend/dist")
	if err != nil {
		log.Fatal(err)
	}
	config, err := os.UserConfigDir()
	if err != nil {
		log.Fatal(err)
	}
	service := &DesktopService{preferences: loadThemePreferences(filepath.Join(config, "SellerStatusMac", "preferences.json"))}
	app := application.New(application.Options{
		Name: "SellerStatus Mac",
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID: "local.sellerstatus.mac.demo",
			OnSecondInstanceLaunch: func(application.SecondInstanceData) {
				if service.tray != nil {
					service.OpenPanel()
				}
			},
		},
		Description: "Личная сводка продавца — демонстрационный прототип",
		Services:    []application.Service{application.NewService(service)},
		Assets:      application.AssetOptions{Handler: application.BundledAssetFileServer(assets)},
		Mac:         application.MacOptions{ActivationPolicy: application.ActivationPolicyAccessory},
	})
	service.app = app
	panel := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name: "summary", Title: "SellerStatus — сводка", URL: "/?view=panel",
		Width: 420, Height: 740, Frameless: true, AlwaysOnTop: true,
		Hidden: true, DisableResize: true,
		Mac: application.MacWindow{CornerType: application.MacWindowCornerTypeSquare},
		BackgroundColour: application.NewRGB(246, 247, 251),
	})
	details := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name: "details", Title: "SellerStatus — пульс магазина", URL: "/",
		Width: 1220, Height: 880, MinWidth: 390, MinHeight: 600, Hidden: true,
		BackgroundColour: application.NewRGB(246, 247, 251),
	})
	panel.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) { hidePanel(panel); e.Cancel() })
	panel.OnWindowEvent(events.Common.WindowLostFocus, func(*application.WindowEvent) { hidePanel(panel) })
	details.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) { details.Hide(); e.Cancel() })
	service.panel, service.details = panel, details
	tray := app.SystemTray.New()
	tray.SetTemplateIcon(trayIcon)
	tray.SetTooltip("SellerStatus · демонстрационный магазин")
	tray.OnClick(func() { togglePanel(panel) })
	menu := app.NewMenu()
	menu.Add("Открыть обзор · ДЕМО").OnClick(func(*application.Context) { _ = service.OpenDetails("overview", "today", "normal") })
	menu.AddSeparator()
	menu.Add("Выход").OnClick(func(*application.Context) { app.Quit() })
	tray.SetMenu(menu)
	service.tray = tray
	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
