package config

import (
	"log"
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server ServerConfig `yaml:"server"`
}

type ServerConfig struct {
	Port   string `yaml:"port"`
	APIKey string `yaml:"api_key"`
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
