#!/bin/bash
# PostToolUse hook for ExitPlanMode
# Suggests running check-your-plan skill to validate the plan before implementation

cat > /dev/null  # consume stdin

echo '{"decision": "block", "reason": "Plan created. Run the check-your-plan skill (say \"check your plan\") to validate this plan before proceeding with implementation. This catches hallucinated file paths, pattern violations, and scope creep before code is written."}'
