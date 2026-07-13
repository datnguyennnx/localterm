# FinalTerm / OSC 133 shell integration for zsh
# https://gitlab.com/gnachman/iterm2/-/wikis/shell-integration

# Only enable for agent-mode sessions.
if [[ -n "$LOCALTERM_SHELL_INTEGRATION" && -z "$_LOCALTERM_OSC133_INJECTED" ]]; then
  _LOCALTERM_OSC133_INJECTED=1

  # Tell the terminal we support OSC 133.
  printf '\eP\e]133;E\e\\'

  # precmd: fires before each prompt
  # Emit command end with exit code, then prompt start
  __localterm_precmd() {
    local exit_code=$?
    printf '\e]133;D;%s\e' "$exit_code"
    printf '\e]133;A\e'
  }

  # preexec: fires before each command
  # Emit command start
  __localterm_preexec() {
    printf '\e]133;C\e'
  }

  # Install zsh hooks
  precmd_functions+=(__localterm_precmd)
  preexec_functions+=(__localterm_preexec)
fi
