#!/usr/bin/env bash
# Exports KEY=VALUE pairs from a .env file literally (no shell expansion), stripping CR.
# Usage: source scripts/export-dotenv.sh [path-to-.env]
_dotenv="${1:-.env}"
if [ -f "$_dotenv" ]; then
	while IFS= read -r _line || [ -n "$_line" ]; do
		_line="${_line%$'\r'}"
		case "$_line" in
			''|'#'*) continue ;;
		esac
		case "$_line" in
			*=*)
				_key="${_line%%=*}"
				_val="${_line#*=}"
				_key="${_key## }"; _key="${_key%% }"
				case "$_val" in
					\"*\") _val="${_val#\"}"; _val="${_val%\"}" ;;
					\'*\') _val="${_val#\'}"; _val="${_val%\'}" ;;
				esac
				export "$_key=$_val"
				;;
		esac
	done < "$_dotenv"
fi
unset _dotenv _line _key _val
