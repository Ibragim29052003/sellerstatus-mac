package main

import "testing"

func TestDesktopNavigationRejectsUntrustedContext(t *testing.T) {
	service := &DesktopService{}
	for _, input := range [][3]string{
		{"https://example.org", "today", "normal"},
		{"stocks", "../../etc", "normal"},
		{"stocks", "today", "not-a-scenario"},
	} {
		if err := service.OpenDetails(input[0], input[1], input[2]); err == nil {
			t.Fatalf("untrusted navigation accepted: %v", input)
		}
	}
}
