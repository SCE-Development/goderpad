package handlers

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"

	"goderpad/config"
)

const executionTimeout = 10 * time.Second

type langConfig struct {
	image      string
	dockerfile string
	filename   string
	command    string
}

var languageConfigs = map[string]langConfig{
	"python": {
		image:      "goderpad-python",
		dockerfile: "docker/python.Dockerfile",
		filename:   "main.py",
		command:    "python3 /code/main.py",
	},
	"javascript": {
		image:      "goderpad-javascript",
		dockerfile: "docker/javascript.Dockerfile",
		filename:   "main.js",
		command:    "node /code/main.js",
	},
	"c++": {
		image:      "goderpad-cpp",
		dockerfile: "docker/cpp.Dockerfile",
		filename:   "main.cpp",
		command:    "g++ -o /tmp/main /code/main.cpp && /tmp/main",
	},
	"java": {
		image:      "goderpad-java",
		dockerfile: "docker/java.Dockerfile",
		filename:   "Main.java",
		command:    "javac -d /tmp /code/Main.java && java -cp /tmp Main",
	},
}

// BuildExecutionImages builds each language sandbox image from its Dockerfile.
// Run as a goroutine at startup — the /execute endpoint will return an error
// for any language whose image hasn't finished building yet.
func BuildExecutionImages() {
	for lang, cfg := range languageConfigs {
		log.Printf("building execution image for %s...", lang)
		cmd := exec.Command(config.GetDockerBinaryPath(), "build", "-t", cfg.image, "-f", cfg.dockerfile, ".")
		if out, err := cmd.CombinedOutput(); err != nil {
			log.Printf("error building %s image: %v\n%s", lang, err, out)
		} else {
			log.Printf("built execution image for %s", lang)
		}
	}
}

type executeRequest struct {
	Language string `json:"language"`
	Code     string `json:"code"`
}

type executeResult struct {
	Stdout string `json:"stdout"`
	Stderr string `json:"stderr"`
	Code   int    `json:"code"`
}

func ExecuteHandler(c *gin.Context) {
	if !config.GetEnableExecutionImages() {
		c.JSON(http.StatusOK, executeResult{
			Stdout: "",
			Stderr: "code execution is disabled! to enable, set enable_execution_images: true in config/config.yml and restart the server.",
			Code:   -1,
		})
		return
	}

	var req executeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid request"})
		return
	}

	result, err := runCode(req.Language, req.Code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func runCode(language, code string) (*executeResult, error) {
	cfg, ok := languageConfigs[language]
	if !ok {
		return nil, fmt.Errorf("unsupported language: %s", language)
	}

	dir, err := os.MkdirTemp("", "goderpad-*")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp directory")
	}
	defer os.RemoveAll(dir)

	if err := os.WriteFile(filepath.Join(dir, cfg.filename), []byte(code), 0644); err != nil {
		return nil, fmt.Errorf("failed to write code")
	}

	ctx, cancel := context.WithTimeout(context.Background(), executionTimeout)
	defer cancel()

	args := []string{
		"run", "--rm",
		"--network=none",
		"--memory=256m",
		"--memory-swap=256m",
		"--cpus=0.25",
		"--pids-limit=64",
		"--read-only",
		"--tmpfs=/tmp:exec,size=32m",
		"-v", dir + ":/code:ro",
		cfg.image,
		"sh", "-c", cfg.command,
	}

	cmd := exec.CommandContext(ctx, config.GetDockerBinaryPath(), args...)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err = cmd.Run()

	if ctx.Err() == context.DeadlineExceeded {
		return &executeResult{
			Stdout: stdout.String(),
			Stderr: "execution timed out (10s limit)",
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

	return &executeResult{
		Stdout: stdout.String(),
		Stderr: stderr.String(),
		Code:   exitCode,
	}, nil
}
