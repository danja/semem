find ./ -type f -printf '%s %p\n' | sort -nr | head -30 | awk '{printf "%s %s\n", $1, $2}' | numfmt --to=iec --field=1 | sort -hr
