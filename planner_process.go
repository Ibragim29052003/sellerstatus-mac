package main

import (
	"bufio"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

var errPlannerMissing = errors.New("Планировщик не включён в эту сборку. Подготовьте модуль C# и пересоберите приложение.")
var errPlannerStart = errors.New("Не удалось запустить планировщик. Повторите открытие; сохранённые сценарии останутся на месте.")

// Keep diagnostics bounded even if a long-lived child repeatedly logs errors.
type plannerLogTail struct{ data []byte }

func (log *plannerLogTail) Write(data []byte) (int, error) {
	size := len(data)
	if size >= 8192 {
		log.data = append(log.data[:0], data[size-8192:]...)
		return size, nil
	}
	if len(log.data)+size > 8192 {
		log.data = append(log.data[:0], log.data[len(log.data)+size-8192:]...)
	}
	log.data = append(log.data, data...)
	return size, nil
}
func (log *plannerLogTail) String() string { return string(log.data) }

type plannerSession struct{ url, secret string }
type plannerProcess struct {
	initOnce                  sync.Once
	stopOnce                  sync.Once
	quit                      chan struct{}
	mu                        sync.Mutex
	executable, dataDirectory string
	command                   func(string) *exec.Cmd
	timeout                   time.Duration
	cmd                       *exec.Cmd
	stdin                     io.WriteCloser
	done                      chan struct{}
	session                   plannerSession
}

func newPlannerProcess(dataDirectory string) *plannerProcess {
	executable, _ := os.Executable()
	bundled := filepath.Join(filepath.Dir(executable), "..", "Resources", "planner", "SupplyPlanner.Web")
	if _, err := os.Stat(bundled); err != nil {
		bundled = filepath.Join(".local", "planner", "SupplyPlanner.Web")
	}
	bundled, _ = filepath.Abs(bundled)
	return &plannerProcess{executable: bundled, dataDirectory: dataDirectory, timeout: 20 * time.Second}
}

func randomHex(size int) (string, error) {
	bytes := make([]byte, size)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
func (p *plannerProcess) owner() (string, error) {
	if err := os.MkdirAll(p.dataDirectory, 0700); err != nil {
		return "", err
	}
	path := filepath.Join(p.dataDirectory, "owner")
	if data, err := os.ReadFile(path); err == nil {
		owner := strings.TrimSpace(string(data))
		decoded, err := hex.DecodeString(owner)
		if err != nil || len(decoded) != 16 {
			return "", errors.New("invalid workspace identity")
		}
		return owner, nil
	} else if !os.IsNotExist(err) {
		return "", err
	}
	owner, err := randomHex(16)
	if err != nil {
		return "", err
	}
	file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return "", err
	}
	_, err = file.WriteString(owner)
	closeErr := file.Close()
	if err != nil {
		return "", err
	}
	return owner, closeErr
}

func plannerURL(value string) bool {
	parsed, err := url.Parse(value)
	if err != nil {
		return false
	}
	port, err := strconv.Atoi(parsed.Port())
	return err == nil && port > 0 && port <= 65535 && parsed.Scheme == "http" && parsed.Hostname() == "127.0.0.1" && parsed.User == nil && parsed.RawQuery == "" && parsed.Fragment == "" && (parsed.Path == "" || parsed.Path == "/")
}
func plannerHealth(session plannerSession) bool {
	client := &http.Client{Timeout: 2 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	request, err := http.NewRequest(http.MethodGet, session.url+"/healthz", nil)
	if err != nil {
		return false
	}
	request.Header.Set("X-SellerStatus-Desktop", session.secret)
	response, err := client.Do(request)
	if err != nil {
		return false
	}
	defer response.Body.Close()
	var body struct{ Status, Service string }
	return response.StatusCode == 200 && json.NewDecoder(io.LimitReader(response.Body, 1024)).Decode(&body) == nil && body.Status == "ok" && body.Service == "supply-planner"
}
func (p *plannerProcess) shutdownSignal() <-chan struct{} {
	p.initOnce.Do(func() { p.quit = make(chan struct{}) })
	return p.quit
}
func (p *plannerProcess) Start() (plannerSession, error) {
	quit := p.shutdownSignal()
	p.mu.Lock()
	defer p.mu.Unlock()
	select {
	case <-quit:
		return plannerSession{}, errPlannerStart
	default:
	}
	if p.cmd != nil {
		select {
		case <-p.done:
			p.clearLocked()
		default:
			if plannerHealth(p.session) {
				return p.session, nil
			}
			p.stopLocked()
		}
	}
	if info, err := os.Stat(p.executable); err != nil || info.IsDir() {
		return plannerSession{}, errPlannerMissing
	}
	owner, err := p.owner()
	if err != nil {
		return plannerSession{}, errPlannerStart
	}
	secret, err := randomHex(32)
	if err != nil {
		return plannerSession{}, errPlannerStart
	}
	command := p.command
	if command == nil {
		command = func(path string) *exec.Cmd { return exec.Command(path) }
	}
	cmd := command(p.executable)
	cmd.Dir = filepath.Dir(p.executable)
	env := []string{}
	for _, entry := range os.Environ() {
		key := strings.SplitN(entry, "=", 2)[0]
		if strings.HasPrefix(key, "Planner__") || strings.HasPrefix(key, "SELLERSTATUS_DESKTOP_") || key == "ASPNETCORE_URLS" || key == "ASPNETCORE_ENVIRONMENT" || key == "DOTNET_ENVIRONMENT" {
			continue
		}
		env = append(env, entry)
	}
	cmd.Env = append(env, "ASPNETCORE_URLS=http://127.0.0.1:0", "ASPNETCORE_ENVIRONMENT=Development", "DOTNET_ENVIRONMENT=Development", "Planner__DataDirectory="+p.dataDirectory, "Planner__LocalSellerStatus=false", "Planner__AccessKey=", "Planner__PathBase=", "SELLERSTATUS_DESKTOP_SESSION="+secret, "SELLERSTATUS_DESKTOP_OWNER="+owner, "Logging__LogLevel__Default=Warning", "DOTNET_USE_POLLING_FILE_WATCHER=1", "DOTNET_HOSTBUILDER__RELOADCONFIGONCHANGE=false")
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return plannerSession{}, errPlannerStart
	}
	stdin, err := cmd.StdinPipe()
	if err != nil {
		stdout.Close()
		return plannerSession{}, errPlannerStart
	}
	var diagnostics plannerLogTail
	var output plannerLogTail
	scanDone := make(chan struct{})
	cmd.Stderr = &diagnostics
	if err = cmd.Start(); err != nil {
		_ = os.WriteFile(filepath.Join(p.dataDirectory, "startup-error.log"), []byte("Launch failed: "+err.Error()), 0600)
		stdin.Close()
		stdout.Close()
		return plannerSession{}, errPlannerStart
	}
	p.cmd, p.stdin, p.done = cmd, stdin, make(chan struct{})
	done := p.done
	ready := make(chan string, 1)
	go func() {
		defer close(scanDone)
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			_, _ = output.Write(append(append([]byte{}, scanner.Bytes()...), byte(10)))
			if value, ok := strings.CutPrefix(scanner.Text(), "SELLERSTATUS_PLANNER_READY "); ok {
				select {
				case ready <- value:
				default:
				}
			}
		}
	}()
	go func() { _ = cmd.Wait(); close(done) }()
	select {
	case value := <-ready:
		if plannerURL(value) {
			session := plannerSession{url: strings.TrimSuffix(value, "/"), secret: secret}
			if plannerHealth(session) {
				p.session = session
				_ = os.Remove(filepath.Join(p.dataDirectory, "startup-error.log"))
				return session, nil
			}
		}
	case <-done:
	case <-time.After(p.timeout):
	case <-quit:
	}
	p.stopLocked()
	<-scanDone
	message := strings.ReplaceAll(diagnostics.String()+"\n"+output.String(), secret, "[redacted]")
	if len(message) > 8192 {
		message = message[len(message)-8192:]
	}
	if message == "" {
		message = "The local service did not report a healthy loopback endpoint before the startup deadline."
	}
	_ = os.WriteFile(filepath.Join(p.dataDirectory, "startup-error.log"), []byte(message), 0600)
	return plannerSession{}, errPlannerStart
}
func (p *plannerProcess) clearLocked() {
	p.cmd = nil
	p.stdin = nil
	p.done = nil
	p.session = plannerSession{}
}
func (p *plannerProcess) stopLocked() {
	if p.cmd == nil {
		return
	}
	_ = p.stdin.Close()
	select {
	case <-p.done:
	case <-time.After(2 * time.Second):
		_ = p.cmd.Process.Kill()
		<-p.done
	}
	p.clearLocked()
}
func (p *plannerProcess) Stop() {
	p.shutdownSignal()
	p.stopOnce.Do(func() { close(p.quit) })
	p.mu.Lock()
	defer p.mu.Unlock()
	p.stopLocked()
}
