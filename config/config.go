package config

import (
	"log"
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server ServerConfig `yaml:"server"`
	Redis  RedisConfig  `yaml:"redis"`
}

type RedisConfig struct {
	Addr     string `yaml:"addr"`
	Password string `yaml:"password"`
	DB       int    `yaml:"db"`
}

type ServerConfig struct {
	Port                  string   `yaml:"port"`
	APIKey                string   `yaml:"api_key"`
	AllowedOrigins        []string `yaml:"allowed_origins"`
	EnableExecutionImages bool     `yaml:"enable_execution_images"`
	DockerBinaryPath      string   `yaml:"docker_binary_path"`
}

var AppConfig Config

func Load(configPath string) error {
	data, err := os.ReadFile(configPath)
	if err != nil {
		return err
	}

	err = yaml.Unmarshal(data, &AppConfig)
	if err != nil {
		return err
	}

	log.Printf("Configuration loaded: Server will run on port %s", AppConfig.Server.Port)
	return nil
}

func GetPort() string {
	return AppConfig.Server.Port
}

func GetAPIKey() string {
	return AppConfig.Server.APIKey
}

func GetAllowedOrigins() []string {
	return AppConfig.Server.AllowedOrigins
}

func GetEnableExecutionImages() bool {
	return AppConfig.Server.EnableExecutionImages
}

func GetRedisAddr() string {
	if env := os.Getenv("REDIS_ADDR"); env != "" {
		return env
	}
	if AppConfig.Redis.Addr != "" {
		return AppConfig.Redis.Addr
	}
	return "localhost:6379"
}

func GetRedisPassword() string {
	return AppConfig.Redis.Password
}

func GetRedisDB() int {
	return AppConfig.Redis.DB
}

func GetDockerBinaryPath() string {
	if AppConfig.Server.DockerBinaryPath != "" {
		return AppConfig.Server.DockerBinaryPath
	}
	return "docker"
}
