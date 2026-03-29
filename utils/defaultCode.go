package utils

const DEFAULT_REACT_CODE = "import React from 'react';\n\nfunction App() {\n  return (\n    <div>\n      <h1>Hello, World!</h1>\n    </div>\n  );\n}\nexport default App;"

const DEFAULT_PYTHON_CODE = "def main():\n    print(\"Hello, World!\")"

const DEFAULT_JAVA_CODE = "public class Main {\n    public static void main(String[] args) {\n        System.out.println(\"Hello, World!\");\n    }\n}"

const DEFAULT_CPP_CODE = "#include <iostream>\n\nint main() {\n    std::cout << \"Hello, World!\" << std::endl;\n    return 0;\n}"

const DEFAULT_JAVASCRIPT_CODE = "function main() {\n  console.log(\"Hello, World!\");\n}"

// DEFAULT_CODE kept for backwards compatibility
const DEFAULT_CODE = DEFAULT_REACT_CODE

func DefaultCodeForLanguage(language string) string {
	switch language {
	case "python":
		return DEFAULT_PYTHON_CODE
	case "java":
		return DEFAULT_JAVA_CODE
	case "cpp":
		return DEFAULT_CPP_CODE
	case "javascript":
		return DEFAULT_JAVASCRIPT_CODE
	default: // "react" and anything unrecognised
		return DEFAULT_REACT_CODE
	}
}
