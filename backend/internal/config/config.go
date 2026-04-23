package config

import (
	"os"

	"gopkg.in/yaml.v3"
)

// Language represents a single configured locale.
type Language struct {
	Code    string `yaml:"code"    json:"code"`
	Label   string `yaml:"label"   json:"label"`
	Dir     string `yaml:"dir"     json:"dir"`
	Default bool   `yaml:"default" json:"default"`
}

// SocialLinks holds optional social media URLs.
type SocialLinks struct {
	Twitter  string `yaml:"twitter"  json:"twitter,omitempty"`
	LinkedIn string `yaml:"linkedin" json:"linkedin,omitempty"`
	GitHub   string `yaml:"github"   json:"github,omitempty"`
}

// SiteConfig holds general site metadata read from config.yaml.
type SiteConfig struct {
	Name       string      `yaml:"name"       json:"name"`
	Tagline    string      `yaml:"tagline"    json:"tagline"`
	URL        string      `yaml:"url"        json:"url"`
	BookingURL string      `yaml:"bookingUrl" json:"bookingUrl"`
	Social     SocialLinks `yaml:"social"    json:"social"`
}

// Config is the full parsed representation of config.yaml.
type Config struct {
	Site         SiteConfig `yaml:"site"`
	Languages    []Language `yaml:"languages"`
	Tags         []string   `yaml:"tags"`
	ContactEmail string     `yaml:"contactEmail"`
}

// DefaultConfig is used when config.yaml is absent or unreadable.
var DefaultConfig = Config{
	Languages: []Language{
		{Code: "en", Label: "English", Dir: "ltr", Default: true},
	},
	Tags: []string{"Tutorials", "News", "Guides"},
}

// Load reads and parses the YAML config file at path.
// If the file does not exist, DefaultConfig is returned without error.
func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			c := DefaultConfig
			return &c, nil
		}
		return nil, err
	}

	var c Config
	if err := yaml.Unmarshal(data, &c); err != nil {
		return nil, err
	}

	// Ensure at least one language is always configured.
	if len(c.Languages) == 0 {
		c.Languages = DefaultConfig.Languages
	}

	return &c, nil
}

// DefaultLanguage returns the first language marked as default,
// falling back to the first configured language.
func (c *Config) DefaultLanguage() Language {
	for _, l := range c.Languages {
		if l.Default {
			return l
		}
	}
	if len(c.Languages) > 0 {
		return c.Languages[0]
	}
	return DefaultConfig.Languages[0]
}
