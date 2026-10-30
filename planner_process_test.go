package main

import (
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"testing"
	"time"
)

// A real child process exercises pipes, ownership, shutdown, and restart.
func TestPlannerChild(t *testing.T) {
	if len(os.Args) < 3 || os.Args[len(os.Args)-2] != "planner-helper" {
		return
	}
	mode := os.Args[len(os.Args)-1]
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		os.Exit(2)
	}
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-SellerStatus-Desktop") != os.Getenv("SELLERSTATUS_DESKTOP_SESSION") {
			w.WriteHeader(403)
			return
		}
		if mode == "bad-health" {
			fmt.Fprint(w, `{"status":"ok","service":"unrelated"}`)
		} else {
			fmt.Fprint(w, `{"status":"ok","service":"supply-planner"}`)
		}
	})
	go http.Serve(listener, handler)
	switch mode {
	case "untrusted":
		fmt.Println("SELLERSTATUS_PLANNER_READY https://example.com:443")
	case "timeout":
	default:
		fmt.Println("SELLERSTATUS_PLANNER_READY http://" + listener.Addr().String())
	}
	_, _ = io.Copy(io.Discard, os.Stdin)
	listener.Close()
	os.Exit(0)
}
func testPlanner(t *testing.T, mode string) *plannerProcess {
	t.Helper()
	binary, _ := os.Executable()
	manager := &plannerProcess{executable: binary, dataDirectory: filepath.Join(t.TempDir(), "planner"), timeout: 400 * time.Millisecond,
		command: func(path string) *exec.Cmd {
			return exec.Command(path, "-test.run=^TestPlannerChild$", "planner-helper", mode)
		}}
	t.Cleanup(manager.Stop)
	return manager
}
func TestPlannerSingleProcessAndPersistentOwner(t *testing.T) {
	manager := testPlanner(t, "normal")
	var wg sync.WaitGroup
	sessions := make(chan plannerSession, 6)
	for range 6 {
		wg.Go(func() {
			session, err := manager.Start()
			if err != nil {
				t.Errorf("start: %v", err)
				return
			}
			sessions <- session
		})
	}
	wg.Wait()
	close(sessions)
	var first plannerSession
	for session := range sessions {
		if first.url == "" {
			first = session
		}
		if first != session {
			t.Fatal("concurrent opens created duplicate services")
		}
	}
	owner, _ := manager.owner()
	process := manager.cmd.Process
	manager.mu.Lock()
	manager.stopLocked()
	manager.mu.Unlock()
	if err := process.Signal(syscall.Signal(0)); err == nil {
		t.Fatal("child is still alive")
	}
	restarted, err := manager.Start()
	if err != nil {
		t.Fatal(err)
	}
	if restarted.secret == first.secret {
		t.Fatal("restart reused session credentials")
	}
	nextOwner, _ := manager.owner()
	if nextOwner != owner {
		t.Fatal("workspace identity changed")
	}
}
func TestPlannerRestartsOnlyItsOwnDeadProcess(t *testing.T) {
	manager := testPlanner(t, "normal")
	session, err := manager.Start()
	if err != nil {
		t.Fatal(err)
	}
	_ = manager.cmd.Process.Kill()
	<-manager.done
	next, err := manager.Start()
	if err != nil {
		t.Fatal(err)
	}
	if session.secret == next.secret {
		t.Fatal("dead child was reused")
	}
}
func TestPlannerRejectsUntrustedOrUnavailableService(t *testing.T) {
	for _, mode := range []string{"untrusted", "timeout", "bad-health"} {
		t.Run(mode, func(t *testing.T) {
			manager := testPlanner(t, mode)
			if _, err := manager.Start(); err != errPlannerStart {
				t.Fatalf("got %v", err)
			}
			if manager.cmd != nil {
				t.Fatal("failed child was left running")
			}
		})
	}
	missing := &plannerProcess{executable: filepath.Join(t.TempDir(), "missing")}
	if _, err := missing.Start(); err != errPlannerMissing {
		t.Fatalf("missing runtime: %v", err)
	}
}
func TestPlannerURLAndCorruptIdentity(t *testing.T) {
	for _, value := range []string{"http://localhost:5000", "http://127.0.0.1", "https://127.0.0.1:1234", "http://127.0.0.1:2/path", "http://127.0.0.1:2?secret=x", "http://user@127.0.0.1:3", "http://127.0.0.1:65536", "http://example.com:1234"} {
		if plannerURL(value) {
			t.Errorf("accepted %s", value)
		}
	}
	if !plannerURL("http://127.0.0.1:1234") {
		t.Fatal("valid loopback rejected")
	}
	manager := testPlanner(t, "normal")
	if err := os.MkdirAll(manager.dataDirectory, 0700); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(manager.dataDirectory, "owner")
	_ = os.WriteFile(path, []byte("broken"), 0600)
	if _, err := manager.Start(); err == nil {
		t.Fatal("silently replaced corrupt workspace identity")
	}
	bytes, _ := os.ReadFile(path)
	if !strings.Contains(string(bytes), "broken") {
		t.Fatal("overwrote identity")
	}
}

func TestPreparedPlannerRuntime(t *testing.T) {
	runtime := os.Getenv("SELLERSTATUS_TEST_RUNTIME")
	if runtime == "" {
		t.Skip("optional private runtime is not configured")
	}
	absolute, err := filepath.Abs(runtime)
	if err != nil {
		t.Fatal(err)
	}
	manager := &plannerProcess{executable: absolute, dataDirectory: t.TempDir(), timeout: 20 * time.Second}
	defer manager.Stop()
	if _, err := manager.Start(); err != nil {
		diagnostics, _ := os.ReadFile(filepath.Join(manager.dataDirectory, "startup-error.log"))
		t.Fatalf("runtime start: %v\n%s", err, diagnostics)
	}
}

func TestPlannerDiagnosticsStayBounded(t *testing.T) {
	var log plannerLogTail
	for range 100 {
		_, _ = log.Write([]byte(strings.Repeat("x", 300)))
	}
	_, _ = log.Write([]byte("last error"))
	if len(log.String()) != 8192 || !strings.HasSuffix(log.String(), "last error") {
		t.Fatal("diagnostic tail was not bounded or lost the latest error")
	}
}

func TestPlannerShutdownCancelsPendingStart(t *testing.T) {
	manager := testPlanner(t, "timeout")
	manager.timeout = 15 * time.Second
	finished := make(chan error, 1)
	go func() { _, err := manager.Start(); finished <- err }()
	time.Sleep(100 * time.Millisecond)
	started := time.Now()
	manager.Stop()
	select {
	case err := <-finished:
		if err == nil {
			t.Fatal("cancelled startup succeeded")
		}
	case <-time.After(3 * time.Second):
		t.Fatal("startup did not cancel")
	}
	if time.Since(started) > 3*time.Second {
		t.Fatal("shutdown waited for the full startup timeout")
	}
	if _, err := manager.Start(); err == nil {
		t.Fatal("started another child after application shutdown")
	}
}
