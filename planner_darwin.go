//go:build darwin

package main

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Cocoa -framework WebKit
#include <stdlib.h>
void ssOpenPlanner(const char *url, const char *secret, const char *theme, const char *styles);
void ssHidePlanner(void);
void ssReloadPlanner(void);
void ssPlannerTheme(const char *theme);
void ssPlannerError(const char *message);
*/
import "C"
import (
	_ "embed"
	"unsafe"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed integration/planner-host.css
var plannerHostCSS string

var plannerDesktop *DesktopService

//export plannerGoSummary
func plannerGoSummary() {
	go func() {
		if plannerDesktop != nil {
			plannerDesktop.OpenPanel()
		}
	}()
}

//export plannerGoReload
func plannerGoReload() {
	go func() {
		if plannerDesktop != nil {
			if err := plannerDesktop.OpenPlanner(); err != nil {
				showPlannerError(err)
			} else {
				application.InvokeSync(func() { C.ssReloadPlanner() })
			}
		}
	}()
}

func (s *DesktopService) OpenPlanner() error {
	session, err := s.planner.Start()
	if err != nil {
		return err
	}
	url, secret, theme := C.CString(session.url), C.CString(session.secret), C.CString(s.preferences.get())
	defer C.free(unsafe.Pointer(url))
	defer C.free(unsafe.Pointer(secret))
	defer C.free(unsafe.Pointer(theme))
	styles := C.CString(plannerHostCSS)
	defer C.free(unsafe.Pointer(styles))
	hidePanel(s.panel)
	s.details.Hide()
	application.InvokeSync(func() { C.ssOpenPlanner(url, secret, theme, styles) })
	return nil
}
func hidePlanner() { application.InvokeSync(func() { C.ssHidePlanner() }) }
func setPlannerTheme(theme string) {
	value := C.CString(theme)
	defer C.free(unsafe.Pointer(value))
	application.InvokeSync(func() { C.ssPlannerTheme(value) })
}

func showPlannerError(err error) {
	value := C.CString(err.Error())
	defer C.free(unsafe.Pointer(value))
	application.InvokeSync(func() { C.ssPlannerError(value) })
}
func (s *DesktopService) openPlannerFromMenu() {
	if err := s.OpenPlanner(); err != nil {
		showPlannerError(err)
	}
}
