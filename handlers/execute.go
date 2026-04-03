package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"goderpad/config"
	"goderpad/execution"
)

type executeRequest struct {
	Language string `json:"language"`
	Code     string `json:"code"`
}

func ExecuteHandler(c *gin.Context) {
	if !config.GetEnableCodeExecution() {
		c.JSON(http.StatusOK, execution.Result{
			Stdout: "",
			Stderr: "sorry code execution is disabled :(",
			Code:   -1,
		})
		return
	}

	var req executeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid request"})
		return
	}

	result, err := execution.RunCode(req.Language, req.Code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}
