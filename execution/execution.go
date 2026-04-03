package execution

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"os/exec"
	"strings"
	"time"

	"goderpad/config"
)

const ExecutionTimeout = 20 * time.Second

type LangConfig struct {
	Image      string
	Dockerfile string
	Filename   string
	Command    string
}

var LanguageConfigs = map[string]LangConfig{
	"python": {
		Image:      "goderpad-python",
		Dockerfile: "docker/python.Dockerfile",
		Filename:   "main.py",
		Command:    "cat > /tmp/main.py && python3 /tmp/main.py",
	},
	"javascript": {
		Image:      "goderpad-javascript",
		Dockerfile: "docker/javascript.Dockerfile",
		Filename:   "main.js",
		Command:    "cat > /tmp/main.js && node /tmp/main.js",
	},
	"c++": {
		Image:      "goderpad-cpp",
		Dockerfile: "docker/cpp.Dockerfile",
		Filename:   "main.cpp",
		Command:    "cat > /tmp/main.cpp && g++ -o /tmp/main /tmp/main.cpp && /tmp/main",
	},
	"java": {
		Image:      "goderpad-java",
		Dockerfile: "docker/java.Dockerfile",
		Filename:   "Main.java",
		Command:    "cat > /tmp/Main.java && javac -d /tmp /tmp/Main.java && java -cp /tmp Main",
	},
}

type Result struct {
	Stdout string `json:"stdout"`
	Stderr string `json:"stderr"`
	Code   int    `json:"code"`
}

// BuildImages builds each language sandbox image from its Dockerfile.
func BuildImages() {
	for lang, cfg := range LanguageConfigs {
		log.Printf("building execution image for %s...", lang)
		cmd := exec.Command(config.GetDockerBinaryPath(), "build", "-t", cfg.Image, "-f", cfg.Dockerfile, ".")
		if out, err := cmd.CombinedOutput(); err != nil {
			log.Printf("error building %s image: %v\n%s", lang, err, out)
		} else {
			log.Printf("built execution image for %s", lang)
		}
	}
}

// RunCode executes user code in a sandboxed Docker container.
// Code is piped via stdin to avoid volume mounts, which don't work
// when the runner itself is inside a container (Docker-in-Docker).
func RunCode(language, code string) (*Result, error) {
	cfg, ok := LanguageConfigs[language]
	if !ok {
		return nil, fmt.Errorf("unsupported language: %s", language)
	}

	ctx, cancel := context.WithTimeout(context.Background(), ExecutionTimeout)
	defer cancel()

	args := []string{
		"run", "--rm", "-i",
		"--network=none",
		"--memory=256m",
		"--memory-swap=256m",
		"--cpus=0.25",
		"--pids-limit=64",
		"--read-only",
		"--tmpfs=/tmp:exec,size=32m",
		cfg.Image,
		"sh", "-c", cfg.Command,
	}

	cmd := exec.CommandContext(ctx, config.GetDockerBinaryPath(), args...)
	cmd.Stdin = strings.NewReader(code)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()

	if ctx.Err() == context.DeadlineExceeded {
		return &Result{
			Stdout: stdout.String(),
			Stderr: "execution timed out (20s limit)",
			Code:   -1,
		}, nil
	}

	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			return nil, fmt.Errorf("docker unavailable — is it installed and running? (%v)", err)
		}
	}

	return &Result{
		Stdout: stdout.String(),
		Stderr: stderr.String(),
		Code:   exitCode,
	}, nil
}
