# FinalTerm / OSC 133 shell integration for bash
# https://gitlab.com/gnachman/iterm2/-/wikis/shell-integration
# Emits structured escape sequences so localterm can detect:
# - Prompt boundaries (OSC 133;A / OSC 133;B)
# - Command start (OSC 133;B)
# - Command output (OSC 133;C)
# - Command end + exit code (OSC 133;D;<code>)

# Only enable for agent-mode sessions (injected by localterm server).
# Guard idempotent.
if [[ -n "$LOCALTERM_SHELL_INTEGRATION" && -z "$_LOCALTERM_OSC133_INJECTED" ]]; then
  _LOCALTERM_OSC133_INJECTED=1

  # Tell the terminal we support OSC 133.
  printf '\eP\e]133;E\e\\'

  # Wrap DEBUG/DEBUGGER: skip if these are set
  if [ -z "$BASH_DEBUG" ]; then
    # Mark prompt start (OSC 133;A)
    PS0='\[\e]133;A\e\]'

    # Mark prompt end (OSC 133;B) — emitted right before the command is read
    # This is tricky in bash. We use PROMPT_COMMAND to emit OSC 133;A before
    # each prompt, and PS0 to emit OSC 133;B before the command runs.
    # Unfortunately PS0 only fires for interactive shells in bash 4.4+.
    # Use DEBUG trap as fallback.
    
    # Pre-cmd: emit command start
    __localterm_preexec() {
      printf '\e]133;C\e'
    }
    
    # Post-cmd: emit command end with exit code
    __localterm_precmd() {
      local exit_code=$?
      printf '\e]133;D;%s\e' "$exit_code"
      printf '\e]133;A\e'  # next prompt start
    }
    
    # Install the hooks
    if [ -z "$PROMPT_COMMAND" ]; then
      PROMPT_COMMAND="__localterm_precmd"
    else
      PROMPT_COMMAND="__localterm_precmd;${PROMPT_COMMAND#;}"
    fi
    
    # For preexec, use DEBUG trap (best-effort, fires on every simple command)
    # This is a known limitation: only fires for the first command in a pipeline.
    trap '__localterm_preexec' DEBUG
  fi
fi
