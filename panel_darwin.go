//go:build darwin

package main

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Cocoa -framework QuartzCore
#include <stdbool.h>
void ssShowPanel(void *window);
void ssHidePanel(void *window);
void ssTogglePanel(void *window);
typedef struct { double cutoutWidth; double headerHeight; } SSPanelLayout;
SSPanelLayout ssGetPanelLayout(void *window);
*/
import "C"

import "github.com/wailsapp/wails/v3/pkg/application"

type PanelLayout struct {
	CutoutWidth  float64 `json:"cutoutWidth"`
	HeaderHeight float64 `json:"headerHeight"`
}

func (s *DesktopService) GetPanelLayout() PanelLayout {
	var layout PanelLayout
	application.InvokeSync(func() {
		value := C.ssGetPanelLayout(s.panel.NativeWindow())
		layout = PanelLayout{CutoutWidth: float64(value.cutoutWidth), HeaderHeight: float64(value.headerHeight)}
	})
	return layout
}

func showPanel(window *application.WebviewWindow) {
	application.InvokeSync(func() { C.ssShowPanel(window.NativeWindow()) })
}
func hidePanel(window *application.WebviewWindow) {
	application.InvokeSync(func() { C.ssHidePanel(window.NativeWindow()) })
}
func togglePanel(window *application.WebviewWindow) {
	application.InvokeSync(func() { C.ssTogglePanel(window.NativeWindow()) })
}
