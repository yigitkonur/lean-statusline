# `termstandard/colors` — canonical terminal truecolor spec

**URL:** https://github.com/termstandard/colors
**Scraped:** 2026-04-21
**Relevance:** This is the canonical community spec for how terminals should advertise 24-bit truecolor support. It is the successor of the well-known `XVilka/8346728` gist (which now redirects here). Every popular detection library (chalk/supports-color, nu-ansi-term, charmbracelet/colorprofile, go-runewidth) treats this doc as the source of truth.

## Verbatim excerpts

### How truecolor is advertised

> VTE, [Konsole](https://bugs.kde.org/show_bug.cgi?id=371919) and [iTerm2](https://gitlab.com/gnachman/iterm2/issues/5294) all advertise truecolor support by placing `COLORTERM=truecolor` in the environment of the shell user's shell. This has been in VTE for a ...

### The `COLORTERM` content rule

> The S-Lang library has a check that `$COLORTERM` contains either "truecolor" or "24bit" (case sensitive).

### Terminfo RGB capability

> Terminfo has supported the 24-bit TrueColor capability since ncurses-6.0-20180121, under the name "RGB". You need to use the "setaf" and "setab" commands to set the foreground and background respectively.

### Reliability caveats — why `COLORTERM` is not a silver bullet

> Having an extra environment variable (separate from TERM) is not ideal: by default it is not forwarded via sudo, ssh, etc, and so it may still be unreliable even where support is available in programs. (It does however err on the side of safety: it does not advertise support when it is not actually supported, and the programs should fall back to using 8-bit color.)

### SSH / sudo mitigation

> These issues can be ameliorated by adding `COLORTERM` to:
> - the `SendEnv` list in `/etc/ssh/ssh_config` on ssh clients;
> - the `AcceptEnv` list in `/etc/ssh/sshd_config` on ssh servers; and
> - the `env_keep` list in `/etc/sudoers`.

### Shell-rc fallback

> Ideally any terminal that really supports truecolor would set this variable; but as a work-around you might need to put a check in your shell's start-up file (e.g. `/etc/profile` or `~/.profile` or `~/.bashrc` or `~/.zshrc`) to set `COLORTERM=truecolor` when `$TERM` matches any terminal type known to have working truecolor:
>
> ```sh
> case $TERM in
>   iterm       |\
>   vte*        |\
>   *-truecolor ) export COLORTERM=truecolor ;;
> esac
> ```

### Interactive detection via escape sequences

> In an interactive program that can read terminal responses, a more reliable method is available that is transparent to sudo & ssh. Simply try sending a TrueColor escape sequence to the terminal, followed by a query to ask what color it currently has. If the response indicates the same color as was just set, then TrueColor is supported.
>
> If the response indicates an 8-bit color, or does not indicate a color, or if no response is forthcoming within a few centiseconds, then TrueColor is probably unsupported.

### Truecolor escape-sequence test snippets

Two forms shown in the spec:

```sh
printf '\e[%u;2;%u;%u;%um%s\e[m\n' "$fgbg" "$red" "$green" "$blue" TRUECOLOR
```

```sh
printf '\e[48:2:1:2:3m\eP$qm\e\\' ; xxd -g1
```

> Keep in mind that it is possible to use both ';' and ':' as Control Sequence delimiters.

## Implications for `lean-statusline`

1. `COLORTERM=truecolor` OR `COLORTERM=24bit` (both case-sensitive) is the single canonical positive signal.
2. We cannot do "an interactive escape-and-read probe" because `lean-statusline` is spawned by Claude Code, does not own the TTY, and must emit its output quickly without a round-trip.
3. The shell-rc workaround is out of our hands — we must be tolerant of missing `COLORTERM` and emit truecolor anyway. That is the only practical option.
4. SSH-stripped COLORTERM cannot be repaired by us; the right user-facing message is "set `COLORTERM=truecolor` in your shell rc".
