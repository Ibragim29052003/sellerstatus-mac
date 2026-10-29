//go:build darwin

package main

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Cocoa -framework QuartzCore
#include <stdbool.h>
void ssShowPanel(void *window);
void ssHidePanel(void *window);
void ssTogglePanel(void *window);
*/
import "C"

import "github.com/wailsapp/wails/v3/pkg/application"

func showPanel(window *application.WebviewWindow) {
	application.InvokeSync(func() { C.ssShowPanel(window.NativeWindow()) })
}
func hidePanel(window *application.WebviewWindow) {
	application.InvokeSync(func() { C.ssHidePanel(window.NativeWindow()) })
}
func togglePanel(window *application.WebviewWindow) {
	application.InvokeSync(func() { C.ssTogglePanel(window.NativeWindow()) })
}
